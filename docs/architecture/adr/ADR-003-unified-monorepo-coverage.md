# ADR-003: Unified Monorepo Test and Coverage Configuration

## Status

Superseded by: [ADR-006](ADR-006-split-client-server-architecture.md)

## Context

StreamDesk is structured as a monorepo containing client, server, and shared TypeScript code. Running separate test and coverage commands for each part fragments the coverage data, making it difficult to enforce a consistent automated regression coverage baseline across the entire codebase and complicating the CI pipeline configuration.

If coverage is fragmented, maintainers cannot easily see the overall testability of the system, and it becomes hard to enforce that critical boundaries (like shared permission logic) are adequately tested.

## Decision

We configured a **unified test and coverage script** (`npm run coverage`) that executes tests across the client, server, and shared modules and aggregates the results into a single coverage summary. 

This unified script is integrated as a mandatory automated quality requirement test in the CI pipeline for **changes covered by the configured CI triggers** (pull requests and configured branches), ensuring that submitted changes are evaluated against a holistic coverage baseline.

### Alternatives considered

- **Separate coverage commands per module.** Rejected because it fragments the coverage data, making it hard to get a holistic view of regression coverage and complicating CI reporting.
- **No coverage enforcement.** Rejected because it does not provide repeatable automated evidence that critical permission and access-control behavior remains testable over time.

## Consequences

### Positive

- **Holistic coverage view:** Provides a single source of truth for automated regression coverage across all architectural boundaries (client, server, shared).
- **Enforced testability:** Encourages developers to write tests for shared logic and cross-boundary interactions, as they contribute to the unified coverage report.
- **Simplified CI:** The CI pipeline only needs to run one coverage command and parse one report, simplifying the automation setup.

### Negative

- **Execution time:** The unified coverage command might take longer to execute than individual commands, though this is mitigated by CI caching.
- **Current test focus:** The coverage command is unified, but the current automated tests are concentrated around critical client/shared logic (like equipment permissions and protected route access control). Broader API and workflow-level coverage remains a follow-up.

## Quality Requirements Addressed

- **QR-003 (Automated Regression Coverage):** The unified configuration ensures that changes covered by the configured CI triggers run automated tests with coverage reporting for the configured client, server, and shared TypeScript sources, providing repeatable evidence of testability.
