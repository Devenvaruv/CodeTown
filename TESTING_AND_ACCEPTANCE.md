# Testing and Acceptance Criteria

## Test layers

### Unit tests

Required for:

- path normalization
- file discovery and exclusions
- import extraction
- export extraction
- module resolution helpers
- graph construction
- reverse-dependency construction
- cycle detection
- folder aggregation
- deterministic layout
- message validation

### Integration tests

Use fixture projects.

Required fixtures:

1. Small TypeScript project
2. Nested folder project
3. Circular dependency project
4. Path alias project
5. Mixed JS/TS project
6. Project with unresolved import
7. Project with re-exports
8. Project with type-only imports

## Example fixture

```text
fixture/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── token.service.ts
├── users/
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.repository.ts
└── shared/
    └── validator.ts
```

Expected relationships must be asserted explicitly.

## Manual acceptance scenarios

### Scenario 1: Open a project

- Open fixture workspace.
- Run `Codebase Town: Open Map`.
- Confirm towns appear.
- Confirm no webview CSP or console errors.

### Scenario 2: Expand folder

- Expand `auth`.
- Confirm direct files appear.
- Confirm internal roads appear.
- Confirm unexpanded folders remain summarized.

### Scenario 3: Select file

- Select `auth.service.ts`.
- Confirm imports, exports, and dependents appear in details.
- Confirm connected roads highlight.
- Confirm unrelated nodes dim.

### Scenario 4: Open source

- Activate `Open file`.
- Confirm the correct source file opens in VS Code.

### Scenario 5: Search

- Search for `UserService`.
- Confirm the exporting file is returned.
- Confirm importing files are discoverable from the result.

### Scenario 6: Circular dependency

- Open circular fixture.
- Confirm all files and roads in the cycle are marked.

### Scenario 7: Refresh

- Add a local import to a file.
- Save the file.
- Confirm the map updates.
- Confirm existing town positions remain stable where possible.

## MVP acceptance checklist

- [ ] Command opens a working map.
- [ ] Real workspace files are analyzed.
- [ ] Folders render as towns.
- [ ] Files render as buildings.
- [ ] Local imports render as directed roads.
- [ ] Folder-level roads aggregate dependencies when collapsed.
- [ ] Folders can expand and collapse.
- [ ] Selecting a file shows imports.
- [ ] Selecting a file shows exports.
- [ ] Selecting a file shows reverse dependencies.
- [ ] Search finds files and exported symbols.
- [ ] Filters alter visible road types.
- [ ] Circular dependencies are visible.
- [ ] Selected files open in VS Code.
- [ ] Parser failures are reported without crashing the graph.
- [ ] Tests, type checking, and build pass.

## Performance acceptance

Target fixture:

- 500 source files
- 2,000 local connections

Expected behavior:

- extension host remains responsive
- progress is visible during analysis
- map interactions remain usable
- refresh is debounced

Exact timing targets should be measured and documented rather than invented.
