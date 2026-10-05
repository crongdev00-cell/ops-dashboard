#!/usr/bin/env bash
# Run this AFTER you have closed the Claude Code CLI for this session (the one
# that asked you to run it). It does, in order:
#   1. Confirm the Claude Code process for this session is not running
#   2. Final session export (via export-session.sh) — this is the authoritative
#      copy, taken only once the transcript file is no longer being written
#   3. Secret scan over the exported session + the rest of the repo diff
#   4. Stage only the transfer-relevant files (not a blanket `git add -A`)
#   5. Commit
#   6. Push
#   7. Verify the push actually landed by comparing local vs remote HEAD via
#      the GitHub API (not just trusting `git push`'s exit code)
#
# Usage: ./finalize-and-push.sh <session-id>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SESSION_ID="${1:-}"
if [ -z "$SESSION_ID" ]; then
  echo "Usage: finalize-and-push.sh <session-id>" >&2
  exit 1
fi

echo "== Step 1: confirm the Claude Code CLI for this session is closed =="
# A still-open session holds its .jsonl file open for writing. We can't reliably
# detect "is process X still running" cross-platform from inside the script with
# certainty, so we require explicit confirmation rather than guessing.
read -r -p "Have you fully closed the Claude Code window/terminal for THIS session? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborting. Close the CLI first, then re-run this script." >&2
  exit 1
fi

echo "== Step 2: final session export =="
"$SCRIPT_DIR/export-session.sh" "$SESSION_ID"

echo "== Step 3: secret scan =="
SECRET_PATTERN='AQ\.Ab8RN6KF2FF57|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
FOUND=0

# Scan the exported session transcript (it may contain tool output that echoed
# secrets during the conversation).
if grep -rEn "$SECRET_PATTERN" "$SCRIPT_DIR/session" 2>/dev/null; then
  FOUND=1
fi

# Scan whatever is about to be committed from the rest of the repo.
cd "$PROJECT_ROOT"
if git diff --cached -- . ':!manual/manual_offline.html' ':!manual/*.png' 2>/dev/null | grep -iE "$SECRET_PATTERN"; then
  FOUND=1
fi

if [ "$FOUND" -eq 1 ]; then
  echo "ERROR: possible secret detected above. Review and redact before committing." >&2
  echo "  (Known-noisy files like manual_offline.html's embedded base64 images were excluded" >&2
  echo "   from the repo scan but NOT from the session scan — check context before assuming" >&2
  echo "   a session-transcript hit is a false positive.)" >&2
  exit 1
fi
echo "No known secret patterns found."

echo "== Step 4: stage transfer-relevant files only =="
git add .session-transfer/
git add HANDOFF.md 2>/dev/null || true
git status --short

echo "== Step 5: commit =="
if git diff --cached --quiet; then
  echo "Nothing new to commit (transfer files unchanged since last run)."
else
  git commit -m "$(cat <<EOF
Add session transfer package for computer B handoff

Exports Claude Code session $SESSION_ID (manifest + checksums) and
HANDOFF.md so work can resume on another machine.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
fi

echo "== Step 6: push =="
git push origin main

echo "== Step 7: verify remote actually has this commit =="
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(gh api repos/:owner/:repo/commits/main --jq '.sha' 2>/dev/null || true)"
if [ -z "$REMOTE_SHA" ]; then
  # fall back to parsing remote url for owner/repo
  REMOTE_URL="$(git remote get-url origin)"
  OWNER_REPO="$(echo "$REMOTE_URL" | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?#\1#')"
  REMOTE_SHA="$(gh api "repos/$OWNER_REPO/commits/main" --jq '.sha')"
fi

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "OK: remote main is at $REMOTE_SHA, matches local HEAD."
else
  echo "MISMATCH: local HEAD=$LOCAL_SHA remote main=$REMOTE_SHA" >&2
  exit 1
fi

echo "Done. Session $SESSION_ID exported and pushed."
