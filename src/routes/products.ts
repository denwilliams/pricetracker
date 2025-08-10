import { Hono } from 'hono'
import { db } from '../db/connection.js'
import { products, priceHistory, insertProductSchema, selectProductSchema } from '../db/schema.js'
import { URLParser } from '../services/url-parser.js'
import { PriceScraper } from '../services/scraper.js'
import { PriceMonitorScheduler } from '../services/scheduler.js'
import { eq, desc } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

// Get all products
app.get('/', async (c) => {
  try {
    const allProducts = await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt))

    return c.json({ 
      success: true,
      products: allProducts,
      count: allProducts.length 
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch products' 
    }, 500)
  }
})

// Get single product with price history
app.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid product ID' 
      }, 400)
    }

    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1)

    if (product.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Product not found' 
      }, 404)
    }

    // Get price history for the last 30 days
    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productId, id))
      .orderBy(desc(priceHistory.scrapedAt))
      .limit(100)

    return c.json({
      success: true,
      product: product[0],
      priceHistory: history
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch product' 
    }, 500)
  }
})

// Create new product
app.post('/', 
  zValidator('json', z.object({
    name: z.string().min(1).max(255).optional(),
    url: z.string().url(),
    targetPrice: z.number().positive().optional(),
    selector: z.string().optional()
  })),
  async (c) => {
    try {
      const body = c.req.valid('json')
      
      // Parse and validate URL
      const parsed = await URLParser.parseURL(body.url)
      
      if (!parsed.isSupported) {
        return c.json({
          success: false,
          error: `Store not supported: ${parsed.domain}. Supported stores: Amazon AU, eBay AU, JB Hi-Fi, Harvey Norman, Woolworths, Coles`
        }, 400)
      }

      // Check if product already exists
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.url, parsed.cleanUrl))
        .limit(1)

      if (existing.length > 0) {
        return c.json({
          success: false,
          error: 'Product already being tracked',
          product: existing[0]
        }, 409)
      }

      // Get initial price and product info
      let initialPrice: string | undefined
      let productName = body.name

      try {
        console.log('🔍 Getting initial price for new product...')
        const scrapeResult = await PriceScraper.scrapePrice(parsed.cleanUrl, body.selector)
        
        if (scrapeResult.price) {
          initialPrice = scrapeResult.price.toString()
        }
        
        if (!productName && scrapeResult.productName) {
          productName = scrapeResult.productName
        }
      } catch (error) {
        console.warn('Could not get initial price:', error)
      }

      // Create product
      const newProduct = await db
        .insert(products)
        .values({
          name: productName || `Product from ${parsed.store || parsed.domain}`,
          url: parsed.cleanUrl,
          store: parsed.store || parsed.domain,
          selector: body.selector,
          currentPrice: initialPrice,
          targetPrice: body.targetPrice?.toString(),
          isActive: true,
          lastChecked: initialPrice ? new Date() : null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()

      // Add initial price to history if we got one
      if (initialPrice) {
        await db.insert(priceHistory).values({
          productId: newProduct[0].id,
          price: initialPrice,
          currency: 'AUD',
          isAvailable: true,
          scrapedAt: new Date()
        })
      }

      return c.json({
        success: true,
        message: 'Product added successfully',
        product: newProduct[0]
      }, 201)
    } catch (error) {
      console.error('Error creating product:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to create product' 
      }, 500)
    }
  }
)

// Update product
app.put('/:id',
  zValidator('json', z.object({
    name: z.string().min(1).max(255).optional(),
    targetPrice: z.number().positive().optional().nullable(),
    selector: z.string().optional().nullable(),
    isActive: z.boolean().optional()
  })),
  async (c) => {
    try {
      const id = parseInt(c.req.param('id'))
      const body = c.req.valid('json')
      
      if (isNaN(id)) {
        return c.json({ 
          success: false, 
          error: 'Invalid product ID' 
        }, 400)
      }

      // Check if product exists
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1)

      if (existing.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Product not found' 
        }, 404)
      }

      // Update product
      const updated = await db
        .update(products)
        .set({
          name: body.name,
          targetPrice: body.targetPrice?.toString(),
          selector: body.selector,
          isActive: body.isActive,
          updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning()

      return c.json({
        success: true,
        message: 'Product updated successfully',
        product: updated[0]
      })
    } catch (error) {
      console.error('Error updating product:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to update product' 
      }, 500)
    }
  }
)

// Delete product
app.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid product ID' 
      }, 400)
    }

    // Check if product exists
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1)

    if (existing.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Product not found' 
      }, 404)
    }

    // Delete product (cascade will handle price history and notifications)
    await db
      .delete(products)
      .where(eq(products.id, id))

    return c.json({
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to delete product' 
    }, 500)
  }
})

// Manually check price for a product
app.post('/:id/check-price', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid product ID' 
      }, 400)
    }

    // Check if product exists
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1)

    if (product.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Product not found' 
      }, 404)
    }

    if (!product[0].isActive) {
      return c.json({ 
        success: false, 
        error: 'Product is not active' 
      }, 400)
    }

    // Trigger price check
    await PriceMonitorScheduler.checkSingleProduct(id)

    // Get updated product
    const updated = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1)

    return c.json({
      success: true,
      message: 'Price check completed',
      product: updated[0]
    })
  } catch (error) {
    console.error('Error checking price:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to check price' 
    }, 500)
  }
})

// Get price history for a product
app.get('/:id/history', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const limit = parseInt(c.req.query('limit') || '30')
    
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid product ID' 
      }, 400)
    }

    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productId, id))
      .orderBy(desc(priceHistory.scrapedAt))
      .limit(Math.min(limit, 1000)) // Cap at 1000 records

    return c.json({
      success: true,
      history: history,
      count: history.length
    })
  } catch (error) {
    console.error('Error fetching price history:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch price history' 
    }, 500)
  }
})

export default app