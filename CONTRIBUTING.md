# Contributing

This guide describes the current contribution workflow for StreamDesk.

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Never commit `.env`, credentials, recordings, private access instructions, or customer-identifying data.

## Before Submitting

Run the checks relevant to your change:

```bash
npm run check
npm test
npm run coverage
npm run build
```

If a check is not applicable, explain why in the PR.

## Workflow

- Create or use a tracked issue for each non-automated change.
- Use a branch named `<issue-number>-short-description`.
- Keep each PR focused on one change where practical.
- Link the PR to the issue.
- Verify the issue acceptance criteria before requesting review.
- Add or update `CHANGELOG.md` for user-visible changes.

## Review

- Every PR needs review by a different team member.
- The reviewer checks acceptance criteria, tests, documentation impact, and sensitive-data safety.
- Merge only after required checks pass and review is approved.

## Documentation

Update maintained documentation when behavior, setup, workflow, deployment, tests, architecture, or handover status changes.

Useful links:

- [README](README.md)
- [Development process](docs/development-process.md)
- [Repository workflow](docs/repository-workflow.md)
- [Definition of Done](docs/definition-of-done.md)
- [Testing overview](docs/testing.md)
- [Customer handover](docs/customer-handover.md)
- [Architecture overview](docs/architecture/README.md)
