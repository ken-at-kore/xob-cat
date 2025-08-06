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
  
  // Parse slowMo configuration from command line or environment variables
  const enableSlowMo = args.some(arg => arg === '--slowMo') || 
                      process.env.PUPPETEER_SLOWMO === 'true' ||
                      process.env.PUPPETEER_SLOWMO === '1';
  
  const slowMoSpeedArg = args.find(arg => arg.startsWith('--slowMoSpeed='));
  const slowMoSpeed = slowMoSpeedArg ? parseInt(slowMoSpeedArg.split('=')[1]) : 
                     process.env.PUPPETEER_SLOWMO_SPEED ? parseInt(process.env.PUPPETEER_SLOWMO_SPEED) : 
                     50;
  
  // Parse other common options
  const headless = args.some(arg => arg === '--headless');
  const screenshot = args.some(arg => arg === '--screenshot');
  const verbose = args.some(arg => arg === '--verbose');
  
  return {
    baseUrl,
    slowMo: {
      enabled: enableSlowMo,
      speed: slowMoSpeed
    },
    headless,
    screenshot,
    verbose
  };
}

/**
 * Display help message for command line arguments
 */
function showHelp() {
  console.log(`
Puppeteer Test Command Line Options:

  --url=<url>           Base URL to test against (default: http://localhost:3000)
  --slowMo              Enable slow motion mode for easier debugging
  --slowMoSpeed=<ms>    Set slow motion delay in milliseconds (default: 50)
  --headless            Run browser in headless mode
  --screenshot          Take screenshots on failures
  --verbose             Enable verbose logging
  --help                Show this help message

Environment Variables:
  PUPPETEER_SLOWMO=true         Enable slow motion mode
  PUPPETEER_SLOWMO_SPEED=<ms>   Set slow motion delay (default: 50)

Examples:
  node test.js --slowMo --slowMoSpeed=100
  node test.js --url=https://production.com --headless
  node test.js --slowMo --screenshot --verbose
  
  # Using environment variables
  PUPPETEER_SLOWMO=true PUPPETEER_SLOWMO_SPEED=75 node test.js
`);
}

module.exports = {
  parseTestArgs,
  showHelp
};