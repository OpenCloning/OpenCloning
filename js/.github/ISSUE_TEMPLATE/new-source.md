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

* [ ] Add it to `Source.jsx`.
* [ ] Include a "finished source text" in `FinishedSource.jsx`.
* [ ] Include it in the right selection group in `SourceTypeSelector.jsx` (whether it takes no input, a single input or 1+ inputs).
* [ ] Include the endpoint in the backend API that the source uses in `sourceFunctions.js` > `classNameToEndPointMap`.
* [ ] You may have to add it to the right place in `source_input_constrains.cy.js`.
* [ ] If it has primers,
  * [ ] Prevent primers used in the source from being deleted in `PrimerList.jsx` > `getUsedPrimerIds`.
  * [ ] Implement the `shiftSource` and `mergePrimersInSource` functionality in `cloning_utils.js`.
* [ ] Make a test

