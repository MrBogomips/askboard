# Change request: effort by profile, cost and FTE in the WBS with PERT (2026-11-07)

**Status: queued, for the PO.** It becomes an OpenSpec change through `/opsx:propose`; until then it binds nothing. It came from the PO's review of two WBS test asks on 2026-11-07: a three-phase WBS with a Gantt plan, and a stress ask with 63 work packages, 120 dependencies, a plain PERT Tree with agent-defined columns, and a Gantt plan with requested starts and durations. It touches FR-15, AD-7, AD-9, AD-13 and AD-14, changes FR-15's consequences in the PRD, and needs no new AD.

## The PO's request

Verbatim, in Italian:

> La molecola WBS deve consentire di stimare gli effort (impegni) anche per risorsa. Modalità semplice quella attuale dove metto semplicemente tre valori pert, modalità avanzata metto anche la ripartizione per profilo in percentuale. Ad esempio posso dire che un attività impegna PM al 5%, Architect al 20%, FE Developer al 30% e così via.
> Prevediamo anche la possibilità di fornire alla molecola WBS la lista dei profili previsti e il costo per profilo e la vista deve mostrare non solo l'effort in giorni ma anche la stima economica: l'utente può switchare dalla vista in GG UOMO, FTE, e COSTO anche il parametro FTE può essere configurato e va mostrato in una legenda di recap nella WBS.

## Why

A work package's effort is one PERT figure in working days today. A PM staffs and prices work by profile: a review of the plan needs to see who does the work and what it costs, and to change the mix, without the agent converting days into money or FTE. AD-13 forbids the agent from computing derived values. A cost or FTE view is therefore something AskBoard has to derive, or the agent cannot offer it at all.

## What changes

### 1. Two modes, one molecule

- **Simple mode** is today's WBS with PERT: three estimates per work package. Every ask that is valid today stays valid, renders the same and answers the same.
- **Advanced mode** is on when the data carry a list of profiles. Each work package may then carry a **split** of its effort by profile, in percentages: for example PM 5%, Architect 20%, FE Developer 30%, Backend Developer 35%, QA 10%.

### 2. Profiles

- The agent sends the expected profiles: an ID, a name, and a daily rate.
- A rate is money as AD-7 defines it, a decimal string plus an ISO 4217 code, which the WBS declares once for all its amounts. A WBS uses one currency.
- A rate is optional. Without one, days and FTE still work, and the cost view shows that profile's cost as missing (see 6).

### 3. Splits

- A split maps profile IDs to percentages. It applies to the work package's estimates, so a profile's effort is the package's expected effort times its share.
- The shares are fixed percentages, so cost and FTE are linear in effort. A spread therefore converts with the same factor as the expected effort, and AD-13's function whitelist covers everything (`SUMPRODUCT`, `SUM`, `ROUND`, the four operators).
- A node without a split of its own takes its nearest ancestor's (open question 1).

### 4. Three views: person-days, FTE, cost

- A switch on the WBS toolbar: **Giorni uomo** (the default), **FTE**, **Costo**. It only changes the display. Like switching off the Gantt's critical path (FR-15), it changes neither the draft nor the answer.
- **Person-days:** the expected effort and spread, as today, and in advanced mode the effort of each profile.
- **FTE:** effort divided by the FTE parameter (see 5).
- **Cost:** the sum over profiles of the profile's effort times its daily rate. Money is rounded only for display, to the currency's minor unit (AD-13).
- Every figure rolls up to the parent nodes and to the WBS total, as the expected effort does.
- How the per-profile figures are laid out (one column per profile, an expandable breakdown, or a breakdown of the selected row) is for the UX design. A Tree's eight columns are not used for this: profiles are not columns.

### 5. The FTE parameter and the recap legend

- The **FTE parameter** is the number of working days that make one FTE in a named period, such as 220 days for one FTE-year or 20 for one FTE-month.
- The agent may set it in the data. Otherwise a project default from the configuration applies (AD-14, like `defaultMinimumMargin`), and with neither a built-in default applies (open question 4).
- A **recap legend** in the WBS shows the FTE parameter and its period, the currency, every profile with its daily rate, and the totals per profile in the current view.

### 6. Validation and fail closed

- Every profile ID in a split must name a profile of the list.
- At send time, a split whose shares do not sum to 100% is a request problem that names the node.
- On the board, such a split shows a field error, and the missing share shows as **Non ripartito** (unallocated).
- A total that misses a part, such as an unallocated share or a profile without a rate, is shown as incomplete, never as a complete figure (AD-10, NFR-10).

### 7. The answer

- The answer carries only what the user changed (splits, estimates, and rates and the FTE parameter if open question 3 makes them editable), as the estimates already are (FR-15).
- Its derived values are each changed node's effort per profile, FTE and cost, and the totals per profile and for the WBS, under the rules of `TREE_PERT_ANSWER_DERIVED` (rounding, changed nodes only, the item's totals always).
- The agent computes none of them (AD-13).

### 8. The Gantt plan does not change

Task durations still come from the expected effort, `MAX(1, ROUNDUP(expected))`. Profiles and splits move no date. Letting staffing drive durations is a separate request (see "Out of scope").

