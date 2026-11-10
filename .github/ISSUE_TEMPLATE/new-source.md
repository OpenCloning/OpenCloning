---
name: New source
about: Adding a new type of source and corresponding functionality
title: 'New source: <name-of-source>'
labels: new-source
assignees: ''

---

## Description

<!-- Add your description here -->

## Checklist

You can do some of these tasks in parallel, specially if you need to wait for approval, but it's good to keep in mind the intended order. The backend is in `python/` and the frontend in `js/`; both go in the same PR.

* [ ] Make a branch in [OpenCloning_LinkML](https://github.com/OpenCloning/OpenCloning_LinkML) where you implement the new source (see extra docs in there) on how to do this.
* [ ] Point `opencloning-linkml` at your branch (commit): edit `python/packages/opencloning/pyproject.toml` and `[tool.uv.sources]` as needed, then run `uv lock` in `python/`. See [uv Git dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/#git).
* [ ] Implement the new source in the backend. You will need to add a new endpoint in `main.py` and a new class in `pydantic_models.py` that will handle the new source. You can use the existing sources as a template. Note that you can add extra validation or methods (see examples as well).
* [ ] If the source is a repository_id, make sure to add the appropriate redirect in `endpoints/external_import.py`, endpoint `/repository_id`.
* [ ] Write tests for the new source under `python/packages/opencloning/tests/` (see existing endpoint tests). You can use the existing tests as a template.
* [ ] Implement the frontend functionality:
  * [ ] Add it to `Source.jsx`.
  * [ ] Include a "finished source text" in `FinishedSource.jsx`.
  * [ ] Include it in the right selection group in `SourceTypeSelector.jsx` (whether it takes no input, a single input or 1+ inputs).
  * [ ] Include the endpoint in the backend API that the source uses in `sourceFunctions.js` > `classNameToEndPointMap`.
  * [ ] You may have to add it to the right place in `source_input_constrains.cy.js`.
  * [ ] If it has primers,
    * [ ] Prevent primers used in the source from being deleted in `PrimerList.jsx` > `getUsedPrimerIds`.
    * [ ] Implement the `shiftSource` and `mergePrimersInSource` functionality in `cloning_utils.js`.
  * [ ] Make a test
* [ ] Once the tests pass, merge the PR of the new source in [OpenCloning_LinkML] and make a release of the `opencloning-linkml` package.
* [ ] Update the dependency to the new released version: set `opencloning-linkml` in `python/packages/opencloning/pyproject.toml` and run `uv lock` in `python/` (see [PyPI versions](https://pypi.org/project/opencloning-linkml/)).
* [ ] Merge the PR into master.
* [ ] You are done!
