import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { PriceMonitorScheduler } from './services/scheduler.js'

// Import routes
import productsRoute from './routes/products.js'
import storesRoute from './routes/stores.js'
import notificationsRoute from './routes/notifications.js'
import systemRoute from './routes/system.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount API routes
app.route('/api/products', productsRoute)
app.route('/api/stores', storesRoute)
app.route('/api/notifications', notificationsRoute)
app.route('/api/system', systemRoute)

// Serve static files from client/dist
app.use('/assets/*', serveStatic({ root: './client/dist' }))
app.use('/vite.svg', serveStatic({ path: './client/dist/vite.svg' }))

// Serve index.html for all non-API routes (SPA routing)
app.get('*', serveStatic({ path: './client/dist/index.html' }))

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    message: 'The requested endpoint does not exist'
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err)
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message
  }, 500)
})

const port = process.env.PORT || 3001

// Start server
console.log(`🚀 Price Tracker API starting on port ${port}`)

serve({
  fetch: app.fetch,
  port: Number(port),
})

console.log(`✅ Price Tracker API listening on http://localhost:${port}`)

// Run database migrations and start scheduler
setTimeout(async () => {
  try {
    console.log('🔄 Running database migrations...')
    const { migrate } = await import('drizzle-orm/postgres-js/migrator')
    const { db } = await import('./db/connection.js')
    const fs = await import('fs')
    const path = await import('path')
    
    const migrationsPath = path.resolve(process.cwd(), 'drizzle')
    console.log('Looking for migrations in:', migrationsPath)
    
    if (!fs.existsSync(migrationsPath)) {
      console.error('Migrations folder does not exist at:', migrationsPath)
      return
    }
    
    const files = fs.readdirSync(migrationsPath)
    console.log('Files in migrations folder:', files)
    
    await migrate(db, { migrationsFolder: migrationsPath })
    console.log('✅ Database migrations completed')
    
    console.log('🕐 Starting price monitoring scheduler...')
    await PriceMonitorScheduler.startAllJobs()
    console.log('✅ Price monitoring scheduler started')
  } catch (error) {
    console.error('❌ Failed to start services:', error)
  }
}, 2000) // Wait 2 seconds for server to start

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...')
  PriceMonitorScheduler.stopAllJobs()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...')
  PriceMonitorScheduler.stopAllJobs()
  process.exit(0)
})

export default {
  port,
  fetch: app.fetch,
}