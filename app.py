import datetime
from blog.pages import Pages
from flask import Flask, render_template, abort

app = Flask(__name__)
pages = Pages()

@app.context_processor
def inject_pages():
    """Supply information used base template to all pages"""
    return dict(
        this_year = datetime.datetime.utcnow().year,
        all_categories = pages.category_counts(),
        all_tags = pages.tag_counts(),
    )

@app.before_request
def reload_pages():
    pages.reload()

@app.route("/")
def index():
    return render_template('index.html', pages=pages.all())

@app.route('/about/')  # /about also redirects here
def about():
    return render_template('about.html')

@app.route('/featured/')
def featured():
    return render_template('featured.html', pages=pages.featured())

@app.route('/tag/<string:tag>/')
def tag(tag):
    tagged = pages.with_tag(tag)
    return render_template('tag.html', pages=tagged, tag=tag)

@app.route('/category/<string:category>/')
def category(category):
    category = category.title()
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
