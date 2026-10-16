.PHONY: test lint backend-test extension-test extension-typecheck extension-build

test: lint backend-test extension-typecheck extension-test extension-build

lint:
	uv run --project backend ruff check backend

backend-test:
	uv run --project backend pytest -q backend/tests

extension-typecheck:
	npm --prefix extension run typecheck

extension-test:
	npm --prefix extension run test

extension-build:
	npm --prefix extension run build
