import { Hono } from 'hono'
import { db } from '../db/connection.js'
import { notifications, products } from '../db/schema.js'
import { NotificationService } from '../services/notifications.js'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

// Get all notifications
app.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50')
    const sent = c.req.query('sent')
    
    let query = db
      .select({
        id: notifications.id,
        productId: notifications.productId,
        productName: products.name,
        type: notifications.type,
        message: notifications.message,
        sent: notifications.sent,
        sentAt: notifications.sentAt,
        createdAt: notifications.createdAt
      })
      .from(notifications)
      .leftJoin(products, eq(notifications.productId, products.id))
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(limit, 1000))

    if (sent !== undefined) {
      const isSent = sent === 'true'
      query = query.where(eq(notifications.sent, isSent)) as any
    }

    const allNotifications = await query

    return c.json({ 
      success: true,
      notifications: allNotifications,
      count: allNotifications.length 
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch notifications' 
    }, 500)
  }
})

// Get notification statistics
app.get('/stats', async (c) => {
  try {
    const stats = await NotificationService.getNotificationStats()

    return c.json({ 
      success: true,
      stats: stats
    })
  } catch (error) {
    console.error('Error fetching notification stats:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch notification stats' 
    }, 500)
  }
})

// Send test notification
app.post('/test', async (c) => {
  try {
    const success = await NotificationService.sendTestNotification()

    return c.json({ 
      success: true,
      sent: success,
      message: success ? 'Test notification sent successfully' : 'Test notification logged (Pushover not configured)'
    })
  } catch (error) {
    console.error('Error sending test notification:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to send test notification' 
    }, 500)
  }
})

// Mark notification as read (delete it)
app.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    if (isNaN(id)) {
      return c.json({ 
        success: false, 
        error: 'Invalid notification ID' 
      }, 400)
    }

    await db
      .delete(notifications)
      .where(eq(notifications.id, id))

    return c.json({
      success: true,
      message: 'Notification deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to delete notification' 
    }, 500)
  }
})

// Clean up old notifications
app.post('/cleanup', async (c) => {
  try {
    const cleaned = await NotificationService.cleanupOldNotifications()

    return c.json({
      success: true,
      message: `Cleaned up old notifications`,
      cleaned: cleaned
    })
  } catch (error) {
    console.error('Error cleaning up notifications:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to cleanup notifications' 
    }, 500)
  }
})

export default app