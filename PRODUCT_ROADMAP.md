# Lazy Backlog — Product Roadmap

## Philosophy

> **Simple ask, deep answer.**
> Every action is an intelligence powerhouse internally. Users ask one thing, get back analysis built from hundreds of historical tickets, team patterns, and velocity data. Complexity scales inside — the external interface stays minimal.

---

## v3.0 Target: 24 Actions, 8 Tools

Down from 33 actions today. Fewer actions, dramatically more intelligence per action.

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

## What People Ask → What Happens Internally

| What the user says | Tool / Action | Internal intelligence |
|---|---|---|
| "Create a ticket for X" | `issues create` | Smart defaults, team conventions, description scaffold, KB context search, duplicate check, structured preview |
| "Create stories for this epic" | `issues create` (with epicKey) | Epic decomposition + all intelligence per child story |
| "Create these 5 tickets" | `issues create` (with tickets array) | Bulk preview with full intelligence per ticket |
| "Update PROJ-123" | `issues update` | Applies changes + enrichment suggestions ("missing AC, want me to suggest?") |
| "Find tickets about auth" | `issues search` | Universal JQL, project-scoped. One search for all issue types. |
| "Triage this bug" | `bugs triage` | Completeness scoring → severity inference → priority recommendation → sprint suggestion → optional auto-apply |
| "Show me the backlog" | `backlog list` | Per-item quality scores, duplicate clusters, orphaned/stale items flagged, grooming suggestions |
| "Rank PROJ-42 to the top" | `backlog rank` | Agile ranking API, relative or positional |
| "How's the sprint?" | `sprints get` | Health score, blockers, workload balance, stale items, progress %, issue breakdown |
| "Prepare my standup" | `sprints get` (since=24h) | Per-person: completed, started, blocked. Aging blockers flagged. |
| "What did we ship?" | `sprints get` (closed sprint) | Release notes: features/bugs/tech debt grouped, velocity, carryover |
| "Set sprint goal to X" | `sprints update` | Updates goal. Pure write, separate from reads. |
| "Add these to the sprint" | `sprints move-issues` | Bulk assign via Agile API |
| "Run my retro" | `insights retro` | Auto-detects sprint. Velocity trends + cycle time + scope creep + carryover + estimation accuracy + bottlenecks |
| "Help me plan next sprint" | `insights plan` | Velocity avg + team capacity + carryover + backlog fitting + overcommit warnings |
| "How's epic X?" | `insights epic-progress` | Completion stats + Monte Carlo forecast with confidence intervals |
| "Show team patterns" | `insights team-profile` | Ownership mapping, estimation patterns, conventions, compliance trends, calibration |
| "Search docs about X" | `knowledge search` | FTS5 across all sources |
| "How's the knowledge base?" | `knowledge stats` | Counts + context summary + recent changes + stale docs + health score |

---

## Persona Gap Analysis

### Product Owner

| Daily Activity | v2.0 | v3.0 |
|---|---|---|
| Write user stories | `create`, `bulk-create` | `create` (single, bulk, or decompose — one action) |
| Prioritize backlog | `backlog rank` | `backlog rank` |
| Track epic progress | `insights epic-progress` | `insights epic-progress` + **forecast** ("50% done by Sprint 48") |
| Stakeholder reporting | ❌ | `sprints get` on closed sprint → **release notes** |
| Backlog grooming prep | ❌ | `backlog list` → **health scores + quality flags inline** |
| Sprint review prep | ❌ | `sprints get` on closed sprint → **structured summary** |
| Forecasting | ❌ | `insights epic-progress` → **Monte Carlo confidence intervals** |
| Sprint planning | ❌ | `insights plan` → **"here's what fits given velocity + capacity"** |

### Scrum Master

| Daily Activity | v2.0 | v3.0 |
|---|---|---|
| Sprint health | `sprints health` | `sprints get` → **health baked in** |
| Velocity tracking | `insights velocity` | `insights retro` → **velocity baked in** |
| Retrospectives | `insights retro` | `insights retro` → **enriched with carryover, estimation accuracy, bottlenecks** |
| Standup facilitation | ❌ | `sprints get` (since=24h) → **per-person standup digest** |
| Sprint planning | ❌ | `insights plan` → **capacity-based recommendations** |
| Team workload balance | ❌ | `sprints get` → **workload balance baked into health view** |
| Carryover tracking | ❌ | `insights retro` → **chronic carryover flagged** |

### Senior Engineer

