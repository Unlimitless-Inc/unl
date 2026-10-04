// The red arm first: without the middleware the model sees no Unl context; with it, it does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { withUnl, injectContext, latestUserText, UnlNoUserError } from "../dist/index.js";

function mockModel(seen) {
  return new MockLanguageModelV4({
    modelId: "mock-model",
    doGenerate: async (opts) => {
      seen.push(opts.prompt);
      return { content: [{ type: "text", text: "ok" }], finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] };
    },
  });
}
const POSTURE = "DECIDED: background jobs run on the existing Postgres queue. BECAUSE: one fewer system to operate.";
function fakeFetch(calls, { status = 200, posture = POSTURE } = {}) {
  return async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ operating_posture: posture, canonical_sources: [{ id: "r1" }] }), { status });
  };
}

test("red arm: an unwrapped model gets no Unl context", async () => {
  const seen = [];
  await generateText({ model: mockModel(seen), system: "You help.", prompt: "Should we add Kafka?" });
  assert.ok(!JSON.stringify(seen[0]).includes("DECIDED:"));
});

test("the wrapped model gets Unl's context as a system message after the caller's own", async () => {
  const seen = [], calls = [];
  const model = withUnl(mockModel(seen), { apiKey: "unl_test", fetch: fakeFetch(calls) });
  await generateText({ model, system: "You help.", prompt: "Should we add Kafka?" });
  const p = seen[0];
  assert.equal(p[0].role, "system"); assert.equal(p[0].content, "You help.");
  assert.equal(p[1].role, "system"); assert.equal(p[1].content, POSTURE);
  assert.equal(p[2].role, "user");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.unlimitless.ai/api/ask");
  assert.equal(calls[0].body.query, "Should we add Kafka?");
  assert.equal(calls[0].body.receiver_model, "mock-model");
  assert.equal(calls[0].init.headers.authorization, "Bearer unl_test");
});

test("fails open: Unl down, the call still runs, without context", async () => {
  const seen = [], calls = [];
  const model = withUnl(mockModel(seen), { apiKey: "unl_test", fetch: fakeFetch(calls, { status: 503 }) });
  const r = await generateText({ model, prompt: "Should we add Kafka?" });
  assert.equal(r.text, "ok");
  assert.ok(!JSON.stringify(seen[0]).includes("DECIDED:"));
});

test("onUnavailable throw fails the call", async () => {
  const model = withUnl(mockModel([]), { apiKey: "unl_test", onUnavailable: "throw", fetch: fakeFetch([], { status: 503 }) });
  await assert.rejects(generateText({ model, prompt: "x" }), /Unl answered HTTP 503/);
});

test("no key: fails open with a warning, not a crash", async () => {
  const seen = [];
  const saved = process.env.UNL_KEY; delete process.env.UNL_KEY;
  const r = await generateText({ model: withUnl(mockModel(seen)), prompt: "x" });
  if (saved) process.env.UNL_KEY = saved;
  assert.equal(r.text, "ok");
});

test("a repeated query within the cache window costs one Unl call", async () => {
  const calls = [];
  const model = withUnl(mockModel([]), { apiKey: "unl_test", fetch: fakeFetch(calls) });
  await generateText({ model, prompt: "same" });
  await generateText({ model, prompt: "same" });
  assert.equal(calls.length, 1);
});

test("a gateway id string is accepted and wrapped", () => {
  const m = withUnl("openai/gpt-5", { apiKey: "unl_test" });
  assert.equal(typeof m.doGenerate, "function");
  assert.equal(m.modelId, "openai/gpt-5");
});

test("helpers: latest user text, and injection with no system message", () => {
  const prompt = [{ role: "user", content: [{ type: "text", text: "first" }] }, { role: "assistant", content: [{ type: "text", text: "a" }] }, { role: "user", content: [{ type: "text", text: "second" }] }];
  assert.equal(latestUserText(prompt), "second");
  const out = injectContext(prompt, "CTX");
  assert.deepEqual(out[0], { role: "system", content: "CTX" });
  assert.equal(out.length, 4);
});

// ── A platform's end users ──────────────────────────────
test("userKey: the end user's key is the one sent, never apiKey or UNL_KEY", async () => {
  const calls = [];
  const saved = process.env.UNL_KEY; process.env.UNL_KEY = "unl_developer_own";
  try {
    const model = withUnl(mockModel([]), { apiKey: "unl_developer_own", userKey: "unl_end_user_1", fetch: fakeFetch(calls) });
    await generateText({ model, prompt: "Should we add Kafka?" });
  } finally { if (saved === undefined) delete process.env.UNL_KEY; else process.env.UNL_KEY = saved; }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.authorization, "Bearer unl_end_user_1");
});

test("userKey per call: one model serves two end users, each with their own key and their own window", async () => {
  const calls = [];
  const model = withUnl(mockModel([]), { userKey: ({ providerOptions }) => providerOptions?.unl?.userKey, fetch: fakeFetch(calls) });
  await generateText({ model, prompt: "same question", providerOptions: { unl: { userKey: "unl_alice" } } });
  await generateText({ model, prompt: "same question", providerOptions: { unl: { userKey: "unl_bob" } } });
  assert.deepEqual(calls.map((c) => c.init.headers.authorization), ["Bearer unl_alice", "Bearer unl_bob"],
    "the same query from a second end user must be fetched with their key, never answered from the first user's cached window");
});

test("userKey that names no user for a call: refused, nothing fetched, and never served from UNL_KEY", async () => {
  const calls = [];
  const saved = process.env.UNL_KEY; process.env.UNL_KEY = "unl_developer_own";
  try {
    const model = withUnl(mockModel([]), { userKey: () => undefined, fetch: fakeFetch(calls) });
    await assert.rejects(generateText({ model, prompt: "x" }), (e) => e instanceof UnlNoUserError);
  } finally { if (saved === undefined) delete process.env.UNL_KEY; else process.env.UNL_KEY = saved; }
  assert.equal(calls.length, 0);
});

test("a platform key used to serve is refused loudly, even with onUnavailable continue", async () => {
  const platformRefusal = async (url, init) =>
    new Response(JSON.stringify({ error: "out_of_scope", scope: "platform", detail: "this key is scoped to 'platform'" }), { status: 403 });
  const model = withUnl(mockModel([]), { apiKey: "unl_platform_key", fetch: platformRefusal });
  await assert.rejects(generateText({ model, prompt: "x" }), (e) => e instanceof UnlNoUserError && /platform key/.test(e.message));
});

test("any other 403 still fails open (an unservable workspace is not a misconfiguration)", async () => {
  const seen = [];
  const other = async () => new Response(JSON.stringify({ error: "workspace_not_servable" }), { status: 403 });
  const r = await generateText({ model: withUnl(mockModel(seen), { apiKey: "unl_test", fetch: other }), prompt: "x" });
  assert.equal(r.text, "ok");
});

test("live: a real key gets a real window from Unl (runs only when UNL_KEY is set)", { skip: !process.env.UNL_KEY }, async () => {
  const seen = [];
  // The live check asks as a shadow read, which serves the same window but is never recorded: a test run
  // must not land in the key owner's serve log as a real turn.
  const shadow = (url, init) => globalThis.fetch(url, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), channel: "judge_shadow" }) });
  await generateText({ model: withUnl(mockModel(seen), { fetch: shadow }), prompt: "What have I already decided about how Unl reaches a model?" });
  const sys = seen[0].filter((m) => m.role === "system");
  assert.ok(sys.length >= 1 && sys[0].content.length > 200, "expected a served window");
});
