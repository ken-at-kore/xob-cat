/**
 * Common utilities for data collection scripts
 */

import { createKoreApiService, KoreApiConfig } from '../../backend/src/services/koreApiService';
import { configManager } from '../../backend/src/utils/configManager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Initialize Kore API service with configuration
 */
export function initializeKoreApiService() {
  const koreConfig = configManager.getKoreConfig();
  const config: KoreApiConfig = {
    botId: koreConfig.bot_id,
    clientId: koreConfig.client_id,
    clientSecret: koreConfig.client_secret,
    baseUrl: 'https://bots.kore.ai'
  };
  return createKoreApiService(config);
}

/**
 * Ensure data directory exists
 */
export function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

/**
 * Write data to JSON file with pretty formatting
 */
export function writeJsonFile(filePath: string, data: any, description?: string) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  const fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
  console.log(`✅ ${description || 'Data'} saved to: ${filePath} (${fileSize} KB)`);
}

/**
 * Read JSON file with error handling
 */
export function readJsonFile<T = any>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error);
    return null;
  }
}

/**
 * Format date for consistent file naming
 */
export function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Log script execution start
 */
export function logScriptStart(scriptName: string, description?: string) {
  console.log(`🚀 Starting ${scriptName}...`);
  if (description) {
    console.log(`📝 ${description}`);
  }
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('---');
}

/**
 * Log script execution completion
 */
export function logScriptComplete(scriptName: string, stats?: { [key: string]: number }) {
  console.log('---');
  console.log(`✅ ${scriptName} completed successfully!`);
  if (stats) {
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`📊 ${key}: ${value}`);
    });
  }
  console.log(`⏰ Completed at: ${new Date().toISOString()}`);
}

/**
 * Handle script errors consistently
 */
export function handleScriptError(scriptName: string, error: unknown) {
  console.error('---');
  console.error(`❌ ${scriptName} failed:`, error);
  process.exit(1);
}