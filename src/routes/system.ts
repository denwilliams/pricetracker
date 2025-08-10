import { Hono } from 'hono'
import { db } from '../db/connection.js'
import { products, priceHistory, notifications } from '../db/schema.js'
import { PriceMonitorScheduler } from '../services/scheduler.js'
import { NotificationService } from '../services/notifications.js'
import { eq, count } from 'drizzle-orm'

const app = new Hono()

// System health check
app.get('/health', async (c) => {
  try {
    // Test database connection
    await db.select().from(products).limit(1)
    
    return c.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return c.json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    }, 503)
  }
})

// System statistics
app.get('/stats', async (c) => {
  try {
    // Get product counts
    const [productCounts] = await db
      .select({ 
        total: count(products.id),
        active: count(products.id) 
      })
      .from(products)

    const [activeProductCounts] = await db
      .select({ active: count() })
      .from(products)
      .where(eq(products.isActive, true))

    // Get price history count
    const [priceHistoryCounts] = await db
      .select({ total: count() })
      .from(priceHistory)

    // Get notification stats
    const notificationStats = await NotificationService.getNotificationStats()

    // Get job status
    const jobStatus = PriceMonitorScheduler.getJobStatus()

    return c.json({
      success: true,
      stats: {
        products: {
          total: productCounts.total,
          active: activeProductCounts.active,
          inactive: productCounts.total - activeProductCounts.active
        },
        priceHistory: {
          total: priceHistoryCounts.total
        },
        notifications: notificationStats,
        jobs: {
          running: jobStatus.filter(j => j.running).length,
          total: jobStatus.length,
          jobs: jobStatus
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching system stats:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch system statistics' 
    }, 500)
  }
})

// Start/stop scheduler
app.post('/scheduler/:action', async (c) => {
  try {
    const action = c.req.param('action')
    
    if (action === 'start') {
      await PriceMonitorScheduler.startAllJobs()
      return c.json({
        success: true,
        message: 'Scheduler started successfully'
      })
    } else if (action === 'stop') {
      PriceMonitorScheduler.stopAllJobs()
      return c.json({
        success: true,
        message: 'Scheduler stopped successfully'
      })
    } else {
      return c.json({
        success: false,
        error: 'Invalid action. Use "start" or "stop"'
      }, 400)
    }
  } catch (error) {
    console.error('Error controlling scheduler:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to control scheduler' 
    }, 500)
  }
})

// Trigger all price checks manually
app.post('/check-all-prices', async (c) => {
  try {
    // This runs in the background
    PriceMonitorScheduler.checkAllProductPrices()
    
    return c.json({
      success: true,
      message: 'Price check initiated for all products'
    })
  } catch (error) {
    console.error('Error triggering price checks:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to trigger price checks' 
    }, 500)
  }
})

export default app