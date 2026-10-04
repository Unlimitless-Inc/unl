/**
 * @unlimitless/ai-sdk/eve : Unl as the why step in an eve agent.
 *
 * eve (Vercel's agent framework) takes runtime context through dynamic instructions: a file in
 * agent/instructions/ whose `turn.started` handler returns instructions for the turn. This is that
 * file's whole body:
 *
 *   // agent/instructions/unl.ts
 *   export { default } from "@unlimitless/ai-sdk/eve";
 *
 * On every turn Unl reads the incoming message, and the decisions that bear on it arrive with their
 * reasons before the model thinks. Nothing bears, nothing is added. Unl never decides for the person.
 * Set UNL_KEY in the agent's environment. Custom options: export default unlInstructions({ ... }).
 */
import { defineDynamic, defineInstructions } from "eve/instructions";
import { serve, type UnlOptions } from "./index.js";

type EveMessage = { role: string; content: unknown };

export function lastUserText(messages: readonly EveMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const c = m.content;
    const text = typeof c === "string"
      ? c
      : Array.isArray(c) ? c.filter((p: any) => p?.type === "text" && typeof p.text === "string").map((p: any) => p.text).join("\n") : "";
    if (text.trim()) return text.trim();
  }
  return undefined;
}

export function unlInstructions(opts: UnlOptions = {}) {
  let warned = false;
  return defineDynamic({
    events: {
      "turn.started": async (_event, ctx) => {
        const query = lastUserText(ctx.messages as readonly EveMessage[]);
        if (!query) return null;
        try {
          const served = await serve(query, { ...opts, receiverModel: ctx.model?.id });
          return served.context ? defineInstructions({ content: served.context, role: "system" }) : null;
        } catch (e) {
          if (opts.onUnavailable === "throw") throw e;
          if (!warned) { warned = true; console.warn(`[unl] carrying on without Unl: ${(e as Error).message}`); }
          return null;
        }
      },
    },
  });
}

export default unlInstructions();
