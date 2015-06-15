#import markdown
from markdown import Markdown

EXTENSIONS = (
    'abbr_once',  # if used, can't use 'extra'
    'unichar',
    'smart_strong',
    'footnotes',
    'def_list',
    'tables',
    'codehilite(guess_lang=False)',
    'smarty',
    'attr_list',
    'autolink',
    'fenced_code',
)

def render_page(text):
    """Render Markdown article with custom extension list"""
    md = Markdown(extensions=EXTENSIONS)
    return md.convert(text)
