# StreamDesk

StreamDesk is a web application for managing a streaming studio.

The application has many features, Team34 have only five to implement: task manager, calendar, warehouse, dashboard, and projects pages.

## Product Access

Current product access: https://team34.com

Hosted documentation: [StreamDesk Documentation](https://swp-team-34.github.io/streamdesk/)

## Product Goal

Provide the streaming studio team with one shared workspace for planning studio work, managing equipment, tracking project tasks, and reducing manual coordination.

## Current Status

MVP v3 status: TODO (@TimBqs): summarize the final customer-usable state.

Main supported workflows:

- Manage tasks via task manager and calendar
- Track equipment and availability.
- Manage projects.
- Track the state of the stream in the dashboard

Known limitations: see [customer handover](docs/customer-handover.md). TODO: insert known limitations header link

## Usage

User guidance: TODO (@TripleA89): add the main user-facing page or short access instructions.

Customer handover: [docs/customer-handover.md](docs/customer-handover.md)

UAT scenarios: [docs/user-acceptance-tests.md](docs/user-acceptance-tests.md)

## Local Setup

Requirements: Node.js and npm.

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Default local URL: `http://localhost:5000`.

Do not commit `.env` or real secrets.

## Verification

```bash
npm run check
npm test
npm run coverage
npm run build
```

## Deployment

Deployment guidance: TODO (@MeeDaniel): add the current deployment command or link.

Available scripts:

- `npm run build`
- `npm run start`
- `npm run deploy`
- `npm run deploy:full`

## Maintained Documentation

- [Roadmap](docs/roadmap.md)
- [Development process](docs/development-process.md)
- [Repository workflow](docs/repository-workflow.md)
- [Definition of Done](docs/definition-of-done.md)
- [Testing overview](docs/testing.md)
- [Quality requirements](docs/quality-requirements.md)
- [Architecture overview](docs/architecture/README.md)
- [Changelog](CHANGELOG.md)

## Contribution

- Human contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Coding agent guide: [AGENTS.md](AGENTS.md)

## License

MIT.
