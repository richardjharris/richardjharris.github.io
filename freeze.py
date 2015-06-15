#!/usr/bin/env python
from flask.ext.frozen import Freezer
from app import app

freezer = Freezer(app)
if __name__ == '__main__':
    freezer.freeze()
