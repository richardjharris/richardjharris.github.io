from markdown import Markdown

EXTENSIONS = (
    'mdx_reibun',
#    'mdx_abbr_once',  # if used, can't use 'extra'
    'mdx_unichar',
    'footnotes',
    'def_list',
    'tables',
    'codehilite(guess_lang=False)',
    'smarty',
    'attr_list',
    'mdx_autolink',
    'fenced_code',
    'mdx_furigana',
)

def render_page(text):
    """Render Markdown article with custom extension list"""
    md = Markdown(extensions=EXTENSIONS)
    return md.convert(text)
