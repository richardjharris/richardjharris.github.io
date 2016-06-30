"""Pages class represents one or more pages"""
import os
from .page import Page
from collections import Counter
from operator import attrgetter

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
            try:
                cached = self._cache.get(path)
                mtime = os.path.getmtime(path)
                if cached and cached[1] == mtime:
                    page = cached[0]
                else:
                    page = Page.load(path)
                    self._cache[path] = (page, mtime)
                pages.append(page)
            except Exception as err:
                print("Error loading page " + path)
                raise(err)

        self._pages = pages

    def all(self):
        return sorted(self._pages, key=attrgetter('date'), reverse=True)

    def featured(self):
        return self._filter(lambda p: p.featured)

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
