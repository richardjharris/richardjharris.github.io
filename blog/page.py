"""View, filter and edit markdown pages."""
import os
import regex
import yaml
from collections import OrderedDict, Counter
from operator import methodcaller
from itertools import takewhile
from datetime import datetime
from slugify import slugify
from blog.render import render_page
from html import escape as html_escape

class Page(object):
    """Represents an article (content and metadata. Can be saved and loaded"""
    def __init__(self, title, body, path=None, category=None,
            tags=None, date=None, summary=None, star=False, slug=None):
        self.title = title
        self.body = body
        self.category = category
        self.tags = tags if tags else set()
        self.date = date if date else datetime.today()
        self.summary = summary
        self.star = star
        self.path = path
        # If no slug provided, generate one automatically
        self.slug = slug or self._generate_slug()

    def __repr__(self):
        return "Page(" + repr(self.slug) + ")"

    @property
    def html(self):
        return render_page(self.body)

    # For titles, we support a simple and explicit form of furigana
    # (less complex than the articles do)
    FURIGANA_RE = regex.compile(r'\[(.*?)\]\{(.*?)\}')

    @property
    def title_html(self):
        """Title with furigana represented as ruby tags"""
        def makeTag(m):
            return "<ruby>{}<rt>{}</rt></ruby>".format(*m.groups())
        title_safe = html_escape(self.title)
        html = regex.sub(self.FURIGANA_RE, makeTag, title_safe)
        return html

    @property
    def title_text(self):
        """Title with furigana removed; for page title"""
        return regex.sub(self.FURIGANA_RE, lambda m: m.group(1), self.title)

    @property
    def title_reading(self):
        """Title with kanji replaced with furigana; used for slugs"""
        return regex.sub(self.FURIGANA_RE, lambda m: m.group(2), self.title)

    @classmethod
    def load(cls, path):
        mtime = datetime.fromtimestamp(os.path.getmtime(path))
        lines = open(path)
        # Read meta info until an empty line is encountered
        meta = yaml.load('\n'.join(takewhile(methodcaller('strip'), lines)))
        # Lowercase (standardise) key case
        meta = dict((k.lower(), v) for k, v in meta.items())
        content = ''.join(lines)
        tags = { tag.strip() for tag in meta.get('tags', '').split(',') }
        tags.discard('')
        # YAML automatically makes a datetime obj for us
        date = meta.get('date', mtime)
        return cls(
            title = meta['title'],
            slug = meta.get('slug', None),
            body = content,
            category = meta.get('category', None),
            tags = tags,
            date = date,
            summary = meta.get('summary', None),
            star = ('star' in meta),
            path = path,
        )

    def save(self):
        with open(self.path, 'w') as handle:
            meta = collections.OrderedDict()
            meta['title'] = self.title
            meta['slug'] = self.slug
            if self.category:
                meta['category'] = self.category
            if self.tags:
                meta['tags'] = ', '.join(self.tags)
            meta['date'] = self.date.strftime('%Y-%m-%d %H:%m')
            if self.summary:
                meta['summary'] = self.summary
            if self.star:
                meta['star'] = '*'
            w.write(yaml.dump(meta))
            w.write("\n")
            w.write(self.body)

    def _generate_slug(self):
        return slugify(self.title_reading, max_length=70, word_boundary=True)

class Pages(object):
    """Filterable collection of pages under the given directory"""

    def __init__(self, directory='pages/'):
        self._cache = {}
        self.directory = directory
        self.reload()

    def reload(self):
        paths = self._walk(self.directory)
        pages = []
        for path in paths:
            cached = self._cache.get(path)
            mtime = os.path.getmtime(path)
            if cached and cached[1] == mtime:
                page = cached[0]
            else:
                page = Page.load(path)
                self._cache[path] = (page, mtime)
            pages.append(page)
        self._pages = pages

    def all(self):
        return self._pages

    def with_tag(self, tag):
        return self._filter(lambda p: tag in p.tags)

    def with_category(self, category):
        return self._filter(lambda p: p.category and p.category == category)

    def tag_counts(self):
        return Counter(tag for page in self.all() for tag in page.tags)

    def category_counts(self):
        return Counter(page.category for page in self.all() if page.category)

    def __getitem__(self, key):
        if type(key) == int:
            return self._pages[key]
        else:
            for page in self.all():
                if page.slug == key:
                    return page
            raise KeyError("no such page")

    def _filter(self, f):
        return filter(f, self.all())

    @staticmethod
    def _walk(directory):
        for subdir, _, filenames in os.walk(directory):
            for fn in filenames:
                if fn.endswith('.md'):
                    yield subdir + os.sep + fn
