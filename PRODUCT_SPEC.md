# Product Specification

## Product name

Working name: **Codebase Town Visualizer**

## Product summary

Codebase Town Visualizer is a VS Code extension that turns a JavaScript or TypeScript project into a structured 2D town map.

Folders appear as towns or districts, files appear as buildings, and import/export relationships appear as directed roads. The user can zoom from project-level architecture into a folder, select a file, inspect its dependencies, and open the source directly in VS Code.

## Problem

Existing dependency graphs often fail on real projects because they:

- flatten folder hierarchy
- create overlapping edges
- use unstable force-directed layouts
- become unreadable in medium or large repositories
- show structure without useful symbol-level detail
- do not help developers build spatial memory of a codebase

## Product goal

Help a developer understand an unfamiliar codebase by answering:

- What folders make up this project?
- Which folders depend on one another?
- Which files are central?
- What does a selected file import and export?
- Which files depend on this file?
- What exact symbols travel across a dependency?
- Are there circular dependencies?
- Where is a given file or symbol located?

## Target users

- developers onboarding into an unfamiliar repository
- developers reviewing architecture
- developers debugging dependency chains
- technical leads identifying tightly coupled modules
- developers using AI coding agents who want a visual representation of project structure

## Core metaphor

| Code concept | Visual concept |
|---|---|
| Project | World/map |
| Folder | Town/district |
| Subfolder | Neighborhood |
| File | Building/house |
| Import | Directed road |
| Re-export | Transfer road |
| Exported symbol | Building entrance or road label |
| External package | Destination outside the map |
| Circular dependency | Warning road |
| New file | Building under construction |
| Deleted file | Removed building |

## MVP scope

### Included

- JavaScript and TypeScript workspaces
- local static imports
- type-only imports
- dynamic imports when statically resolvable
- re-exports
- folder hierarchy
- file nodes
- exported symbol extraction
- reverse-dependency calculation
- deterministic 2D layout
- folder expand/collapse
- pan and zoom
- file selection
- details panel
- search for files and exported symbols
- filters for dependency types
- circular dependency highlighting
- open file in editor
- workspace refresh

### Excluded from MVP

- runtime call tracing
- live debugger integration
- language support beyond JS/TS
- full function-call graph
- animated AI agents
- collaborative map editing
- architecture rule enforcement
- cloud sync
- repository history animation
- interior room visualization for functions/classes

## Future versions

### V2

- symbol-level dependency paths
- building interiors for classes and functions
- git diff overlays
- architecture metrics
- dependency health warnings
- layout persistence per workspace

### V3

- AI-agent activity overlay
- file read/edit/create/delete animation
- before-and-after codebase map comparison
- runtime call traffic
- shared map links or exports

## Success criteria

The MVP succeeds when a developer can analyze a real TypeScript project and understand its major folder and file dependencies faster than by browsing the file tree alone.