## Constraints from the spine

- **AD-9:** a ready-made molecule is data. The change ships a new minor version of the `wbs-pert` definition, whose new parameters are optional, and no fill evaluates anything. The profiles, splits, rates and FTE parameter belong to the Tree's props, so a plain Tree with `pert` gets advanced mode as well.
- **AD-13:** the new derived fields are built-in fields declared in `contract`, over the whitelist only.
  - **The main design question:** the reference grammar has a single field segment (`[wbs.ux.expected]`), and profile IDs may contain `-` and `_`, which a field name may not. Per-profile fields therefore need an addressing the grammar admits, such as an index in the profile list or a widened grammar that `compute` and the answer addresses both follow.
- **AD-7:** money keeps its decimal-string and ISO 4217 format. Percentages and FTE use the values' existing formats. Display uses the en-US and it-IT tables in `contract` (Stack, "Locale formats"). The schema-set versions this change moves are labels assigned at merge (`askboard-contract-versioning`).
- **AD-14:** an optional project default for the FTE parameter in the configuration.
- **NFR-1:** every new field is optional, and simple mode costs the agent nothing more than today.
- **AD-15:** a Snapshot shows the WBS in one view (open question 7).

## Illustrative data

The field names below are illustrative only; choosing them is the design's job.

```json
{
  "molecule": "wbs-pert",
  "data": {
    "currency": "EUR",
    "fte": { "days": 220, "period": "year" },
    "profiles": [
      { "id": "pm", "label": "Project manager", "rate": "650.00" },
      { "id": "arch", "label": "Architect", "rate": "720.00" },
      { "id": "fe", "label": "FE developer", "rate": "480.00" },
      { "id": "be", "label": "Backend developer", "rate": "500.00" },
      { "id": "qa", "label": "QA engineer", "rate": "420.00" }
    ],
    "nodes": [
      {
        "id": "build", "label": "Build",
        "split": { "pm": 5, "arch": 10, "fe": 35, "be": 40, "qa": 10 },
        "children": [
          { "id": "portal", "label": "Customer portal", "optimistic": 8, "mostLikely": 12, "pessimistic": 20,
            "split": { "pm": 5, "arch": 20, "fe": 30, "be": 35, "qa": 10 } },
          { "id": "billing", "label": "Billing integration", "optimistic": 5, "mostLikely": 8, "pessimistic": 15 }
        ]
      }
    ]
  }
}
```

Here `billing` takes the split of `build`, its parent.

## Acceptance

- An ask with today's `wbs-pert` data renders and answers exactly as today.
- With profiles and splits, each of the three views shows every node, the totals and the legend in its unit, and switching views changes neither the draft nor the answer.
- Changing an estimate or a split updates, within the same interaction, the node's effort per profile, FTE and cost, those of its ancestors, the totals and the legend. A percentage change of selected estimates (FR-15) does the same.
- A split that does not sum to 100% is refused at send time with a problem naming the node. On the board, it shows a field error and the unallocated share, and the totals that depend on it show as incomplete.
- A profile without a rate leaves the cost view incomplete, never showing a partial total as complete. The person-days and FTE views stay whole.
- The answer carries only the changed values, and the derived values come from AskBoard.
- Money, percentages and FTE are formatted for en-US and it-IT.
- No Gantt date depends on profiles, splits, rates or the FTE parameter.

## Open questions

Each one has a recommended default.

1. **Split inheritance.** A node without a split takes its nearest ancestor's. *Recommended:* yes, since it keeps asks short (NFR-1).
2. **Shares that do not sum to 100%.** *Recommended:* refused at send time, and shown as an error with an unallocated share on the board (section 6).
3. **What the user may edit.** *Recommended:* splits, rates and the FTE parameter, each returned as a change, as the sales estimate review returns its rates (FR-15).
4. **The built-in FTE default.** *Recommended:* 220 days per FTE-year, which the agent or the project configuration overrides.
5. **Splits in absolute days as well as percentages.** *Recommended:* percentages only, as the PO asked.
6. **Shared rate model with the sales estimate review.** Its "roles, effort, rates and margin" overlap with these profiles and rates. *Recommended:* one profile-and-rate shape in `contract`, used by both molecules, so that a later change can feed a WBS into a sales review.
7. **Snapshot view.** *Recommended:* the view the user had selected, with the legend.
8. **Limit on profiles.** *Recommended:* a `contract` limit, such as 20 profiles per WBS.

## Out of scope

The same review found three more limits. Each would be its own request:

- **Effort and duration are the same number.** A package of 20 person-days staffed by two people lasts 10 days, but the Gantt plan schedules it for 20. Staffing would have to drive the plan's durations.
- **Milestones last one day.** A work package estimated 0/0/0 becomes a one-day task (`MAX(1, …)`), where a milestone should have zero duration and show as a diamond.
- **No roll-ups for agent-defined columns.** A number column that the agent adds to a Tree, such as a cost, is not summed into its parents.

## Placement in the queue

- It depends on nothing beyond `main` at #39.
- Design it together with `molecules-sales-decision` from the remaining-features roadmap, or right after it, so that the two molecules share the profile-and-rate model (open question 6).
