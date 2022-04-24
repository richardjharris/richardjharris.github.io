from markdown import Markdown

EXTENSIONS = (
    'mdx_reibun',
    'mdx_unichar',
    'footnotes',
    'def_list',
    'tables',
    'codehilite',
    'smarty',
    'attr_list',
    'mdx_autolink',
    'fenced_code',
    'mdx_furigana',
    'abbr',
)

EXTENSION_CONFIGS = {
    'codehilite': {
        'guess_lang': False,
    },
}

def render_page(text):
    """Render Markdown article with custom extension list"""
    md = Markdown(extensions=EXTENSIONS, extension_configs=EXTENSION_CONFIGS)
    return md.convert(text)
