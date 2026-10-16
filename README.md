# Workflow wire

Workflow run and request IDs, plus the generic graph reply schemas (catalog,
start, status, cancel, review, schedules and event triggers), live at the root.
Hub and the Trellis App consume this package without an App-to-App dependency.

## Packed consumer readiness

Run `pnpm run build`, `pnpm run pack` and `pnpm run stranger` in this package.
The maintained stranger proof installs only package tarballs into a fresh npm
consumer, checks the exact shipped files, runs the public runtime fixture and
compiles every JavaScript entrypoint with strict NodeNext and no library-check
skip. This qualification does not publish npm releases or push a repository
split.

See [LICENSE](LICENSE) for the license and the package manifest for its public
repository destination.

## Quick start

```ts
import { workflowRunRequestIds } from "@fungi.computer/workflows-wire";

const requestId = workflowRunRequestIds.request.generate();
console.log(workflowRunRequestIds.request.parse(requestId).ok);
```

## Core concepts

Identifiers and decoded wire values are data contracts. This package does not
own workflow execution, App admission or run persistence.

## Examples and checks

The packed runtime fixture at `test/stranger/runtime.mjs` exercises the public
API in a fresh consumer. Run `pnpm run stranger` after building the package.

## Install

Install the package tarball with npm. The manifest pins its runtime
dependencies.

## Contribute and license

See [LICENSE](LICENSE) for the MIT terms.
