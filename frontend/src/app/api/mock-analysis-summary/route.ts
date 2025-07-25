import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Get the analysis summary from the data directory
    const filePath = path.join(process.cwd(), '..', 'data', 'analysis-summary.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const summaryData = JSON.parse(fileContent);
    
    return NextResponse.json(summaryData);
  } catch (error) {
    console.error('Error loading mock analysis summary:', error);
    return NextResponse.json(
      { error: 'Failed to load analysis summary' },
      { status: 500 }
    );
  }
}