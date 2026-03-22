# Action Audit — Final Consolidation Plan

Audit of all 33 existing actions across 8 tools. Goal: eliminate redundancy, fold shallow actions into smarter ones, reduce action count while increasing intelligence per action.

**Principle: `get` actions NEVER mutate. Reads are reads, writes are writes. No surprises.**

---

## Summary

| Tool | Before | After | Change |
|------|--------|-------|--------|
| configure | 3 | 3 | — |
| knowledge | 5 | 3 | -2 (merge stale-docs + what-changed + summarize into stats) |
| confluence | 2 | 2 | — |
| insights | 4 | 4 | velocity folded into retro, +plan |
| issues | 6 | 4 | -2 (bulk-create + decompose folded into create) |
| bugs | 4 | 1 | -3 (kill find-bugs + search, merge assess into triage) |
| backlog | 3 | 2 | -1 (kill search, health baked into list) |
| sprints | 6 | 5 | -1 (health into get, goal into update, +update) |
| **Total** | **33** | **24** | **-9** |

24 actions. Fewer than today. All new roadmap intelligence included.

---

## Final Action Map (v3.0)

```
configure:  setup, set, get                           (3)
knowledge:  search, stats, get-page                   (3)
confluence: spider, list-spaces                       (2)
insights:   team-profile, epic-progress, retro, plan  (4)
issues:     get, create, update, search               (4)
bugs:       triage                                    (1)
backlog:    list, rank                                (2)
sprints:    list, get, create, update, move-issues    (5)
                                                     ────
                                                      24
```

---

## What Each Action Does (with internal intelligence)

### CONFIGURE (3 actions — no change)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `setup` | "Set up the project" | Full onboarding: Jira schema discovery → Confluence spider → learn team conventions from completed tickets |
| `set` | "Save this setting" | Store individual config values |
| `get` | "Show me the config" | Current config + setup status |

---

### KNOWLEDGE (3 actions — consolidated from 5)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `search` | "Find docs about X" | FTS5 full-text search across all sources. Core capability. |
| `stats` | "How's the knowledge base?" | **Enriched:** counts by type/space/source + context summary (ADRs, designs, specs) + recent changes (last 7 days) + stale doc flags + KB health score. One call, complete picture. |
| `get-page` | "Show me this page" | Full page content by ID. Deep dive. |

**Killed:** `stale-docs` (folded into stats), `what-changed` (folded into stats), hidden `summarize` flag (now default behavior in stats).

**Why:** `stale-docs` and `what-changed` were the same operation in opposite directions — date filtering on pages, ~12 lines of logic each. The `summarize` flag hidden inside `stats` was confusing — the LLM had to know about a boolean that completely changed the output. Now `stats` returns the full KB picture automatically.

---

### CONFLUENCE (2 actions — no change)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `spider` | "Index Confluence pages" | Bounded concurrency crawl, incremental (skip unchanged), classification, chunking |
| `list-spaces` | "What spaces exist?" | Discover available Confluence spaces |

Already minimal. No overlap.

---

