/**
 * @unlimitless/ai-sdk : Unl, your why agent, inside any Vercel AI SDK model.
 *
 * Unl keeps what you decided and why. Wrap a model once and every call it makes carries the part of
 * your reasoning that bears on that call, chosen by Agent Unl before your model thinks. Your model,
 * tools and prompts stay exactly as they are: Unl adds one system message and never decides for you.
 *
 *   import { withUnl } from "@unlimitless/ai-sdk";
 *   const model = withUnl(openai("gpt-5"));        // reads UNL_KEY from the environment
 *   await generateText({ model, prompt: "Should we add a queue for background jobs?" });
 *
 * The reach is structural: the middleware runs on every call, so the model cannot skip it the way
 * it can skip an optional tool. If Unl cannot be reached, the call goes ahead without it (fail open,
 * one warning), because your product must never stop because Unl did.
 */
import type { LanguageModelMiddleware } from "ai";
import { gateway, wrapLanguageModel } from "ai";

export const VERSION = "0.1.0";
const DEFAULT_BASE_URL = "https://api.unlimitless.ai";

export type UnlOptions = {
  /** A key from https://unlimitless.ai/portal/keys. Defaults to process.env.UNL_KEY. */
  apiKey?: string;
  /** Defaults to https://api.unlimitless.ai (or process.env.UNL_BASE_URL). */
  baseUrl?: string;
  /** Cap on the served context, in bytes. Unl keeps what bears most and drops the rest. */
  budgetBytes?: number;
  /** How long to wait for Unl before carrying on without it. Default 4000 ms. */
  timeoutMs?: number;
  /** "continue" (default) runs the call without Unl when it cannot be reached; "throw" fails the call. */
  onUnavailable?: "continue" | "throw";
  /** Which text Unl reads for the call. Default: the latest user message. */
  query?: (prompt: PromptMessage[]) => string | undefined;
  /** Reuse a served window for the same query within this many ms (tool-loop steps repeat it). Default 60000. */
  cacheMs?: number;
  /**
   * FOR A PLATFORM SERVING ITS OWN USERS: the end user's key, the one Unl handed back when you provisioned
   * them (POST /api/platform/users). A string for one user, or a function that picks the key for each call
   * (from its providerOptions, say). Once set, it is the ONLY key this model uses: a call it gives no key
   * for is refused with UnlNoUserError, never served from UNL_KEY, so no end user is ever handed your own
   * decisions.
   */
  userKey?: string | ((params: { prompt: PromptMessage[]; providerOptions?: Record<string, any> }) => string | undefined);
  /** Injected for tests; defaults to globalThis.fetch. */
  fetch?: typeof fetch;
};

/** The subset of the AI SDK prompt shape this middleware reads (stable across LanguageModel V2 to V4). */
export type PromptMessage =
  | { role: "system"; content: string }
  | { role: "user" | "assistant" | "tool"; content: Array<{ type: string; text?: string }> };

/** What Unl served for one call, exposed for logging and tests. */
export type UnlServe = { query: string; context: string; sources: string[] };

export class UnlUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnlUnavailableError";
  }
}

/**
 * A call that could only have been served the wrong world: userKey is set but named no user for this call,
 * or the key is a platform key (it provisions users and serves no one). Thrown whatever onUnavailable says,
 * because carrying on would not be "Unl is down", it would be a misconfiguration answered silently.
 */
export class UnlNoUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnlNoUserError";
  }
}

/** Which key a call uses: the end user's when userKey is set (and nothing else), else apiKey or UNL_KEY. */
export function keyFor(opts: UnlOptions, params: { prompt: PromptMessage[]; providerOptions?: Record<string, any> }): string | undefined {
  if (opts.userKey !== undefined) {
    const k = typeof opts.userKey === "function" ? opts.userKey(params) : opts.userKey;
    const key = typeof k === "string" ? k.trim() : "";
    if (!key) throw new UnlNoUserError("userKey named no end user for this call, so Unl served nothing (it never falls back to your own key)");
    return key;
  }
  const env = typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>);
  return opts.apiKey ?? env.UNL_KEY;
}

export function latestUserText(prompt: PromptMessage[]): string | undefined {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m.role !== "user") continue;
    const text = m.content
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return undefined;
}

