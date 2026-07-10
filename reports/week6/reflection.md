# Week 6 Reflection

## Learning points
- **From the trial release:** The customer was able to register, create a company, and exercise the main workflows (Dashboard, Task Manager, Calendar, Locations, Warehouse) independently. This confirmed that the trial build is stable enough for hands‑on evaluation.
- **From the combined online meeting:** We learned that the customer values early access to a working product. The live UAT session generated concrete, prioritised feedback that we could immediately turn into Sprint 5 PBIs.
- **From team coordination:** Starting development early reduced time pressure, but the absence of a clear task‑allocation window on Day 1 led to some duplicated effort. We confirmed that the team lead (or a designated backup) must facilitate assignment on the first sprint day.

## Validated assumptions
- **Assumption:** We assumed the Week 6 trial release was stable enough for the customer to perform critical business scenarios.
  **Result:** **Confirmed.** The customer created projects, tasks, locations, equipment, and verified overdue visualisation, board statistics, and custom fields without encountering blocking bugs.
- **Assumption:** We assumed the current documentation set (README, `docs/customer-handover.md`) was visible and sufficient for a first‑time reader.
  **Result:** **Partially confirmed.** After the customer received the direct link they confirmed the content was fine.
- **Assumption:** We assumed the product would be ready for transition after the agreed Sprint 5 fixes.
  **Result:** **Confirmed.** The customer stated: “If we deploy what is there now, we can already start using it … we will definitely take it into work and use it.” The remaining work (warehouse categories, kit protection, location‑project linkage) was classified as essential but achievable within Week 7.

## Friction and gaps
- **Documentation discoverability:** The customer did not locate the README and handover guide without a direct link. We need a more visible entry point for the hosted documentation and the handover artifact.
- **Late detailed feedback:** The UAT session produced many specific requests (dashboard reset button, reusable location field, equipment categories/subcategories, kit disassembly guard, initiator/responsible person fields). These arrived late in Sprint 4, so they could only be added to the Sprint 5 backlog.
- **Missing product capabilities:** The customer expected configurable equipment categories and subcategories, a reusable Location picker, and a warning when removing a component from a kit. These were not in the current scope and must be addressed before final acceptance.
- **Tooling inconsistency:** The customer noted that the Dashboard reset button and the Task Manager “responsible person” concept are desirable but not blocking. We need to clearly separate “must‑have for transition” from “nice‑to‑have” in the remaining backlog.

## Planned response
Based on the Sprint 4 review and the remaining work identified by the team, we have planned the following concrete actions for Sprint 5:

1. **Complete Locations enhancements:**
   - Add editing of location name, type, and description.
   - Enable issue creation from legacy tasks and streams.
   - Add a linked task/card/stream selector in the issue form.
   - Show reporter, time, status, and related work in issue details.
   - Add UI for changing status, closing, and cancelling an issue.
   - Add field‑level validation on issue forms.

2. **Improve Warehouse booking visibility:**
   - Display planning constraints in the equipment/booking context so users see applicable limits.

3. **Add warnings for legacy tasks** where relevant to guide users during the transition.

4. **Automated verification of US‑019:** implement an automated check that validates the safe‑update mechanism on an existing PostgreSQL database.

5. **Documentation entry point update:**
   - Improve README discoverability by adding a dedicated Documentation section with direct links to the hosted docs site and the customer‑handover guide.
   - Update `docs/customer-handover.md` with a brief Getting Started checklist.

6. **Address customer feedback that is not blocking MVP v3:**
   - The Dashboard reset button and the initiator/responsible person concept are recorded as PBIs (#149, #150) but will not block the final release.
   - The customer’s requests for user‑definable equipment categories and the kit‑disassembly guard are noted and will be prioritised after the final delivery.

7. **Mid‑sprint checkpoint:** we scheduled a short online check‑in with the customer on Wednesday of Week 7 to validate the critical fixes and confirm final acceptance.
