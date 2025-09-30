#!/bin/bash

# UI V2 Test Suite Runner
# Loads environment and executes tests

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}BrandVX UI V2 Launch Test Suite${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════════${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from template...${NC}"
    
    if [ -f .env.template ]; then
        cp .env.template .env
        echo -e "${GREEN}✅ .env created from template${NC}"
        echo -e "${YELLOW}📝 Please edit .env with your credentials before running tests${NC}"
        exit 1
    else
        echo -e "${RED}❌ Error: .env.template not found${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Validate required environment variables
REQUIRED_VARS=("VITE_SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "VITE_SUPABASE_ANON_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Error: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}   - $var${NC}"
    done
    echo -e "${YELLOW}Please check your .env file${NC}"
    exit 1
fi

# Display configuration
echo -e "\n${BLUE}Configuration:${NC}"
echo -e "  API Base URL: ${GREEN}${API_BASE_URL:-https://api.brandvx.io}${NC}"
echo -e "  Supabase URL: ${GREEN}${VITE_SUPABASE_URL}${NC}"
echo -e "  Test Tenant:  ${GREEN}${TEST_TENANT_ID:-auto-detect}${NC}"
echo -e "  Test User:    ${GREEN}${TEST_USER_EMAIL:-auto-create}${NC}"
echo ""

# Run tests
echo -e "${BLUE}🚀 Running tests...${NC}\n"
npm test

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
else
    echo -e "\n${RED}❌ Some tests failed (exit code: $EXIT_CODE)${NC}"
fi

exit $EXIT_CODE
