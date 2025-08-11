#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { DataSanitizer, SanitizationOptions } from './lib/data-sanitizer';

// Enhanced sanitizeFile function that uses the shared DataSanitizer
function sanitizeFile(inputPath: string, outputPath?: string, options?: SanitizationOptions): void {
  const sanitizer = new DataSanitizer(options);
  
  console.log(`Reading file: ${inputPath}`);
  
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const sanitized = sanitizer.sanitizeObject(data);
  
  if (!outputPath) {
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    const suffix = options?.outputSuffix || '-sanitized';
    outputPath = path.join(dir, `${base}${suffix}${ext}`);
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(sanitized, null, 2));
  console.log(`Sanitized data written to: ${outputPath}`);
  
  // Print summary statistics
  const stats = sanitizer.getSanitizationStats();
  console.log('\nSanitization Summary:');
  console.log(`- Unique names replaced: ${stats.byType.names}`);
  console.log(`- Unique emails replaced: ${stats.byType.emails}`);
  console.log(`- Unique phones replaced: ${stats.byType.phones}`);
  console.log(`- Unique SSNs replaced: ${stats.byType.ssns}`);
  console.log(`- Unique policy IDs replaced: ${stats.byType.policyIds}`);
  console.log(`- Unique addresses replaced: ${stats.byType.addresses}`);
  console.log(`- Total replacements: ${stats.totalReplacements}`);
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx scripts/sanitize-data.ts <input-file> [options]

Options:
  -o, --output <path>       Output file path (default: input-sanitized.json)
  --suffix <string>         Output file suffix (default: -sanitized)
  --no-preserve-ids         Don't preserve internal IDs
  -h, --help               Show this help message

Examples:
  npx tsx scripts/sanitize-data.ts data/sessions.json
  npx tsx scripts/sanitize-data.ts data/sessions.json -o data/clean.json
  npx tsx scripts/sanitize-data.ts data/sessions.json --suffix -clean
  npx tsx scripts/sanitize-data.ts data/sessions.json --no-preserve-ids
    `);
    process.exit(0);
  }
  
  const inputFile = args[0];
  let outputFile: string | undefined;
  let suffix = '-sanitized';
  let preserveInternalIds = true;
  
  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '-o' || args[i] === '--output') && i + 1 < args.length) {
      outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--suffix' && i + 1 < args.length) {
      suffix = args[i + 1];
      i++;
    } else if (args[i] === '--no-preserve-ids') {
      preserveInternalIds = false;
    }
  }
  
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' not found`);
    process.exit(1);
  }
  
  try {
    sanitizeFile(inputFile, outputFile, {
      preserveStructure: true,
      preserveInternalIds,
      outputSuffix: suffix
    });
  } catch (error) {
    console.error('Error sanitizing file:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { sanitizeFile, DataSanitizer, SanitizationOptions };