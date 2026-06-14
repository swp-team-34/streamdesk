# MVP v0 Report

## MVP v0 Scope

MVP v0 is a deployed web foundation of StreamDesk. It provides a working
internet-accessible application with authentication, primary navigation, and
the initial manager workflow pages needed for early product review and
technical validation.

At this stage, MVP v0 is not a full implementation of the planned product. Its
purpose is to demonstrate that the system can be deployed, opened in a browser,
used for account access, and navigated through the core interface areas that
support the future MVP v1 direction.

## Deployment

- Public deployment URL: [https://team34.ru](https://team34.ru)
- Access model: public web access through a browser
- Current product type: deployed web application
- Local setup instructions: [Root README](../../README.md#локальный-запуск)

## Demonstration Video

Public demonstration video: [MVP v0 demonstration (Yandex Disk)](https://disk.yandex.ru/i/h7QVL3-S5v-lFQ)

The video shows the deployed application and the core smoke-check flow.

## Relationship to Prototype and Proposed MVP v1 Stories

MVP v0 and the interactive prototype serve different purposes:

- The prototype demonstrates the intended user experience for the proposed MVP
  v1 workflows.
- MVP v0 demonstrates that the technical product foundation is already deployed
  and usable over the internet.

The current MVP v0 is most directly related to the following proposed MVP v1
stories:

- `US-02` - View tasks in a calendar
- `US-05` - Organize tasks on a dashboard
- `US-08` - View progress in real time
- `US-10` - Order dashboard tasks by deadline

MVP v0 does not claim complete end-to-end implementation of all planned
stories. It provides the deployed application shell and core pages that support
those workflows and future iteration.

## Verification

### Repeatable smoke-check scenario

1. Open [https://team34.ru](https://team34.ru) in a browser.
2. Verify that the application loads successfully over HTTPS.
3. Register a new user account.
4. Sign in to the application.
5. Open the main application workspace after authentication.
6. Navigate to the calendar page and verify that it loads.
7. Navigate to the dashboard or task management area and verify that the main
   interface loads.

### Expected results

- The deployment is reachable from the public internet.
- HTTPS access works correctly.
- A new user can register and sign in.
- The authenticated application shell opens successfully.
- Primary navigation between key MVP v0 pages works.
- The user can access the calendar and dashboard/task-related interface areas.

## Known Limitations

- MVP v0 is a technical foundation, not the final MVP v1 delivery.
- Not all planned user stories are implemented end-to-end yet.
- Some advanced product modules described in the broader product vision remain
  incomplete or will be refined in later assignments.
- The current deployment is intended for course evaluation, early review, and
  iterative development rather than full production operation.
