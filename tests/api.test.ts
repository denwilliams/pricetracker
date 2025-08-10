import request from 'supertest'
import { Hono } from 'hono'

// Mock database and services
jest.mock('../src/db/connection')
jest.mock('../src/services/url-parser')
jest.mock('../src/services/scraper')
jest.mock('../src/services/scheduler')

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis()
}

require('../src/db/connection').db = mockDb

const mockURLParser = require('../src/services/url-parser').URLParser
const mockPriceScraper = require('../src/services/scraper').PriceScraper

describe('API Endpoints', () => {
  let app: Hono

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Import the app after mocks are set up
    delete require.cache[require.resolve('../src/routes/products')]
    app = new Hono()
    const productsRoute = require('../src/routes/products').default
    app.route('/api/products', productsRoute)
  })

  describe('GET /api/products', () => {
    test('should return list of products', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Test Product',
          url: 'https://example.com/product/1',
          store: 'Example Store',
          currentPrice: '99.99',
          targetPrice: '89.99',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z'
        }
      ]

      mockDb.returning.mockResolvedValue(mockProducts)

      const response = await request(app.fetch.bind(app))
        .get('/api/products')
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        products: mockProducts,
        count: 1
      })
    })

    test('should handle database errors', async () => {
      mockDb.returning.mockRejectedValue(new Error('Database error'))

      const response = await request(app.fetch.bind(app))
        .get('/api/products')
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch products'
      })
    })
  })

  describe('POST /api/products', () => {
    beforeEach(() => {
      mockURLParser.parseURL.mockResolvedValue({
        cleanUrl: 'https://example.com/product/1',
        isSupported: true,
        domain: 'example.com',
        store: 'Example Store'
      })

      mockPriceScraper.scrapePrice.mockResolvedValue({
        price: 99.99,
        productName: 'Test Product',
        currency: 'AUD',
        isAvailable: true
      })

      mockDb.returning.mockResolvedValue([{
        id: 1,
        name: 'Test Product',
        url: 'https://example.com/product/1',
        store: 'Example Store',
        currentPrice: '99.99',
        isActive: true
      }])
    })

    test('should create new product', async () => {
      const productData = {
        url: 'https://example.com/product/1',
        targetPrice: 89.99
      }

      const response = await request(app.fetch.bind(app))
        .post('/api/products')
        .send(productData)
        .expect(201)

      expect(response.body).toEqual({
        success: true,
        message: 'Product added successfully',
        product: expect.objectContaining({
          id: 1,
          name: 'Test Product',
          url: 'https://example.com/product/1'
        })
      })
    })

    test('should reject unsupported store', async () => {
      mockURLParser.parseURL.mockResolvedValue({
        isSupported: false,
        domain: 'unsupported.com'
      })

      const productData = {
        url: 'https://unsupported.com/product/1'
      }

      const response = await request(app.fetch.bind(app))
        .post('/api/products')
        .send(productData)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Store not supported')
    })

    test('should validate required fields', async () => {
      const response = await request(app.fetch.bind(app))
        .post('/api/products')
        .send({})
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    test('should handle duplicate products', async () => {
      // Mock existing product
      const existingProduct = [{
        id: 1,
        name: 'Existing Product',
        url: 'https://example.com/product/1'
      }]
      
      // First call returns existing product (for duplicate check)
      mockDb.returning.mockResolvedValueOnce(existingProduct)

      const productData = {
        url: 'https://example.com/product/1'
      }

      const response = await request(app.fetch.bind(app))
        .post('/api/products')
        .send(productData)
        .expect(409)

      expect(response.body).toEqual({
        success: false,
        error: 'Product already being tracked',
        product: existingProduct[0]
      })
    })
  })

  describe('PUT /api/products/:id', () => {
    test('should update product', async () => {
      // Mock existing product check
      mockDb.returning.mockResolvedValueOnce([{ id: 1, name: 'Existing Product' }])
      
      // Mock update result
      const updatedProduct = {
        id: 1,
        name: 'Updated Product',
        targetPrice: '79.99',
        isActive: true
      }
      mockDb.returning.mockResolvedValueOnce([updatedProduct])

      const updateData = {
        name: 'Updated Product',
        targetPrice: 79.99,
        isActive: true
      }

      const response = await request(app.fetch.bind(app))
        .put('/api/products/1')
        .send(updateData)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct
      })
    })

    test('should return 404 for non-existent product', async () => {
      mockDb.returning.mockResolvedValue([]) // No product found

      const response = await request(app.fetch.bind(app))
        .put('/api/products/999')
        .send({ name: 'Test' })
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: 'Product not found'
      })
    })
  })

  describe('DELETE /api/products/:id', () => {
    test('should delete product', async () => {
      // Mock existing product check
      mockDb.returning.mockResolvedValue([{ id: 1, name: 'Test Product' }])

      const response = await request(app.fetch.bind(app))
        .delete('/api/products/1')
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: 'Product deleted successfully'
      })
    })

    test('should return 404 for non-existent product', async () => {
      mockDb.returning.mockResolvedValue([]) // No product found

      const response = await request(app.fetch.bind(app))
        .delete('/api/products/999')
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: 'Product not found'
      })
    })
  })
})