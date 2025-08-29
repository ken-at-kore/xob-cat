# E2E Testing Guide - XOBCAT

## Overview

XOBCAT uses a hybrid E2E testing approach with **Puppeteer** for critical session validation and **Playwright** for general UI testing. This guide provides best practices and troubleshooting for both frameworks.

## 🎭 Framework Selection

### Puppeteer (Recommended for Critical Tests)
**Use Cases:**
- Session message validation
- Dialog interaction testing  
- Complex UI workflows
- Tests requiring reliable execution

**Advantages:**
- No hanging/timeout issues
- Better WebSocket handling
- More reliable for session dialogs
- Completes in seconds vs 30+ seconds

**Configuration:**
```bash
# Basic execution (fast, no slowMo)
node frontend/e2e/view-sessions-mock-api-puppeteer.test.js

# Debug mode with slowMo
node test.js --slowMo                    # 50ms delay
node test.js --slowMo --slowMoSpeed=100  # Custom delay
PUPPETEER_SLOWMO=true node test.js      # Via env var

# Show all options
node test.js --help
```

### Playwright (General UI Testing)
**Use Cases:**
- Basic navigation testing
- Form submission workflows
- Quick UI validation
- Parallel test execution

**Limitations:**
- Can hang on complex selectors
- WebSocket timeout issues
- Less reliable for session dialogs

## 🎪 Test Implementation Patterns

### Shared Workflow Architecture (Recommended)

XOBCAT uses a shared workflow pattern for Puppeteer tests to promote code reuse and consistency:

#### Directory Structure
```
frontend/e2e/
├── shared/
│   └── view-sessions-workflow.js    # Shared workflow steps
├── view-sessions-mock-api-puppeteer.test.js  # Mock API test
├── view-sessions-real-api-puppeteer.test.js  # Real API test
└── run-puppeteer-bogus-credentials-test.js   # Error handling test
```

#### Shared Workflow Module
```javascript
// frontend/e2e/shared/view-sessions-workflow.js
const puppeteer = require('puppeteer');

// Common browser configuration
const BROWSER_CONFIG = {
  headless: false,
  slowMo: 50,
  defaultViewport: { width: 1280, height: 800 },
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

// Consistent timeouts
const TIMEOUTS = {
  default: 2000,
  navigation: 5000,
  sessionLoad: 30000,
  shortWait: 3000
};

// Reusable workflow steps
async function enterCredentials(page, credentials, baseUrl = 'http://localhost:3000') {
  console.log('📝 Navigating to credentials page');
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });
  await page.type('#botId', credentials.botId);
  await page.type('#clientId', credentials.clientId);
  await page.type('#clientSecret', credentials.clientSecret);
  await page.click('button');
}

async function waitForSessionsPage(page) {
  await page.waitForFunction(
    () => window.location.pathname.includes('/sessions'),
    { timeout: 15000 }
  );
}

async function validateSanitization(dialogContent, isRealApi = false) {
  const sanitizationTests = {
    ssmlTagsRemoved: !dialogContent.includes('<speak>'),
    htmlEntitiesDecoded: !dialogContent.includes('&quot;'),
    noRawJsonCommands: !dialogContent.includes('{"type":"command"'),
    systemMessagesFiltered: !dialogContent.includes('Welcome Task'),
    hasReadableMessages: /[a-zA-Z]{3,}/.test(dialogContent)
  };
  
  return { sanitizationTests };
}

module.exports = {
  BROWSER_CONFIG,
  TIMEOUTS,
  enterCredentials,
  waitForSessionsPage,
  validateSanitization
  // ... other shared functions
};
```

#### Using Shared Workflows in Tests
```javascript
// view-sessions-mock-api-puppeteer.test.js
const puppeteer = require('puppeteer');
const {
  BROWSER_CONFIG,
  enterCredentials,
  waitForSessionsPage,
  validateSanitization
} = require('./shared/view-sessions-workflow');

async function runTest() {
  const browser = await puppeteer.launch(BROWSER_CONFIG);
  
  try {
    const page = await browser.newPage();
    
    // Use shared workflow steps
    await enterCredentials(page, {
      botId: 'st-mock-bot-id-12345',
      clientId: 'cs-mock-client-id-12345',
      clientSecret: 'mock-client-secret-12345'
    });
    
    await waitForSessionsPage(page);
    
    // Test-specific logic here...
    
    const { sanitizationTests } = validateSanitization(dialogContent);
    // Validate results...
    
  } finally {
    await browser.close();
  }
}
```

