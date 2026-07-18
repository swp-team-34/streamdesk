# Sprint Retrospective – Sprint 5

## What went well
- **All Sprint 5 goals delivered and accepted by the customer**
  The team completed the planned scope (equipment categories, kit disassembly guard, location discussions, design polish, and backlog fixes) and the customer confirmed that the product is ready for real use.
- **Smooth final review and clear handover**
  The final meeting was focused and efficient. The customer tested the new features, understood the logic, and gave a strong positive assessment: “what there is now, it is already possible to take and work calmly”.
- **Documentation was ready early**
  The customer‑handover guide and README were reviewed and approved without major changes, thanks to the earlier decision to pin a person on each document.

## What did not go well
- **Minor UI discoverability issues remained**
  The customer pointed out that some kit‑management icons were not immediately obvious (“these icons were not for me”). This didn’t block acceptance but showed that we could have added clearer tooltips or labels.
- **Last‑minute design adjustments caused a small rush**
  The decision to refresh the overall UI style came mid‑sprint, which required extra polishing and reduced the time available for internal manual testing.

## Changes implemented from the previous Retrospective
- **Strict deadlines for start of the code developing**
  This rule worked again: frontend and backend work began immediately after sprint planning, which allowed all user stories to be closed on time.
- **Buffer for review**
  Reviewers continued to check open PRs at least once a day, preventing review bottlenecks.
- **Pinned a person on each maintained document**
  One team member owned the customer‑handover guide, another owned the README. This made the final documentation update fast and accurate.

## Concrete process improvements for the next Sprint

- **Make UI icons and statuses self‑explanatory from the start**
  Whenever a new icon or state is introduced, add a tooltip or a one‑time hint visible on first hover. This reduces the “what does this button do” questions during UAT.
- **Include a short internal “silent testing” session before the customer demo**
  Reserve 30 minutes for the whole team to click through the deployed build together, silently and independently, before showing it to the customer. This would catch the small visual gaps that manual developer testing often misses.