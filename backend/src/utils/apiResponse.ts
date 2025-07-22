import { Response } from 'express';

// Standard API response interface
export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  meta?: {
    total_count?: number;
    has_more?: boolean;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
}

// Error response interface
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string; // Only in development
}

/**
 * Standard success response wrapper
 */
export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: StandardApiResponse['meta'],
  statusCode: number = 200
): Response<StandardApiResponse<T>> {
  const response: StandardApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(message && { message }),
    ...(meta && { meta })
  };

  return res.status(statusCode).json(response);
}

/**
 * Standard error response wrapper
 */
export function errorResponse(
  res: Response,
  error: string,
  message?: string,
  statusCode: number = 500,
  details?: any
): Response<StandardApiResponse<never>> {
  const response: StandardApiResponse<never> = {
    success: false,
    error,
    message: message || error,
    timestamp: new Date().toISOString(),
    ...(details && process.env.NODE_ENV === 'development' && { details })
  };

  return res.status(statusCode).json(response);
}

/**
 * Validation error response (400)
 */
export function validationErrorResponse(
  res: Response,
  message: string,
  details?: any
): Response<StandardApiResponse<never>> {
  return errorResponse(res, 'Validation Error', message, 400, details);
}

/**
 * Not found error response (404)
 */
export function notFoundResponse(
  res: Response,
  resource: string,
  identifier?: string
): Response<StandardApiResponse<never>> {
  const message = identifier 
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;
  
  return errorResponse(res, 'Not Found', message, 404);
}

/**
 * Unauthorized error response (401)
 */
export function unauthorizedResponse(
  res: Response,
  message: string = 'Unauthorized access'
): Response<StandardApiResponse<never>> {
  return errorResponse(res, 'Unauthorized', message, 401);
}

/**
 * Forbidden error response (403)
 */
export function forbiddenResponse(
  res: Response,
  message: string = 'Forbidden access'
): Response<StandardApiResponse<never>> {
  return errorResponse(res, 'Forbidden', message, 403);
}

/**
 * Internal server error response (500)
 */
export function internalServerErrorResponse(
  res: Response,
  message: string = 'Internal server error',
  details?: any
): Response<StandardApiResponse<never>> {
  return errorResponse(res, 'Internal Server Error', message, 500, details);
}

/**
 * Service unavailable error response (503)
 */
export function serviceUnavailableResponse(
  res: Response,
  service: string,
  message?: string
): Response<StandardApiResponse<never>> {
  const errorMessage = message || `${service} is currently unavailable`;
  return errorResponse(res, 'Service Unavailable', errorMessage, 503);
}