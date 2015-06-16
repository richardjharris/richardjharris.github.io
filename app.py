from blog.page import Pages
from flask import Flask, render_template, abort

app = Flask(__name__)
pages = Pages.from_dir()  # global?

@app.context_processor
def inject_pages():
    """Supply information used base template to all pages"""
    return dict(
        all_categories = pages.category_counts(),
        all_tags = pages.tag_counts(),
    )

@app.route("/")
def index():
    return render_template('index.html', pages=pages)

@app.route('/about/')  # /about also redirects here
def about():
    return render_template('about.html')

@app.route('/tag/<string:tag>/')
def tag(tag):
    tagged = pages.with_tag(tag)
    return render_template('tag.html', pages=tagged, tag=tag)

@app.route('/category/<string:category>/')
def category(category):
    # TODO: casing
    catpages = pages.with_category(category)
    return render_template('category.html', pages=catpages, category=category)

@app.route('/<path:slug>/')
def page(slug):
    try:
        page = pages[slug]
    except KeyError:
        abort(404)
    return render_template('page.html', page=page)

if __name__ == "__main__":
    app.run(port=8000, debug=True)