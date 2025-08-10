import { PriceScraper } from '../src/services/scraper'

// Mock external dependencies
jest.mock('puppeteer')
jest.mock('axios')
jest.mock('../src/services/url-parser')

const mockAxios = require('axios')
const mockURLParser = require('../src/services/url-parser')

describe('PriceScraper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockURLParser.URLParser.parseURL.mockResolvedValue({
      cleanUrl: 'https://example.com/product/123',
      isSupported: true,
      domain: 'example.com',
      store: 'Example Store'
    })
    
    mockURLParser.URLParser.getDefaultSelector.mockResolvedValue('.price')
  })

  describe('scrapePrice', () => {
    test('should return price from supported store', async () => {
      // Mock successful scraping
      mockAxios.get.mockResolvedValue({
        data: '<html><body><div class="price">$99.99</div></body></html>'
      })

      const result = await PriceScraper.scrapePrice('https://example.com/product/123')
      
      expect(result).toEqual({
        price: expect.any(Number),
        currency: 'AUD',
        isAvailable: true,
        productName: undefined,
        imageUrl: undefined
      })
    })

    test('should handle unsupported store', async () => {
      mockURLParser.URLParser.parseURL.mockResolvedValue({
        isSupported: false,
        domain: 'unsupported.com'
      })

      const result = await PriceScraper.scrapePrice('https://unsupported.com/product/123')
      
      expect(result).toEqual({
        price: null,
        currency: 'AUD',
        isAvailable: false,
        error: 'Store not supported: unsupported.com'
      })
    })

    test('should handle scraping errors gracefully', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'))

      const result = await PriceScraper.scrapePrice('https://example.com/product/123')
      
      expect(result).toEqual({
        price: null,
        currency: 'AUD',
        isAvailable: false,
        error: 'Unable to extract price with any method'
      })
    })

    test('should extract product information', async () => {
      mockAxios.get.mockResolvedValue({
        data: `
          <html>
            <body>
              <h1 id="productTitle">Test Product</h1>
              <div class="price">$49.95</div>
              <img id="landingImage" src="https://example.com/image.jpg" />
            </body>
          </html>
        `
      })

      const result = await PriceScraper.scrapePrice('https://example.com/product/123')
      
      expect(result.price).toBe(49.95)
      expect(result.productName).toBe('Test Product')
      expect(result.imageUrl).toBe('https://example.com/image.jpg')
    })

    test('should detect out of stock products', async () => {
      mockAxios.get.mockResolvedValue({
        data: `
          <html>
            <body>
              <div class="price">$99.99</div>
              <div class="availability">Out of stock</div>
            </body>
          </html>
        `
      })

      const result = await PriceScraper.scrapePrice('https://example.com/product/123')
      
      expect(result.isAvailable).toBe(false)
    })
  })

  describe('getDefaultSelector', () => {
    test('should return correct selector for known domains', () => {
      expect(PriceScraper.getDefaultSelector('amazon.com.au')).toBe('.a-price .a-offscreen, .a-price-whole')
      expect(PriceScraper.getDefaultSelector('ebay.com.au')).toBe('.u-flL.condensedfont, .price .notranslate')
      expect(PriceScraper.getDefaultSelector('jbhifi.com.au')).toBe('.price, .current-price')
    })

    test('should return generic selector for unknown domains', () => {
      const selector = PriceScraper.getDefaultSelector('unknown.com')
      expect(selector).toBe('.price, [class*="price"], [id*="price"]')
    })
  })

  describe('testScrape', () => {
    test('should run test scrape and return results', async () => {
      mockAxios.get.mockResolvedValue({
        data: '<html><body><div class="price">$29.99</div></body></html>'
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = await PriceScraper.testScrape('https://example.com/product/123')
      
      expect(result.price).toBe(29.99)
      expect(consoleSpy).toHaveBeenCalledWith('Testing scrape for: https://example.com/product/123')
      expect(consoleSpy).toHaveBeenCalledWith('Result:', expect.any(Object))
      
      consoleSpy.mockRestore()
    })
  })
})