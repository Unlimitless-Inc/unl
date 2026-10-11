#!/usr/bin/env node
/**
 * A changed decision, carried to a fresh agent. Runs in a few seconds with Node 18+, no account, no key and no
 * model: `node demo/changed-decision.mjs`.
 *
 * What it shows. Say you decided exports run synchronously, because your files are small. A planning agent asks
 * Unl what bears on its task and gets that decision with its reason. Then you change your mind: exports are
 * queued, because larger files now exceed the request timeout. A brand-new agent, told nothing about the change,
 * asks the same question and gets the new decision. A copy of the old context does not.
 *
 * What it is not. Unl here is a local stand-in that answers the same request the real service answers
 * (POST /api/ask, Bearer key, `operating_posture` back), so the demo needs no account. The "agent" is a fixed rule,
 * not a model, so nothing here measures a model. A context file you keep up to date by hand gives the same answer;
 * what Unl changes is that nobody has to remember to update it. The request below is the one
 * examples/openai-agents/src/unl.ts sends to the real service with your key.
 */
import { createServer } from "node:http";

const SYNC = "[1] Exports run synchronously — why: Your files are small, so the simple path is enough.";
const QUEUED = "[2] Exports are queued — why: Larger files now exceed the request timeout.";

// The local stand-in for Unl: it answers with whatever you have decided right now.
let decided = SYNC;
const asked = [];
const unl = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  asked.push(JSON.parse(body));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ operating_posture: decided }));
});

// The request every Unl example makes: what bears on this task?
async function whatBears(base, task) {
  const res = await fetch(`${base}/api/ask`, {
    method: "POST",
    cache: "no-store",
    headers: { authorization: "Bearer demo-only", "content-type": "application/json" },
    body: JSON.stringify({ query: task, receiver_model: "demo" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).operating_posture ?? "";
}

// A fixed rule standing in for an agent: it follows whatever decision its context carries.
function plan(context) {
  if (context.includes("queued")) return "Queue the export job.";
  if (context.includes("synchronously")) return "Run the export inline.";
  return "No decision to follow.";
}

const check = (ok, line) => {
  console.log(`  ${ok ? "✓" : "✗"} ${line}`);
  if (!ok) process.exitCode = 1;
};

await new Promise((resolve) => unl.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${unl.address().port}`;
  const task = "Plan the export feature";

  console.log("\n1. A planning agent asks what bears on its task.");
  const first = await whatBears(base, task);
  console.log(`   Unl: ${first}\n   Plan: ${plan(first)}`);

  console.log("\n2. You change the decision. Nobody tells the agents.");
  const copied = first;
  decided = QUEUED;
  console.log(`   Now decided: ${QUEUED}`);

  console.log("\n3. A brand-new agent asks the same question.");
  const fresh = await whatBears(base, task);
  console.log(`   Unl: ${fresh}\n   Plan: ${plan(fresh)}`);
  console.log(`   An agent working from the copied context would still plan: ${plan(copied)}`);

  console.log("");
  check(fresh === QUEUED, "the fresh agent got the changed decision and its reason");
  check(plan(fresh) !== plan(copied), "its plan differs from one made on the old context");
  check(asked.every((a) => a.query === task && !JSON.stringify(a).includes("synchronously")), "it was told nothing about the change: its request carried only the task");
  console.log(process.exitCode ? "\nThe demo did not run as described." : "\nThat is the whole loop: decide once, and every agent that asks gets what you decided now.");
} finally {
  unl.closeAllConnections?.();
  await new Promise((resolve) => unl.close(resolve));
}
