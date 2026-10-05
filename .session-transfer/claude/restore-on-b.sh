#!/usr/bin/env bash
# Run this on computer B, from Git Bash, AFTER cloning the repo there.
# It copies the exported session into B's own Claude Code session store so
# `claude --resume <session-id>` can pick it up, WITHOUT touching any of B's
# existing sessions, settings, or auth.
#
# Usage: ./restore-on-b.sh [path-to-this-project-on-B]
#   If omitted, uses the directory this script's repo was cloned into.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SESSION_EXPORT_DIR="$SCRIPT_DIR/session"
MANIFEST="$SESSION_EXPORT_DIR/manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: no exported session found at $SESSION_EXPORT_DIR (manifest.json missing)." >&2
  echo "  This means finalize-and-push.sh was not run on computer A, or the export" >&2
  echo "  folder wasn't committed. Nothing to restore." >&2
  exit 1
fi

SESSION_ID="$(grep -o '"sessionId": *"[^"]*"' "$MANIFEST" | sed -E 's/.*"sessionId": *"([^"]*)".*/\1/')"
ORIG_PATH="$(grep -o '"originalProjectPath": *"[^"]*"' "$MANIFEST" | sed -E 's/.*"originalProjectPath": *"([^"]*)".*/\1/')"

if [ -z "$SESSION_ID" ]; then
  echo "ERROR: could not read sessionId from manifest.json" >&2
  exit 1
fi

TARGET_PROJECT_PATH="${1:-$REPO_ROOT}"

echo "Session to restore : $SESSION_ID"
echo "Original path (A)  : $ORIG_PATH"
echo "Target path (B)    : $TARGET_PROJECT_PATH"
echo

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJECTS_DIR="$CLAUDE_HOME/projects"

sanitize_path() {
  printf '%s' "$1" | sed -E 's/[:\\\/_]/-/g'
}

WIN_TARGET_PATH=$(cd "$TARGET_PROJECT_PATH" && pwd -W 2>/dev/null || cygpath -w "$TARGET_PROJECT_PATH" 2>/dev/null || echo "$TARGET_PROJECT_PATH")
PROJECT_DIR_NAME=$(sanitize_path "$WIN_TARGET_PATH")
DEST_PROJECT_DIR="$PROJECTS_DIR/$PROJECT_DIR_NAME"
DEST_JSONL="$DEST_PROJECT_DIR/$SESSION_ID.jsonl"
DEST_SIDECAR="$DEST_PROJECT_DIR/$SESSION_ID"

echo "Computed B session dir: $DEST_PROJECT_DIR"
echo "  (derived by replacing ':','\\','/','_' with '-' in the path above — if B's"
echo "   Claude Code version names project directories differently, this will be"
echo "   wrong; check by running 'claude' once in $TARGET_PROJECT_PATH first and"
echo "   looking at what directory it creates under $PROJECTS_DIR, then re-run this"
echo "   script with that confirmed, or copy the files there by hand.)"
echo

if [ -e "$DEST_JSONL" ] || [ -e "$DEST_SIDECAR" ]; then
  echo "ERROR: a session with id $SESSION_ID already exists at $DEST_PROJECT_DIR." >&2
  echo "  Refusing to overwrite. If you want a fresh copy under a new id instead," >&2
  echo "  resume with --fork-session, or manually rename/back up the existing files first." >&2
  exit 1
fi

mkdir -p "$DEST_PROJECT_DIR"
cp "$SESSION_EXPORT_DIR/$SESSION_ID.jsonl" "$DEST_JSONL"
if [ -d "$SESSION_EXPORT_DIR/$SESSION_ID" ]; then
  cp -r "$SESSION_EXPORT_DIR/$SESSION_ID" "$DEST_SIDECAR"
fi

echo "Copied session files into: $DEST_PROJECT_DIR"
echo
echo "Verify checksums against manifest.json manually if you want extra assurance:"
echo "  sha256sum \"$DEST_JSONL\""
echo
echo "Next: cd \"$TARGET_PROJECT_PATH\" && claude --resume $SESSION_ID"
echo "  (add --fork-session if you'd rather continue under a NEW session id"
echo "   and leave this copy untouched)"
