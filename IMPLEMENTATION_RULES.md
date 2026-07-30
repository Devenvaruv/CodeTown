# Implementation Rules

## General

- Build working slices, not disconnected scaffolding.
- Keep the extension runnable after each milestone.
- Prefer simple, typed code over premature abstraction.
- Document justified deviations from the specifications.
- Do not silently remove requirements.

## Architecture

- Keep parsing independent from rendering.
- Keep graph types in a shared module.
- Do not expose VS Code APIs to the webview.
- Use typed and validated message contracts.
- Avoid global mutable state.
- Use deterministic IDs.

## Parser

- Never execute workspace code.
- Use AST parsing, not regular expressions, for core imports and exports.
- Normalize paths consistently.
- Resolve actual module paths where possible.
- Continue after individual file failures.
- Preserve diagnostics.

## Layout

- Do not use random coordinates.
- Do not use a force-directed layout as the main layout.
- Do not allow roads to pass through buildings when avoidable.
- Keep positions stable across refreshes.
- Aggregate edges for collapsed folders.

## UI

- Prioritize readability over decorative detail.
- Keep file names visible.
- Do not show every edge label permanently.
- Hide external packages by default.
- Use semantic zoom.
- Support VS Code light and dark themes.
- Do not rely on color alone for status.

## Testing

- Every parser feature requires a fixture or unit test.
- Every bug fix should include a regression test where practical.
- Run tests before marking a milestone complete.
- Record commands and outcomes in `IMPLEMENTATION_STATUS.md`.

## Documentation

Maintain `IMPLEMENTATION_STATUS.md` with:

- current milestone
- completed tasks
- files changed
- commands run
- test outcomes
- known failures
- next task
- deviations from the specification

## Prohibited shortcuts

- static graph pretending to analyze a workspace
- hardcoded fixture-only implementation
- regex-only dependency extraction
- random graph placement
- swallowing parser errors
- rendering all edges and labels at once
- declaring completion without build and test evidence
