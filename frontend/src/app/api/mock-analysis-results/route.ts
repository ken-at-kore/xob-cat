import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * API endpoint to serve mock analysis results
 * GET /api/mock-analysis-results
 */
export async function GET() {
  try {
    // Read the mock analysis results file
    // In Next.js, process.cwd() points to the frontend directory, so we need to go up one level
    const filePath = path.join(process.cwd(), '..', 'data', 'mock-analysis-results.json');
    console.log('Attempting to read mock data from:', filePath);
    const fileContent = await readFile(filePath, 'utf-8');
    const mockResults = JSON.parse(fileContent);
    
    console.log(`Successfully loaded ${mockResults.length} mock analysis results`);
    return NextResponse.json(mockResults);
  } catch (error) {
    console.error('Error loading mock analysis results:', error);
    console.error('Attempted file path:', path.join(process.cwd(), '..', 'data', 'mock-analysis-results.json'));
    return NextResponse.json(
      { error: 'Failed to load mock analysis results' },
      { status: 500 }
    );
  }
}