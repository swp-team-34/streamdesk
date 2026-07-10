# Week 6 Reflection

## Learning points
- **From the trial release:** We learned that our deployment pipeline is stable, but the customer needs a clearer single entry point with all access instructions in one place.
- **From the online customer meeting:** We learned that the customer values seeing a working version early, even if some features are not yet polished. The meeting helped us understand which remaining bugs are truly blocking for independent use.
- **From team coordination:** We confirmed that starting development early in the sprint reduces pressure, but tasks must be assigned by the team lead (or a backup) on Day 1 to avoid confusion.

## Validated assumptions
- **Assumption:** We assumed that the Week 6 trial release would be stable enough for the customer to evaluate the core workflows.
  **Result:** **Confirmed.** The customer was able to create tasks, navigate the calendar, and check warehouse functionality without major issues.
- **Assumption:** We assumed that existing documentation (README and development‑process guide) would be enough for the customer to get started.
  **Result:** **Partially confirmed.** The customer found the access link and basic usage clear, but asked for a short troubleshooting section and a single page that summarises all key access details.
- **Assumption:** We assumed that the product was nearly ready for final handover, needing only minor UI fixes in Week 7.
  **Result:** **Confirmed.** The customer agreed that the remaining work can realistically be finished in Sprint 5.

## Friction and gaps
- **Late task assignment:** The team lead was unavailable at the start of the sprint, so the team began self‑allocating tasks without clear priorities. This caused some duplication and rework.
- **Documentation written at the last moment:** The customer‑handover guide and the updated README were started too late, leaving little time for internal review before the customer meeting.
- **Single meeting limited feedback depth:** Because we had only one online session, some detailed feedback (especially about edge cases in the calendar) arrived after the meeting, reducing the time available to address it in Sprint 4.
- **Merge conflicts from long‑lived branches:** Two features were developed in isolation and merged only at the end of the sprint, resulting in unexpected conflicts that delayed the trial build.

## Planned response
To address the gaps found in Sprint 4, we have planned the following actions for Sprint 5 (Week 7):

1. **Finalise customer‑handover documentation:** We will add a troubleshooting page and merge all access instructions into one place (*Issue # 141*).
2. **Fix remaining critical bugs** reported during the trial: issues *# 142*, *# 143* will be handled in the first half of Week 7.
3. **Improve task allocation process:** We agreed that if the team lead is unavailable, the Scrum Master will facilitate the allocation meeting on the first day of the sprint.
4. **Daily merges to `main`:** Feature branches will be merged at least daily to prevent large conflicts, hiding unfinished work behind feature flags where necessary.
5. **Mid‑sprint feedback checkpoint:** We scheduled a short online check‑in with the customer for Wednesday of Week 7 to ensure final feedback arrives while there is still time to react.