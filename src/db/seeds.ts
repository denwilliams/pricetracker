import { db } from './connection.js'
import { stores } from './schema.js'

const initialStores = [
  {
    name: 'Amazon Australia',
    domain: 'amazon.com.au',
    defaultSelector: '.a-price-whole, .a-price .a-offscreen',
    isActive: true,
  },
  {
    name: 'eBay Australia',
    domain: 'ebay.com.au',
    defaultSelector: '.notranslate, .Price-current',
    isActive: true,
  },
  {
    name: 'JB Hi-Fi',
    domain: 'jbhifi.com.au',
    defaultSelector: '.price, .current-price',
    isActive: true,
  },
  {
    name: 'Harvey Norman',
    domain: 'harveynorman.com.au',
    defaultSelector: '.price, .product-price',
    isActive: true,
  },
  {
    name: 'Woolworths',
    domain: 'woolworths.com.au',
    defaultSelector: '.price, .shelfProductTile-price',
    isActive: true,
  },
  {
    name: 'Coles',
    domain: 'coles.com.au',
    defaultSelector: '.price, .product-price',
    isActive: true,
  },
]

export async function seedStores() {
  try {
    console.log('🌱 Seeding stores...')
    
    for (const store of initialStores) {
      await db.insert(stores).values(store).onConflictDoNothing()
    }
    
    console.log('✅ Stores seeded successfully')
  } catch (error) {
    console.error('❌ Error seeding stores:', error)
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedStores().then(() => process.exit(0)).catch(() => process.exit(1))
}