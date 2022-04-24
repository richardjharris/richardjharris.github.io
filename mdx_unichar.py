#!/usr/bin/env python
# -*- coding: utf8 -*-

"""
mdx_unichar - annotated unicode characters

This extension adds new syntax for annotation of Unicode characters.
Characters can be defined in several ways:

u{Σ} - wide char
u{GREEK CAPITAL LETTER SIGMA} - charname
u{U+03A3} or u{03A3} - charcode

The char will be rendered as a span element with class 'unichar'
and an appropriate title attribute containing the full name and code.

The following special characters can be added before the closing
brace:

' - char is a mark, prefix with U+25CC DOTTED CIRCLE.
+ - add full charname inline
# - add char number inline
! - char cannot be rendered, use number instead, # ignored
"""

import markdown
import re
import unicodedata
import markdown.inlinepatterns
from markdown.util import etree

UNICHAR_RE = r'u\{\s*(.*?)([#\'+!]*)\s*\}'

class UnicharPattern(markdown.inlinepatterns.Pattern):
    def handleMatch(self, m):
        char, flags = m.group(2,3)
        flags = self.parseFlags(flags)
        if "!" in flags and '#' in flags:
            del flags['#']
        char = self.parseChar(char)
        name = self.getName(char)
        code = "%04X" % ord(char)

        tag = etree.Element('span')
        char_tag = etree.SubElement(tag, 'span', {
            'class': 'unichar',
            'title': "%s (U+%s)" % (name, code),
            'data-name': name,
            'data-code': code,
        })
        char_tag.text = self.displayChar(char, flags)

        info = self.postInfo(char, flags)
        if info:
            info_tag = etree.SubElement(tag, 'span')
            info_tag.text = ' ' + info

        return tag

    def parseFlags(self, flags):
        return { x: 1 for x in list(flags) }

    def parseChar(self, char):
        """Converts wide char, number or name into Unicode char with len=1"""
        ishex = re.match("^(?:U+)?([0-9A-F]{2,})$", char, re.I)
        if len(char) == 1:
            return char
        elif ishex:
            return chr(int(ishex.group(1), 16))
        else:
            try:
                return unicodedata.lookup(char.encode('ascii'))
            except KeyError:
                raise Exception("Invalid u{...} value '" + char + "'")

    def displayChar(self, char, flags):
        if "!" in flags:
            return "U+%04X" % ord(char)
        else:
            # ElementTree escapes it for us, using HTML entities if available.
            html = char
            if "'" in flags:
                html = u'\u25CC' + char
            return html

    def postInfo(self, char, flags):
        html = []
        if "+" in flags:
            html.append(self.getName(char))
        if "#" in flags:
            html.append("(U+%04X)" % ord(char))
        return ' '.join(html)

    def getName(self, char):
        try:
            return unicodedata.name(char)
        except ValueError:
            codepoint = ord(char)
            # Python doesn't have these yet
            if 0x1f1e6 <= codepoint <= 0x1f1ff:
                letter = chr( ord('a') + (codepoint - 0x1f1e6) ).upper()
                return "REGIONAL INDICATOR SYMBOL LETTER '" + letter + "'"
            elif codepoint == 0x1f3e9:
                return "LOVE HOTEL"
            elif codepoint == 0x1f4a9:
                return "PILE OF POO"
            else:
                return "<unnamed %04X>" % ord(char)

class UnicharExtension(markdown.Extension):
    def extendMarkdown(self, md, md_globals):
        pat = UnicharPattern(UNICHAR_RE)
        md.inlinePatterns.add('unichar', pat, '_end')

def makeExtension(**kwargs):
    return UnicharExtension(**kwargs)