### Benefits of Shared Workflows

1. **DRY Principle**: Write workflow logic once, use across multiple tests
2. **Consistency**: Same validation logic for mock and real API tests
3. **Maintainability**: Update workflow in one place affects all tests
4. **Separation of Concerns**: Test configuration vs implementation logic
5. **Easier Debugging**: Modular functions are easier to troubleshoot

### Implementation Learnings (August 2025)

**Critical Pattern: Exact Replication of Working Logic**
When creating shared workflows, replicate the exact patterns from proven working tests:

```javascript
// ✅ CORRECT: Match working test pattern exactly
await page.waitForSelector('table', { timeout: 3000 });
const sessionRows = await page.$$('table tbody tr');

// ❌ INCORRECT: Complex selector logic that can fail
const possibleSelectors = ['table tbody tr', 'tbody tr', ...];
for (const selector of possibleSelectors) { ... }
```

**Key Insight**: The working Puppeteer tests use simple, direct DOM queries. Complex fallback logic often introduces edge cases.

**Error Handling Strategy**
```javascript
// ✅ CORRECT: Return state instead of throwing errors
if (noTable) {
  return { sessionRows: [], hasNoSessions: true, noTable: true };
}

// ❌ INCORRECT: Throwing errors prevents graceful handling
throw new Error('Sessions table did not load');
```

**Real API Data Considerations**
- **Date Range Issues**: Real APIs may have no data in default date ranges
- **Automatic Expansion**: Implement progressive date range expansion (last 7 days → 365 days)
- **No-Data Scenarios**: Always handle cases where API returns 0 results successfully
- **Production Validation**: Real API tests confirmed message sanitization works with actual production data

### When to Use Shared Workflows

**Use shared workflows when:**
- Testing the same user journey with different data sources
- Multiple tests share common setup/teardown logic
- Need consistency in validation across test variants
- Want to reduce code duplication

**Use standalone tests when:**
- Test is unique and doesn't share workflow with others
- Quick proof-of-concept or debugging specific issues
- Legacy tests that work well and don't need refactoring

### Legacy Puppeteer Test Template

For reference, here's the standalone pattern still used in some tests:

```javascript
const puppeteer = require('puppeteer');

async function runTest() {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(2000);
    page.setDefaultNavigationTimeout(5000);
    
    // Test implementation...
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}
```

### Mock Service Activation

Mock services automatically activate with exact mock credentials:

```javascript
// ✅ Triggers mock services (exact values required)
const mockCredentials = {
  botId: 'st-mock-bot-id-12345',
  clientId: 'cs-mock-client-id-12345', 
  clientSecret: 'mock-client-secret-12345'
};

// ❌ Uses real API services
const realCredentials = {
  botId: process.env.TEST_BOT_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET
};
```

## 📊 Mock Data Reference

Mock services provide 10 predefined sessions with rich conversation data:

### Session Types
- **Claim Status** (`mock_session_1`): Insurance claim inquiry with status check
- **Billing Questions** (`mock_session_2`): Billing dispute leading to agent transfer
- **Coverage Verification** (`mock_session_3`): MRI and physical therapy coverage inquiry
- **Password Reset** (`mock_session_4`): Simple password reset workflow
- **Technical Support** (`mock_session_5`): App crash issue with agent transfer
- **Account Balance** (`mock_session_6`): Quick balance inquiry
- **Store Hours** (`mock_session_7`): Store hours information request
- **Complex Billing** (`mock_session_8`): Billing dispute requiring specialist
- **Product Information** (`mock_session_9`): Inventory and pricing inquiry
- **Credit Cards** (`mock_session_10`): Payment method acceptance question

### Message Content Examples
```javascript
// Rich conversation data includes:
"I need to check the status of my claim"
"Do you accept credit cards?" 
"Yes, we accept all major credit cards including Visa, MasterCard, American Express, and Discover."
"I have a question about my bill"
"My app is crashing constantly"
```

## 🔧 Configuration Best Practices

