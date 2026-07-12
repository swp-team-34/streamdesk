# Customer Handover

Current, actual handover state of StreamDesk. Maintained throughout Assignment 6; updated
whenever access, deployment, limitations, or transition status change. Summarizes the handover -
follow the links for detail.

Last updated: 2026-07-12 (Week 6 trial and transition-readiness review completed).

## 1. Status and Scope

StreamDesk is a multi-tenant workflow platform for event/production teams: equipment warehouse,
task manager, calendar, projects, estimates, connection schemes, and machine monitoring,
isolated per company.

Latest release: **[v3.0.0-rc.1 (Week 6 trial / handover candidate)](https://github.com/swp-team-34/streamdesk/releases/tag/v3.0.0-rc.1)**,
available at **[team34.ru](https://team34.ru/)**. Sprint 4 ([milestone](https://github.com/swp-team-34/streamdesk/milestone/4),
Week 6, July 6-12) delivered the trial increment and transition-readiness evidence - see
[roadmap.md](roadmap.md) and the
[Week 6 report](https://github.com/swp-team-34/streamdesk/blob/main/reports/week6/README.md).
Final MVP v3 is
planned for Sprint 5 (Week 7, July 13-19).

Scope: the deployed application, source repository, maintained docs, and guidance to run,
configure, and troubleshoot the product without the dev team present.

## 2. Access and Use

- **Instance:** [team34.ru](https://team34.ru/)
- **Sign-in:** any email/password to register, then "for personal use" - or register via a
  company invite link (owners generate these from company settings).
- **Usable now:** task manager (including project-specific Kanban boards), calendar, projects,
  locations and issue reporting, warehouse tracking/checkout requests, customizable dashboard,
  and monitoring-agent downloads. Estimates and connection schemes work but are less mature.
- **Trial result:** the customer independently registered, created a company, and exercised the
  Dashboard, Task Manager, Calendar, Projects, Locations, and Warehouse workflows. The result was
  **passed with observations**; remaining work is listed in [Section 7](#7-known-limitations).

## 3. Installation and Deployment

Self-hosting is optional - `team34.ru` is the default access path. Instructions below are for a
customer-owned deployment or recovery copy.

```bash
npm install && npm run db:push && npm run dev   # local run
npm run build && npm start                       # production build + start
```

Production runs the built bundle under PM2 (`ecosystem.config.cjs`) behind Nginx on a VPS over
SSH. Deploy checklist: build -> upload bundle -> apply only safe migrations (`npm run db:push`,
never destructive) -> restart PM2 -> verify `/api/health`, then login/warehouse/tasks/estimates
in the browser.

Deploy scripts: `deploy.mjs`, `deploy-full.mjs`, `deploy.sh`, `scripts/setup-remote-server.mjs` -
team-maintained today (transfer status: [Section 9](#9-remaining-actions)).

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
- Company data isolation is a hard requirement (tasks, warehouse, agents, estimates, schemes).
- Monitoring-agent `.bat` files are company-specific - never reuse across companies.

## 6. Troubleshooting and Support

- App down: check `/api/health` first.
- DB issues: `npm run db:verify`.
- Before deploying a change: `npm run check` and `npm run build`.
- Regression check: `npm test`, `npm run coverage` - see [testing.md](testing.md).
- Known UI bugs: [Section 7](#7-known-limitations), each linked to a tracked issue.
- Escalation until transition completes: open a GitHub issue on
  [swp-team-34/streamdesk](https://github.com/swp-team-34/streamdesk), or raise it at a Sprint
  Review. Direct team support ends at course end ([Section 9](#9-remaining-actions)).

## 7. Known Limitations

Current limitations from the Week 6 customer trial:

| Area | Description | Issue/PBI | Status |
| --- | --- | --- | --- |
| Warehouse categories | User-configurable categories/subcategories | Sprint 5 follow-up PBI | Open |
| Warehouse kits | Prevent issuing active kit components separately; log removals | Sprint 5 follow-up PBI | Open |
| Locations | Expand the basic locations and issue flow into a venue archive with editing, notes, files, history, and resolve/archive workflows | Sprint 5 follow-up PBI | Open |
| Location integration | Complete location context across Warehouse and task/stream issue entry points | Sprint 5 follow-up PBI | Open |
| Task Manager | Add responsible person and initiator fields | Follow-up PBI | Open |
| Warehouse equipment cards | Add comments/photos to equipment items | Follow-up PBI | Open |
| Task Manager custom fields | Add hints for custom-field filters | Follow-up PBI | Open |

Project-specific boards, equipment-request links to Kanban cards or legacy tasks, Warehouse
counts and action layout, compact Task Manager controls, Dashboard layout persistence and reset,
Calendar overlap/overflow fixes, and additive database updates are included in the Week 6 trial
release. The remaining limitations do not invalidate the Week 6 trial result. The Week 7 priority
is Warehouse taxonomy, kit safeguards, Locations improvements, deployment, and final transition.

## 8. Handover Status

**Current level: Week 6 trial / handover candidate, as of 2026-07-12.**

The customer independently used the trial release during the Sprint Review / UAT and confirmed
that the product can be taken into practical use after the agreed Week 7 fixes and deployment.
The product is still used for demonstration/testing only and is not deployed or operated on the
customer side. See [user-acceptance-tests.md](user-acceptance-tests.md) and the
[Week 6 review summary](https://github.com/swp-team-34/streamdesk/blob/main/reports/week6/sprint-review-summary.md).

The customer agreed to act as product owner after handover and found the reviewed documentation
familiar and sufficient for the current trial level. Final Assignment 6 handover level and
customer-confirmation status are not yet recorded: Week 7 must confirm them against the final
build and actual transition scope.

## 9. Remaining Actions

**Blocking full transition:**

- Complete the agreed Week 7 Warehouse taxonomy, kit safeguards, Locations workflow, and UI
  follow-up work selected for MVP v3.
- Provide the final deployment/recovery instructions and support the customer-side deployment,
  backup, update, and GitHub issue-tracker setup where agreed.
- Decide and execute, in Week 7, the transfer/continued-operation status of the `team34.ru`
  domain, VPS/SSH access, and PM2/Nginx deployment - currently team-operated. The repository
  itself needs no separate ownership transfer: it is MIT-licensed and the customer and
  university already hold the rights.
- Ask the customer to review the final Week 7 build and the current version of this document,
  then record the reached handover level and explicit confirmation status (Assignment 6 Part 8).

**Completed in Week 6:** trial release `v3.0.0-rc.1`, customer-led trial/UAT,
transition-readiness discussion, documentation review, and the delivered fixes summarized in
Section 7. Keep this document, `README.md`, `CONTRIBUTING.md`, and `AGENTS.md` current if
access, deployment, support, or workflow arrangements change in Sprint 5.

## 10. Documentation Sufficiency

Current docs (this file, `README.md`, [testing.md](testing.md),
[quality-requirements.md](quality-requirements.md), [architecture/README.md](architecture/README.md),
[hosted site](https://swp-team-34.github.io/streamdesk/)) were reviewed by the customer, who
reported no specific documentation gap, and are sufficient for the current Week 6 trial /
handover-candidate level. They are not yet sufficient evidence of a zero-team final transition:
the production deployment remains team-operated, the customer-side deployment has not happened,
and the final ownership/access arrangements are undecided. Team support remains necessary for
the agreed Week 7 fixes, deployment, backups, updates, issue-tracker setup, and final handover.

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
