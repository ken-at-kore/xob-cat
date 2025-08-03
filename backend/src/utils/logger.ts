/**
 * Simple structured logging service for XOBCAT
 * Provides consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  context?: Record<string, unknown>;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    // Set log level based on environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      default:
        this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
    }
  }

  private log(level: LogLevel, service: string, message: string, context?: Record<string, unknown>): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      service,
      message,
      ...(context && { context })
    };

    // In production, we'd send to a logging service
    // For now, use console with structured format
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      const emoji = this.getLevelEmoji(level);
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.log(`${emoji} [${service}] ${message}${contextStr}`);
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      default: return '📝';
    }
  }

  debug(service: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, service, message, context);
  }

  info(service: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, service, message, context);
  }

  warn(service: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, service, message, context);
  }

  error(service: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, service, message, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience methods for backward compatibility
export const createServiceLogger = (serviceName: string) => ({
  debug: (message: string, context?: Record<string, unknown>) => logger.debug(serviceName, message, context),
  info: (message: string, context?: Record<string, unknown>) => logger.info(serviceName, message, context),
  warn: (message: string, context?: Record<string, unknown>) => logger.warn(serviceName, message, context),
  error: (message: string, context?: Record<string, unknown>) => logger.error(serviceName, message, context),
});