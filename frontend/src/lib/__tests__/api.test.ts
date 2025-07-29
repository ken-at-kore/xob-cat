import { apiClient } from '../api'

// Import static test data
const staticSessionData = require('../../../../data/api-kore-sessions-selfservice-2025-07-23T17-05-08.json')
const staticMessageData = require('../../../../data/api-kore-messages-2025-07-23T17-05-31.json')

// Mock fetch globally
global.fetch = jest.fn()

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockClear()
  })

  describe('healthCheck', () => {
    it('should make a GET request to /health', async () => {
      const healthResponseData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'XOB CAT Backend API'
      }

      const standardResponse = {
        success: true,
        data: healthResponseData,
        timestamp: new Date().toISOString()
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => standardResponse
      })

      const result = await apiClient.healthCheck()

      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/health', {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      expect(result).toEqual(healthResponseData)
    })

    it('should throw error when health check fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          error: 'Internal Server Error',
          timestamp: new Date().toISOString()
        })
      })

      await expect(apiClient.healthCheck()).rejects.toThrow('Internal Server Error')
    })
  })

  describe('getSessions', () => {
    it('should make a GET request to /api/analysis/sessions with filters', async () => {
      // Use static data with realistic sessions
      const realisticSessions = staticSessionData.data.slice(0, 3) // Use first 3 sessions
      const standardResponse = {
        success: true,
        data: realisticSessions,
        timestamp: new Date().toISOString(),
        meta: {
          total_count: realisticSessions.length
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => standardResponse
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
      expect(result).toEqual(realisticSessions) // API client extracts data field
    })

    it('should make a GET request without filters', async () => {
      const realisticSessions = staticSessionData.data.slice(0, 2) // Use first 2 sessions
      const standardResponse = {
        success: true,
        data: realisticSessions,
        timestamp: new Date().toISOString(),
        meta: {
          total_count: realisticSessions.length
        }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => standardResponse
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
      expect(result).toEqual(realisticSessions)
    })
  })

  describe('getSession', () => {
    it('should make a GET request to /api/analysis/sessions/{sessionId}', async () => {
      const realisticSession = staticSessionData.data[0] // First session from static data
      const standardResponse = {
        success: true,
        data: realisticSession,
        timestamp: new Date().toISOString()
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => standardResponse
      })

      const sessionId = realisticSession.session_id
      const result = await apiClient.getSession(sessionId)

      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/analysis/sessions/${sessionId}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(realisticSession)
    })
  })

  describe('analyzeSession', () => {
    it('should make a POST request to /api/analysis/session', async () => {
      const realisticSession = staticSessionData.data[0]
      const sessionId = realisticSession.session_id
      
      // Get realistic messages for this session
      const realisticMessages = staticMessageData.data
        .filter((msg: any) => msg.sessionId === sessionId)
        .slice(0, 5) // Use first 5 messages
      
      const analysisResult = {
        analyses: [{
          session_id: sessionId,
          intent: 'Claim Status',
          outcome: 'Contained',
          dropOff: false,
          escalationReason: null,
          notes: 'User successfully checked claim status'
        }],
        token_usage: {
          prompt_tokens: 150,
          completion_tokens: 50,
          total_tokens: 200,
          cost: 0.0004
        }
      }

      const standardResponse = {
        success: true,
        data: analysisResult,
        timestamp: new Date().toISOString()
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => standardResponse
      })

      const result = await apiClient.analyzeSession(sessionId, realisticMessages)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionId, messages: realisticMessages })
        }
      )
      expect(result).toEqual(analysisResult)
    })
  })

  describe('analyzeSessionsBatch', () => {
    it('should make a POST request to /api/analysis/batch', async () => {
      const realisticSessions = staticSessionData.data.slice(0, 2) // First 2 sessions
      
      const batchResult = {
        analyses: realisticSessions.map((session: any) => ({
          session_id: session.session_id,
          intent: 'Member Services',
          outcome: 'Contained',
          dropOff: false,
          escalationReason: null,
          notes: 'Session handled successfully'
        })),
        token_usage: {
          prompt_tokens: 300,
          completion_tokens: 100,
          total_tokens: 400,
          cost: 0.0008
        }
      }

      const standardResponse = {
        success: true,
        data: batchResult,
        timestamp: new Date().toISOString()
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => standardResponse
      })

      const sessionsWithMessages = realisticSessions.map((session: any) => ({
        session_id: session.session_id,
        messages: staticMessageData.data
          .filter((msg: any) => msg.sessionId === session.session_id)
          .slice(0, 3) // First 3 messages per session
      }))

      const result = await apiClient.analyzeSessionsBatch(sessionsWithMessages)

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/analysis/batch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessions: sessionsWithMessages })
        }
      )
      expect(result).toEqual(batchResult)
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