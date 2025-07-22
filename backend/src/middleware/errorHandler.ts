import { Request, Response, NextFunction } from 'express';
import { internalServerErrorResponse, errorResponse } from '../utils/apiResponse';

// Custom error class for API errors
export class ApiError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.name = 'ApiError';

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// Specific error types
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden access') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(service: string, message?: string) {
    const errorMessage = message || `${service} is currently unavailable`;
    super(errorMessage, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Global error handling middleware
 * Should be the last middleware in the chain
 */
export function globalErrorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error details
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Handle known API errors
  if (error instanceof ApiError) {
    errorResponse(
      res,
      error.errorCode,
      error.message,
      error.statusCode,
      error.details
    );
    return;
  }

  // Handle specific Node.js errors
  if (error.name === 'ValidationError') {
    errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    return;
  }

  if (error.name === 'CastError') {
    errorResponse(res, 'INVALID_FORMAT', 'Invalid data format provided', 400);
    return;
  }

  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    errorResponse(res, 'DATABASE_ERROR', 'Database operation failed', 500);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    errorResponse(res, 'INVALID_TOKEN', 'Invalid authentication token', 401);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    errorResponse(res, 'TOKEN_EXPIRED', 'Authentication token has expired', 401);
    return;
  }

  // Handle multer errors (file upload)
  if (error.name === 'MulterError') {
    errorResponse(res, 'FILE_UPLOAD_ERROR', error.message, 400);
    return;
  }

  // Default internal server error
  internalServerErrorResponse(
    res,
    process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined
  );
}

/**
 * 404 Not Found middleware
 * Should be placed after all routes but before error handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  errorResponse(
    res,
    'NOT_FOUND',
    `Route ${req.originalUrl} not found`,
    404
  );
}

/**
 * Async error wrapper to catch async errors in route handlers
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}