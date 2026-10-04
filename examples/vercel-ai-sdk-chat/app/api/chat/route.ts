// The whole integration: wrap the model with Unl, and every call carries the part of your why that
// bears on it. The model id goes through the Vercel AI Gateway (auth is automatic on Vercel).
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { withUnl } from "@unlimitless/ai-sdk";

const model = withUnl(process.env.UNL_MODEL ?? "openai/gpt-5-mini");

// A failed model call reaches the page as words, never as a question with no reply. The AI SDK's
// default turns every error into "An error occurred.", which hides the fault a new deploy hits most:
// the AI Gateway refuses calls until the Vercel team has a card on file.
function explain(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/credit card|customer_verification_required/i.test(text)) {
    return "The Vercel AI Gateway refused the model call: your Vercel team needs a card on file. Add one in your team's AI Gateway settings (it also unlocks the free credits), then ask again.";
  }
  return `The model call failed: ${text}`;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model,
    system: "You help the person with their project.",
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse({ onError: explain });
}
