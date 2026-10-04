/**
 * Unl inside Mastra: two coding agents from two different companies, run by one Mastra setup, both
 * working from the same person's decisions and the reasons behind them.
 *
 *   npm start -- "Add retries to the export job"      each agent asks Unl, then acts
 *   npm run ask-only -- "Add retries to the export job"   each agent asks Unl, and nothing else runs
 *
 * The shape is the same for every agent, whoever made it:
 *   1. the agent says who it is and what it is about to do;
 *   2. Unl answers with what bears on that, shaped for that agent;
 *   3. the agent acts for itself, with Unl's tools there if it wants the full reasoning;
 *   4. what it did comes back to you, and only you change what you decided.
 * Mastra runs the agents. Unl never does: it only answers when asked.
 */
import { Mastra } from "@mastra/core/mastra";
import { ClaudeSDKAgent } from "@mastra/claude";
import { CursorSDKAgent } from "@mastra/cursor";
import { whatBears, unlMcp, decisionTitles, type AgentSurface } from "./unl.js";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";
const CURSOR_MODEL = process.env.CURSOR_MODEL ?? "";
const WORKDIR = process.env.WORKDIR ?? process.cwd();

/** Mastra and its two agents, built only when they will run, so asking Unl alone needs no model key. */
export function buildMastra(): Mastra {
  const builder = new ClaudeSDKAgent({
    id: "builder",
    description: "Makes the change.",
    sdkOptions: { model: CLAUDE_MODEL, cwd: WORKDIR, mcpServers: { unl: unlMcp() } },
  });
  const reviewer = new CursorSDKAgent({
    id: "reviewer",
    description: "Reviews the change against what was decided.",
    sdkOptions: { model: { id: CURSOR_MODEL }, local: { cwd: WORKDIR }, mcpServers: { unl: unlMcp() } },
  });
  return new Mastra({ agents: { builder, reviewer } });
}

type Seat = { id: "builder" | "reviewer"; surface: AgentSurface; model: string; job: string };
const SEATS: Seat[] = [
  { id: "builder", surface: "claude-code", model: CLAUDE_MODEL, job: "Make this change." },
  { id: "reviewer", surface: "cursor", model: CURSOR_MODEL || "", job: "Review the change the builder just made." },
];

function promptFor(seat: Seat, task: string, why: string): string {
  const context = why
    ? `What the person has decided that bears on this, and why, from Unl:\n\n${why}\n\n`
    : "";
  return `${context}${seat.job}\n\nTask: ${task}\n\nIf a decision above bears on what you do, say which one and how you followed it. ` +
    `If you think a decision is wrong for this task, say so plainly; it stays the person's to change.`;
}

async function main() {
  const askOnly = process.argv.includes("--ask-only");
  const task = process.argv.slice(2).filter((a) => a !== "--ask-only" && a !== "--").join(" ").trim()
    || "Add retries to the export job";
  if (!process.env.UNL_KEY) {
    console.log("Set UNL_KEY first (unlimitless.ai/portal/keys). Without it each agent runs without your decisions.");
  }
  if (!askOnly && !CURSOR_MODEL) {
    console.log("Set CURSOR_MODEL to a Cursor model id for the reviewer, or run npm run ask-only.");
    process.exit(1);
  }

  const mastra = askOnly ? null : buildMastra();
  const windows = [];
  for (const seat of SEATS) {
    const w = await whatBears(seat.id, seat.surface, seat.model, `${seat.job} ${task}`);
    windows.push(w);
    const titles = decisionTitles(w.why);
    console.log(`\nUnl → ${seat.id} (${seat.surface}): ${w.why.length} characters, ${titles.length} decision(s)`);
    for (const t of titles) console.log(`  · ${t}`);
    if (!mastra) continue;

    const agent = mastra.getAgentById(seat.id);
    const out = await agent.generate(promptFor(seat, task, w.why));
    console.log(`\n${seat.id} answered:\n${out.text}`);
  }

  const [a, b] = windows.map((w) => new Set(decisionTitles(w.why)));
  const shared = [...a].filter((t) => b.has(t));
  console.log(`\nBoth agents were handed ${shared.length} of the same decision(s)${shared.length ? `, including "${shared[0]}"` : ""}.`);
  console.log("Change a decision in any AI you use, run this again, and both agents work from the new one.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
