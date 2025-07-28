# Kore.ai API Documentation

This directory contains documentation for the Kore.ai APIs used by XOB CAT.

## Overview

XOB CAT integrates with Kore.ai's APIs to retrieve bot conversation data for analysis. The integration uses JWT-based authentication and implements rate limiting to comply with API usage policies.

## Documentation Files

*Documentation files will be added here as they become available.*

## API Integration Details

- **Authentication**: JWT-based authentication
- **Rate Limits**: 60 requests/minute, 1800 requests/hour
- **Base URL**: Configured per bot instance
- **Implementation**: See `backend/src/services/koreApiService.ts`

## Related Code

- **Service**: `backend/src/services/koreApiService.ts` - Main API client
- **Models**: `shared/types/index.ts` - TypeScript interfaces
- **Tests**: `backend/src/__tests__/services/koreApiService.test.ts` - Unit tests
- **Integration Tests**: `backend/src/__tests__/integration/koreApiReal.test.ts` - Real API tests

For XOB CAT's internal API documentation, see [`../api-reference.md`](../api-reference.md).