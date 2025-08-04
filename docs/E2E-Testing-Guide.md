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

**Example:**
```bash
node frontend/e2e/run-puppeteer-test.js
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

### Puppeteer Test Template

```javascript
const puppeteer = require('puppeteer');

async function runTest() {
  let browser;
  
  try {
    // Launch with optimal settings
    browser = await puppeteer.launch({
      headless: false,      // Visual debugging
      slowMo: 50,          // Human-like timing
      defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    // Critical: Short timeouts prevent hanging
    page.setDefaultTimeout(2000);
    page.setDefaultNavigationTimeout(5000);
    
    // Navigate and test
    await page.goto('http://localhost:3000/');
    
    // Mock credentials trigger mock services
    await page.type('#botId', 'mock-bot-id');
    await page.type('#clientId', 'mock-client-id');
    await page.type('#clientSecret', 'mock-client-secret');
    
    // Human-like interactions
    await page.click('button:has-text("Connect")');
    await page.waitForNavigation();
    
    // Validate results
    const content = await page.content();
    console.log('✅ Test passed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}
```

### Mock Service Activation

Mock services automatically activate when credentials contain "mock":

```javascript
// ✅ Triggers mock services
const mockCredentials = {
  botId: 'mock-bot-id',
  clientId: 'mock-client-id', 
  clientSecret: 'mock-client-secret'
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

#### 4. WebSocket Connection Errors
**Symptoms:**
```
ws does not work in the browser. Browser clients must use the native WebSocket object
```

**Solution:**
Use standalone Node.js execution instead of Jest:
```bash
# ✅ Good: Direct Node.js execution
node frontend/e2e/run-puppeteer-test.js

# ❌ Bad: Jest environment
npx jest e2e/session-message-validation-puppeteer.test.js
```

## 📋 Test Inventory

### Active Puppeteer Tests
- `run-puppeteer-test.js` ✅ - Session message validation (recommended)
- `session-message-validation-puppeteer.test.js` ⚠️ - Jest-based (WebSocket issues)

### Key Playwright Tests
- `session-message-validation-mock.spec.ts` - Message display validation
- `auto-analyze-complete-workflow.spec.ts` - Full auto-analyze workflow
- `session-viewer-real-api.spec.ts` - Real API integration
- `auth-flow.spec.ts` - Login workflow testing

### Creating New Tests

#### 1. Start with Mock API Test
```javascript
// Use mock credentials for fast, reliable testing
await page.fill('#botId', 'mock-bot-id');
await page.fill('#clientId', 'mock-client-id');
await page.fill('#clientSecret', 'mock-client-secret');
```

#### 2. Add Real API Variant (Optional)
```javascript
// Require environment variables for real API tests
const shouldRunTest = process.env.TEST_BOT_ID && 
                     process.env.TEST_CLIENT_ID && 
                     process.env.TEST_CLIENT_SECRET;
```

#### 3. Choose Framework
- **Complex dialogs/session validation**: Use Puppeteer
- **Simple navigation/forms**: Use Playwright

## 🚀 Running Tests

### Development
```bash
# Recommended: Puppeteer for critical tests
node frontend/e2e/run-puppeteer-test.js

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