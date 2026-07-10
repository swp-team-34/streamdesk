# Customer Handover

Current, actual handover state of StreamDesk. Maintained throughout Assignment 6; updated
whenever access, deployment, limitations, or transition status change. Summarizes the handover -
follow the links for detail.

Last updated: 2026-07-09 (Week 6, Sprint 4 in progress).

## 1. Status and Scope

StreamDesk is a multi-tenant workflow platform for event/production teams: equipment warehouse,
task manager, calendar, projects, estimates, connection schemes, and machine monitoring,
isolated per company.

Latest release: **[v2.0.0 (MVP v2)](https://github.com/swp-team-34/streamdesk/releases/tag/v2.0.0)**,
live at **[team34.ru](https://team34.ru/)**. Sprint 4 ([milestone](https://github.com/swp-team-34/streamdesk/milestone/4),
Week 6, July 6-12) is in progress on deployment reliability and interface stability - see
[roadmap.md](roadmap.md). A Week 6 trial release follows at Sprint 4 close; final MVP v3 is
planned for Sprint 5 (Week 7, July 13-19).

Scope: the deployed application, source repository, maintained docs, and guidance to run,
configure, and troubleshoot the product without the dev team present.

## 2. Access and Use

- **Instance:** [team34.ru](https://team34.ru/)
- **Sign-in:** any email/password to register, then "for personal use" - or register via a
  company invite link (owners generate these from company settings).
- **Usable now:** task manager (Kanban), calendar, warehouse tracking/checkout, dashboard,
  monitoring-agent downloads. Estimates and connection schemes work but are less mature.
- **Not yet implemented:** a dedicated "projects" page and several warehouse features (see
  [Section 7](#7-known-limitations)).

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

Open, actively tracked for Sprint 4:

| Area | Issue | Status |
| --- | --- | --- |
| Task Manager mobile view needs optimization | [#155](https://github.com/swp-team-34/streamdesk/issues/155) | Open |
| Warehouse "Send to project" UI glitch | [#156](https://github.com/swp-team-34/streamdesk/issues/156) | Open |
| Tasks fail to attach to checkout requests | [#157](https://github.com/swp-team-34/streamdesk/issues/157) | Open |
| Minor equipment count discrepancy | [#158](https://github.com/swp-team-34/streamdesk/issues/158) | Open |
| Dashboard widgets not drag-and-drop | [#159](https://github.com/swp-team-34/streamdesk/issues/159) | Open |
| No safe migration workflow yet | [#160](https://github.com/swp-team-34/streamdesk/issues/160) | Open |

Closed, will not be fixed as a separate item: task cards overlapping action buttons on small
screens / high density ([#154](https://github.com/swp-team-34/streamdesk/issues/154), closed
2026-07-06 as not planned, no reason recorded in the issue). No related fix has landed in the
codebase since the close date, so the symptom should be assumed to still be present; it is out
of Sprint 4 scope unless reopened.

Not yet scheduled: dedicated "projects" page, several `docs/roadmap.md` warehouse features,
further polish on estimates/schemes.

None of this blocks core task manager, calendar, or basic warehouse use today. #157 and #160
are treated as priority fixes before the Week 6 trial release since they affect data reliability.

## 8. Handover Status

**Level reached: Ready for independent use (partial), as of 2026-07-09.**

Core workflows work end-to-end and the customer already exercised several directly during
Sprint Review / UAT (see [user-acceptance-tests.md](user-acceptance-tests.md) and the
[Week 5 report](../reports/week5/README.md)). Not yet confirmed as fully independent, unguided
use, and the Section 7 reliability fixes are still open - so this level is claimed with that
qualification, not without it.

Not the final level for the course: Week 6 covers trial/transition-readiness, Week 7 covers
final transition confirmation. This section updates after each
(`reports/week6/README.md`, `reports/week7/README.md`).

## 9. Remaining Actions

**Blocking full transition:**

- Close #157 and #160 (and the rest of Section 7 where practical).
- Cut and deploy the Week 6 trial release.
- Hold the Week 6 transition-readiness meeting; let the customer trial independently or with
  minimal guidance; record whether they confirm readiness, use it independently, or operate it.
- Decide and execute, in Week 7, the transfer/continued-operation status of the `team34.ru`
  domain, VPS/SSH access, and PM2/Nginx deployment - currently team-operated. The repository
  itself needs no separate ownership transfer: it is MIT-licensed and the customer and
  university already hold the rights.
- Get explicit customer confirmation on this document (Assignment 6 Part 8) in Week 7.

**Not blocking, expected before MVP v3:** remaining non-critical Section 7 items (mobile
layout, dashboard drag-and-drop, UI glitches); keep this document, `README.md`,
`CONTRIBUTING.md`, and `AGENTS.md` current if access/deployment/workflow changes in Sprint 5.

## 10. Documentation Sufficiency

Current docs (this file, `README.md`, [testing.md](testing.md),
[quality-requirements.md](quality-requirements.md), [architecture/README.md](architecture/README.md),
[hosted site](https://swp-team-34.github.io/streamdesk/)) are enough to run, configure, and
operate MVP v2 and the in-progress trial. Not yet enough for a zero-team handoff: Section 3
still assumes access the team currently holds, and Section 7 fixes are unresolved. Team support
continues through Sprint 4 and Sprint 5.

## 11. Related Documentation

- [README.md](../README.md) - overview, stack, setup.
- [roadmap.md](roadmap.md) - sprint plan and current course outcome.
- [testing.md](testing.md) - tests and CI gates.
- [quality-requirements.md](quality-requirements.md) / [quality-requirement-tests.md](quality-requirement-tests.md)
- [architecture/README.md](architecture/README.md) - static/dynamic/deployment views, ADRs.
- [user-acceptance-tests.md](user-acceptance-tests.md)
- [definition-of-done.md](definition-of-done.md)
- [Hosted documentation site](https://swp-team-34.github.io/streamdesk/)
- `.env.example` - sanitized configuration reference.
