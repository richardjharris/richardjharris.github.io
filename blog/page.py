"""View, filter and edit markdown pages."""
import os
import regex
import yaml
import dateutil.parser
import collections
from operator import methodcaller
from itertools import takewhile
from datetime import datetime
from slugify import slugify
from blog.render import render_page
from html import escape as html_escape

class Page:
    """Represents an article (content and metadata. Can be saved and loaded"""
    def __init__(self, title, body, path=None, category=None,
            tags=None, date=None, summary=None, slug=None, visible=True):
        self.title = title
        self.body = body
        self.category = category
        self.tags = tags if tags else set()
        self.date = date if date else datetime.today()
        self.summary = summary
        self.path = path
        # If no slug provided, generate one automatically
        self.slug = slug or self._generate_slug()
        self.visible = visible

        # Normalise casing of category/tag
        if self.category:
            self.category = self.category.title()
            self.tags |= set([self.category.lower()])

    def __repr__(self):
        return "Page(" + repr(self.slug) + ")"

    @property
    def html(self):
        return render_page(self.body)

    @property
    def featured(self):
        return ('featured' in self.tags)

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
        lines = open(path)

        # Read meta info until an empty line is encountered
        meta = yaml.load('\n'.join(takewhile(methodcaller('strip'), lines)), Loader=yaml.SafeLoader)

        # Lowercase (standardise) key case
        meta = dict((k.lower(), v) for k, v in meta.items())

        title = meta.get('title', None)
        if title is None:
            raise Exception("Title is missing")

        content = ''.join(lines)

        tags = { tag.strip() for tag in meta.get('tags', '').split(',') }
        tags.discard('')

        date = meta.get('date', None)
        if type(date) is str:
            # YAML didn't parse this one (e.g. a date with no seconds)
            date = dateutil.parser.parse(meta['date'], dayfirst=True, yearfirst=True)
        else:
            # Try parsing the YYYY-MM-DD date out of the filename
            filename = os.path.basename(path)
            try:
                date = datetime.strptime(filename[:10], "%Y-%m-%d")
            except ValueError:
                pass

        if date is None:
            # Default to the modified time
            date = datetime.fromtimestamp(os.path.getmtime(path))
            
        return cls(
            title = meta['title'],
            slug = meta.get('slug', None),
            body = content,
            category = meta.get('category', None),
            tags = tags,
            date = date,
            summary = meta.get('summary', None),
            path = path,
            visible = 'hidden' not in meta,
        )

    # TODO(rjh) Not currently tested.
    def save(self):
        with open(self.path, 'w') as handle:
            meta = collections.OrderedDict()
            meta['Title'] = self.title
            meta['Slug'] = self.slug
            if self.category:
                meta['Category'] = self.category

            if self.tags:
                meta['Tags'] = ', '.join(self.tags)

            if self.date.strftime('%H:%m') == '00:00':
                meta['Date'] = self.date.strftime('%Y-%m-%d')
            else:
                meta['Date'] = self.date.strftime('%Y-%m-%d %H:%m')

            if self.summary:
                meta['Summary'] = self.summary

            if not self.visible:
                meta['Hidden'] = 'true'

            handle.write(yaml.dump(meta))
            handle.write("\n")
            handle.write(self.body)

    def _generate_slug(self):
        return slugify(self.title_reading, max_length=70, word_boundary=True)

