/**
 * Parse Test Arguments Helper
 * 
 * Common argument parsing for Puppeteer tests
 */

/**
 * Parse command line arguments for Puppeteer tests
 * @param {string[]} args - Command line arguments (process.argv.slice(2))
 * @returns {Object} Parsed configuration
 */
function parseTestArgs(args = []) {
  // Parse URL
  const urlArg = args.find(arg => arg.startsWith('--url='));
  const baseUrl = urlArg ? urlArg.split('=')[1] : 'http://localhost:3000';
  
  // Parse slowMo configuration - single parameter approach like native Puppeteer
  // Default to 25ms (was previously 50ms) for better production compatibility
  let slowMo = 25; // Default speed in milliseconds
  
  // Check for explicit slowMo speed argument
  const slowMoArg = args.find(arg => arg.startsWith('--slowMo'));
  if (slowMoArg) {
    if (slowMoArg === '--slowMo') {
      // --slowMo without value uses default
      slowMo = 25;
    } else if (slowMoArg.includes('=')) {
      // --slowMo=50 format
      slowMo = parseInt(slowMoArg.split('=')[1]) || 25;
    }
  } else if (process.env.PUPPETEER_SLOWMO) {
    // Environment variable override
    slowMo = parseInt(process.env.PUPPETEER_SLOWMO) || 25;
  } else if (args.includes('--no-slowMo')) {
    // Explicitly disable slowMo
    slowMo = 0;
  }
  
  // Parse sessions count
  const sessionsArg = args.find(arg => arg.startsWith('--sessions='));
  const sessions = sessionsArg ? parseInt(sessionsArg.split('=')[1]) : undefined;
  
  // Parse other common options
  const headless = args.some(arg => arg === '--headless');
  const screenshot = args.some(arg => arg === '--screenshot');
  const verbose = args.some(arg => arg === '--verbose');
  const testDownload = args.some(arg => arg === '--test-download');
  
  return {
    baseUrl,
    slowMo, // Single speed value (0 = disabled, >0 = enabled with that speed)
    sessions, // Number of sessions to test with (undefined = use test default)
    headless,
    screenshot,
    verbose,
    testDownload // Enable download functionality testing (disabled by default)
  };
}

/**
 * Display help message for command line arguments
 */
function showHelp() {
  console.log(`
Puppeteer Test Command Line Options:

  --url=<url>           Base URL to test against (default: http://localhost:3000)
  --sessions=<count>    Number of sessions to analyze (for real API tests)
  --slowMo[=<ms>]       Enable slow motion with optional speed in ms (default: 25, was 50)
  --no-slowMo           Explicitly disable slow motion (speed = 0)
  --headless            Run browser in headless mode
  --screenshot          Take screenshots on failures
  --verbose             Enable verbose logging
  --test-download       Enable download functionality testing (disabled by default)
  --help                Show this help message

Environment Variables:
  PUPPETEER_SLOWMO=<ms>     Set slow motion delay in milliseconds (default: 25)

Examples:
  node test.js --slowMo              # Use default 25ms slowMo
  node test.js --slowMo=100          # Use 100ms slowMo
  node test.js --no-slowMo           # Disable slowMo completely
  node test.js --sessions=100        # Test with 100 sessions
  node test.js --url=https://production.com --sessions=50 --slowMo
  
  # Using environment variables
  PUPPETEER_SLOWMO=75 node test.js
`);
}

module.exports = {
  parseTestArgs,
  showHelp
};