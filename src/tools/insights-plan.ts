import { computeVelocity } from "../lib/analytics.js";
import { buildJiraClient, errorResponse, textResponse } from "../lib/config.js";
import type { KnowledgeBase } from "../lib/db.js";
import type { SearchIssue } from "../lib/jira.js";
import { fetchSprintData, getStoryPoints } from "./sprints-utils.js";

// ── Types ──

type ToolResponse = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const DONE_CATEGORIES = new Set(["done"]);

function isDoneIssue(issue: SearchIssue): boolean {
  const cat = (issue.fields.status?.statusCategory?.name ?? "").toLowerCase();
  if (DONE_CATEGORIES.has(cat)) return true;
  const status = (issue.fields.status?.name ?? "").toLowerCase();
  return status === "done" || status === "closed" || status === "resolved";
}

// ── Helpers ──

interface OwnershipInsight {
  component: string;
  assignees: Array<{ name: string; percentage: number }>;
}

function parseOwnershipInsights(
  allInsights: Array<{ category: string; insight_key: string; data: string }>,
): OwnershipInsight[] {
  return allInsights
    .filter((i) => i.category === "ownership")
    .map((i) => {
      try {
        return { component: i.insight_key, ...JSON.parse(i.data) } as OwnershipInsight;
      } catch {
        return null;
      }
    })
    .filter((i): i is OwnershipInsight => i !== null);
}

function suggestAssignee(issue: SearchIssue, ownership: OwnershipInsight[]): string | undefined {
  if (ownership.length === 0) return undefined;
  const components = (issue.fields as Record<string, unknown>).components as Array<{ name: string }> | undefined;
  if (!components || components.length === 0) return undefined;

  for (const comp of components) {
    const match = ownership.find((o) => o.component.toLowerCase() === comp.name.toLowerCase());
    if (match?.assignees?.[0]) {
      return match.assignees[0].name;
    }
  }
  return undefined;
}

// ── Formatting ──

function formatVelocitySection(velocity: ReturnType<typeof computeVelocity>): string {
  let out = "## Velocity\n\n";
  out += `**Average:** ${Math.round(velocity.average)} SP/sprint | **Trend:** ${velocity.trend}`;
  if (velocity.trendSlope !== 0) {
    out += ` (${velocity.trendSlope > 0 ? "+" : ""}${velocity.trendSlope.toFixed(2)} SP/sprint)`;
  }
  out += "\n\n";

  if (velocity.sprints.length > 0) {
    out += "| Sprint | Committed | Completed | Carry-Over |\n";
    out += "|--------|-----------|-----------|------------|\n";
    for (const s of velocity.sprints) {
      out += `| ${s.sprintName} | ${s.committed} SP | ${s.completed} SP | ${s.carryOver} SP |\n`;
    }
    out += "\n";
  }
  return out;
}

function formatCarryoverSection(
  carryover: Array<{ key: string; summary: string; sp: number }>,
  carryoverSP: number,
): string {
  if (carryover.length === 0) return "## Carryover\n\nNo carryover items.\n\n";

  let out = `## Carryover (${carryover.length} items, ${carryoverSP} SP)\n\n`;
  for (const item of carryover) {
    out += `- **${item.key}**: ${item.summary} (${item.sp} SP)\n`;
  }
  out += "\n";
  return out;
}

function formatCapacitySection(velocityAvg: number, carryoverSP: number, availableSP: number): string {
  let out = "## Capacity\n\n";
  out += `- **Velocity average:** ${Math.round(velocityAvg)} SP\n`;
  out += `- **Carryover:** ${carryoverSP} SP\n`;
  out += `- **Available for new work:** ${Math.round(availableSP)} SP\n`;

  if (availableSP < velocityAvg * 0.2) {
    out +=
      "\n> **Warning:** Available capacity is less than 20% of velocity average. Consider reducing carryover before pulling new work.\n";
  }
  out += "\n";
  return out;
}

function formatRecommendedSection(
  items: Array<{ key: string; summary: string; sp: number; assignee?: string }>,
  totalSP: number,
  velocityAvg: number,
): string {
  if (items.length === 0) return "## Recommended Items\n\nNo items fit the available capacity.\n\n";

  let out = `## Recommended Items (${items.length} items, ${totalSP} SP)\n\n`;
  out += "| Key | Summary | SP | Suggested Assignee |\n";
  out += "|-----|---------|----|-----------|\n";
  for (const item of items) {
    const assignee = item.assignee ?? "-";
    const summaryTrunc = item.summary.length > 60 ? `${item.summary.slice(0, 57)}...` : item.summary;
    out += `| ${item.key} | ${summaryTrunc} | ${item.sp} | ${assignee} |\n`;
  }

  if (totalSP > velocityAvg) {
    out += `\n> **Overcommitment warning:** Recommended items (${totalSP} SP) exceed velocity average (${Math.round(velocityAvg)} SP).\n`;
  }
  out += "\n";
  return out;
}

