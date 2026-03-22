# LLM-Friendly Tool Design Guide

How to scale Lazy Backlog's features without breaking LLM tool selection.

---

## The Problem

LLMs degrade at tool selection as tool count and schema complexity grow:

- **Tool count > 15–20**: Selection accuracy drops noticeably
- **Tool descriptions > ~200 tokens each**: LLMs skim or miss details
- **Large discriminated union schemas**: LLMs pick wrong action or hallucinate params
- **No contextual guidance**: LLMs don't discover capabilities they weren't explicitly asked about

We have 8 tools. That's safe. The risk is action bloat within tools — descriptions become walls of text, schemas become huge, and the LLM starts guessing.

---

## Core Principles

### 1. `get` never mutates

Read actions are pure reads. Write operations go in `create`, `update`, or dedicated mutation actions. No side effects hidden behind read params.

### 2. Enrich, don't expand

When adding a new feature, the first question is: **can an existing action do this?**

| Approach | Example |
|----------|---------|
| ❌ Add `carryover` action | Standalone, LLM must discover it |
| ✅ Enrich `retro` action | Carryover data is part of retro output automatically |
| ❌ Add `dependencies` action | Separate workflow to learn |
| ✅ Enrich `get` action | Link graph shown automatically when fetching an issue |
| ❌ Add `enrich` action | Another thing to remember |
| ✅ Make `update` smarter | Suggests improvements in its response |

**Only add a new action when the intent is genuinely distinct** — when a user would phrase the request in a completely different way.

### 3. Context-adaptive output

The same action returns different formats based on context:

| `sprints get` called on... | Output adapts to... |
|---|---|
| Active sprint | Health score + blockers + workload + progress |
| Active sprint with `since=24h` | Standup digest: per-person completed/started/blocked |
| Closed sprint | Release notes: features/bugs/tech debt + metrics |
| Future sprint | Basic info (name, dates, planned issues) |

One action, four useful outputs. Intelligence inside, simplicity outside.

### 4. One search to rule them all

`issues search` is the universal JQL entry point. No more per-tool search wrappers:

| Before (confusing) | After (clean) |
|---|---|
| `issues search` — project scoped | `issues search` — universal |
| `backlog search` — sprint=EMPTY scoped | Use `issues search` with sprint JQL |
| `bugs search` — type=Bug scoped | Use `issues search` with type JQL |

The LLM learns JQL instead of learning three search actions.

---

## Description Engineering

The tool description is the single most important factor in LLM tool selection. Every word counts.

### Format: Domain sentence + action table with trigger phrases

```
Before (v2.0 — too long, no trigger phrases, 180+ tokens):
"Jira sprint management. Use this tool for sprint CRUD and health checks.
Actions: 'list' show sprints (use state='active' for current sprint).
'get' sprint details with full issue breakdown. 'create' a new sprint.
'move-issues' assign issues to a sprint. 'health' active sprint progress,
stale items, capacity. 'goal' read or set sprint goal. For velocity, retros,
epic progress, and team intelligence use the 'insights' tool..."
```

```
After (v3.0 — concise, trigger phrases, ~120 tokens):
"Sprint management. Actions: list (view sprints by state), get (sprint
details — active: health + blockers + standup with 'since' param,
closed: release notes), create (new sprint), update (set goal, rename),
move-issues (assign issues to sprint). For velocity/retros/planning
use 'insights'."
```

### Rules:
1. **First sentence**: Domain scope in ≤5 words (helps initial routing)
2. **Action list**: name + 3-5 word purpose + quoted trigger phrase for non-obvious actions
3. **Cross-references**: One sentence pointing to sibling tools (helps disambiguation)
4. **No implementation details** — those go in `.describe()` on schema fields
5. **Target: ≤150 tokens** per tool description

### Schema field descriptions

Use `.describe()` with `[action]` scoping and natural language:

```typescript
// Good: clear scope, natural language
since: z.string().optional()
  .describe("[get] ISO date or duration like '24h' — filters to recent changes (standup mode)")

// Good: tells LLM when to use it
tickets: z.array(ticketSchema).optional()
  .describe("[create] Array of tickets for bulk creation. Omit for single ticket.")

// Good: explains dual-purpose
epicKey: z.string().optional()
  .describe("[create] Parent epic. If no summary provided, decomposes epic into child stories.")

// Bad: too generic
count: z.number().optional()
  .describe("Number of items")
```

---

## Output-Driven Discovery

