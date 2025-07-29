import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { AnalysisExportFile } from '../../shared/types';

// Helper to wait for download
async function waitForDownload(page: any, action: () => Promise<void>) {
  const downloadPromise = page.waitForEvent('download');
  await action();
  return await downloadPromise;
}

test.describe('Report Export and Import E2E', () => {
  let downloadPath: string;

  test.beforeEach(async ({ page }) => {
    // Create temp directory for downloads
    downloadPath = path.join(process.cwd(), 'temp-downloads-' + Date.now());
    await fs.mkdir(downloadPath, { recursive: true });
  });

  test.afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(downloadPath, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup download directory:', e);
    }
  });

  test('complete export and import workflow', async ({ page, context }) => {
    // Step 1: Navigate to the app and set credentials
    await page.goto('http://localhost:3000');
    
    // Fill in credentials (using mock credentials)
    await page.fill('input[placeholder="Enter bot ID"]', 'test-bot-id');
    await page.fill('input[placeholder="Enter JWT token"]', 'test-jwt-token');
    await page.click('button:has-text("Connect")');
    
    // Wait for navigation to sessions page
    await page.waitForURL('**/sessions');
    
    // Step 2: Navigate to Auto-Analyze
    await page.click('a:has-text("Auto-Analyze")');
    await page.waitForURL('**/analyze');
    
    // Step 3: Load mock results (bypass actual analysis for E2E test)
    await page.click('button:has-text("See Mock Reports")');
    
    // Wait for results to load
    await page.waitForSelector('h1:has-text("Analysis Report")');
    
    // Step 4: Download the report
    const download = await waitForDownload(page, async () => {
      await page.click('button:has-text("Download Report Data")');
    });
    
    // Save the downloaded file
    const downloadFilePath = path.join(downloadPath, 'analysis-export.json');
    await download.saveAs(downloadFilePath);
    
    // Verify the download
    const fileContent = await fs.readFile(downloadFilePath, 'utf-8');
    const exportedData: AnalysisExportFile = JSON.parse(fileContent);
    
    // Basic validation of exported file
    expect(exportedData.metadata).toBeDefined();
    expect(exportedData.metadata.version).toBe('1.0.0');
    expect(exportedData.metadata.schemaVersion).toBe('1.0');
    expect(exportedData.sessions).toBeDefined();
    expect(exportedData.sessions.length).toBeGreaterThan(0);
    
    // Step 5: Navigate to report viewer
    await page.goto('http://localhost:3000/report-viewer');
    
    // Verify we're on the upload page
    await expect(page.locator('h2:has-text("Upload Analysis Report")')).toBeVisible();
    
    // Step 6: Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadFilePath);
    
    // Wait for validation and navigation
    await page.waitForURL('**/report-viewer/view');
    
    // Step 7: Verify the report is displayed correctly
    await expect(page.locator('h1:has-text("Analysis Report")')).toBeVisible();
    
    // Check that session count matches
    const sessionCountText = await page.locator('text=/Analysis period:.*sessions analyzed/').textContent();
    expect(sessionCountText).toContain(`${exportedData.sessions.length} sessions analyzed`);
    
    // Verify key elements are present
    await expect(page.locator('text="Analysis Overview"')).toBeVisible();
    await expect(page.locator('text="Session Outcomes"')).toBeVisible();
    await expect(page.locator('text="Transfer Reasons"')).toBeVisible();
    
    // Step 8: Test navigation to main app
    await page.click('button:has-text("Start New Analysis")');
    
    // Should redirect to home page (credentials)
    await page.waitForURL('http://localhost:3000/');
    await expect(page.locator('h1:has-text("XOB CAT")')).toBeVisible();
    
    // Step 9: Go back to report viewer and test upload new
    await page.goto('http://localhost:3000/report-viewer/view');
    
    // Should redirect to upload page since session storage is cleared
    await page.waitForURL('**/report-viewer');
    
    await fileInput.setInputFiles(downloadFilePath);
    await page.waitForURL('**/report-viewer/view');
    
    // Click upload new report
    await page.click('button:has-text("Upload New Report")');
    await page.waitForURL('**/report-viewer');
    
    // Verify we're back on upload page
    await expect(page.locator('h2:has-text("Upload Analysis Report")')).toBeVisible();
  });

  test('handles invalid file uploads', async ({ page }) => {
    await page.goto('http://localhost:3000/report-viewer');
    
    // Create an invalid JSON file
    const invalidJsonPath = path.join(downloadPath, 'invalid.json');
    await fs.writeFile(invalidJsonPath, '{ invalid json }', 'utf-8');
    
    // Try to upload invalid JSON
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(invalidJsonPath);
    
    // Should show error
    await expect(page.locator('text="Invalid JSON file"')).toBeVisible();
    
    // Create a valid JSON but wrong structure
    const wrongStructurePath = path.join(downloadPath, 'wrong-structure.json');
    await fs.writeFile(wrongStructurePath, JSON.stringify({ foo: 'bar' }), 'utf-8');
    
    await fileInput.setInputFiles(wrongStructurePath);
    
    // Should show structure error
    await expect(page.locator('text=/not appear to be an XOB CAT analysis export/')).toBeVisible();
  });

  test('handles version mismatch', async ({ page }) => {
    await page.goto('http://localhost:3000/report-viewer');
    
    // Create a file with unsupported version
    const unsupportedVersionFile: AnalysisExportFile = {
      metadata: {
        version: '2.0.0',
        schemaVersion: '2.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'XOB-CAT-2.0.0',
        requiredFeatures: ['advanced-ai'],
        optionalFeatures: []
      },
      analysisConfig: {
        startDate: '2025-07-01',
        startTime: '09:00',
        sessionCount: 10,
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      },
      sessions: [],
      summary: {
        overview: '',
        detailedAnalysis: '',
        totalSessions: 0,
        containmentRate: 0,
        topTransferReasons: {},
        topIntents: {},
        topDropOffLocations: {}
      },
      chartData: {
        sessionOutcomes: [],
        transferReasons: [],
        dropOffLocations: [],
        generalIntents: []
      },
      costAnalysis: {
        totalTokens: 0,
        estimatedCost: 0,
        modelUsed: 'gpt-4o-mini'
      }
    };
    
    const versionMismatchPath = path.join(downloadPath, 'version-mismatch.json');
    await fs.writeFile(versionMismatchPath, JSON.stringify(unsupportedVersionFile), 'utf-8');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(versionMismatchPath);
    
    // Should show version error
    await expect(page.locator('text=/Unsupported schema version.*newer version of XOB CAT/')).toBeVisible();
  });

  test('drag and drop functionality', async ({ page }) => {
    await page.goto('http://localhost:3000/report-viewer');
    
    // Create a valid export file
    const validExportFile: AnalysisExportFile = {
      metadata: {
        version: '1.0.0',
        schemaVersion: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'XOB-CAT-1.0.0',
        requiredFeatures: ['basic-charts', 'session-analysis'],
        optionalFeatures: []
      },
      analysisConfig: {
        startDate: '2025-07-01',
        startTime: '09:00',
        sessionCount: 1,
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      },
      sessions: [{
        session_id: 'test-session',
        user_id: 'test-user',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        containment_type: 'selfService',
        tags: [],
        metrics: {},
        messages: [],
        message_count: 0,
        user_message_count: 0,
        bot_message_count: 0,
        facts: {
          generalIntent: 'Test',
          sessionOutcome: 'Contained',
          transferReason: '',
          dropOffLocation: '',
          notes: 'Test session'
        },
        analysisMetadata: {
          tokensUsed: 100,
          processingTime: 1000,
          batchNumber: 1,
          timestamp: new Date().toISOString()
        }
      }],
      summary: {
        overview: 'Test overview',
        detailedAnalysis: 'Test analysis',
        totalSessions: 1,
        containmentRate: 1.0,
        topTransferReasons: {},
        topIntents: { 'Test': 1 },
        topDropOffLocations: {}
      },
      chartData: {
        sessionOutcomes: [{ name: 'Contained', value: 1 }],
        transferReasons: [],
        dropOffLocations: [],
        generalIntents: [{ intent: 'Test', count: 1 }]
      },
      costAnalysis: {
        totalTokens: 100,
        estimatedCost: 0.01,
        modelUsed: 'gpt-4o-mini'
      }
    };
    
    const dragDropPath = path.join(downloadPath, 'drag-drop.json');
    await fs.writeFile(dragDropPath, JSON.stringify(validExportFile), 'utf-8');
    
    // Test drag and drop (Playwright limitation: simulate with file input)
    // In a real test, you'd use CDP or browser automation for true drag-drop
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(dragDropPath);
    
    // Should navigate to view page
    await page.waitForURL('**/report-viewer/view');
    await expect(page.locator('text="Test overview"')).toBeVisible();
  });
});