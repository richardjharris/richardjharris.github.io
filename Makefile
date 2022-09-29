.PHONY: build serve deps deploy

all: build

deps:
	pip install -r requirements.txt

build:
	python freeze.py
	cp -r static-root/* build/

deploy: build
	cd build && git init --initial-branch=main && git add -A && git commit -m 'deploy' \
		&& git push --force git@github.com:richardjharris/richardjharris.github.io.git gh-pages

serve:
	sleep 1 && xdg-open http://127.0.0.0:8000 &
	python run.py

