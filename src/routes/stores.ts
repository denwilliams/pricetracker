import { Hono } from 'hono'
import { db } from '../db/connection.js'
import { stores } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const app = new Hono()

// Get all stores
app.get('/', async (c) => {
  try {
    const allStores = await db
      .select()
      .from(stores)
      .orderBy(stores.name)

    return c.json({ 
      success: true,
      stores: allStores,
      count: allStores.length 
    })
  } catch (error) {
    console.error('Error fetching stores:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch stores' 
    }, 500)
  }
})

// Get supported stores (active only)
app.get('/supported', async (c) => {
  try {
    const supportedStores = await db
      .select()
      .from(stores)
      .where(eq(stores.isActive, true))
      .orderBy(stores.name)

    return c.json({ 
      success: true,
      stores: supportedStores,
      count: supportedStores.length 
    })
  } catch (error) {
    console.error('Error fetching supported stores:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch supported stores' 
    }, 500)
  }
})

export default app