### Timeout Strategy
```javascript
// Puppeteer - Aggressive timeouts prevent hanging
page.setDefaultTimeout(2000);           // 2 seconds max
page.setDefaultNavigationTimeout(5000); // 5 seconds for navigation

// Playwright - More lenient for complex selectors
test.setTimeout(30000);                 // 30 second test timeout
```

### Human-like Interactions
```javascript
// ✅ Good: Simulate human behavior
await page.hover(selector);
await page.waitForTimeout(200);
await page.click(selector);

// ❌ Bad: Immediate clicking without context
await page.click(selector);
```

### Content Validation
```javascript
// Rich content validation
const dialogContent = await page.textContent('.dialog');
const hasRichContent = dialogContent.length > 50;
const hasMessageWords = /claim|bill|help|status|coverage/i.test(dialogContent);

if (hasRichContent && hasMessageWords) {
  console.log('✅ Dialog contains message content');
} else {
  throw new Error('❌ No message content found');
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Playwright Tests Hanging
**Symptoms:**
- Tests timeout after 30+ seconds
- Multiple operations with stacked timeouts
- WebSocket connection issues

**Solutions:**
```javascript
// Reduce timeout complexity
test.use({ 
  actionTimeout: 1000,     // Very short
  navigationTimeout: 3000  // Minimal navigation time
});

// Or switch to Puppeteer for reliability
```

#### 2. Session Dialog Not Opening
**Symptoms:**
- Click events not triggering dialog
- UI appears frozen after click
- No error messages

**Debug Steps:**
```javascript
// Check if click handlers are bound
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000); // React hydration time

// Verify element is clickable
await element.scrollIntoViewIfNeeded();
await element.hover();
await element.click();

// Screenshot for debugging
await page.screenshot({ path: 'debug-click.png' });
```

#### 3. Mock Services Not Activating
**Symptoms:**
- Real API calls instead of mock data
- Timeout errors on API requests
- Missing session data

**Check List:**
- Credentials contain "mock" string
- Backend logs show "🎭 Detected mock credentials"
- Environment variable `USE_MOCK_SERVICES=mock` is set

#### 4. Shared Workflow Implementation Issues
**Symptoms:**
- Tests fail with "Sessions table did not load"
- Working standalone tests but failing shared workflow tests
- Complex selector logic not finding elements

**Solutions:**
```javascript
// Problem: Over-engineered selector fallback logic
const possibleSelectors = [...many selectors...];
for (const selector of possibleSelectors) { ... }

// Solution: Use exact pattern from working tests
await page.waitForSelector('table', { timeout: 3000 });
const sessionRows = await page.$$('table tbody tr');
```

**Debug Steps:**
1. Compare shared workflow with working standalone test
2. Ensure exact DOM query patterns are replicated
3. Use return values instead of throwing errors for graceful handling
4. Test with both mock and real API scenarios

#### 4. WebSocket Connection Errors
**Symptoms:**
```
ws does not work in the browser. Browser clients must use the native WebSocket object
```

**Solution:**
Use standalone Node.js execution instead of Jest:
```bash
# ✅ Good: Direct Node.js execution
node frontend/e2e/view-sessions-mock-api-puppeteer.test.js