/** Put Unl's context after the caller's own system messages and before the conversation. */
export function injectContext(prompt: PromptMessage[], context: string): PromptMessage[] {
  const firstNonSystem = prompt.findIndex((m) => m.role !== "system");
  const at = firstNonSystem === -1 ? prompt.length : firstNonSystem;
  return [...prompt.slice(0, at), { role: "system", content: context }, ...prompt.slice(at)];
}

/** Ask Unl what bears on this text. One HTTP call; no model call on your bill. */
export async function serve(query: string, opts: UnlOptions & { receiverModel?: string } = {}): Promise<UnlServe> {
  const env = typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>);
  const key = opts.apiKey ?? env.UNL_KEY;
  if (!key) throw new UnlUnavailableError("No Unl key: set UNL_KEY to a key from https://unlimitless.ai/portal/keys");
  const base = (opts.baseUrl ?? env.UNL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = opts.fetch ?? globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await doFetch(`${base}/api/ask`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "user-agent": `@unlimitless/ai-sdk/${VERSION}`,
      },
      body: JSON.stringify({
        query,
        surface: "ai-sdk",
        ...(opts.receiverModel ? { receiver_model: opts.receiverModel } : {}),
        ...(opts.budgetBytes ? { budget_bytes: opts.budgetBytes } : {}),
      }),
    });
    if (res.status === 403) {
      const refusal: any = await res.json().catch(() => null);
      if (refusal?.error === "out_of_scope" && refusal?.scope === "platform") {
        throw new UnlNoUserError("This is a platform key: it provisions your users and serves no one. Pass userKey with the end user's key.");
      }
    }
    if (!res.ok) throw new UnlUnavailableError(`Unl answered HTTP ${res.status}`);
    const body: any = await res.json();
    const context = typeof body?.operating_posture === "string" ? body.operating_posture : "";
    const sources = Array.isArray(body?.canonical_sources) ? body.canonical_sources.map((s: any) => String(s?.id)) : [];
    return { query, context, sources };
  } catch (e: any) {
    if (e instanceof UnlUnavailableError || e instanceof UnlNoUserError) throw e;
    throw new UnlUnavailableError(e?.name === "AbortError" ? "Unl did not answer in time" : `Unl could not be reached: ${e?.message ?? e}`);
  } finally {
    clearTimeout(timer);
  }
}

/** The AI SDK middleware. Use withUnl() unless you compose middleware yourself. */
export function unlMiddleware(opts: UnlOptions = {}): LanguageModelMiddleware {
  const cache = new Map<string, { at: number; served: UnlServe }>();
  const cacheMs = opts.cacheMs ?? 60_000;
  let warned = false;
  return {
    transformParams: async ({ params, model }) => {
      const prompt = params.prompt as unknown as PromptMessage[];
      const query = (opts.query ?? latestUserText)(prompt);
      if (!query) return params;
      // The key first: a call with no end user is refused here, before anything is fetched or cached.
      const apiKey = keyFor(opts, { prompt, providerOptions: (params as any).providerOptions });
      // The cache is per key AND query: one end user's window is never handed to another asking the same thing.
      const slot = `${apiKey ?? ""}\u0000${query}`;
      let served: UnlServe | undefined;
      const hit = cache.get(slot);
      if (hit && Date.now() - hit.at < cacheMs) served = hit.served;
      else {
        try {
          served = await serve(query, { ...opts, apiKey, receiverModel: model?.modelId });
          cache.set(slot, { at: Date.now(), served });
          if (cache.size > 100) cache.delete(cache.keys().next().value as string);
        } catch (e) {
          if (e instanceof UnlNoUserError) throw e;
          if (opts.onUnavailable === "throw") throw e;
          if (!warned) {
            warned = true;
            console.warn(`[unl] carrying on without Unl: ${(e as Error).message}`);
          }
          return params;
        }
      }
      if (!served.context) return params;
      return { ...params, prompt: injectContext(prompt, served.context) as unknown as typeof params.prompt };
    },
  };
}

type WrappableModel = Parameters<typeof wrapLanguageModel>[0]["model"];

/**
 * Wrap any AI SDK language model so every call carries the part of your why that bears on it.
 * Pass a model object (openai("gpt-5")) or a Vercel AI Gateway id ("openai/gpt-5").
 */
export function withUnl(model: WrappableModel | string, opts: UnlOptions = {}) {
  const resolved = typeof model === "string" ? (gateway(model) as unknown as WrappableModel) : model;
  return wrapLanguageModel({ model: resolved, middleware: unlMiddleware(opts) });
}
