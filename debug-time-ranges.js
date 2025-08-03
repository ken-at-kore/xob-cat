/**
 * Debug the exact time ranges being used by both approaches
 */

// Simulate the parseETDateTime function
function parseETDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);

  // Create date assuming it's already in ET, then convert to UTC
  const etOffset = getETOffset(new Date(year, (month - 1), day));
  
  // Create date in UTC by directly adjusting for ET offset
  // ET time + offset = UTC time
  const utcHours = (hours + etOffset) % 24;
  const date = new Date(Date.UTC(year, (month - 1), day, utcHours, minutes));
  
  // Handle day rollover if needed
  if (hours + etOffset >= 24) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function getETOffset(date) {
  const month = date.getMonth();
  const isDST = month > 2 && month < 10; // Simplified - March through October
  return isDST ? 4 : 5; // EDT is UTC-4, EST is UTC-5
}

function generateTimeWindows(startDate, startTime) {
  const windows = [];
  const EXPANSION_STRATEGY = [
    { duration: 3, label: 'Initial 3-hour window' },
    { duration: 6, label: 'Extended to 6 hours' },
    { duration: 12, label: 'Extended to 12 hours' },
    { duration: 144, label: 'Extended to 6 days' }
  ];
  
  const startDateTime = parseETDateTime(startDate, startTime);

  for (const strategy of EXPANSION_STRATEGY) {
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + strategy.duration);

    windows.push({
      start: new Date(startDateTime),
      end: endDateTime,
      duration: strategy.duration,
      label: strategy.label
    });
  }

  return windows;
}

console.log('=== COMPARING TIME RANGES ===');

// Session Viewer approach
console.log('\n1. Session Viewer time range:');
const startDate = '2025-08-01';
const startTime = '09:00';
const endDate = '2025-08-01';
const endTime = '12:00';

const sessionViewerStart = parseETDateTime(startDate, startTime);
const sessionViewerEnd = parseETDateTime(endDate, endTime);

console.log(`   From: ${sessionViewerStart.toISOString()}`);
console.log(`   To:   ${sessionViewerEnd.toISOString()}`);
console.log(`   Duration: ${(sessionViewerEnd - sessionViewerStart) / (1000 * 60 * 60)} hours`);

// Auto-analyze approach
console.log('\n2. Auto-analyze time windows:');
const autoAnalyzeWindows = generateTimeWindows(startDate, startTime);

autoAnalyzeWindows.forEach(window => {
  console.log(`   ${window.label}:`);
  console.log(`     From: ${window.start.toISOString()}`);
  console.log(`     To:   ${window.end.toISOString()}`);
  console.log(`     Duration: ${window.duration} hours`);
  
  // Check if session viewer time range overlaps with this window
  const overlaps = (sessionViewerStart < window.end) && (sessionViewerEnd > window.start);
  console.log(`     Overlaps with session viewer range: ${overlaps}`);
});

console.log('\n3. Analysis:');
console.log('If the first auto-analyze window overlaps with the session viewer range,');
console.log('then both should find the same sessions. If not, that explains the difference!');

// Check specific overlap
const firstWindow = autoAnalyzeWindows[0];
const overlaps = (sessionViewerStart < firstWindow.end) && (sessionViewerEnd > firstWindow.start);
console.log(`\nFirst window overlap: ${overlaps}`);

if (overlaps) {
  console.log('✅ Time ranges overlap - issue must be elsewhere');
} else {
  console.log('❌ Time ranges do NOT overlap - this could be the issue!');
}