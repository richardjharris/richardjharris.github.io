#!/usr/bin/env python
# -*- coding: utf8 -*-

"""
mdx_autolink - link shorthand

Adds new autolink syntax [[...]]

Examples:

[[perlguts]] - link to perldoc
[[perlfunc:open]] - link to perldoc functions
[[My::Module]] - link to metacpan (must contain '::')
[[open::]] - link to metacpan for 'open' module
[[w:Dotted_and_dotless_I]]: link to en wikipedia

May include an optional fragment identifier:

[[perluniprops#Misc]] - link to perluniprops.html#Misc

"""
from markdown import Extension
from markdown.inlinepatterns import Pattern
from markdown.util import etree
import re

class AutoLinkExtension(Extension):
    def extendMarkdown(self, md, md_globals):
        # append to end of inline patterns
        AUTOLINK_RE = r'\[\[([:\w0-9_-]+)(#.*?)?\]\]'
        md.inlinePatterns.add('autolink', AutoLinks(AUTOLINK_RE), "<not_strong")

class AutoLinks(Pattern):
    def handleMatch(self, m):
        label = m.group(2).strip()
        fragment = m.group(3)
        return self.url(label, fragment)

    def url(self, label, fragment):
        url = ''
        if re.match(r'^perl\w+$', label):
            url = 'https://perldoc.perl.org/' + label + '.html'
        elif re.match(r'^perlfunc:(\w+)$', label):
            func = label.split(':')[1]
            url = 'https://perldoc.perl.org/functions/' + func + '.html'
            label = func
        elif re.match(r'^w:(.*?)$', label):
            page = label.split(':')[1]
            url = 'https://en.wikipedia.org/wiki/' + page
            label = re.sub('_', ' ', page)
        elif re.search(r'::', label):
            label = re.sub(r'::$', '', label)
            url = 'https://metacpan.org/module/' + label

        if url:
            if fragment:
                url += fragment
            return self.urlElement(url, label)
        else:
            raise Exception("unknown autolink form " + label)

    def urlElement(self, url, label):
        a = etree.Element('a')
        a.text = label
        a.set('href', url)
        return a

def makeExtension(**kwargs):
    return AutoLinkExtension(**kwargs)
