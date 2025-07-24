/**
 * API Response Utilities Unit Tests
 * 
 * Tests for standard API response wrappers including success, error,
 * validation, not found, unauthorized, forbidden, internal server error,
 * and service unavailable responses.
 */

import { Response } from 'express';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  serviceUnavailableResponse,
  StandardApiResponse,
  ApiError
} from '../../utils/apiResponse';

describe('API Response Utilities', () => {
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();
    
    mockRes = {
      status: mockStatus,
      json: mockJson
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successResponse', () => {
    it('should return a success response with data', () => {
      const testData = { id: 1, name: 'Test' };
      
      successResponse(mockRes as Response, testData);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: testData,
        timestamp: expect.any(String)
      });
    });

    it('should include optional message and meta', () => {
      const testData = { items: [1, 2, 3] };
      const message = 'Items retrieved successfully';
      const meta = { total_count: 3, has_more: false };
      
      successResponse(mockRes as Response, testData, message, meta);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: testData,
        message,
        meta,
        timestamp: expect.any(String)
      });
    });

    it('should use custom status code', () => {
      const testData = { created: true };
      
      successResponse(mockRes as Response, testData, undefined, undefined, 201);

      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it('should generate valid ISO timestamp', () => {
      const testData = { test: true };
      
      successResponse(mockRes as Response, testData);

      const call = mockJson.mock.calls[0][0];
      expect(new Date(call.timestamp).toISOString()).toBe(call.timestamp);
    });
  });

  describe('errorResponse', () => {
    it('should return an error response', () => {
      const error = 'TEST_ERROR';
      const message = 'Test error message';
      
      errorResponse(mockRes as Response, error, message);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error,
        message,
        timestamp: expect.any(String)
      });
    });

    it('should use error as message when message not provided', () => {
      const error = 'TEST_ERROR';
      
      errorResponse(mockRes as Response, error);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error,
        message: error,
        timestamp: expect.any(String)
      });
    });

    it('should use custom status code', () => {
      const error = 'BAD_REQUEST';
      
      errorResponse(mockRes as Response, error, undefined, 400);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('should include details in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = 'TEST_ERROR';
      const details = { stack: 'Error stack trace' };
      
      errorResponse(mockRes as Response, error, undefined, 500, details);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error,
        message: error,
        timestamp: expect.any(String),
        details
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include details in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = 'TEST_ERROR';
      const details = { stack: 'Error stack trace' };
      
      errorResponse(mockRes as Response, error, undefined, 500, details);

      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error,
        message: error,
        timestamp: expect.any(String)
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('validationErrorResponse', () => {
    it('should return a validation error response', () => {
      const message = 'Invalid input provided';
      
      validationErrorResponse(mockRes as Response, message);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Validation Error',
        message,
        timestamp: expect.any(String)
      });
    });

    it('should include validation details', () => {
      const message = 'Validation failed';
      const details = { field: 'email', reason: 'Invalid format' };
      
      validationErrorResponse(mockRes as Response, message, details);

      const call = mockJson.mock.calls[0][0];
      expect(call.error).toBe('Validation Error');
      expect(call.message).toBe(message);
    });
  });

  describe('notFoundResponse', () => {
    it('should return a not found response without identifier', () => {
      const resource = 'User';
      
      notFoundResponse(mockRes as Response, resource);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'User not found',
        timestamp: expect.any(String)
      });
    });

    it('should return a not found response with identifier', () => {
      const resource = 'User';
      const identifier = '12345';
      
      notFoundResponse(mockRes as Response, resource, identifier);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: "User with identifier '12345' not found",
        timestamp: expect.any(String)
      });
    });
  });

  describe('unauthorizedResponse', () => {
    it('should return an unauthorized response with default message', () => {
      unauthorizedResponse(mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Unauthorized access',
        timestamp: expect.any(String)
      });
    });

    it('should return an unauthorized response with custom message', () => {
      const message = 'Invalid credentials';
      
      unauthorizedResponse(mockRes as Response, message);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message,
        timestamp: expect.any(String)
      });
    });
  });

  describe('forbiddenResponse', () => {
    it('should return a forbidden response with default message', () => {
      forbiddenResponse(mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: 'Forbidden access',
        timestamp: expect.any(String)
      });
    });

    it('should return a forbidden response with custom message', () => {
      const message = 'Insufficient permissions';
      
      forbiddenResponse(mockRes as Response, message);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message,
        timestamp: expect.any(String)
      });
    });
  });

  describe('internalServerErrorResponse', () => {
    it('should return an internal server error response with default message', () => {
      internalServerErrorResponse(mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Internal server error',
        timestamp: expect.any(String)
      });
    });

    it('should return an internal server error response with custom message and details', () => {
      const message = 'Database connection failed';
      const details = { connection: 'timeout', retries: 3 };
      
      internalServerErrorResponse(mockRes as Response, message, details);

      expect(mockStatus).toHaveBeenCalledWith(500);
      const call = mockJson.mock.calls[0][0];
      expect(call.error).toBe('Internal Server Error');
      expect(call.message).toBe(message);
    });
  });

  describe('serviceUnavailableResponse', () => {
    it('should return a service unavailable response with generated message', () => {
      const service = 'Kore.ai API';
      
      serviceUnavailableResponse(mockRes as Response, service);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Service Unavailable',
        message: 'Kore.ai API is currently unavailable',
        timestamp: expect.any(String)
      });
    });

    it('should return a service unavailable response with custom message', () => {
      const service = 'OpenAI API';
      const message = 'Service maintenance in progress';
      
      serviceUnavailableResponse(mockRes as Response, service, message);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Service Unavailable',
        message,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Response chaining', () => {
    it('should support method chaining', () => {
      successResponse(mockRes as Response, { test: true });
      
      expect(mockStatus).toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalled();
      expect(mockStatus).toHaveReturnedWith(mockRes);
      expect(mockJson).toHaveReturnedWith(mockRes);
    });
  });

  describe('TypeScript interfaces', () => {
    it('should work with StandardApiResponse interface', () => {
      const response: StandardApiResponse<{ id: number }> = {
        success: true,
        data: { id: 1 },
        timestamp: new Date().toISOString()
      };

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(1);
    });

    it('should work with ApiError interface', () => {
      const error: ApiError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' }
      };

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
    });
  });
});