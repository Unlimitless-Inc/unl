/**
 * Unl inside OpenAI's Agents SDK: two agents with a handoff between them, each working from the same
 * person's decisions and the reasons behind them, without the first passing them along.
 *
 *   npm start -- "Plan the move of the export job to the queue"      run both agents
 *   npm run ask-only -- "Plan the move of the export job to the queue"   ask Unl only, no model call
 *
 * How it works. Each agent's instructions are a function the SDK calls when that agent becomes the one
 * acting. The function asks Unl what bears on this agent's task, as this agent. So when the planner
 * hands off to the writer, the writer asks Unl itself: the person's reasoning never has to survive the
 * handoff, because it never has to travel through it. Unl's tools come in over MCP for an agent that
 * wants the full reasoning behind a decision, or to report what it did.
 */
import { Agent, MCPServerStreamableHttp, run, type RunContext } from "@openai/agents";
import { whatBears, unlMcpOptions, decisionTitles } from "./unl.js";

// The SDK's own default and its own override, so this example runs the model the SDK would.
const MODEL = process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5.6-luna";

type Ctx = { task: string };

const ROLES = {
  planner: "You are the planner. Turn the task into a short plan of at most five steps, then hand off to the writer.",
  writer: "You are the writer. Write the first step of the plan as a short, concrete change description.",
} as const;

/** Instructions that ask Unl, as this agent, at the moment it starts acting. */
function withUnl(role: keyof typeof ROLES) {
  return async (rc: RunContext<Ctx>, agent: Agent<Ctx>) => {
    const why = await whatBears(agent.name, MODEL, `${ROLES[role]} Task: ${rc.context.task}`);
    const context = why ? `\n\nWhat the person has decided that bears on this, and why, from Unl:\n\n${why}` : "";
    return `${ROLES[role]}${context}\n\nIf a decision above bears on what you do, say which one and how you followed it. If you think one is wrong for this task, say so plainly; it stays the person's to change.`;
  };
}

async function main() {
  const askOnly = process.argv.includes("--ask-only");
  const task = process.argv.slice(2).filter((a) => a !== "--ask-only" && a !== "--").join(" ").trim()
    || "Plan the move of the export job to the queue";
  if (!process.env.UNL_KEY) console.log("Set UNL_KEY first (unlimitless.ai/portal/keys). Without it the agents run without your decisions.");

  if (askOnly) {
    const seen: Set<string>[] = [];
    for (const role of ["planner", "writer"] as const) {
      const why = await whatBears(role, MODEL, `${ROLES[role]} Task: ${task}`);
      const titles = decisionTitles(why);
      seen.push(new Set(titles));
      console.log(`\nUnl → ${role}: ${why.length} characters, ${titles.length} decision(s)`);
      for (const t of titles) console.log(`  · ${t}`);
    }
    const shared = [...seen[0]].filter((t) => seen[1].has(t));
    console.log(`\nAfter the handoff the writer asks Unl itself, and gets ${shared.length} of the planner's decision(s) without being passed any.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log("Set OPENAI_API_KEY to let the agents act, or run npm run ask-only.");
    process.exit(1);
  }
  const unl = new MCPServerStreamableHttp(unlMcpOptions());
  await unl.connect();
  try {
    const writer = new Agent<Ctx>({ name: "writer", model: MODEL, instructions: withUnl("writer"), mcpServers: [unl] });
    const planner = new Agent<Ctx>({ name: "planner", model: MODEL, instructions: withUnl("planner"), mcpServers: [unl], handoffs: [writer] });
    const result = await run(planner, task, { context: { task } });
    console.log(`\nLast agent: ${result.lastAgent?.name}\n\n${result.finalOutput}`);
  } finally {
    await unl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
