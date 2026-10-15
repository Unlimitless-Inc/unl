# Unl for Muse Code

Muse Code does the work. Unl carries your why into the work.

Every time you send Muse Code a message, this plugin hands it the decisions you have already made that bear on it, each with its reason, before the model starts. Muse Code still does all the thinking. Unl only brings your reasons into the room.

## Install

```bash
muse plugins marketplace add unl https://github.com/Unlimitless-Inc/unl
muse plugins install unl@unl
muse plugins approve unl
```

Then sign in once:

```bash
npx unlimitless login
```

That opens your browser, signs you in to Unl and keeps a key for this machine in `~/.unl/reach-key`. You never paste a key anywhere. Start Muse Code in a project and ask it what you are working on.

## What it adds

- **A hook on every message.** It sends your message to Unl and gives Muse Code what comes back. When nothing you have decided bears on the message, it adds nothing.
- **Unl's tools**, such as `ask_unl`, so Muse Code can ask for more in the middle of a task. Muse Code asks you before it runs one.

Both use the same sign-in. If you are not signed in yet, the first message in a session tells you how, once.

## Good to know

- Muse Code limits what a hook may return. When a turn has more of your decisions than fit, the plugin sends the ones that bear most and says that the rest are a call to `ask_unl` away.
- Muse Code runs hooks with a cleared environment, so the plugin reads only `~/.unl`. Nothing depends on a shell variable.
- To sign out: `npx unlimitless logout`. To remove the plugin: `muse plugins remove unl`.

Everything else about Unl, and the other tools it works in: [unlimitless.ai/connect](https://unlimitless.ai/connect).
