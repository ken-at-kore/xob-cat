/**
 * Date and time formatting utilities
 */

export const formatDuration = (seconds?: number | string | null) => {
  const value = Number(seconds);
  // Fixed: Check for null/undefined specifically, but allow 0 
  if (seconds === null || seconds === undefined || isNaN(value) || value < 0) return 'N/A';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = Math.floor(value % 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/New_York'
  }) + ' ET';
};

export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/New_York'
  });
};