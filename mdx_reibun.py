"""
mdx_reibun - add support for example sentences and breakdowns

Basic syntax:
 // 日本語の文章 (Japanese sentence)
 /// English sentence  
 /// (Hard linebreaks are also supported with two spaces)

Optional sentence annotations:
// 今日さくらん家で晩ご飯((を))食べさしてもろた
//1 さくらん[家]{ち} Slang for さくらんの家{うち}, "Sakura's House"
//2! 食{た}べさして Infl 食べる -> 食べさす (causative form, "to allow to eat") -> 食べさして (te-form). Causative may mean either 'to allow to eat' or 'to force to eat' but coupled with the もらう after, it becomes 'to be allowed to eat'.
//3 もろた Infl もらう -> まらった (past) -> もろた (slang)
Not implemented yet:
/// Today, I was [treated]3 to [dinner]2 at [Sakura's house]1.  ??

You can skip furigana if already specified:
// 水馬{あめんぼ}　赤い{あかい}な　あいうえお
//1 水馬 water strider; pond skater

Separate multiple lines with //-
Specify alternate content for tooltip:
// 納戸{なんど}に　ぬめって　なにねばる
//3 ねばる:粘る to be sticky
 (furigana automatically added)
Or:
// 鳩{はと}ぽっぽ　ホロホロ　はひふへほ
//2 ぽっぽ:ぽっぽ(と) puffling, chugging

TODO:
 - remove need for //-
 - make the alternate reading thing (ねばる:粘る) saner

"""

from markdown import Extension, Markdown
from markdown.blockprocessors import BlockProcessor
from markdown.util import etree, AtomicString
from itertools import takewhile
import regex