**The most powerful pattern.** Instead of relying on the LLM to memorize 24 actions upfront, teach it through contextual suggestions in tool responses.

### How it works:

Every tool response includes a `suggestions` section when relevant findings trigger them:

```markdown
## Sprint Health: 62/100 (At Risk)

**Blockers (3):** BP-45, BP-67, BP-89 — no movement for 4+ days
**Workload:** Alice has 21 SP (team avg: 12 SP) — overloaded
**Carryover:** BP-23 has been in 3 consecutive sprints

---
Suggested next steps:
• "Get details on BP-45" → issues get
• "Help me plan the next sprint" → insights plan
• "Run my retro" → insights retro
• "Triage BP-45" → bugs triage
```

### Implementation pattern:

```typescript
interface Suggestion {
  condition: string;      // internal: when to show
  naturalPhrase: string;  // what the user would say
  tool: string;           // which tool
  action: string;         // which action
}

function buildSuggestions(context: SprintContext): Suggestion[] {
  const suggestions: Suggestion[] = [];
  if (context.blockerCount > 0) {
    suggestions.push({
      condition: "blockers found",
      naturalPhrase: "Get details on the blocked items",
      tool: "issues", action: "get"
    });
  }
  if (context.overloadedMembers.length > 0) {
    suggestions.push({
      condition: "workload imbalance",
      naturalPhrase: "Run my retro for workload analysis",
      tool: "insights", action: "retro"
    });
  }
  return suggestions;
}
```

### Why this works:
- LLM doesn't need to memorize all 24 actions at tool-selection time
- Discovery happens **in context** — the suggestion appears when it's relevant
- Creates natural workflows: get → retro → plan
- Users also see the suggestions and can ask for them directly

---

## Tool Annotations

MCP SDK supports annotations that help clients handle tools appropriately:

```typescript
server.registerTool("insights", {
  description: "...",
  annotations: {
    readOnlyHint: true,
  },
  inputSchema: insightsSchema,
}, handler);
```

| Tool | readOnlyHint | destructiveHint | Notes |
|------|-------------|-----------------|-------|
| configure | false | false | setup mutates DB |
| knowledge | true | false | pure reads |
| confluence | false | false | spider writes to KB |
| insights | true | false | pure analytics |
| issues | false | true | creates/updates issues |
| bugs | false | false | triage can auto-update |
| backlog | false | false | rank mutates order |
| sprints | false | false | create/update/move mutate |

Read-only tools get auto-approved more often in clients like Claude Code, reducing friction for analytics and search.

---

## Anti-Patterns

### ❌ One action per feature
Every new feature = new action = longer description = worse LLM routing.
✅ Fold intelligence into existing actions.

### ❌ Mutations hidden in reads
`get` with a `goal` param that sets the goal — confusing, accident-prone.
✅ Strict read/write separation. Mutations in `create`/`update` actions.

### ❌ Per-domain search wrappers
Three `search` actions that all take JQL with different auto-scoping.
✅ One universal search. Users learn JQL, not tool selection.

### ❌ Generic action names
`analyze`, `process`, `check` — too vague for LLM to distinguish.
✅ Intent-specific names: `triage`, `plan`, `retro`.

### ❌ Flat parameter schemas
All params at top level, LLM doesn't know which belong to which action.
✅ `[action]` scoping in `.describe()` tags.

### ❌ Silent tools
Tool returns data with no guidance on what to do next.
✅ Contextual suggestions in every response.

### ❌ Relying on LLM to compose multi-step workflows
"First call get, then retro, then plan..."
✅ Build composition internally. `retro` includes velocity. `get` includes health.

---

## Measuring Success

Track these to ensure the design works:

1. **Action hit rate** — every action should be called. Never-called actions → fold further.
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

Review monthly. Fold underused actions. Promote frequently-suggested actions to tool descriptions if they're being missed.

---

## Summary

| Principle | Rule |
|-----------|------|
| Read/write separation | `get` never mutates. Writes in `create`/`update`. |
| Enrich, don't expand | Make existing actions smarter, not more actions. |
| Context-adaptive output | Same action, different output based on state/params. |
| One search | Universal `issues search`. No per-domain wrappers. |
| ≤150-token descriptions | Domain sentence + action table + trigger phrases. |
| Output-driven discovery | Suggestions in responses teach the LLM contextually. |
| Measure and prune | Track usage, fold what's unused. |
| 8 tools, 24 actions | Hard ceiling. New features fold, not add. |
