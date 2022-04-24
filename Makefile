.PHONY: build serve

build:
	python freeze.py
	perl make_redirects.pl
	cp -r static-root/* build/
	git push --git-dir build

serve:
	sleep 1 && xdg-open http://127.0.0.0:8000 &
	python run.py

