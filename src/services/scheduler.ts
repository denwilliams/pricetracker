import * as cron from 'node-cron'
import { db } from '../db/connection.js'
import { products, priceHistory, notifications } from '../db/schema.js'
import { PriceScraper } from './scraper.js'
import { NotificationService } from './notifications.js'
import { eq, and, lt, gt, desc } from 'drizzle-orm'

export class PriceMonitorScheduler {
  private static jobs: Map<string, cron.ScheduledTask> = new Map()
  
  /**
   * Start all scheduled price monitoring jobs
   */
  static async startAllJobs(): Promise<void> {
    console.log('🕐 Starting price monitoring scheduler...')
    
    // Main price check job - runs every 30 minutes
    this.scheduleJob('price-check', '*/30 * * * *', async () => {
      await this.checkAllProductPrices()
    })
    
    // Cleanup old price history - runs daily at 2 AM
    this.scheduleJob('cleanup', '0 2 * * *', async () => {
      await this.cleanupOldPriceHistory()
    })
    
    // Send pending notifications - runs every 5 minutes
    this.scheduleJob('notifications', '*/5 * * * *', async () => {
      await NotificationService.sendPendingNotifications()
    })
    
    console.log('✅ Price monitoring scheduler started with', this.jobs.size, 'jobs')
  }
  
  /**
   * Stop all scheduled jobs
   */
  static stopAllJobs(): void {
    console.log('🛑 Stopping all scheduled jobs...')
    
    this.jobs.forEach((job, name) => {
      job.destroy()
      console.log(`  Stopped job: ${name}`)
    })
    
    this.jobs.clear()
    console.log('✅ All scheduled jobs stopped')
  }
  
  /**
   * Schedule a new job
   */
  private static scheduleJob(
    name: string, 
    schedule: string, 
    callback: () => Promise<void>
  ): void {
    if (this.jobs.has(name)) {
      console.warn(`Job ${name} already exists, skipping...`)
      return
    }
    
    const task = cron.schedule(schedule, async () => {
      console.log(`📊 Running scheduled job: ${name}`)
      try {
        await callback()
        console.log(`✅ Completed scheduled job: ${name}`)
      } catch (error) {
        console.error(`❌ Error in scheduled job ${name}:`, error)
      }
    }, {
      timezone: 'Australia/Sydney'
    })
    
    this.jobs.set(name, task)
    console.log(`✅ Scheduled job: ${name} (${schedule})`)
  }
  
  /**
   * Check prices for all active products
   */
  static async checkAllProductPrices(): Promise<void> {
    try {
      // Get all active products
      const activeProducts = await db
        .select()
        .from(products)
        .where(eq(products.isActive, true))
      
      console.log(`🔍 Checking prices for ${activeProducts.length} products`)
      
      const results = await Promise.allSettled(
        activeProducts.map(product => this.checkProductPrice(product))
      )
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      console.log(`📈 Price check completed: ${successful} successful, ${failed} failed`)
      
    } catch (error) {
      console.error('❌ Error checking product prices:', error)
    }
  }
  
  /**
   * Check price for a specific product
   */
  static async checkProductPrice(product: typeof products.$inferSelect): Promise<void> {
    try {
      console.log(`🏷️  Checking price for: ${product.name}`)
      
      const scrapeResult = await PriceScraper.scrapePrice(product.url, product.selector || undefined)
      
      if (scrapeResult.price === null) {
        console.warn(`⚠️  Could not extract price for ${product.name}: ${scrapeResult.error}`)
        return
      }
      
      const newPrice = scrapeResult.price.toString()
      const currentPrice = product.currentPrice
      
      // Save price history
      await db.insert(priceHistory).values({
        productId: product.id,
        price: newPrice,
        currency: scrapeResult.currency,
        isAvailable: scrapeResult.isAvailable,
        scrapedAt: new Date()
      })
      
      // Update product's current price and last checked time
      await db
        .update(products)
        .set({
          currentPrice: newPrice,
          lastChecked: new Date(),
          updatedAt: new Date()
        })
        .where(eq(products.id, product.id))
      
      console.log(`💰 Updated price for ${product.name}: $${newPrice}`)
      
      // Check for price drop notifications
      if (currentPrice && parseFloat(newPrice) < parseFloat(currentPrice)) {
        const priceDrop = parseFloat(currentPrice) - parseFloat(newPrice)
        await this.createNotification(
          product.id,
          'price_drop',
          `Price drop alert! ${product.name} dropped from $${currentPrice} to $${newPrice} (saved $${priceDrop.toFixed(2)})`
        )
      }
      
      // Check for target price notifications - only notify when price crosses threshold
      await this.checkTargetPriceNotification(product, currentPrice, newPrice)
      
      // Check for back in stock notifications
      if (!scrapeResult.isAvailable && product.currentPrice) {
        // Product became unavailable
        await this.createNotification(
          product.id,
          'back_in_stock',
          `${product.name} is currently out of stock`
        )
      } else if (scrapeResult.isAvailable && !product.currentPrice) {
        // Product came back in stock
        await this.createNotification(
          product.id,
          'back_in_stock',
          `Good news! ${product.name} is back in stock for $${newPrice}`
        )
      }
      
    } catch (error) {
      console.error(`❌ Error checking price for ${product.name}:`, error)
    }
  }
  
