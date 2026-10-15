"use strict";

// Presentation only: use the frame's public-safe receiver label, never an agent id or a guessed model.
const SURFACES = {
  "claude-code": "Claude Code", "claude.ai": "Claude", "claude-web": "Claude",
  "claude-desktop": "Claude Desktop", claude: "Claude", chatgpt: "ChatGPT", codex: "Codex",
  cursor: "Cursor", windsurf: "Devin Desktop", cline: "Cline", zed: "Zed", vscode: "VS Code",
  copilot: "Copilot", gemini: "Gemini", "ai-sdk": "AI SDK",
};
const UNKNOWN = /^(unknown|unclassified|an AI|a coding agent|the Unl API|an AI app Unl does not recognise yet|mcp|api|hook)$/i;

/** @param {{label?: string|null, surface?: string|null}} receiver @param {string} viewer */
function beatsFor(receiver, viewer) {
  const label = typeof receiver.label === "string" ? receiver.label.trim() : "";
  const name = label && !UNKNOWN.test(label) && /^[\p{L}\p{N} .+-]{1,48}$/u.test(label)
    ? label : SURFACES[String(receiver.surface || "").toLowerCase()] || null;
  const owner = viewer !== "public";
  return name
    ? { asked: `${owner ? "You asked" : "Asked"} ${name}`, told: `Unl to ${name}`, did: `${name} did`, then: `Then ${name}` }
    : { asked: owner ? "You asked" : "Asked", told: "Unl", did: owner ? "Your AI did" : "The AI did", then: owner ? "Then your AI" : "Then the AI" };
}

module.exports = { beatsFor };
