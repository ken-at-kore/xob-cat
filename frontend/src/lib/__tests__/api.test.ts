import { apiClient } from '../api'

// Mock fetch globally
global.fetch = jest.fn()

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  describe('healthCheck', () => {
    it('should make a GET request to /health', async () => {
      const mockResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'XOB CAT Backend API'
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.healthCheck()

      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/health', {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(result).toEqual(mockResponse)
    })

    it('should throw error when health check fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(apiClient.healthCheck()).rejects.toThrow('API request failed: 500 Internal Server Error')
    })
  })

  describe('getSessions', () => {
    it('should make a GET request to /api/analysis/sessions with filters', async () => {
      const mockResponse = {
        success: true,
        data: [],
        total_count: 0
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const filters = {
        start_date: '2025-07-01T00:00:00.000Z',
        end_date: '2025-07-31T23:59:59.999Z',
        limit: 100
      }

      const result = await apiClient.getSessions(filters)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/sessions?start_date=2025-07-01T00%3A00%3A00.000Z&end_date=2025-07-31T23%3A59%3A59.999Z&limit=100',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make a GET request without filters', async () => {
      const mockResponse = {
        success: true,
        data: [],
        total_count: 0
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getSessions()

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/sessions?',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getSession', () => {
    it('should make a GET request to /api/analysis/sessions/{sessionId}', async () => {
      const mockResponse = {
        success: true,
        data: {
          session_id: 'session_123',
          user_id: 'user_456'
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await apiClient.getSession('session_123')

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/sessions/session_123',
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('analyzeSession', () => {
    it('should make a POST request to /api/analysis/session', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            session_id: 'session_123',
            analysis: 'This session shows good containment'
          }
        ]
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const sessionId = 'session_123'
      const messages = [
        { message_type: 'user', message: 'Hello' },
        { message_type: 'bot', message: 'Hi there!' }
      ]

      const result = await apiClient.analyzeSession(sessionId, messages)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionId, messages })
        }
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('analyzeSessionsBatch', () => {
    it('should make a POST request to /api/analysis/batch', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            session_id: 'session_123',
            analysis: 'Analysis 1'
          },
          {
            session_id: 'session_456',
            analysis: 'Analysis 2'
          }
        ]
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const sessions = [
        { session_id: 'session_123', messages: [] },
        { session_id: 'session_456', messages: [] }
      ]

      const result = await apiClient.analyzeSessionsBatch(sessions)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/batch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessions })
        }
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.healthCheck()).rejects.toThrow('Network error')
    })

    it('should handle non-JSON responses', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      await expect(apiClient.healthCheck()).rejects.toThrow('Invalid JSON')
    })
  })
}) 