  /**
   * Create a notification
   */
  private static async createNotification(
    productId: number,
    type: 'price_drop' | 'target_reached' | 'back_in_stock',
    message: string
  ): Promise<void> {
    try {
      await db.insert(notifications).values({
        productId,
        type,
        message,
        sent: false,
        createdAt: new Date()
      })
      
      console.log(`🔔 Created ${type} notification for product ${productId}`)
    } catch (error) {
      console.error(`❌ Error creating notification:`, error)
    }
  }
  
  /**
   * Clean up old price history (keep last 90 days)
   */
  static async cleanupOldPriceHistory(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      
      const result = await db
        .delete(priceHistory)
        .where(lt(priceHistory.scrapedAt, ninetyDaysAgo))
      
      console.log(`🧹 Cleaned up old price history`)
    } catch (error) {
      console.error('❌ Error cleaning up price history:', error)
    }
  }
  
  /**
   * Manual price check for a specific product
   */
  static async checkSingleProduct(productId: number): Promise<void> {
    try {
      const product = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      
      if (product.length === 0) {
        throw new Error(`Product with ID ${productId} not found`)
      }
      
      await this.checkProductPrice(product[0])
    } catch (error) {
      console.error(`❌ Error checking single product ${productId}:`, error)
      throw error
    }
  }
  
  /**
   * Check and handle target price notifications
   */
  private static async checkTargetPriceNotification(
    product: typeof products.$inferSelect,
    currentPrice: string | null,
    newPrice: string
  ): Promise<void> {
    if (!product.targetPrice) return
    
    const targetPrice = parseFloat(product.targetPrice)
    const newPriceFloat = parseFloat(newPrice)
    const currentPriceFloat = currentPrice ? parseFloat(currentPrice) : null
    
    // Only proceed if new price is at or below target
    if (newPriceFloat > targetPrice) return
    
    // Check if this is a threshold crossing event
    const isCrossingThreshold = !currentPriceFloat || currentPriceFloat > targetPrice
    
    if (!isCrossingThreshold) return
    
    // Check if we already have an active target_reached notification
    // Look for the most recent target_reached notification
    const recentNotifications = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.productId, product.id),
        eq(notifications.type, 'target_reached')
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(5) // Get last 5 to check the pattern
    
    if (recentNotifications.length > 0) {
      const mostRecent = recentNotifications[0]
      
      // Get the price history to see if price went above target since last notification
      const recentPriceHistory = await db
        .select()
        .from(priceHistory)
        .where(and(
          eq(priceHistory.productId, product.id),
          gt(priceHistory.scrapedAt, mostRecent.createdAt)
        ))
        .orderBy(desc(priceHistory.scrapedAt))
        .limit(10)
      
      // Check if price was above target since the last notification
      const wasAboveTargetSinceNotification = recentPriceHistory.some(
        history => parseFloat(history.price) > targetPrice
      )
      
      // Only send notification if price was above target since last notification
      if (!wasAboveTargetSinceNotification) {
        return // Don't send duplicate notification
      }
    }
    
    // Send the target price notification
    await this.createNotification(
      product.id,
      'target_reached',
      `Target price reached! ${product.name} is now $${newPrice} (target: $${product.targetPrice})`
    )
  }
  
  /**
   * Get job status
   */
  static getJobStatus(): { name: string, running: boolean }[] {
    return Array.from(this.jobs.entries()).map(([name, task]) => ({
      name,
      running: task.getStatus() === 'scheduled'
    }))
  }
}