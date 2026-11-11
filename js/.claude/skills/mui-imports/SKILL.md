---
name: mui-imports
description: Rules for importing MUI (Material-UI) components and icons. Use when adding or editing imports from @mui/material or @mui/icons-material, or when MUI commit hooks fail.
---

# MUI Import Rules

Imports must use the **main package entry point**, not subpaths. This ensures proper module resolution when the package is installed from npm. Enforced by `.husky/no_mui_subpath_imports.sh` on commit.

## Rules

### @mui/material

❌ **Wrong** (subpath):
```js
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
```

✅ **Correct** (named imports from main package):
```js
import { Button, TextField } from '@mui/material'
```

### @mui/icons-material

❌ **Wrong** (subpath):
```js
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
```

✅ **Correct** (named imports from main package):
```js
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material'
```

## Summary

| Package            | Use                                        | Avoid                           |
|--------------------|--------------------------------------------|---------------------------------|
| `@mui/material`    | `import { Component } from '@mui/material'` | `import Component from '@mui/material/Component'` |
| `@mui/icons-material` | `import { Icon } from '@mui/icons-material'` | `import Icon from '@mui/icons-material/Icon'` |
