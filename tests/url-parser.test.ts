import { URLParser } from '../src/services/url-parser'

// Mock the database connection
jest.mock('../src/db/connection', () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(Promise.resolve([{
            name: 'Amazon Australia',
            domain: 'amazon.com.au',
            isActive: true,
            defaultSelector: '.a-price .a-offscreen'
          }]))
        })
      })
    })
  }
}))

describe('URLParser', () => {
  describe('cleanURL', () => {
    test('should remove common tracking parameters', () => {
      const dirtyUrl = 'https://example.com/product?utm_source=test&utm_medium=email&ref=tracker'
      const cleanUrl = URLParser.cleanURL(dirtyUrl)
      expect(cleanUrl).toBe('https://example.com/product')
    })

    test('should clean Amazon URLs properly', () => {
      const amazonUrl = 'https://amazon.com.au/dp/B123456789?utm_source=test&ref=sr_1_1'
      const cleanUrl = URLParser.cleanURL(amazonUrl)
      expect(cleanUrl).toBe('https://amazon.com.au/dp/B123456789')
    })

    test('should handle eBay URLs', () => {
      const ebayUrl = 'https://ebay.com.au/itm/123456789?hash=abc&utm_campaign=test'
      const cleanUrl = URLParser.cleanURL(ebayUrl)
      expect(cleanUrl).toContain('ebay.com.au/itm/123456789')
    })

    test('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-url'
      const result = URLParser.cleanURL(invalidUrl)
      expect(result).toBe(invalidUrl) // Should return original on error
    })
  })

  describe('extractProductId', () => {
    test('should extract Amazon ASIN', () => {
      const url = 'https://amazon.com.au/dp/B123456789'
      const productId = URLParser.extractProductId(url, 'amazon.com.au')
      expect(productId).toBe('B123456789')
    })

    test('should extract eBay item ID from path', () => {
      const url = 'https://ebay.com.au/itm/123456789'
      const productId = URLParser.extractProductId(url, 'ebay.com.au')
      expect(productId).toBe('123456789')
    })

    test('should handle JB Hi-Fi URLs', () => {
      const url = 'https://jbhifi.com.au/products/awesome-product'
      const productId = URLParser.extractProductId(url, 'jbhifi.com.au')
      expect(productId).toBe('awesome-product')
    })

    test('should return undefined for unknown patterns', () => {
      const url = 'https://unknown-store.com/product/test'
      const productId = URLParser.extractProductId(url, 'unknown-store.com')
      expect(productId).toBe('test') // Generic extraction
    })

    test('should handle invalid URLs', () => {
      const invalidUrl = 'not-a-url'
      const productId = URLParser.extractProductId(invalidUrl, 'example.com')
      expect(productId).toBeUndefined()
    })
  })

  describe('parseURL', () => {
    test('should parse a supported store URL', async () => {
      const url = 'https://amazon.com.au/dp/B123456789'
      const result = await URLParser.parseURL(url)
      
      expect(result).toEqual({
        url,
        cleanUrl: expect.any(String),
        domain: 'amazon.com.au',
        store: 'Amazon Australia',
        productId: 'B123456789',
        isSupported: true
      })
    })

    test('should handle unsupported store', async () => {
      // Mock empty result for unsupported store
      const mockDb = require('../src/db/connection').db
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue(Promise.resolve([]))
          })
        })
      })

      const url = 'https://unknown-store.com/product/123'
      const result = await URLParser.parseURL(url)
      
      expect(result.isSupported).toBe(false)
      expect(result.store).toBeUndefined()
    })

    test('should throw error for invalid URL', async () => {
      await expect(URLParser.parseURL('not-a-url')).rejects.toThrow('Invalid URL')
    })
  })
})