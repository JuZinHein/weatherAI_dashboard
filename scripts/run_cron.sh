#!/usr/bin/env bash
# =============================================================================
# Automated FourCastNet Myanmar Cron Runner
# =============================================================================
# Add this script to your crontab to execute every 6 hours aligned with NOAA GFS:
#
# Recommended crontab line:
# 30 3,9,15,21 * * * /bin/bash /path/to/NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/scripts/run_cron.sh >> /var/log/fourcastnet_cron.log 2>&1
# =============================================================================

set -e

# Resolve directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================================================"
echo "[CRON] Starting NVIDIA FourCastNet Myanmar forecast pipeline: $(date -u)"
echo "App Directory: $APP_DIR"
echo "========================================================================"

# Export NGC_API_KEY from environment or local .env if present
if [ -f "$APP_DIR/.env" ]; then
    export $(grep -v '^#' "$APP_DIR/.env" | xargs)
fi

# 1. Run Python pipeline (with earth2studio + matplotlib + NIM inference)
if command -v python3 &>/dev/null; then
    echo "[CRON] Executing Python FourCastNet pipeline..."
    python3 "$APP_DIR/backend/fourcastnet_pipeline.py"
else
    echo "[CRON] python3 is required to run the forecast pipeline." >&2
    exit 1
fi

echo "[CRON] Pipeline completed successfully: $(date -u)"
echo "========================================================================"