| Daily Activity | v2.0 | v3.0 |
|---|---|---|
| Create/update tickets | `create`, `update` | `create` + `update` with **enrichment intelligence** |
| Search for context | `knowledge search` | `knowledge search` (no change) |
| Bug triage | `bugs assess` + `triage` | `bugs triage` → **single call, complete pipeline** |
| Self-serve grooming | ❌ | `issues update` → **suggests missing AC, points, labels** |
| Dependency visibility | ❌ | `issues get` → **link graph shown automatically** |

---

## Implementation Phases

### Phase 1: Consolidation (reduce 33 → 24)

No new features — just merge, fold, and enrich existing actions.

**Knowledge:**
- Fold `stale-docs`, `what-changed`, hidden `summarize` flag into enriched `stats`

**Issues:**
- Merge `bulk-create` into `create` (detect via `tickets` array)
- Fold `decompose` into `create` (detect via epicKey without summary)
- Add enrichment suggestions to `update` responses

**Bugs:**
- Kill `find-bugs` and `search` (use `issues search` with JQL)
- Merge `assess` into `triage` (assess is step 1 of pipeline)

**Backlog:**
- Kill `search` (use `issues search` with sprint JQL)
- Bake health scoring into `list` output

**Sprints:**
- Merge `health` into `get` (both fetch same data)
- Move `goal` mutations to new `update` action
- Goal reading already part of `get` output

**Insights:**
- Fold `velocity` into `retro`

### Phase 2: New Intelligence

Build the new capabilities that make existing actions smarter.

**`sprints get` intelligence:**
- Standup mode: changelog-based "what changed in N hours" with per-person grouping
- Closed sprint mode: release notes formatting (group by type, show metrics)
- Active sprint: workload balance computation, blocker aging detection

**`insights retro` intelligence:**
- Carryover analysis: track issues across sprints via changelog, flag chronic carryover (3+ sprints)
- Estimation accuracy: compare points assigned vs actual cycle time, per-person and per-type
- Scope creep quantification: SP added/removed mid-sprint

**`insights plan` (new action):**
- Velocity averaging (last N sprints with variance)
- Team capacity computation (who's available, historical load per person)
- Carryover detection from active sprint
- Backlog bin-packing: "given X SP capacity, here are items that fit, balanced across assignees"
- Overcommitment warnings

**`insights epic-progress` intelligence:**
- Monte Carlo forecast: remaining SP ÷ velocity (with variance) × 1000 simulations
- Confidence intervals: 50%, 75%, 90% completion dates
- Scope creep trend: new issues added per sprint to this epic

**`backlog list` intelligence:**
- Per-item quality scoring (team rules evaluation)
- Duplicate cluster detection
- Orphaned ticket flags (no epic parent)
- Stale item detection (no updates in N days)

**`issues update` intelligence:**
- Gap detection: check for missing AC, story points, labels, components
- Smart suggestions: "based on team patterns, suggest X" in response

### Phase 3: Output-Driven Discovery

Add contextual suggestions to every tool response so the LLM discovers capabilities through use, not memorization.

```
## Sprint Health: 62/100

Blockers (3): BP-45, BP-67, BP-89 — no movement 4+ days
Workload: Alice has 21 SP (team avg: 12) — overloaded

Suggested next steps:
• "Help me plan next sprint" → insights plan
• "Run my retro" → insights retro
• "Triage BP-45" → bugs triage
```

Every response teaches the LLM what to call next. Discovery is contextual, not memorized.

---

## Design Principles

1. **`get` never mutates.** Reads are reads. Writes go in `create`, `update`, or dedicated mutation actions.
2. **Enrich, don't expand.** Make existing actions smarter. Only add a new action when the intent is genuinely distinct.
3. **One search to rule them all.** `issues search` is the universal JQL entry point. No more three-way confusion.
4. **Output-driven discovery.** Responses suggest next steps. The LLM doesn't need to memorize 24 actions — it learns through use.
5. **Adapt to context.** `sprints get` returns different formats for active vs closed sprints. `issues create` handles single, bulk, and decompose. Intelligence inside, simplicity outside.
6. **Tool descriptions ≤ 150 tokens.** Domain sentence + action table with trigger phrases. No implementation details.

---

## Detailed Design Docs

- `ACTION_AUDIT.md` — per-action analysis, what was killed/merged/enriched, migration path
- `TOOL_DESIGN_GUIDE.md` — LLM-friendly tool design patterns, description engineering, three-layer architecture
