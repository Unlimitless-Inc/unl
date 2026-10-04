// Unl on Netlify: a Netlify Function whose model calls carry the person's why.
// Netlify's AI Gateway injects OPENAI_API_KEY and OPENAI_BASE_URL, so the AI SDK's OpenAI provider needs
// no key of yours. Unl joins through the middleware; set UNL_KEY in the site's environment variables.
import type { Config } from "@netlify/functions";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withUnl } from "@unlimitless/ai-sdk";

const model = withUnl(openai("gpt-5-mini"));

export default async (req: Request) => {
  const { prompt } = (await req.json()) as { prompt: string };
  const { text } = await generateText({ model, prompt });
  return Response.json({ text });
};

export const config: Config = { path: "/api/chat" };
