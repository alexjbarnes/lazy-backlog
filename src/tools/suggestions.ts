// ── Contextual Suggestions ──────────────────────────────────────────────────
// Appended to tool responses to guide users toward logical next actions.
// ~130 lines. No side effects — pure string output.

// ── Types ───────────────────────────────────────────────────────────────────

interface SuggestionRule {
  tool: string;
  action: string;
  condition: (ctx: Record<string, unknown>) => boolean;
  text: string;
}

// ── Rules ───────────────────────────────────────────────────────────────────

const RULES: SuggestionRule[] = [
  // backlog list
  {
    tool: "backlog",
    action: "list",
    condition: (ctx) => (ctx.orphanedCount as number) > 0,
    text: "Assign parent epics to orphaned items \u2192 `issues update`",
  },
  {
    tool: "backlog",
    action: "list",
    condition: (ctx) => (ctx.unestimatedCount as number) > 0,
    text: "Add story points to unestimated items \u2192 `issues update`",
  },

  // bugs triage
  {
    tool: "bugs",
    action: "triage",
    condition: (ctx) => (ctx.triageCount as number) > 0,
    text: "Apply recommended changes \u2192 `issues update` or move to sprint \u2192 `sprints move-issues`",
  },

  // issues create (confirmed)
  {
    tool: "issues",
    action: "create",
    condition: (ctx) => ctx.confirmed === true,
    text: "Add to sprint \u2192 `sprints move-issues` or rank in backlog \u2192 `backlog rank`",
  },

  // issues get
  {
    tool: "issues",
    action: "get",
    condition: (ctx) => ctx.hasMissingFields === true,
    text: "Fill in missing fields \u2192 `issues update`",
  },

  // issues search
  {
    tool: "issues",
    action: "search",
    condition: (ctx) => (ctx.resultCount as number) > 0,
    text: "View full details \u2192 `issues get`",
  },

  // sprints get
  {
    tool: "sprints",
    action: "get",
    condition: (ctx) => (ctx.blockerCount as number) > 0,
    text: "Triage blocked items \u2192 `bugs triage` or view details \u2192 `issues get`",
  },
  {
    tool: "sprints",
    action: "get",
    condition: (ctx) => (ctx.healthScore as number) < 70,
    text: "Run retrospective for deeper analysis \u2192 `insights retro`",
  },
  {
    tool: "sprints",
    action: "get",
    condition: (ctx) => (ctx.carryoverCount as number) > 0,
    text: "Review carry-over items and re-prioritize \u2192 `backlog list`",
  },
  {
    tool: "sprints",
    action: "get",
    condition: (ctx) => ctx.isClosedSprint === true,
    text: "Run retrospective on this sprint \u2192 `insights retro`",
  },

  // insights retro
  {
    tool: "insights",
    action: "retro",
    condition: () => true,
    text: "Review backlog priorities \u2192 `backlog list`",
  },

  // insights epic-progress
  {
    tool: "insights",
    action: "epic-progress",
    condition: (ctx) => ctx.behindSchedule === true,
    text: "Review backlog priorities \u2192 `backlog list`",
  },

  // knowledge stats
  {
    tool: "knowledge",
    action: "stats",
    condition: (ctx) => (ctx.staleCount as number) > 0,
    text: "Re-index stale content \u2192 `confluence spider`",
  },

  // configure setup
  {
    tool: "configure",
    action: "setup",
    condition: () => true,
    text: "View your backlog \u2192 `backlog list` or search docs \u2192 `knowledge search`",
  },
];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build contextual "next steps" suggestions based on what was found.
 * Returns a markdown block to append, or empty string if nothing applies.
 */
export function buildSuggestions(tool: string, action: string, context: Record<string, unknown>): string {
  const matching = RULES.filter((r) => r.tool === tool && r.action === action && r.condition(context));
  if (matching.length === 0) return "";

  const lines = matching.map((r) => `\u2022 ${r.text}`).join("\n");
  return `\n\n---\n**Next steps:**\n${lines}`;
}
