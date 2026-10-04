// Unl in a Cloudflare Agent: Unl joins as the MCP server "unl", and its tools reach the model through
// this.mcp.getAITools(). Set the key once: `npx wrangler secret put UNL_KEY`.
import { Agent, routeAgentRequest } from "agents";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";

type Env = { AI: Ai; UNL_KEY: string; UnlAgent: DurableObjectNamespace };

const UNL_INSTRUCTIONS =
  "Unl holds what the person has already decided, each decision with its reason. Before you act on a " +
  "choice they may already have settled, call ask_unl with the step you are about to take. Act within " +
  "any decision that bears; if a step would cross one, say which and ask the person. Unl never decides for them.";

export class UnlAgent extends Agent<Env> {
  async onRequest(request: Request): Promise<Response> {
    await this.addMcpServer("unl", "https://api.unlimitless.ai/mcp", {
      transport: { type: "streamable-http", headers: { Authorization: `Bearer ${this.env.UNL_KEY}` } },
    });
    const { prompt } = (await request.json()) as { prompt: string };
    const workersai = createWorkersAI({ binding: this.env.AI });
    const { text } = await generateText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: UNL_INSTRUCTIONS,
      prompt,
      tools: this.mcp.getAITools(),
    });
    return Response.json({ text });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
