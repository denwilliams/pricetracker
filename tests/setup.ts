// Test setup file
import { beforeAll, afterAll } from '@jest/globals'

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://localhost:5432/pricetracker_test'
process.env.PORT = '3002'

// Mock external dependencies
jest.mock('puppeteer', () => ({
  launch: jest.fn(() => Promise.resolve({
    newPage: jest.fn(() => Promise.resolve({
      setUserAgent: jest.fn(),
      setViewport: jest.fn(),
      goto: jest.fn(),
      waitForTimeout: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn(),
    })),
    close: jest.fn(),
  })),
}))

jest.mock('pushover-notifications', () => {
  return jest.fn().mockImplementation(() => ({
    send: jest.fn((msg, callback) => callback(null, { status: 'sent' })),
  }))
})

// Increase timeout for integration tests
jest.setTimeout(30000)

beforeAll(async () => {
  // Setup test database or mock services if needed
})

afterAll(async () => {
  // Cleanup
})