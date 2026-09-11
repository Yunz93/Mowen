import { describe, expect, it } from "vitest";
import { flattenSessionTree } from "../../apps/server/src/tasks/session-tree.ts";

describe("session tree", () => {
  it("records model_change nodes with previous and next model keys", () => {
    const nodes = flattenSessionTree(
      [
        {
          entry: {
            type: "message",
            id: "u1",
            parentId: null,
            message: { role: "user", content: [{ type: "text", text: "hi" }] },
          },
          children: [
            {
              entry: {
                type: "model_change",
                id: "m1",
                parentId: "u1",
                provider: "openai",
                modelId: "gpt-5.6-sol",
              },
              children: [
                {
                  entry: {
                    type: "model_change",
                    id: "m2",
                    parentId: "m1",
                    model: "anthropic/opus",
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      "m2",
    );
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({
      id: "m1",
      role: "model_change",
      text: "openai/gpt-5.6-sol",
    });
    expect(nodes[2]).toMatchObject({
      id: "m2",
      role: "model_change",
      text: "openai/gpt-5.6-sol -> anthropic/opus",
      leaf: true,
    });
  });
});
