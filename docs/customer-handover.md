# Customer Handover

Current, actual handover state of StreamDesk. Maintained throughout Assignment 6; updated
whenever access, deployment, limitations, or transition status change. Summarizes the handover -
follow the links for detail.

Last updated: 2026-07-18 (Sprint 5 follow-up build and transition state verified).

## 1. Status and Scope

StreamDesk is a multi-tenant workflow platform for event/production teams: equipment warehouse,
task manager, calendar, projects, estimates, connection schemes, and machine monitoring,
isolated per company.

Current deployed build: the latest Sprint 5 build from `main`, available in the
team-controlled test environment at **[team34.ru](https://team34.ru/)**. The latest formal
GitHub release is still
**[v3.0.0-rc.1 (Week 6 trial / handover candidate)](https://github.com/swp-team-34/streamdesk/releases/tag/v3.0.0-rc.1)**.
The final `MVP v3` SemVer release has not yet been published; Sprint 5 changes remain under
`[Unreleased]` in `CHANGELOG.md`.

Sprint 5 ([milestone](https://github.com/swp-team-34/streamdesk/milestone/5), Week 7,
July 13-19) completed the agreed follow-up product work: safer Warehouse kit workflows,
configurable Warehouse taxonomy and storage, equipment activity and work-context links,
Location workspaces and discussions, project/Kanban V2 realtime collaboration, continuous
Calendar navigation, configurable Dashboard layouts, active-workspace isolation, workspace
creation/onboarding recovery, module decomposition, and the shared light/dark UI system.
See [roadmap.md](roadmap.md), the
[Week 6 report](https://github.com/swp-team-34/streamdesk/blob/main/reports/week6/README.md),
and the maintained [changelog](../CHANGELOG.md).

Scope: the deployed application, source repository, maintained docs, and guidance to run,
configure, and troubleshoot the product without the dev team present.

## 2. Access and Use

- **Instance:** [team34.ru](https://team34.ru/)
- **Sign-in and onboarding:** register with email/login and password, then choose personal use,
  create a company workspace, or join through a company invite link. A company owner or
  administrator can generate and copy a 24-hour invite link from company administration. A new
  or existing user can open that link or paste it during onboarding. A signed-in user can create
  and activate additional company workspaces from the workspace selector.
- **Workspace model:** personal Kanban V2, Calendar, and Project data stays in the personal
  workspace; company data is shared only with members of the selected company. Switching the
  active workspace flushes pending autosaves and reloads scoped data and realtime subscriptions.
- **Usable now:** Kanban V2 task management, continuous Calendar, projects, Location workspaces
  and topics, Warehouse inventory/checkout/kits/settings, customizable Dashboard, estimates,
  connection schemes, monitoring-agent downloads, monitoring, streaming, and the related
  administration workflows.
- **Customer result:** the customer independently completed the Week 6 trial. The Sprint 5 build
  was reviewed in a team-led demonstration and described by the customer as a strong working tool
  for tasks, projects, and Warehouse operations. Current handover level:
  **Ready for independent use**. Customer-confirmation status:
  **Accepted with follow-up items**.

## 3. Installation and Deployment

`team34.ru` is the current course-evaluation and test access path. Its domain, VPS/SSH access,
PM2/Nginx configuration, and deployment operation remain controlled by the team; these private
credentials are not part of the handover. The agreed long-term operating model is a separate
customer-owned VPS using customer-owned credentials and secrets. That deployment is planned but
has not yet been independently verified or recorded as completed.

```bash
npm install && npm run db:push && npm run dev   # local run
npm run build && npm start                       # production build + start
```

The tested server topology runs the built bundle under PM2 (`ecosystem.config.cjs`) behind Nginx
on a VPS over SSH. Customer deployment checklist: provision the customer environment -> install
dependencies -> build -> configure server-side environment variables -> apply only safe
migrations (`npm run db:push`, never destructive) -> start/restart PM2 -> verify `/api/health`
-> register/login -> complete onboarding -> create or join a company -> verify workspace
switching, Calendar, Kanban V2, Locations, Projects, Warehouse, and Dashboard in the browser.

Deploy scripts: `deploy.mjs`, `deploy-full.mjs`, `deploy.sh`, `scripts/setup-remote-server.mjs`.
They remain team-maintained for the test environment; customer deployment must use the
customer's own host, environment file, domain/TLS arrangement, and backup policy.

## 4. Configuration and Secrets

Variable names only - see `.env.example`. No real secret values live in the repo or here.

- **Required:** `DATABASE_URL`, `SESSION_SECRET`, `PORT`.
- **Optional:** platform-admin bootstrap (`PLATFORM_ADMIN_*`), integrations
  (`HUGGINGFACE_API_KEY`/`_MODEL`, `YOUGILE_API_KEY`/`_COMPANY_ID`, `TELEGRAM_BOT_TOKEN`,
  `LABEL_PRINTER_HOST`/`_PORT`), TLS (`SSL_CERT_PATH`, `SSL_KEY_PATH`).

Rules: never commit `.env` or real secrets; keep it server-side only; rotate `SESSION_SECRET`
and integration keys if exposed; HTTPS is required in production.

## 5. Operational Notes

- Use a persistent session store in production, not the in-memory default.
- Back up the database before schema-affecting deploys; don't overwrite company data (tracked:
  [#160](https://github.com/swp-team-34/streamdesk/issues/160)).
- YouGile sync must not delete local tasks on API failure - treat it as optional, non-authoritative.
- Company data isolation is enforced through the selected active workspace across Calendar,
  Kanban V2, projects, Locations, Warehouse, Dashboard, users, notifications, monitoring,
  streaming, estimates, schemes, and realtime subscriptions.
- Personal-workspace data and company-workspace data are intentionally separate. Confirm the
  selected workspace before creating, importing, or editing operational records.
- Monitoring-agent `.bat` files are company-specific - never reuse across companies.

## 6. Troubleshooting and Support

- App down: check `/api/health` first.
- DB issues: `npm run db:verify`.
- Before deploying a change: `npm run check` and `npm run build`.
- Regression check: `npm test`, `npm run coverage` - see [testing.md](testing.md).
- Known follow-up work: [Section 7](#7-known-limitations), linked where a public issue exists.
- Escalation until transition completes: open a GitHub issue on
  [swp-team-34/streamdesk](https://github.com/swp-team-34/streamdesk), or raise it at a Sprint
  Review. The team remains available for initial customer-side integration and deployment
  questions; any ongoing support after transition must be agreed separately
  ([Section 9](#9-remaining-actions)).

## 7. Known Limitations

Current limitations after the Sprint 5 follow-up build:

| Area | Description | Issue/action | Status |
| --- | --- | --- | --- |
| Calendar timeline | First-load initialization and toolbar-period updates are fixed. Progressive adjacent-date buffering and active-scroll rebasing still need follow-up validation under sustained fast scrolling. | [#252](https://github.com/swp-team-34/streamdesk/issues/252) | Deferred to later maintenance; not a Sprint 5 handover blocker |
| Final release | Sprint 5 changes are deployed from `main` but are not yet packaged as the final higher-precedence `MVP v3` SemVer release. | Assignment 6 Part 7 | Pending |
| Customer-side operation | The customer-owned VPS deployment is the agreed operating model, but setup and end-to-end verification on that VPS are not yet recorded. The team-controlled `team34.ru` instance remains the test/evaluation environment. | Transition action | Pending |
| Secondary modules | Estimates and connection schemes remain usable but received less customer validation than the core Kanban V2, Calendar, Projects, Locations, Warehouse, and Dashboard workflows. | Future customer-led validation | Follow-up |

The Week 6 limitations for Warehouse categories/kits, Location workspaces and topics, equipment
comments/photos, Kanban V2 initiator/responsible roles, custom-field guidance, project/equipment
links, Dashboard layouts, workspace isolation, and common UI consistency were addressed during
Sprint 5. These resolved items are no longer transition blockers.

## 8. Handover Status

**Reached handover level: Ready for independent use, as of 2026-07-18.**

**Customer-confirmation status: Accepted with follow-up items.**

The customer independently used the Week 6 trial. During the Sprint 5 meeting, the team
demonstrated the latest `main` build available at `team34.ru`; the customer described it as a
strong working tool that can already be used for tasks, projects, and Warehouse operations. The
customer also reviewed the updated handover material and confirmed that it was understandable.
The accepted transition scope covers normal product use, company/personal workspace selection,
and the documentation required to understand, run, verify, and troubleshoot the application. See
[user-acceptance-tests.md](user-acceptance-tests.md) and the
[Week 6 review summary](https://github.com/swp-team-34/streamdesk/blob/main/reports/week6/sprint-review-summary.md).

The customer remains the intended product owner after handover and can use the public GitHub
issue tracker to prioritize future product work and maintenance follow-ups.

The stronger `Deployed or operated on customer side` level is the agreed next operating step,
not a completed evidence claim: the current accessible instance remains team-controlled, while
the customer intends to deploy the accepted product on a separate customer-owned VPS. The final
`MVP v3` tag/release is also still pending even though the latest Sprint 5 build is deployed.

## 9. Remaining Actions

**Required to finish Assignment 6 delivery packaging:**

- Publish the final higher-precedence `MVP v3` SemVer release from protected `main`, move the
  accepted `[Unreleased]` changes into the dated release section, and link the Sprint 5 milestone,
  current access instructions, this handover, the Week 7 report, and sanitized demo evidence.
- Keep `team34.ru` available as the team-controlled evaluation environment until grading and the
  agreed test period are complete.

**Post-handover/customer-side follow-up:**

- Provision the customer's own VPS, use customer-owned secrets/domain/TLS/backup policy, execute
  the deployment checklist in Section 3, and record an end-to-end health/onboarding/core-workflow
  verification. Team test-server credentials must not be copied or disclosed. The team remains
  available to assist with the initial integration and deployment.
- Test Warehouse workflows, including scanning, in the customer-owned environment and record any
  additional feedback discovered during practical use.
- Use the public GitHub issue tracker for future product defects and improvements. The repository
  needs no separate ownership transfer: it is MIT-licensed and remains accessible to the customer
  and university.

## 10. Documentation Sufficiency

Current docs (this file, `README.md`, [testing.md](testing.md),
[quality-requirements.md](quality-requirements.md), [architecture/README.md](architecture/README.md),
[hosted site](https://swp-team-34.github.io/streamdesk/)) cover normal access, local/server setup,
configuration names, verification, troubleshooting, tests, architecture, and current limitations
without exposing private credentials. The customer reviewed the updated handover material during
the Sprint 5 meeting and confirmed that it was understandable. The maintained documentation is
sufficient for the reached **Ready for independent use** level.

Limited team support is still necessary for final `MVP v3` release packaging and the first
customer-owned VPS deployment/recovery exercise. After that exercise, routine operation,
customer-owned secrets, backups, updates, and future issue prioritization belong to the customer.

## 11. Related Documentation

- [README.md](https://github.com/swp-team-34/streamdesk/blob/main/README.md) - overview, stack, setup.
- [roadmap.md](roadmap.md) - sprint plan and current course outcome.
- [testing.md](testing.md) - tests and CI gates.
- [quality-requirements.md](quality-requirements.md) / [quality-requirement-tests.md](quality-requirement-tests.md)
- [architecture/README.md](architecture/README.md) - static/dynamic/deployment views, ADRs.
- [user-acceptance-tests.md](user-acceptance-tests.md)
- [definition-of-done.md](definition-of-done.md)
- [Hosted documentation site](https://swp-team-34.github.io/streamdesk/)
- `.env.example` - sanitized configuration reference.
