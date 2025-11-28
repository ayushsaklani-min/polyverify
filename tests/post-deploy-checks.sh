#!/usr/bin/env bash
# Usage: ./tests/post-deploy-checks.sh
set -euo pipefail

echo "Running post-deploy checks..."
node tools/sanity-check.js
echo "Sanity check complete."



