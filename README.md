## richardjharris.github.io source code

This is the source code for the blog at https://richardjharris.github.io/

The blog is a Flask app, using various custom Markdown extensions (files
starting with `mdx_`) for Unicode character tooltips, Japanese sentence
breakdowns, furigana and more.

The `frozen_flask` module is used to convert the dynamic Flask app to a
set of static HTML pages. Files in `static-root` are also copied to the
pageset root.

The static pageset is built and deployed to Github Pages using [Github
Actions](https://github.com/richardjharris/richardjharris.github.io/blob/main/.github/workflows/deploy.yml).

### Makefile targets

**deps**: install python dependencies (in a venv if you like)

**build**: build static pageset in `build` directory.

**serve**: serve the website as a Flask app and open browser. It will pick up local changes on browser refresh.

**deploy**: manually deploys website to Github Pages. Normally, this is done using Gitlab Actions on push.