# ❌ Bad: Jest environment conflicts with WebSocket handling
```

## 📋 Test Inventory

### Active Puppeteer Tests

#### Shared Workflow Pattern (Recommended)
- `view-sessions-mock-api-puppeteer.test.js` ✅ - View sessions with mock API (10 sessions, full validation)
- `view-sessions-real-api-puppeteer.test.js` ✅ - View sessions with real API (supports --url param, date expansion)
- `auto-analyze-mock-api-puppeteer.test.js` ✅ - Auto-analyze with mock APIs (workflow validation)
- `auto-analyze-real-api-puppeteer.test.js` ✅ - Auto-analyze with real APIs (incurs OpenAI costs)
- `shared/view-sessions-workflow.js` - Shared view sessions workflow steps and validation
- `shared/auto-analyze-workflow.js` - Shared auto-analyze workflow steps and validation

**Implementation Status**: All tests successfully implemented and verified working

**View Sessions Tests:**
- **Mock Test**: Validates 10 mock sessions, message sanitization, dialog functionality
- **Real Test**: Connects to production API, handles no-data scenarios, validates real session content
- **Key Learning**: Simple DOM queries from working tests are more reliable than complex fallback logic

**Auto-Analyze Tests (NEW):**
- **Mock Test**: End-to-end workflow validation with mock Kore.ai and OpenAI services
- **Real Test**: Complete analysis workflow with real APIs, incurs OpenAI costs (~$0.019 per session)
- **Coverage**: Navigation, form configuration, analysis execution, report validation, dialog testing
- **Architecture**: Uses shared workflow (`auto-analyze-workflow.js`) with modular functions

**Auto-Analyze Implementation Insights:**
- **HTML Date Input Fix**: Standard `type()` method failed, solved with JavaScript evaluation:
  ```javascript
  await page.evaluate((date) => {
    const dateInput = document.querySelector('#startDate');
    dateInput.value = date;
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
  }, startDate);
  ```
- **GPT Model Selection**: Successfully automated dropdown selection for GPT-4.1 nano model
- **Form Validation Testing**: Validates client-side date restrictions and API key format requirements
- **Real API Timeouts**: Production analysis takes 60-120s, tests timeout at 30s (expected behavior)

#### Standalone Pattern (Legacy)
- `run-puppeteer-bogus-credentials-test.js` ✅ - Error handling validation

### Key Playwright Tests
- `session-message-validation-mock.spec.ts` - Message display validation
- `auto-analyze-complete-workflow.spec.ts` - Full auto-analyze workflow
- `session-viewer-real-api.spec.ts` - Real API integration
- `auth-flow.spec.ts` - Login workflow testing

### Creating New Tests

#### 1. Start with Mock API Test
```javascript
// Use mock credentials for fast, reliable testing
await page.fill('#botId', 'st-mock-bot-id-12345');
await page.fill('#clientId', 'cs-mock-client-id-12345');
await page.fill('#clientSecret', 'mock-client-secret-12345');
```

#### 2. Add Real API Variant (Optional)

**Configure Real API Credentials:**
Create `.env.local` in project root with real Kore.ai credentials:
```bash
# Required for real API E2E tests
TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEST_CLIENT_SECRET=your-actual-client-secret-here
```

**Load Credentials in Test:**
```javascript
// Load real credentials from .env.local
function loadCredentials() {
  const envPath = path.join(__dirname, '../../.env.local');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const credentials = {};
  
  envContent.split('\n').forEach(line => {
    if (line.startsWith('TEST_BOT_ID=')) {
      credentials.botId = line.substring('TEST_BOT_ID='.length).trim();
    }
    // ... similar for other credentials
  });
  
  return credentials;
}

// Use in test
const credentials = loadCredentials();
await enterCredentials(page, credentials);
```

**Security Best Practices:**
- Never hardcode credentials in test files
- Use `.env.local` which is git-ignored
- Use test bot credentials, never production credentials
- Only configure on machines that need to run real API tests

#### 3. Choose Framework
- **Complex dialogs/session validation**: Use Puppeteer
- **Simple navigation/forms**: Use Playwright

## 🚀 Running Tests

### Development
```bash
# Recommended: Puppeteer for critical tests

# View Sessions Tests
node frontend/e2e/view-sessions-mock-api-puppeteer.test.js
node frontend/e2e/view-sessions-real-api-puppeteer.test.js

# Auto-Analyze Tests (NEW)
node frontend/e2e/auto-analyze-mock-api-puppeteer.test.js                     # Fast, no costs
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js                    # Local, incurs OpenAI costs
node frontend/e2e/auto-analyze-real-api-puppeteer.test.js --url=https://www.koreai-xobcat.com  # Production

# Playwright for general UI testing
npm run test:e2e

# Specific test file
npx playwright test auth-flow.spec.ts
```

### CI/CD Considerations
- Use `headless: true` for CI environments
- Increase timeouts for slower CI machines
- Prefer Puppeteer for critical path validation
- Use screenshots for failure debugging

## 📝 Test Maintenance

### Regular Tasks
1. **Update mock data** when API schemas change
2. **Review timeout values** if tests become flaky
3. **Add screenshots** to new tests for debugging
4. **Validate real API tests** periodically with fresh credentials

### Performance Monitoring
- Mock tests should complete in 5-10 seconds
- Real API tests may take 30-60 seconds
- Puppeteer tests should not hang (max 10 seconds)
- Flag tests taking >30 seconds for investigation

---

*This guide is maintained as part of the XOBCAT project documentation. Update when E2E testing patterns change.*