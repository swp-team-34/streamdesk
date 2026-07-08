# AGENTS.md

## Purpose

This file gives coding agents repository-specific operating rules for StreamDesk. Treat it as a concise README for agents, not a replacement for `README.md` or human contributor documentation.

## Project context

StreamDesk is a web platform for event and production teams. It combines equipment inventory, tasks, projects, estimates, connection schemes, computer monitoring, and company administration in one interface. The product supports multiple companies and must keep company data isolated.

## Essential commands

- Install local dependencies: `npm install`
- Clean CI-style install: `npm ci`
- Start local development server: `npm run dev`
- Type-check: `npm run check`
- Run tests: `npm test`
- Run coverage: `npm run coverage`
- Build production bundle: `npm run build`
- Apply Drizzle schema changes: `npm run db:push`
- Verify database connection: `npm run db:verify`
- Critical dependency audit: `npm audit --audit-level=critical`

## Repository workflow

- Inspect the linked issue, `README.md`, and relevant maintained docs before editing.
- Keep every change scoped to the linked issue and avoid unrelated refactoring.
- Update maintained docs when commands, workflow, deployment, testing, access, CI, or review expectations change.
- Preserve assignment evidence; do not delete or rewrite historical workflow artifacts.
- Follow `docs/development-process.md` and `docs/definition-of-done.md` when they apply.

## Working principles

- Think before coding: state assumptions, surface uncertainty, ask when requirements are ambiguous, and name tradeoffs before implementing.
- Prefer the simplest sufficient solution; do not add speculative features, abstractions, configurability, or irrelevant error handling.
- Make surgical changes only; every changed line must directly support the linked issue or the human's explicit request.
- Match existing project style and mention unrelated issues instead of fixing them opportunistically.
- Define success criteria for vague tasks and verify each meaningful step before calling the work complete.
- For multi-step work, use a short plan with checks such as `1. [Step] -> verify: [check]`.
- Do not fight repeated errors blindly: after seeing the same error twice, research it, identify 3-5 plausible fixes, choose the most effective one, and implement it.
- Stop and ask for clarification when confusion would otherwise lead to guessing.

## Issue, branch, and PR rules

- Before any non-trivial work, determine the correct issue type.
- Create the issue strictly from the matching template in `.github/ISSUE_TEMPLATE/`.
- Do not start implementation before the issue exists.
- Create a separate branch from the issue.
- Branch format must be `<issue-number>-short-description`.
- Work only in that branch; never work directly on `main`.
- Do not create a pull request unless the human explicitly asks for it.
- If asked to create a pull request, use `.github/pull_request_template.md` strictly.
- Link the PR to the issue, fill acceptance-criteria verification, fill testing/verification evidence, and fill the changelog decision.
- Do not approve your own work, merge without human approval, bypass review, or push automatically without explicit human approval.

## Verification rules

- Run relevant checks before saying work is complete.
- Verify the linked issue acceptance criteria.
- Check the team Definition of Done in `docs/definition-of-done.md` when available.
- Run `git diff --check`.
- Run a UTF-8 / broken-encoding check on every changed text artifact before commit and before push.
- Fix encoding problems before committing.
- If a relevant check cannot be run, state the reason and what remains unverified.

```bash
python3 - <<'PY'
from pathlib import Path
import subprocess

changed = subprocess.check_output(
    ["git", "diff", "--name-only", "--cached"],
    text=True,
    encoding="utf-8",
).splitlines()

bad = []
markers = [
    "\ufffd",
    "\u00d0",
    "\u00d1",
    "\u0420\u045f",
    "\u0420",
    "\u00e2\u20ac",
    "\u00e2\u20ac\u2122",
    "\u00e2\u20ac\u0153",
    "\u00e2\u20ac\x9d",
]

for name in changed:
    path = Path(name)
    if not path.exists() or path.is_dir():
        continue
    try:
        data = path.read_bytes()
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        bad.append(f"{name}: not valid UTF-8")
        continue
    if any(marker in text for marker in markers):
        bad.append(f"{name}: possible mojibake/broken encoding marker")

if bad:
    print("\n".join(bad))
    raise SystemExit(1)
print("Encoding check passed")
PY
```

If legitimate text triggers the marker check, explain why before proceeding.

## Documentation rules

- Keep `README.md` as the public entry point.
- Keep `AGENTS.md` for coding agents only and keep it concise.
- `CONTRIBUTING.md` is currently missing; create it later if Assignment 6 requires human contributor guidance.
- Update `AGENTS.md` when setup, checks, workflow, review expectations, safety rules, or key docs change.
- Link to maintained docs instead of duplicating them.
- Existing maintained docs include `README.md`, `docs/development-process.md`, `docs/definition-of-done.md`, `docs/testing.md`, `docs/quality-requirements.md`, `docs/quality-requirement-tests.md`, `docs/user-acceptance-tests.md`, `docs/roadmap.md`, `docs/architecture/README.md`, and `reports/week5/README.md`.
- Missing Assignment 6 follow-up docs include `CONTRIBUTING.md`, `docs/customer-handover.md`, `reports/week6/README.md`, and `reports/week7/README.md`.

## Security and privacy rules

- Never commit secrets, tokens, passwords, API keys, `.env` files, private credentials, private access instructions, private links, private recordings, exact private timecodes, university emails, customer-identifying details, confidential customer information, or unnecessary PII.
- Use sanitized demo/test data in public docs, screenshots, reports, and demos.
- Keep private Moodle evidence out of the public repository.
- Use `.env.example` only for sanitized configuration names.
- Do not expose real secret values.

## Agent conduct rules

- Do not leave repository traces mentioning specific agent products, agent provenance, or generated-by-agent claims.
- Do not include agent names or agent provenance in commits, PR titles, PR descriptions, comments, documentation, changelog entries, or code comments.
- Do not add unnecessary comments explaining that an agent made the change.
- Ask for human confirmation before changing scope.
- Before starting a new subtask, explain what you intend to change and wait for human approval.
- Before push, show the final changed files, summary, verification results, and encoding-check result.
- Push only after explicit human approval.

## Key references

- `README.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/pull_request_template.md`
- `.github/workflows/quality.yml`
- `.github/workflows/lychee.yml`
- `.github/workflows/docs.yml`
- `docs/development-process.md`
- `docs/definition-of-done.md`
- `docs/testing.md`
- `docs/quality-requirements.md`
- `docs/quality-requirement-tests.md`
- `docs/user-acceptance-tests.md`
- `docs/roadmap.md`
- `docs/architecture/README.md`
- `reports/week5/README.md`
