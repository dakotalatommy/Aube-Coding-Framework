#!/bin/bash

# White Screen Diagnostic Test Runner
# This script runs the diagnostic test and displays results

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 BrandVX White Screen Diagnostic"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to test directory
cd "$(dirname "$0")"

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

echo "📦 Checking Playwright installation..."
if ! npx playwright --version &> /dev/null; then
    echo "⚠️  Playwright not installed. Installing..."
    npx playwright install chromium
fi

echo "✓ Playwright ready"
echo ""

# Run the diagnostic test
echo "🚀 Running diagnostic test..."
echo "   Target: https://app.brandvx.io"
echo "   Browser: Chromium (laptop viewport)"
echo ""

# Run with detailed output
npx playwright test white-screen-diagnostic.spec.ts \
  --project=laptop-chrome \
  --reporter=list \
  --headed

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Diagnostic complete!"
echo ""
echo "📸 Screenshot: white-screen-diagnostic.png"
echo "📊 Full results: test-results/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

