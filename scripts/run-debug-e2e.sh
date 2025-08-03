#!/bin/bash
# Script to run E2E debug test with real API credentials
# This makes it easy to pass credentials and run the debug test

echo "🧪 XOB CAT - Real API Debug E2E Test Runner"
echo "=========================================="

# Check if all required environment variables are set
required_vars=("REAL_BOT_ID" "REAL_CLIENT_ID" "REAL_CLIENT_SECRET" "REAL_OPENAI_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "❌ Missing required environment variables:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo ""
    echo "Usage:"
    echo "  export REAL_BOT_ID=\"your-bot-id\""
    echo "  export REAL_CLIENT_ID=\"your-client-id\""
    echo "  export REAL_CLIENT_SECRET=\"your-client-secret\""
    echo "  export REAL_OPENAI_API_KEY=\"sk-your-openai-key\""
    echo "  ./scripts/run-debug-e2e.sh"
    echo ""
    echo "Or run inline:"
    echo "  REAL_BOT_ID=\"...\" REAL_CLIENT_ID=\"...\" REAL_CLIENT_SECRET=\"...\" REAL_OPENAI_API_KEY=\"...\" ./scripts/run-debug-e2e.sh"
    exit 1
fi

echo "✅ All required environment variables are set"
echo "📊 Bot ID: $REAL_BOT_ID"
echo "🔑 Client ID: $REAL_CLIENT_ID"
echo "🤖 Using GPT-4o-mini for cost optimization"
echo ""

# Change to frontend directory and run the debug test
cd "$(dirname "$0")/../frontend" || exit 1

echo "🚀 Starting debug E2E test with real APIs..."
echo "⚠️  This test will make real API calls and may incur costs"
echo ""

# Run the debug test in headed mode so you can watch
npm run test:e2e:debug

echo ""
echo "🏁 Debug E2E test completed"
echo "💰 Check your OpenAI usage dashboard for actual costs incurred"