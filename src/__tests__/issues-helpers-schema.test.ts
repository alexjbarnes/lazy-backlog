import { describe, expect, it } from "vitest";
import type { JiraSchema } from "../lib/jira-types.js";
import { buildSchemaGuidance } from "../tools/issues-helpers.js";

function makeSchema(overrides?: Partial<JiraSchema>): JiraSchema {
  return {
    projectKey: "BP",
    projectName: "Blueprint",
    boardId: "1",
    issueTypes: [
      {
        id: "1",
        name: "Task",
        subtask: false,
        fields: [
          { id: "summary", name: "Summary", required: true, type: "string" },
          { id: "priority", name: "Priority", required: true, type: "string" },
          { id: "story_points", name: "Story Points", required: false, type: "number" },
        ],
        requiredFields: ["summary", "priority"],
      },
      {
        id: "2",
        name: "Bug",
        subtask: false,
        fields: [
          { id: "summary", name: "Summary", required: true, type: "string" },
          { id: "priority", name: "Priority", required: true, type: "string" },
          { id: "environment", name: "Environment", required: true, type: "string" },
          { id: "severity", name: "Severity", required: true, type: "string" },
        ],
        requiredFields: ["summary", "priority", "environment", "severity"],
      },
    ],
    priorities: [{ id: "1", name: "High" }],
    ...overrides,
  };
}

describe("buildSchemaGuidance", () => {
  it("returns schema-not-found message when null", () => {
    const result = buildSchemaGuidance(null, "Task");
    expect(result).toContain("No Jira schema found");
  });

  it("shows fields for the requested issue type", () => {
    const schema = makeSchema();
    const result = buildSchemaGuidance(schema, "Bug");
    expect(result).toContain("Fields for Bug");
    expect(result).toContain("Environment");
    expect(result).toContain("REQUIRED");
  });

  it("shows field differences between Bug and Task", () => {
    const schema = makeSchema();
    const result = buildSchemaGuidance(schema, "Bug");
    expect(result).toContain("Bug vs Task: Field Differences");
    expect(result).toContain("**Environment**");
    expect(result).toContain("**Severity**");
    expect(result).toContain("Required for Bug but not Task");
  });

  it("does not show field differences for Task type", () => {
    const schema = makeSchema();
    const result = buildSchemaGuidance(schema, "Task");
    expect(result).not.toContain("Field Differences");
  });

  it("shows fields only in Task when Bug lacks them", () => {
    const schema: JiraSchema = {
      ...makeSchema(),
      issueTypes: [
        {
          id: "1",
          name: "Task",
          subtask: false,
          fields: [
            { id: "summary", name: "Summary", required: true, type: "string" },
            { id: "components", name: "Components", required: true, type: "array" },
          ],
          requiredFields: ["summary", "components"],
        },
        {
          id: "2",
          name: "Bug",
          subtask: false,
          fields: [{ id: "summary", name: "Summary", required: true, type: "string" }],
          requiredFields: ["summary"],
        },
      ],
    };
    const result = buildSchemaGuidance(schema, "Bug");
    expect(result).toContain("Required for Task but not Bug");
    expect(result).toContain("**Components**");
  });

  it("does not show differences section when fields are identical", () => {
    const schema: JiraSchema = {
      ...makeSchema(),
      issueTypes: [
        { id: "1", name: "Task", subtask: false, fields: [], requiredFields: ["summary"] },
        { id: "2", name: "Story", subtask: false, fields: [], requiredFields: ["summary"] },
      ],
    };
    const result = buildSchemaGuidance(schema, "Story");
    expect(result).not.toContain("Field Differences");
  });
});
