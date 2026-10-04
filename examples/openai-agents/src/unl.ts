/**
 * The one call every agent in this example shares: ask Unl what bears on this agent's task.
 *
 * POST https://api.unlimitless.ai/api/ask with the task and the agent's model, and the answer's
 * `operating_posture` is a text block: the decisions that bear, each with its reason. It is the
 * TypeScript twin of ../unl_ask.py. One HTTP call, no model call on your bill. If Unl cannot be
 * reached, it returns "" and the agent carries on without it.
 */

const BASE = (process.env.UNL_BASE_URL ?? "https://api.unlimitless.ai").replace(/\/+$/, "");

export async function whatBears(agent: string, model: string, task: string): Promise<string> {
  const key = process.env.UNL_KEY;
  if (!key || !task.trim()) return "";
  try {
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "user-agent": "unl-openai-agents-example/0.1" },
      body: JSON.stringify({ query: task, receiver_model: model }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { operating_posture?: string };
    return body.operating_posture ?? "";
  } catch (err) {
    // Fail open: never stop the agent because Unl did.
    console.log(`[unl] ${agent} carries on without Unl: ${(err as Error).message}`);
    return "";
  }
}

/** Unl's own tools over MCP, at the address and key every Unl example uses. */
export function unlMcpOptions(): { name: string; url: string; requestInit: { headers: Record<string, string> } } {
  return { name: "unl", url: `${BASE}/mcp`, requestInit: { headers: { Authorization: `Bearer ${process.env.UNL_KEY ?? ""}` } } };
}

/** The decisions a window carries, by title, so two agents' windows can be compared side by side. */
export function decisionTitles(why: string): string[] {
  return [...why.matchAll(/^\[(\d+)\] (.+?)(?= \(canonical| — why:| — open:| — held back:|$)/gm)].map((m) => m[2].trim());
}
