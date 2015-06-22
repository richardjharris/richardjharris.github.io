"""
mdx_reibun - add support for example sentences and breakdowns

Desired HTML
<div class="example-sentence">
  <p class="jp">...</p>
  <p class="en">...</p>
</div>

Syntax:
// 日本語の例文
/// English example sentence (optional)

Breakdown mode:

// 今日さくらん家で晩ご飯((を))食べさしてもろた
//1 さくらん[家]{ち} Slang さくらんの家{うち} "Sakura's House"
//2* 食{た}べさして Infl 食べさす (te) 食べる (causative - to allow)
//3 もろた Infl もらった (slang) もらう (past)
/// Today, I was [treated]3 to [dinner]2 at [Sakura's house]1.  ??
( * = highlight I guess)

"""

from markdown import Extension
from markdown.blockprocessors import BlockProcessor
from markdown.util import etree, AtomicString
from itertools import takewhile
import regex

class ReibunProcessor(BlockProcessor):
    """ Process definition lists"""

    def test(self, parent, block):
        return block.startswith('//')

    def run(self, parent, blocks):
        block = blocks.pop(0)

        # Japanese sentence comes first
        div = etree.SubElement(parent, 'div', {'class': 'example-sentence'})
        jp = self._build_sentence(div, '//', 'jp', block)
        en = self._build_sentence(div, '///', 'en', block)

        # Now handle annotations, if given
        for annotation in regex.finditer('''
                ^//(?P<num>\d+)\s+
                (?P<word>.*?)\s+
                (?P<detail>.*?)$
        ''', block, regex.VERBOSE | regex.M | regex.S):
            jp = self._inject_annotation(jp, annotation)

        # Remove English sentence if empty
        if len(en) == 0 and len(en.text or '') == 0:
            div.remove(en)

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
        for index in range(start, len(tree) + 1):
            node = tree[index] if index >= 0 else tree
            text = node.tail if index >= 0 else node.text
            pos = text.index(word)
            if pos == -1:
                continue  # no match on this node

            before, after = text[:pos], text[pos+len(word):]
            if node == tree:
                node.text = before
            else:
                node.tail = before
            span = etree.Element('span', {
                'class': 'an',
                'title': annotation['detail'],
            })
            span.text = word
            span.tail = after
            tree.insert(index + 1, span)
            return tree
        raise Exception("unable to find {!r} injection point".format(annotation['word']))

    def _find_last_annotation(self, tree):
        matching = [index for index in range(len(tree))
                        if tree[index].tag == 'span'
                        and tree[index].get('class', '') == 'an']
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
