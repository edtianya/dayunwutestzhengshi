#!/usr/bin/env bash
#
# examclock_v2 deploy script
# Usage: SERVER_PASS=xxx bash scripts/deploy.sh
#
# Packages project files, uploads to server, injects ICP filing info,
# and reloads nginx.
#
# Required: scripts/.env (see scripts/.env.example)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Load config ─────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "ERROR: scripts/.env not found. Copy from scripts/.env.example and fill in."
  exit 1
fi
source "$SCRIPT_DIR/.env"

: "${SERVER_USER:?SERVER_USER not set}"
: "${SERVER_HOST:?SERVER_HOST not set}"
: "${SERVER_PASS:?SERVER_PASS not set}"
: "${ICP_ICP_NUMBER:?ICP_ICP_NUMBER not set}"
: "${ICP_GA_NUMBER:?ICP_GA_NUMBER not set}"
: "${ICP_GA_CODE:?ICP_GA_CODE not set}"

REMOTE_DIR="/usr/share/nginx/html/examclock"
ARCHIVE="/tmp/examclock_v2_deploy.tar.gz"

# ── Step 1: Package ─────────────────────────────────────
echo "==> Packaging project..."
cd "$PROJECT_DIR"
tar czf "$ARCHIVE" \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='.playwright-mcp' \
  --exclude='.playwright-cli' \
  --exclude='tmp' \
  --exclude='scripts' \
  --exclude='.editorconfig' \
  --exclude='STRUCTURE.md' \
  --exclude='design.html' \
  .
echo "    Archive: $(du -h "$ARCHIVE" | cut -f1)"

# ── Step 2: Upload ──────────────────────────────────────
echo "==> Uploading to $SERVER_HOST..."
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no "$ARCHIVE" \
  "$SERVER_USER@$SERVER_HOST:$ARCHIVE"

# ── Step 3: Extract ─────────────────────────────────────
echo "==> Extracting on server..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no \
  "$SERVER_USER@$SERVER_HOST" bash -s <<'REMOTE_EXTRACT'
set -e
cd /usr/share/nginx/html/examclock

# Clean up old files that have been reorganized
rm -rf iconfont/ 2>/dev/null || true
rm -f script.js custom-exam.js styles.css favicon.png 2>/dev/null || true
find . -name '._*' -delete 2>/dev/null || true

tar xzf /tmp/examclock_v2_deploy.tar.gz
find . -name '._*' -delete 2>/dev/null || true
rm -f /tmp/examclock_v2_deploy.tar.gz
echo "    Files synced."
REMOTE_EXTRACT

# ── Step 4: Inject ICP filing info ──────────────────────
echo "==> Injecting ICP filing info..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no \
  "$SERVER_USER@$SERVER_HOST" bash -s <<REMOTE_INJECT
set -e
cd "$REMOTE_DIR"

python3 << 'PYEOF'
import re

ICP_ICP_NUMBER = "$ICP_ICP_NUMBER"
ICP_GA_NUMBER = "$ICP_GA_NUMBER"
ICP_GA_CODE = "$ICP_GA_CODE"

ICP_HTML = f"""        <div class="icp-info">
          <a href="https://beian.miit.gov.cn/" target="_blank">{ICP_ICP_NUMBER}</a>
          |
          <img src="assets/images/ga_icon.png" alt="公安备案图标" style="vertical-align: middle; width: 16px; height: 16px;" />
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code={ICP_GA_CODE}" rel="noreferrer"
            target="_blank">{ICP_GA_NUMBER}</a>
        </div>"""

# index.html: inject ICP inside bottom-bar, after restoreHintLargeScreen
with open("index.html", "r") as f:
    c = f.read()
c = re.sub(
    r'(id="restoreHintLargeScreen"[\s\S]*?点击恢复倒数日期\s*\n\s*</div>)',
    r"\1\n" + ICP_HTML,
    c, count=1
)
with open("index.html", "w") as f:
    f.write(c)
print("    index.html: ICP injected into bottom-bar")

# custom-exam.html: inject bottom-bar with ICP before Service Worker
with open("custom-exam.html", "r") as f:
    c = f.read()
block = f"    <!-- 底部区域 -->\n    <div class=\"bottom-bar\">\n      <div class=\"bottom-content\">\n{ICP_HTML}\n      </div>\n    </div>\n\n"
c = re.sub(r"(\s*<!-- Service Worker 注册 -->)", "\n" + block + r"    \1".strip(), c, count=1)
with open("custom-exam.html", "w") as f:
    f.write(c)
print("    custom-exam.html: ICP injected")

# introduction.html: inject ICP after author line
with open("introduction.html", "r") as f:
    c = f.read()
c = re.sub(
    r'(作者：罗霖\s*\n\s*</div>)',
    r"\1\n" + ICP_HTML,
    c, count=1
)
with open("introduction.html", "w") as f:
    f.write(c)
print("    introduction.html: ICP injected")
PYEOF

# Ensure ga_icon.png exists on server
if [ ! -f assets/images/ga_icon.png ]; then
  echo "    WARNING: assets/images/ga_icon.png not found on server! Please upload it manually."
fi
REMOTE_INJECT

# ── Step 5: Reload nginx ────────────────────────────────
echo "==> Reloading nginx..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no \
  "$SERVER_USER@$SERVER_HOST" "nginx -t 2>&1 && systemctl reload nginx"

# ── Verify ──────────────────────────────────────────────
echo "==> Verifying..."
HTTP_CODE=$(curl -sI "http://$SERVER_HOST/" | head -1 | awk '{print $2}')
if [ "$HTTP_CODE" = "200" ]; then
  echo "    HTTP $HTTP_CODE - Deploy successful!"
else
  echo "    HTTP $HTTP_CODE - Something may be wrong."
fi

# Cleanup local archive
rm -f "$ARCHIVE"
echo "==> Done."
