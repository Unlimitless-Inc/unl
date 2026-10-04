#!/usr/bin/env node
/*
 * Claude Code's headersHelper for the Unl MCP server, installed at ~/.unl/headers.cjs.
 * Claude Code runs it when it connects and uses the JSON it prints as request headers, so the
 * key stays in ~/.unl/reach-key (mode 600) and is never written into a project file that could
 * be committed, nor into a command line that `ps` can see.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const home = process.env.UNL_HOME || path.join(os.homedir(), ".unl");
let key = "";
try {
  key = fs.readFileSync(path.join(home, "reach-key"), "utf8").trim();
} catch {}
process.stdout.write(JSON.stringify(key ? { Authorization: `Bearer ${key}` } : {}));
