#!/usr/bin/env bash

# Strix Security Scan Script for Arbor Project
# This script runs a Strix pentest on the Arbor project
# Requires LLM_API_KEY for OpenRouter API key

# Load environment if exists
if [ -f "/home/adeel/Documents/projects/dev-hub/.env" ]; then
    export $(grep -v '^#' /home/adeel/Documents/projects/dev-hub/.env | xargs)
fi

# Check if required environment variables are set
if [ -z "$LLM_API_KEY" ]; then
    echo "ERROR: LLM_API_KEY is not set. Please set it with the appropriate LLM API key."
    echo "Example: export LLM_API_KEY=\"your-api-key-here\""
    exit 1
fi

# Check if strix is installed
if ! command -v strix &> /dev/null; then
    echo "ERROR: strix command is not found. Please install strix first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running or not installed."
    exit 1
fi

# Set strix environment variables
export STRIX_LLM="openrouter/z-ai/glm-5.3"

# Create a timestamp for the run
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_NAME="security-scan-${TIMESTAMP}"

# Run the security scan
 echo "Starting Strix security scan: $RUN_NAME"
 echo "Target: /home/adeel/Documents/projects/dev-hub"
 echo "Scan mode: standard"
 echo "Max budget: 15 USD"

echo "Note: This may take 20-40 minutes."
echo "Press Ctrl+C to cancel."

echo "\n=== Running Strix ==="
strix -n -t /home/adeel/Documents/projects/dev-hub --scan-mode standard --max-budget 15

# Check if the scan was successful
if [ $? -eq 0 ]; then
    echo "\n=== Scan completed successfully ==="
    echo "Results are in: strix_runs/${RUN_NAME}/"
    echo "Key files:"
    echo "  - penetration_test_report.md (summary report)"
    echo "  - vulnerabilities/ (individual finding files)"
    echo "  - vulnerabilities.json (JSON results)"
    echo "  - run.json (scan metadata)"
else
    echo "\n=== Scan completed with findings ==="
    echo "Results are in: strix_runs/${RUN_NAME}/"
    echo "Review the penetration_test_report.md for findings."
fi

echo "\n=== Next Steps ==="
echo "1. Review the security findings in penetration_test_report.md"
echo "2. Check the specific vulnerabilities in strix_runs/${RUN_NAME}/vulnerabilities/"
echo "3. Prioritize and fix the most critical issues first"
echo "4. Re-run scan to verify fixes"
