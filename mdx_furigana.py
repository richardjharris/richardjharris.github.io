#!/usr/bin/env python
# -*- coding: utf8 -*-

"""
mdx_furigana - support for furigana (Ruby tags)

Syntax is identical to japanese.stackoverflow.com, namely:

[Kanji]{kana} e.g. [東京]{とうきょう} [感]{かん}じる

Square brackets are optional e.g. 根本{ねもと}, 公{おおやけ}

More convenient form: [飛び越える]{とびこえる}

Pitch accent support: [まだ]{HL}

Manually specify how to assign readings to kanji:

食堂{しょく・どう}, 文字を[強調]{﹅・﹅}する

"""

import regex
import markdown
from markdown.util import etree

FURIGANA_RE = regex.compile(r'''
    ^(.*?)(?|
        # [飛び越える]{とびこえる} syntax
        (?: \[ (?P<kanji>.+?) \] \{ (?P<furigana>.+?) \} )
      |
        # 漢字{かんじ} syntax
        (?: (?P<kanji>\p{Han}[\p{Hiragana}\p{Han}]*?)
        \{ (?P<furigana>.*?) \} )
      |
        # ふりがな{HLL} syntax (also used for へ{e} etc.)
        (?: (?P<kanji>\p{Hiragana}+?)
        \{ (?P<furigana>.*?) \} )
    )(.*?)$
''', flags=regex.VERBOSE | regex.DOTALL)

class FuriganaExtension(markdown.Extension):
    def extendMarkdown(self, md, md_globals):
        # We use regex (not re) so compile our own regex and
        # give Pattern's constructor a dummy.
        pat = FuriganaPattern('')
        md.inlinePatterns.add('furigana', pat, '_end')

class FuriganaPattern(markdown.inlinepatterns.Pattern):
    def getCompiledRegExp(self):
        return FURIGANA_RE

    def handleMatch(self, m):
        kanji = m.group('kanji')
        furigana = m.group('furigana')
        if regex.fullmatch('[HL]+', furigana, flags=regex.I):
            html = self.make_pitch_html(kanji, furigana)
        elif '・' in furigana:
            # Manually specified reading
            html = self.make_ruby_html_fixed(kanji, furigana)
        else:
            html = self.make_ruby_html(kanji, furigana)
        # Wrap in a valid tag, or etree will complain
        tree = etree.fromstring("<span>" + html + "</span>")
        tree.tag = None
        return tree

    @staticmethod
    def make_pitch_html(kanji, pitch):
        prev = None
        output = ''

        def _span(cls):
            return '<span class="' + cls + '">'
        _close = '</span>'

        for mora, hl in zip(kanji, pitch.lower()):
            if prev != hl:
                if prev:
                    output += _close + _span('tone-' + hl + '-change')
                else:
                    output += _span('tone-' + hl)
            output += mora
            prev = hl

        if prev:
            output += _close
            output = _span('tone-container') + output + _close

        return output

    @staticmethod
    def make_ruby_html_fixed(kanji, furigana):
        furigana = furigana.split('・')
        def fillSlot(m):
            return '<ruby>{}<rt>{}</rt></ruby>'.format(m.group(0), furigana.pop(0))
        return regex.sub('\p{Han}', fillSlot, kanji)

    @staticmethod
    def make_ruby_html(kanji, furigana):
        # Replace kanji with placeholders
        pattern = regex.sub(r'\p{Han}+', "(.+)", kanji)
        # Substitute in the reading to fill those placeholders
        match = regex.match(pattern, furigana)
        if match:
            furigana_grouped = list(match.groups())
            def buildTag(m):
                this_kanji = m.group(0)
                this_furigana = furigana_grouped.pop(0)
                if this_kanji == this_furigana:
                    return this_kanji
                else:
                    return '<ruby>{}<rt>{}</rt></ruby>'.format(this_kanji, this_furigana)

            output = regex.sub(r'(\p{Han}+)', buildTag, kanji)
        else:
            # Fall back to full tag
            output = '<ruby>' + kanji + '<rt>' + furigana + '</rt></ruby>'
        return output

def makeExtension(**kwargs):
    return FuriganaExtension(**kwargs)


