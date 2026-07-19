# Quality Requirements

This document defines maintained measurable quality requirements for StreamDesk v3.0.0-rc.1.

## Table of Contents

- [QR-001: Equipment permission correctness](#qr-001-equipment-permission-correctness)
- [QR-002: Protected route access control](#qr-002-protected-route-access-control)
- [QR-003: Automated regression coverage](#qr-003-automated-regression-coverage)
- [QR-004: Calendar date manipulation correctness](#qr-004-calendar-date-manipulation-correctness)

## QR-001: Equipment permission correctness

**ISO/IEC 25010 sub-characteristic:** Functional correctness

**Scenario:** When a workspace user attempts to create, edit, or reserve equipment under the normal web application environment, the equipment permission evaluator shall return permission decisions matching the user's role, workspace ownership, and explicit equipment permissions for 100% of automated permission test cases.

**Why this matters:** Equipment actions affect inventory integrity and must not be granted or denied incorrectly.

**Linked quality requirement tests:** [QRT-001](quality-requirement-tests.md#qrt-001-equipment-permission-unit-test)

**Linked architecture decisions:** [ADR-001](architecture/adr/ADR-001-centralized-equipment-permissions.md)

## QR-002: Protected route access control

**ISO/IEC 25010 sub-characteristic:** Authenticity

**Scenario:** When a user opens a protected application route under the normal web application environment, the protected route wrapper shall block anonymous users, show an access restriction for users without the required permission, and render the protected content for authorized users for 100% of automated protected-route test cases.

**Why this matters:** Users must not access protected application areas without a valid authenticated identity and required permissions.

**Linked quality requirement tests:** [QRT-002](quality-requirement-tests.md#qrt-002-protected-route-component-test)

**Linked architecture decisions:** [ADR-002](architecture/adr/ADR-002-declarative-protected-route-wrapper.md)

## QR-003: Automated regression coverage

**ISO/IEC 25010 sub-characteristic:** Testability

**Scenario:** When a change is submitted through the protected repository workflow under the standard GitHub Actions CI environment, the test and coverage configuration shall run automated tests and produce coverage output for the configured client, server, and shared TypeScript source set before the change is considered Done.

**Why this matters:** Maintainers need repeatable automated evidence that critical permission, access-control, and scheduling behavior remains testable over time.

**Linked quality requirement tests:** [QRT-003](quality-requirement-tests.md#qrt-003-coverage-gate)

**Linked architecture decisions:** [ADR-006](architecture/adr/ADR-006-split-client-server-architecture.md)

## QR-004: Calendar date manipulation correctness

**ISO/IEC 25010 sub-characteristic:** Functional correctness

**Scenario:** When a user creates, moves, resizes, or edits a scheduled task or calendar item under the normal web application environment, the calendar date helper module shall preserve the intended date range, quarter-hour alignment, and minimum duration for 100% of automated date-helper test cases.

**Why this matters:** Calendar and task scheduling are core workflows for v3.0.0-rc.1. Incorrect date calculations can place tasks in the wrong time slot or corrupt task planning.

**Linked quality requirement tests:** [QRT-004](quality-requirement-tests.md#qrt-004-calendar-date-helper-tests)

**Linked architecture decisions:** [ADR-006](architecture/adr/ADR-006-split-client-server-architecture.md)
