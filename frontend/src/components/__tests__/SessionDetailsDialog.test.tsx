/**
 * SessionDetailsDialog Main Test Suite
 * 
 * This is the main test file that imports and runs all the modular test suites.
 * The actual tests have been split into focused modules for better maintainability:
 * 
 * - SessionDetailsDialog.rendering.test.tsx: Basic rendering and visibility tests
 * - SessionDetailsDialog.interactions.test.tsx: User interactions and navigation tests  
 * - SessionDetailsDialog.dataHandling.test.tsx: Message display and data edge cases
 */

// Import all the split test modules to ensure they run as part of the test suite
import './SessionDetailsDialog.rendering.test';
import './SessionDetailsDialog.interactions.test';
import './SessionDetailsDialog.dataHandling.test';

// This file now serves as the main entry point for the SessionDetailsDialog test suite.
// All the actual test cases have been moved to the modular files above.

describe('SessionDetailsDialog Test Suite', () => {
  it('should run all modular test suites', () => {
    // This test exists to ensure the main test file has at least one test
    // The actual tests are in the imported modules above
    expect(true).toBe(true);
  });
});