function formatStretchSection(items: Array<{ key: string; summary: string; sp: number }>): string {
  if (items.length === 0) return "";
  let out = "## Stretch Goals\n\n";
  for (const item of items) {
    out += `- **${item.key}**: ${item.summary} (${item.sp} SP)\n`;
  }
  out += "\n";
  return out;
}

function formatWorkloadSection(assigneeMap: Map<string, { sp: number; issues: number }>): string {
  if (assigneeMap.size === 0) return "";

  let out = "## Workload Balance\n\n";
  out += "| Assignee | SP | Issues |\n";
  out += "|----------|----|---------|\n";
  for (const [name, data] of assigneeMap) {
    out += `| ${name} | ${data.sp} | ${data.issues} |\n`;
  }
  out += "\n";
  return out;
}

// ── Main handler ──

export async function handlePlanAction(params: { sprintCount?: number }, kb: KnowledgeBase): Promise<ToolResponse> {
  const { jira, config } = buildJiraClient(kb);
  const boardId = config.jiraBoardId ?? "";
  if (!boardId) {
    return errorResponse("No board ID configured. Set JIRA_BOARD_ID or run configure action='setup'.");
  }

  // 1. Velocity
  const sprintCount = params.sprintCount ?? 5;
  const sprintData = await fetchSprintData(jira, boardId, sprintCount);
  if (sprintData.length === 0) {
    return errorResponse("No closed sprints found. Need sprint history to compute velocity for planning.");
  }
  const velocity = computeVelocity(sprintData);

  // 2. Active sprint carryover
  const activeSprints = await jira.listSprints(boardId, "active");
  const carryoverItems: Array<{ key: string; summary: string; sp: number }> = [];
  let carryoverSP = 0;

  if (activeSprints.length > 0) {
    const activeSprint = activeSprints[0];
    if (activeSprint) {
      const { issues } = await jira.getSprintIssues(String(activeSprint.id));
      for (const issue of issues) {
        if (!isDoneIssue(issue)) {
          const sp = getStoryPoints(issue.fields, jira.storyPointsFieldId);
          carryoverItems.push({ key: issue.key, summary: issue.fields.summary, sp });
          carryoverSP += sp;
        }
      }
    }
  }

  const availableCapacity = Math.max(0, velocity.average - carryoverSP);

  // 3. Backlog items
  const backlog = await jira.getBacklogIssues(boardId, 30);
  const recommended: Array<{ key: string; summary: string; sp: number; assignee?: string }> = [];
  const stretch: Array<{ key: string; summary: string; sp: number }> = [];

  // 4. Ownership insights for assignee suggestions
  let ownership: OwnershipInsight[] = [];
  try {
    const allInsights = kb.getAllInsights();
    ownership = parseOwnershipInsights(allInsights);
  } catch {
    // No insights available — skip assignee suggestions
  }

  // 5. Bin-packing
  let remaining = availableCapacity;
  let recommendedSP = 0;
  const assigneeWorkload = new Map<string, { sp: number; issues: number }>();

  for (const issue of backlog.issues) {
    const sp = getStoryPoints(issue.fields, jira.storyPointsFieldId) || 0;
    if (sp <= remaining) {
      const assignee = suggestAssignee(issue, ownership);
      recommended.push({ key: issue.key, summary: issue.fields.summary, sp, assignee });
      remaining -= sp;
      recommendedSP += sp;

      if (assignee) {
        const existing = assigneeWorkload.get(assignee) ?? { sp: 0, issues: 0 };
        existing.sp += sp;
        existing.issues += 1;
        assigneeWorkload.set(assignee, existing);
      }
    } else {
      stretch.push({ key: issue.key, summary: issue.fields.summary, sp });
      if (stretch.length >= 3) break;
    }
  }

  // 6. Format output
  let out = "# Sprint Planning Assistant\n\n";
  out += formatVelocitySection(velocity);
  out += formatCarryoverSection(carryoverItems, carryoverSP);
  out += formatCapacitySection(velocity.average, carryoverSP, availableCapacity);
  out += formatRecommendedSection(recommended, recommendedSP, velocity.average);
  out += formatStretchSection(stretch);
  out += formatWorkloadSection(assigneeWorkload);

  return textResponse(out);
}
