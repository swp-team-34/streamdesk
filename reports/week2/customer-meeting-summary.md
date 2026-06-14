# Customer Meeting Summary

## Meeting Details

- **Date:** [2026-06-14]
- **Format:** Video call (recorded with permission)
- **Participants:** Team facilitator, @customer

## MIT License Consent

Written consent to the public MIT-licensed development model was confirmed prior to this meeting. The customer acknowledged this verbally during the meeting and raised no objections after clarification of the MIT license terms.

## Agenda

1. Present user roles and user stories
2. Review MoSCoW prioritization and initial proposed MVP v1 scope
3. Demonstrate [Figma interactive prototype](https://www.figma.com/proto/zUuBGPcI53VIh2qIOkv1OA/Research-board-SWP?node-id=4232-58&p=f&viewport=-268%2C275%2C0.14&t=bogVB4RV92UbpFQp-1&scaling=min-zoom&content-scaling=fixed&page-id=4161%3A2)

## Artifacts Demonstrated

- Five user roles and user stories (verbal walkthrough)
- MoSCoW prioritization
- Figma prototype: task manager board, calendar (week/day/3-day/month views), warehouse screen

## Discussion Points

- Five roles confirmed: Production Worker, Video Editor, Streamer, Stream Administrator, Manager.
- Customer confirmed task manager functionality is the primary priority; design changes are secondary.
- Customer's stated Must Have priorities partially differ from the team's initial proposed MVP v1 scope: the customer included real-time status updates and status boards as Must Have, while the team's current proposal classifies these as Should Have ([US-08](user-stories.md#us-08-view-progress-in-real-time)) and Could Have ([US-04](user-stories.md#us-04-view-recording-place-status)) respectively.
- Equipment reservation and on-site issue notifications were placed in Should / Could Have by the customer, which aligns with the team's current priorities.
- Prototype received positive feedback.

## Customer Feedback

- Task manager (dashboard) and calendar are the core deliverables.
- Design modernization is welcome but not a priority.
- Real-time updates matter to the customer.
- Building on the existing StreamDesk codebase is appropriate.

## Customer Approvals

| Item | Status |
| --- | --- |
| Recording permission | Approved verbally at meeting start |
| Transcript publication in repository | Approved verbally at meeting start |
| MIT license | Confirmed prior to meeting; acknowledged verbally |
| User roles and user stories | No objections raised after presentation |
| Figma prototype | Approved ("Good. Super.") |
| MVP v1 scope | Discussed; requires reconciliation (see Action Items) |

## Decisions

- StreamDesk will be modernized on the existing codebase.
- Design is secondary to functional task manager delivery.
- Sanitized transcript may be published in the repository.

## Action Items

- [ ] Reconcile MVP v1 scope with customer's Must Have priorities: evaluate whether US-08 (real-time updates) and US-04 (status boards) should be promoted. Update [user-stories.md](user-stories.md) if priorities change.
- [ ] Obtain explicit written customer approval of the final updated user stories, priorities, and MVP v1 scope.

## Risks

- MVP v1 scope may need to be expanded to satisfy customer expectations on real-time updates and status boards.
- Explicit in-meeting approval of the full user story list and MVP v1 scope was not formally captured; written follow-up approval is required before submission.

## Publication Approval

The customer explicitly permitted publication of the sanitized transcript in the repository. See [Customer Meeting Transcript](customer-meeting-transcript.md).
