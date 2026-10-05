#!/usr/bin/env bash
# Exports the Claude Code session files needed to resume THIS conversation on another
# machine. Run from Git Bash. Safe to re-run (overwrites its own output only).
#
# What it does:
#   1. Locates this project's Claude Code session directory under ~/.claude/projects/
#   2. Copies the current session's .jsonl transcript + its sidecar folder
#      (subagents/, tool-results/) into .session-transfer/claude/session/
#   3. Writes manifest.json recording session id, CLI version, file list, sha256
#      checksums, and the original project path
#
# This does NOT include other sessions for this project, or any other project's
# sessions, or Codex sessions.
#
# IMPORTANT: for a final/authoritative export, the Claude Code CLI for this
# session must be closed first — the .jsonl file is actively written while the
# session is open, so an export taken mid-session is a snapshot, not final.
# finalize-and-push.sh enforces this before calling this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/session"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SESSION_ID="${1:-}"
if [ -z "$SESSION_ID" ]; then
  echo "Usage: export-session.sh <session-id>" >&2
  echo "  (find it in your scratchpad path, e.g. .../claude/<project>/<SESSION_ID>/scratchpad)" >&2
  exit 1
fi

# Claude Code's default session store. If CLAUDE_CONFIG_DIR is set, that takes
# precedence (same rule the CLI itself uses).
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJECTS_DIR="$CLAUDE_HOME/projects"

# Claude Code derives the per-project directory name by replacing each of
# ':', '\', '/', '_' in the absolute project path with '-' (verified against
# this project: E:\llm_pt\ops-dashboard -> E--llm-pt-ops-dashboard).
sanitize_path() {
  printf '%s' "$1" | sed -E 's/[:\\\/_]/-/g'
}

WIN_PROJECT_PATH=$(cd "$PROJECT_ROOT" && pwd -W 2>/dev/null || cygpath -w "$PROJECT_ROOT" 2>/dev/null || echo "$PROJECT_ROOT")
PROJECT_DIR_NAME=$(sanitize_path "$WIN_PROJECT_PATH")
SESSION_PROJECT_DIR="$PROJECTS_DIR/$PROJECT_DIR_NAME"

JSONL_SRC="$SESSION_PROJECT_DIR/$SESSION_ID.jsonl"
SIDECAR_SRC="$SESSION_PROJECT_DIR/$SESSION_ID"

if [ ! -f "$JSONL_SRC" ]; then
  echo "ERROR: session transcript not found at: $JSONL_SRC" >&2
  echo "  Checked derived project dir: $SESSION_PROJECT_DIR" >&2
  echo "  If this looks wrong, list \$HOME/.claude/projects/ and pass the correct session id." >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp "$JSONL_SRC" "$OUT_DIR/$SESSION_ID.jsonl"

if [ -d "$SIDECAR_SRC" ]; then
  cp -r "$SIDECAR_SRC" "$OUT_DIR/$SESSION_ID"
fi

CLI_VERSION="$(claude --version 2>/dev/null | head -1 || echo unknown)"
EXPORTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Build manifest.json with per-file sha256 + size, using only POSIX-ish tools.
MANIFEST="$OUT_DIR/manifest.json"
{
  echo "{"
  echo "  \"sessionId\": \"$SESSION_ID\","
  echo "  \"claudeVersion\": \"$CLI_VERSION\","
  echo "  \"exportedAt\": \"$EXPORTED_AT\","
  echo "  \"originalProjectPath\": \"$WIN_PROJECT_PATH\","
  echo "  \"sourceSessionDir\": \"$SESSION_PROJECT_DIR\","
  echo "  \"files\": ["
  first=1
  find "$OUT_DIR" -type f ! -name manifest.json | sort | while read -r f; do
    rel="${f#"$OUT_DIR"/}"
    size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
    sha=$(sha256sum "$f" | cut -d' ' -f1)
    if [ "$first" -eq 0 ]; then echo "    ,"; fi
    first=0
    printf '    {"path": "%s", "sizeBytes": %s, "sha256": "%s"}\n' "$rel" "$size" "$sha"
  done
  echo "  ]"
  echo "}"
} > "$MANIFEST"

echo "Exported session $SESSION_ID to $OUT_DIR"
echo "Files:"
find "$OUT_DIR" -type f | sort
