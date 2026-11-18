#!/usr/bin/env node
"use strict";

/**
 * UI workflow guard for app-media-creator (Claude Code PreToolUse hook).
 *
 * Blocks writes to src/web/components, src/web/layouts and src/web/pages until, in the same
 * session, (1) the component-architect subagent has run and (2) the daisyui skill has been loaded.
 * Adapted from ki-mal-mit/.claude/hooks/ui-workflow-guard.cjs.
 *
 * State is stored per session id in the OS temp directory, so a new session always
 * starts without prerequisites. INVENTORY.md is exempt so the inventory can be updated first.
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const UI_SEGMENTS = ["/src/web/components/", "/src/web/layouts/", "/src/web/pages/"];
const EXEMPT_FILES = ["/src/web/components/inventory.md"];
const WRITE_TOOLS = new Set(["write", "edit", "multiedit", "notebookedit"]);
const AGENT_TOOLS = new Set(["agent", "task"]);
const ARCHITECT = "component-architect";
const DAISYUI_SKILL = "daisyui";

function readPayload() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function normalize(value) {
  return String(value || "").replace(/\\/g, "/").toLowerCase();
}

function stateFileFor(payload) {
  const key = crypto
    .createHash("sha1")
    .update(`${normalize(payload.cwd)}|${payload.session_id || "no-session"}`)
    .digest("hex")
    .slice(0, 16);
  return path.join(os.tmpdir(), `app-media-creator-ui-guard-${key}.json`);
}

function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_error) {
    return { architectAt: null, daisyuiAt: null };
  }
}

function saveState(file, state) {
  try {
    fs.writeFileSync(file, JSON.stringify(state), "utf8");
  } catch (_error) {
    // Best effort: a failing state write must never crash the session.
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exitCode = 0;
}

function isUiPath(filePath) {
  const p = `/${normalize(filePath).replace(/^\/+/, "")}`;
  if (EXEMPT_FILES.some((exempt) => p.endsWith(exempt))) return false;
  return UI_SEGMENTS.some((segment) => p.includes(segment));
}

function isDaisyuiLoad(toolName, input) {
  if (toolName === "skill") {
    const skill = normalize(input.skill || input.name);
    return skill === DAISYUI_SKILL || skill.endsWith(`:${DAISYUI_SKILL}`);
  }
  if (toolName === "read") {
    return normalize(input.file_path).includes(`/.claude/skills/${DAISYUI_SKILL}/`);
  }
  return false;
}

(function main() {
  const payload = readPayload();
  if (payload.hook_event_name && payload.hook_event_name !== "PreToolUse") return;

  const toolName = normalize(payload.tool_name);
  const input = payload.tool_input || {};
  const file = stateFileFor(payload);
  const state = loadState(file);
  const now = new Date().toISOString();

  if (AGENT_TOOLS.has(toolName) && normalize(input.subagent_type) === ARCHITECT) {
    state.architectAt = now;
    saveState(file, state);
    return;
  }

  if (isDaisyuiLoad(toolName, input)) {
    state.daisyuiAt = now;
    saveState(file, state);
    return;
  }

  if (!WRITE_TOOLS.has(toolName)) return;

  const target = input.file_path || input.notebook_path || "";
  if (!isUiPath(target)) return;

  const missing = [];
  if (!state.architectAt) missing.push("run the agent `component-architect`");
  if (!state.daisyuiAt) missing.push("load the skill `daisyui`");

  if (missing.length > 0) {
    deny(
      `UI change blocked (${target}). First ${missing.join(" and ")}. ` +
        "See section 4 (STOP) in .github/copilot-instructions.md."
    );
  }
})();
