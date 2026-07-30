# Parser Specification

## Supported files

Required:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`
- `.mts`
- `.cts`
- `.mjs`
- `.cjs`

## Default exclusions

- `node_modules`
- `.git`
- `.next`
- `dist`
- `build`
- `coverage`
- `out`
- `.turbo`
- generated declaration output
- minified files

Respect relevant workspace exclusions where practical.

## Imports to extract

### Named import

```ts
import { UserService, type User } from "./user";
```

### Default import

```ts
import React from "react";
```

### Namespace import

```ts
import * as utils from "./utils";
```

### Side-effect import

```ts
import "./styles.css";
```

Non-JS assets may be represented as unresolved or ignored according to configuration.

### Dynamic import

```ts
const page = await import("./page");
```

Only treat it as resolvable when the module specifier is a static string.

### CommonJS require

```ts
const config = require("./config");
```

Support simple static string `require` calls when practical.

## Exports to extract

- named function exports
- named class exports
- variables and constants
- interfaces
- type aliases
- enums
- namespaces
- default exports
- export lists
- re-exports
- export star

Examples:

```ts
export function createUser() {}
export class UserService {}
export type UserId = string;
export { parseUser };
export { User } from "./types";
export * from "./constants";
export default App;
```

## Module resolution

Resolution should account for:

- relative imports
- file extension inference
- `index` files
- `tsconfig.json` baseUrl
- TypeScript path aliases
- JavaScript config where supported
- package imports

Local workspace files become `targetFileId` connections.

Package imports become external package connections.

Unresolved imports remain diagnostics and unresolved edges if useful.

## Type-only classification

Mark a connection as type-only when every imported symbol is type-only or the declaration uses `import type`.

Mixed imports should remain runtime unless represented as split connections. The MVP may split mixed imports into runtime and type-only edges if implementation remains clear and deterministic.

## Re-export classification

These create `re-export` connections:

```ts
export { User } from "./user";
export * from "./constants";
```

## Reverse dependencies

After all connections are built, populate each target file's dependent connection IDs.

## Circular dependencies

Detect strongly connected components among local file dependencies.

Rules:

- a component with more than one file is circular
- a self-import is circular
- mark every edge inside the strongly connected component
- expose cycle membership for file and folder metrics

## File kind inference

Infer visual type from filename patterns, without affecting semantic correctness.

Examples:

- `*.service.*` → service
- `*.controller.*` → controller
- `*.route.*` or `routes.*` → route
- `*.repository.*` → repository
- `*.test.*`, `*.spec.*` → test
- `index.*` → index
- `main.*`, `app.*`, `server.*` → entry when appropriate
- React component naming or JSX presence → component

Unknown files use `other`.

## Partial failure

One invalid file must not stop the full project analysis.

Return diagnostics with:

- file path
- error summary
- severity

Continue building all valid graph data.
