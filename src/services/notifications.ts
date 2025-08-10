import Pushover from 'pushover-notifications'
import { db } from '../db/connection.js'
import { notifications } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export class NotificationService {
  private static pushover: Pushover | null = null
  
  /**
   * Initialize Pushover client
   */
  private static initializePushover(): Pushover | null {
    const token = process.env.PUSHOVER_TOKEN
    const user = process.env.PUSHOVER_USER
    
    if (!token || !user) {
      console.warn('⚠️  Pushover credentials not configured. Notifications will be logged only.')
      return null
    }
    
    if (!this.pushover) {
      this.pushover = new Pushover({
        user: user,
        token: token,
      })
    }
    
    return this.pushover
  }
  
  /**
   * Send a notification via Pushover
   */
  static async sendNotification(
    message: string,
    title: string = 'Price Tracker',
    priority: number = 0,
    url?: string
  ): Promise<boolean> {
    const pushover = this.initializePushover()
    
    if (!pushover) {
      console.log(`📱 [NOTIFICATION] ${title}: ${message}`)
      return false
    }
    
    return new Promise((resolve) => {
      const msg = {
        message: message,
        title: title,
        sound: priority > 0 ? 'pushover' : 'gamelan',
        priority: priority,
        url: url,
        url_title: url ? 'View Product' : undefined,
      }
      
      pushover.send(msg, (err: any, result: any) => {
        if (err) {
          console.error('❌ Error sending Pushover notification:', err)
          resolve(false)
        } else {
          console.log('📱 Pushover notification sent successfully')
          resolve(true)
        }
      })
    })
  }
  
  /**
   * Send pending notifications from database
   */
  static async sendPendingNotifications(): Promise<void> {
    try {
      const pendingNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.sent, false))
        .limit(10) // Process up to 10 notifications at a time
      
      if (pendingNotifications.length === 0) {
        return
      }
      
      console.log(`📬 Processing ${pendingNotifications.length} pending notifications`)
      
      for (const notification of pendingNotifications) {
        try {
          const priority = this.getNotificationPriority(notification.type)
          const title = this.getNotificationTitle(notification.type)
          
          const success = await this.sendNotification(
            notification.message,
            title,
            priority
          )
          
          // Mark as sent regardless of success (to avoid infinite retries)
          await db
            .update(notifications)
            .set({
              sent: true,
              sentAt: new Date()
            })
            .where(eq(notifications.id, notification.id))
          
          console.log(`✅ Processed notification ${notification.id}: ${success ? 'sent' : 'logged'}`)
          
        } catch (error) {
          console.error(`❌ Error processing notification ${notification.id}:`, error)
          
          // Mark as sent to avoid infinite retries
          await db
            .update(notifications)
            .set({
              sent: true,
              sentAt: new Date()
            })
            .where(eq(notifications.id, notification.id))
        }
      }
      
    } catch (error) {
      console.error('❌ Error sending pending notifications:', error)
    }
  }
  
  /**
   * Create and send immediate notification
   */
  static async createAndSendNotification(
    productId: number,
    type: 'price_drop' | 'target_reached' | 'back_in_stock',
    message: string,
    immediate: boolean = false
  ): Promise<void> {
    try {
      // Insert notification into database
      await db.insert(notifications).values({
        productId,
        type,
        message,
        sent: false,
        createdAt: new Date()
      })
      
      if (immediate) {
        // Send immediately
        const priority = this.getNotificationPriority(type)
        const title = this.getNotificationTitle(type)
        
        await this.sendNotification(message, title, priority)
        
        // Mark as sent
        await db
          .update(notifications)
          .set({
            sent: true,
            sentAt: new Date()
          })
          .where(eq(notifications.productId, productId))
      }
      
    } catch (error) {
      console.error('❌ Error creating notification:', error)
      throw error
    }
  }
  
  /**
   * Get notification priority based on type
   */
  private static getNotificationPriority(type: string): number {
    switch (type) {
      case 'target_reached':
        return 1 // High priority
      case 'price_drop':
        return 0 // Normal priority
      case 'back_in_stock':
        return 0 // Normal priority
      default:
        return 0
    }
  }
  
  /**
   * Get notification title based on type
   */
  private static getNotificationTitle(type: string): string {
    switch (type) {
      case 'price_drop':
        return '💰 Price Drop Alert'
      case 'target_reached':
        return '🎯 Target Price Reached'
      case 'back_in_stock':
        return '📦 Stock Alert'
      default:
        return '🔔 Price Tracker'
    }
  }
  
  /**
   * Send test notification to verify Pushover setup
   */
  static async sendTestNotification(): Promise<boolean> {
    const message = 'Test notification from Price Tracker! Your notifications are working correctly.'
    const title = '✅ Test Notification'
    
    return await this.sendNotification(message, title, 0)
  }
  
  /**
   * Get notification statistics
   */
  static async getNotificationStats(): Promise<{
    total: number
    sent: number
    pending: number
    byType: Record<string, number>
  }> {
    try {
      const allNotifications = await db.select().from(notifications)
      
      const stats = {
        total: allNotifications.length,
        sent: allNotifications.filter(n => n.sent).length,
        pending: allNotifications.filter(n => !n.sent).length,
        byType: {} as Record<string, number>
      }
      
      // Count by type
      for (const notification of allNotifications) {
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1
      }
      
      return stats
    } catch (error) {
      console.error('❌ Error getting notification stats:', error)
      return {
        total: 0,
        sent: 0,
        pending: 0,
        byType: {}
      }
    }
  }
  
  /**
   * Clear old notifications (older than 30 days)
   */
  static async cleanupOldNotifications(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const result = await db
        .delete(notifications)
        .where(eq(notifications.sent, true))
      
      console.log(`🧹 Cleaned up old notifications`)
      return 0 // Drizzle doesn't return affected rows count easily
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error)
      return 0
    }
  }
}