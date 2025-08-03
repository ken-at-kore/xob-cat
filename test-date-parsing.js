// Test date parsing logic to understand the issue

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

// Test the parsing
const testDate = '2025-08-01';
const testTime = '09:00';

console.log('Testing date parsing for auto-analyze:');
console.log(`Input: ${testDate} ${testTime} ET`);

const parsed = parseETDateTime(testDate, testTime);
console.log(`Parsed to UTC: ${parsed.toISOString()}`);

// Generate time windows like the session sampling service
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

const windows = generateTimeWindows(testDate, testTime);
console.log('\nTime windows that will be searched:');
windows.forEach(w => {
  console.log(`${w.label}:`);
  console.log(`  From: ${w.start.toISOString()}`);
  console.log(`  To:   ${w.end.toISOString()}`);
});

// Now check what the direct API uses
console.log('\n\nDirect API date parsing (from analysis.ts):');
// The direct API also uses parseETDateTime
const directApiStart = parseETDateTime(testDate, testTime);
console.log(`Direct API would use: ${directApiStart.toISOString()}`);

// The direct API might also be using end time
const endTime = '12:00'; // 3 hours later
const directApiEnd = parseETDateTime(testDate, endTime);
console.log(`Direct API end would use: ${directApiEnd.toISOString()}`);