class ReibunProcessor(BlockProcessor):
    """ Process definition lists"""

    def __init__(self, parser):
        self._markdown_instance = Markdown(extensions=('mdx_furigana',))
        super().__init__(parser)

    def test(self, parent, block):
        return block.startswith('//')

    def run(self, parent, blocks):
        block = blocks.pop(0)

        parts = regex.split(r'//-\n', block)
        div = etree.SubElement(parent, 'div', {'class': 'breakdown'})
        for part in parts:
            self._make_breakdown(div, part)
        return div

    def _make_breakdown(self, parent, block):
        # Japanese sentence comes first
        div = etree.SubElement(parent, 'div', {'class': 'example-sentence'})
        jp = self._build_sentence(div, '//', 'jp', block)
        en = self._build_sentence(div, '///', 'en', block)

        # Now handle annotations, if given
        for annotation in regex.finditer('''
                ^//(?P<num>\d+)(?P<highlight>\!)?\s+
                (?P<word>.*?)(?: :(?P<display_word>.*?) )?\s+
                (?P<detail>.*?)$
        ''', block, regex.VERBOSE | regex.M | regex.S):
            jp = self._inject_annotation(jp, annotation)

        # Remove English sentence if empty
        if len(en) == 0 and len(en.text or '') == 0:
            div.remove(en)

        return div

    def _build_sentence(self, parent, prefix, css_class, block):
        """Extract all lines with the given prefix (either English or
           Japanese) and build an etree as a child of the given parent."""
        p = etree.SubElement(parent, 'p', {'class': css_class})
        p.text = ''
        pat = r'^' + regex.escape(prefix) + r'\s+(.*?)(  )?$'
        for line, nl in regex.findall(pat, block, regex.M | regex.S):
            if len(p) == 0:
                # No br tags yet, so use 'text' attribute as normal
                p.text += line
            else:
                # use the last br tag's 'tail' attribute
                if prefix == 'en':
                    p[-1].tail += ''
                p[-1].tail += line

            if nl:
                br = etree.SubElement(p, 'br')
                br.tail = ''

        return p

    def _inject_annotation(self, tree, annotation):
        """Inject the annotation into the sentence etree as a <span>"""
        word = self._strip_furigana(annotation['word'])
        # Find the node corresponding to the last annotation injected
        # Return as an index on tree
        start = self._find_last_annotation(tree)
        for index in range(start, len(tree)):
            node = tree[index] if index >= 0 else tree
            text = node.tail if index >= 0 else node.text
            pos = text.find(word)
            if pos == -1:
                continue  # no match on this node
            # Match any furigana after the word
            # stolen from mdx_furigana for now
            w = regex.escape(word)
            rgx = regex.compile(r'''('
                    (?: \[ ''' + w + r''' \] \{ (?P<furigana>.+?) \} )
                |
                    ''' + w + r'''\{ (?P<furigana>.*?) \}
                |
                    ''' + w + '''
                )
            ''', flags=regex.VERBOSE | regex.DOTALL)
            pos = rgx.search(text)
            assert pos
            furigana = pos.group('furigana')

            before, after = text[:pos.start(0)], text[pos.end(0):]
            if node == tree:
                node.text = before
            else:
                node.tail = before

            classes = ['an']
            if annotation['highlight']:
                classes.append('an-highlight')

            span = etree.Element('span', {
                'class': ' '.join(classes),
                'title': annotation['detail'],
                'data-annotation': self._build_annotation_html(annotation, furigana),
            })
            if furigana:
                span.text = '[' + word + ']{' + furigana + '}'
            else:
                span.text = word
            span.tail = after
            tree.insert(index + 1, span)
            return tree
        raise Exception("unable to find {!r} injection point".format(annotation['word']))

    def _markdown(self, markup, strip_p=False):
        """Generate HTML from Markdown. Mostly used for furigana."""
        html = self._markdown_instance.convert(markup)
        if strip_p:
            html = regex.fullmatch('<p>(.*?)</p>', html).group(1)
        return html

    def _build_ruby(self, word):
        """Convert markdown ruby markup such as 平仮名{ひりがな} to
           HTML and return it"""
        # Super hacky, we should refactor
        return self._markdown(word, strip_p=True)

    def _build_annotation_html(self, anno, furigana=None):
        """Convert annotation text content to HTML for tooltip display"""

        heading = anno['display_word'] or anno['word']
        if furigana and '{' not in heading:
            # Annotation provides no furigana reading, but we can use the
            # one from the example sentence.
            heading = '[' + heading + ']{' + furigana + '}'
        elif anno['display_word'] and \
            regex.search(r'\p{Han}', anno['display_word']) and \
            regex.fullmatch(r'\p{Hiragana}+', anno['word']):
            # Both provided??
            heading = '[' + anno['display_word'] + ']{' + anno['word'] + '}'

        # First is a heading with the word + furigana
        html = "<h3>" + self._build_ruby(heading) + '</h3><hr />'

        # Now convert the detail field. It may be either a free-form
        # explanation in Markdown, or the string 'Infl' followed by a
        # chain of '->'-separated words with optional explanation in
        # brackets.
        detail = anno['detail']
        if detail.startswith('Infl'):
            detail = regex.sub('^Infl\s*', '', detail)
            html += '<ul class="inflection">'
            # 'Infl' lines may also contain a free-form explanation
            # after a pipe-character, so take that out.
            infl_chain, *detail = detail.split('|', maxsplit=1)
            for stage in infl_chain.split('->'):
                word, explanation = regex.fullmatch(
                    r'\s*(.*?)\s*(?:\((.*?)\))?\s*', stage).groups()
                html += '<li><span class="word">' + self._build_ruby(word) + '</span>'
                if explanation:
                    html += ' &mdash; ' + self._markdown(explanation, strip_p=True)
                html += '</li>'
            html += '</ul>'
            if detail:
                detail = detail[0]
        if detail and len(detail):
            # Add regular information
            html += self._markdown(detail)
        return html

    def _find_last_annotation(self, tree):
        matching = [index for index in range(len(tree))
                        if tree[index].tag == 'span'
                        and 'an' in tree[index].get('class', '').split()]
        if matching:
            return matching[-1]
        else:
            return -1

    def _strip_furigana(self, word):
        """Remove []{} and {} furigana markup"""
        word = regex.sub(r'\[(.*?)\]\{.*?\}', r'\1', word)
        word = regex.sub(r'\{.*?\}', r'', word)
        return word

class ReibunExtension(Extension):
    """Add Japanese example sentence handling to Markdown."""
    def extendMarkdown(self, md, md_globals):
        md.parser.blockprocessors.add('reibun',
                                      ReibunProcessor(md.parser),
                                      '>ulist')

def makeExtension(**kwargs):
    return ReibunExtension(**kwargs)