### INSIGHTS (4 actions — reorganized)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `team-profile` | "Show me team patterns" | Stored team intelligence (zero API calls): ownership mapping, estimation patterns, description templates, convention compliance trends, rework rates. Enriched with calibration data (per-person estimation accuracy). |
| `epic-progress` | "How's this epic?" | Completion stats (issues, SP, remaining) + **built-in forecast**: Monte Carlo simulation with confidence intervals ("50% done by Sprint 48, 90% by Sprint 52"). Factors scope creep trend and velocity variance. |
| `retro` | "Run my retro" / "How did the sprint go?" | **Auto-detects sprint:** just-closed (last 3 days) or most recent closed. Returns complete retrospective: velocity trends (folded in), cycle time by type, scope creep %, carryover analysis (chronic slippers flagged), estimation accuracy, workload distribution, time-in-status bottlenecks. One call = full ceremony prep. |
| `plan` | "Help me plan next sprint" | **Sprint planning intelligence:** velocity average (last 5 sprints) + team capacity (who's available, historical load) + carryover from active sprint + top-ranked backlog items. Runs bin-packing: "given X SP capacity, here are items that fit, balanced across assignees." Warns on overcommitment. |

**Killed:** `velocity` (folded into retro — SMs never ask for velocity alone, always in context of sprint analysis).

**New:** `plan` — genuinely distinct intent ("help me figure out what goes in the sprint" vs "show me what happened"). Capacity-based recommendations.

---

### ISSUES (4 actions — consolidated from 6)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `get` | "Show me PROJ-123" / "Show me these tickets" | Fetch one issue (issueKey) or many (issueKeys array). Full details including link graph (dependencies shown automatically). |
| `create` | "Create a ticket" / "Create stories for this epic" / "Create these 5 tickets" | **Three modes, one action:** (1) Single ticket: individual fields → preview with smart defaults, team conventions, KB context, duplicate check. (2) Bulk: `tickets` array → bulk preview with all intelligence per ticket. (3) Epic decomposition: epicKey without summary → breaks epic into suggested child stories with previews. All modes use preview → confirm flow. |
| `update` | "Update PROJ-123" / "Move to In Progress" | Modify fields, transition status, assign, link, rank. **Enrichment baked in:** response notes gaps ("this ticket is missing AC and story points — want me to suggest them?"). Suggestions powered by smart defaults + team conventions. |
| `search` | "Find tickets about X" / "Show me open bugs" | **The ONE universal JQL search.** Auto-scoped to configured project. For backlog items: add `sprint is EMPTY`. For bugs: add `type = Bug`. Clear, honest, one search to learn. |

**Killed:** `bulk-create` (folded into create — same preview/confirm flow, just pass `tickets` array), `decompose` (folded into create — pass epicKey for breakdown), `enrich` (intelligence baked into update/create responses).

**Why decompose folds into create:** The intent is "create stories for this epic." That's a create operation. The LLM doesn't need to know a separate action name — it calls `create` with the epic context, and create is smart enough to decompose.

**Why enrich folds into update:** Enrichment is intelligence that should happen automatically. When you update a thin ticket, the response suggests improvements. When you create, the preview already shows smart defaults. No separate action needed.

---

### BUGS (1 action — consolidated from 4)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `triage` | "Triage this bug" / "Assess PROJ-45" | **Complete bug pipeline in one call:** (1) Scores completeness (steps to reproduce, expected/actual, environment info, labels/components). (2) If incomplete: recommends "get more info" + auto-comments listing missing items. (3) If complete: infers severity from keywords, recommends priority, suggests sprint placement, warns about rework-prone components. (4) With `autoUpdate=true`: auto-sets priority and moves to recommended sprint. Returns structured triage card per bug. |

**Killed:** `find-bugs` (just a hardcoded JQL query — use `issues search` with `type = Bug`), `search` (redundant with `issues search` + `AND type = Bug`), `assess` (merged into triage — you never assess and stop, assessment feeds into triage).

**Why keep as a separate tool?** "Bug triage" is a strong LLM routing signal. When users mention bugs, severity, triage — the LLM routes here. If we folded triage into `issues` (which has 4 actions already), it would get lost. A focused tool with 1 powerful action is better than a bloated tool.

**After triage, how does the LLM update things?** Triage recommends actions. With `autoUpdate=true`, it auto-applies them. For manual changes, the triage response includes suggestions: "set priority to High → use `issues update`." Output-driven discovery.

---

### BACKLOG (2 actions — consolidated from 3)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `list` | "Show me the backlog" | Board backlog via Agile API. **Health baked in:** each item shows quality score, items with missing fields/AC are flagged, duplicate clusters detected, orphaned tickets (no epic) highlighted, stale items noted. The backlog IS triaged just by looking at it. |
| `rank` | "Move PROJ-42 to the top" | Reorder backlog via Agile ranking API. Position (top/bottom) or relative (before/after another issue). |

**Killed:** `search` (redundant with `issues search` + `sprint is EMPTY` JQL).

**Why list includes health:** When a PO looks at the backlog, they need to see quality at a glance. Separating "see the backlog" from "assess backlog health" forces two calls for one intent. Now every backlog view is a health check.

---

### SPRINTS (5 actions — consolidated from 6)

| Action | Intent | Intelligence |
|--------|--------|-------------|
| `list` | "Show me the sprints" | View sprints filtered by state (active/future/closed). Overview table. |
| `get` | "How's the sprint?" / "Prepare my standup" / "What did we ship?" | **Adapts output by sprint state and params.** Active sprint: full details + health score + blocker flags + workload balance + stale items + progress %. With optional `since` param (e.g. `24h`): standup mode — per-person completed/started/blocked, aging blockers highlighted. Closed sprint: release notes format — features delivered, bugs fixed, tech debt addressed, velocity, carryover summary. **Pure read, never mutates.** |
| `create` | "Create a new sprint" | New sprint with name, dates, optional goal. |
| `update` | "Set the sprint goal" / "Rename the sprint" | Modify sprint properties: goal, name, dates. **Mutations live here, not in get.** |
| `move-issues` | "Add these tickets to the sprint" | Assign issues to a sprint via Agile API. Takes sprint ID + issue keys array. Distinct from `issues update` because it uses the Agile sprint endpoint (different API) and is a bulk sprint operation, not an individual issue operation. |

**Killed:** `health` (folded into get — both fetch the same sprint issues data, now one call returns the full picture), `goal` as separate action (reading is part of get, writing is part of update).

**Why `get` adapts by state:** The user asks the same question differently:
- Active sprint: "How's it going?" → health + progress + blockers
- Standup: "What changed?" → `get` with `since=24h` → per-person changelog
- Closed sprint: "What did we ship?" → summary/release notes format
One action, context-aware output. Intelligence inside, simplicity outside.

**Why `move-issues` stays separate from `issues update`:**
1. Different Jira API endpoint (Agile `/sprint/{id}/issue` vs REST `/issue/{key}`)
2. It's a bulk sprint-level operation ("put these 5 things in Sprint 7") not an individual issue operation
3. Conceptually, the user is managing the sprint, not updating issues

---

## The Three Search Problem — Solved

**Before:** Three `search` actions across three tools, all taking JQL with slightly different auto-scoping. LLM decision paralysis.

| Tool | Action | Auto-scoping |
|------|--------|-------------|
| issues | search | project filter |
| backlog | search | project + sprint=EMPTY |
| bugs | search | project + type=Bug |

**After:** One `search` in `issues`. Description says:
> "Query issues via JQL (auto-scoped to configured project). Add 'sprint is EMPTY' for backlog items, 'type = Bug' for bugs."

Clean. Honest. The LLM learns JQL instead of learning three search actions.

---

## Intelligence That's Baked In (Not Separate Actions)

These features exist as internal intelligence, not as actions the LLM has to discover:

| Intelligence | Where it lives | How it surfaces |
|-------------|----------------|-----------------|
| Smart defaults (assignee, points, labels, priority) | `issues create` | Shown in preview card with confidence scores |
| Description scaffolding | `issues create` | AC template generated from team patterns |
| Duplicate detection | `issues create`, `backlog list` | Flagged in previews and backlog view |
| Team convention checking | `issues create`, `issues update` | Compliance warnings in preview/response |
| Enrichment suggestions | `issues update` | "Missing AC and points — want me to suggest?" |
| Epic decomposition | `issues create` (with epicKey) | Suggested child stories with full intelligence |
| Bug completeness scoring | `bugs triage` | First step of triage pipeline |
| KB context retrieval | `issues create` | Auto-searches KB for relevant docs, shown in preview |
| Workload balance | `sprints get` (active) | Included in sprint health view |
| Blocker aging | `sprints get` (active) | Flagged when items blocked >2 days |
| Carryover tracking | `insights retro` | Chronic slippers highlighted with sprint count |
| Velocity trends | `insights retro` | Included automatically, no separate call |
| Estimation calibration | `insights team-profile` | Per-person accuracy built into team intelligence |
| Forecast (Monte Carlo) | `insights epic-progress` | Confidence intervals on completion date |
| Backlog health scoring | `backlog list` | Per-item quality scores shown inline |

---

## Migration Path

### Actions removed (10):
1. `issues bulk-create` → use `create` with `tickets` array
2. `issues decompose` → use `create` with epicKey
3. `bugs find-bugs` → use `issues search` with `type = Bug` JQL
4. `bugs search` → use `issues search` with `type = Bug` JQL
5. `bugs assess` → use `bugs triage` (assess is step 1 of triage)
6. `backlog search` → use `issues search` with `sprint is EMPTY` JQL
7. `insights velocity` → use `insights retro` (velocity included)
8. `sprints health` → use `sprints get` (health included for active sprints)
9. `sprints goal` → reading: `sprints get`, writing: `sprints update`
10. `knowledge stale-docs` + `what-changed` → use `knowledge stats` (all included)

### Actions enriched (intelligence added):
- `sprints get` — now includes health, workload, standup mode, release notes
- `insights retro` — now includes velocity, carryover, estimation accuracy
- `knowledge stats` — now includes context summary, freshness, stale docs
- `bugs triage` — now includes completeness assessment as step 1
- `issues create` — now handles single, bulk, and decomposition
- `issues update` — now suggests enrichments in response
- `backlog list` — now includes health scores and quality flags

### New actions (1):
- `insights plan` — sprint planning intelligence (velocity + capacity + backlog fitting)
- `sprints update` — sprint property mutations (goal, name, dates)

---

## Measuring Success

Track these to ensure the consolidation works:

1. **Action hit rate** — every action should be called. If something is never called, fold it further.
2. **Error rate** — wrong action chosen, hallucinated action names (should decrease with fewer actions).
3. **Multi-call patterns** — if the LLM consistently calls X then Y, consider merging them.
4. **Suggestion follow-through** — when a response suggests "use X", does the next call follow?

```sql
CREATE TABLE tool_usage (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  tool TEXT NOT NULL,
  action TEXT NOT NULL,
  success INTEGER,
  response_suggestions TEXT
);
```
