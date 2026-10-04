# Unl in an eve agent

[eve](https://vercel.com/docs/eve) takes runtime context through dynamic instructions in `agent/instructions/`. Unl is one file there.

```bash
npx eve@latest init my-agent          # or use your existing eve agent
cd my-agent
npm install @unlimitless/ai-sdk
mkdir -p agent/instructions
echo 'export { default } from "@unlimitless/ai-sdk/eve";' > agent/instructions/unl.ts
npx eve link                           # Vercel project + AI Gateway credentials
vercel env add UNL_KEY                  # a key from https://unlimitless.ai/portal/keys
npx eve dev
```

On every turn (`turn.started`), Unl reads the incoming message. The decisions that bear on it are added as a system instruction, each with its reason, before the model thinks. When nothing bears, nothing is added. If Unl cannot be reached, the turn goes ahead without it.

Checked 25 Sep 2026 on eve 0.66.3 (Node 24):
- A fresh `eve init` agent with this file passes `npm run typecheck`.
- The handler, called with a real eve context and a live key, returned a system instruction of 12,330 characters.
- With no user message it returns nothing, and it returns nothing when Unl is unreachable.

Not yet checked: `eve build` (it stopped on eve's own sandbox runtime on the test machine, before reaching this file) and a full model turn.

Want your model to carry the why on every call too, including tool steps inside a turn? Wrap the model: `defineAgent({ model: withUnl("anthropic/claude-sonnet-5") })` with `import { withUnl } from "@unlimitless/ai-sdk"`.
