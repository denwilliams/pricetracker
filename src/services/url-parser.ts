import { db } from '../db/connection.js'
import { stores } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export interface ParsedProduct {
  url: string
  cleanUrl: string
  store?: string
  domain: string
  productId?: string
  isSupported: boolean
}

export class URLParser {
  
  /**
   * Parse a product URL and extract relevant information
   */
  static async parseURL(url: string): Promise<ParsedProduct> {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      
      // Get store information from database
      const store = await db
        .select()
        .from(stores)
        .where(eq(stores.domain, domain))
        .limit(1)
      
      const result: ParsedProduct = {
        url,
        cleanUrl: this.cleanURL(url),
        domain,
        store: store[0]?.name || `${domain} (Generic)`,
        productId: this.extractProductId(url, domain),
        isSupported: true // Always supported with fallback scraping
      }
      
      return result
      
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`)
    }
  }
  
  /**
   * Clean URL by removing tracking parameters and unnecessary query strings
   */
  static cleanURL(url: string): string {
    try {
      const urlObj = new URL(url)
      
      // Common tracking parameters to remove
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'fbclid', 'ref', 'referer', 'referrer',
        '_branch_match_id', 'mc_cid', 'mc_eid',
        'gclsrc', 'dclid', 'wbraid', 'gbraid'
      ]
      
      // Domain-specific parameter cleaning
      switch (urlObj.hostname.replace('www.', '')) {
        case 'amazon.com.au':
        case 'amazon.com':
          // Keep only essential Amazon parameters
          const allowedAmazonParams = ['dp', 'gp', 'product']
          const amazonParams = new URLSearchParams()
          for (const [key, value] of urlObj.searchParams) {
            if (allowedAmazonParams.includes(key)) {
              amazonParams.set(key, value)
            }
          }
          urlObj.search = amazonParams.toString()
          break
          
        case 'ebay.com.au':
        case 'ebay.com':
          // Keep only item ID for eBay
          const itemId = urlObj.searchParams.get('itm') || urlObj.pathname.match(/\/itm\/(\d+)/)?.[1]
          if (itemId) {
            urlObj.search = `itm=${itemId}`
          } else {
            urlObj.search = ''
          }
          break
          
        default:
          // Remove common tracking parameters for other sites
          trackingParams.forEach(param => {
            urlObj.searchParams.delete(param)
          })
      }
      
      // Remove fragment (hash)
      urlObj.hash = ''
      
      return urlObj.toString()
      
    } catch (error) {
      return url // Return original URL if cleaning fails
    }
  }
  
  /**
   * Extract product ID from URL based on store patterns
   */
  static extractProductId(url: string, domain: string): string | undefined {
    try {
      const urlObj = new URL(url)
      
      switch (domain) {
        case 'amazon.com.au':
        case 'amazon.com':
          // Amazon ASIN pattern: /dp/ASIN or /gp/product/ASIN
          const amazonMatch = urlObj.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)
          return amazonMatch?.[1]
          
        case 'ebay.com.au':
        case 'ebay.com':
          // eBay item ID from URL or query parameter
          const ebayMatch = urlObj.pathname.match(/\/itm\/(\d+)/) || 
                           urlObj.searchParams.get('itm')
          return typeof ebayMatch === 'string' ? ebayMatch : ebayMatch?.[1]
          
        case 'jbhifi.com.au':
          // JB Hi-Fi product ID from pathname
          const jbMatch = urlObj.pathname.match(/\/([a-zA-Z0-9-]+)$/)
          return jbMatch?.[1]
          
        case 'harveynorman.com.au':
          // Harvey Norman product ID
          const hnMatch = urlObj.pathname.match(/\/p\/([^\/]+)/)
          return hnMatch?.[1]
          
        case 'woolworths.com.au':
          // Woolworths product ID
          const woolMatch = urlObj.pathname.match(/\/shop\/productdetails\/(\d+)/)
          return woolMatch?.[1]
          
        case 'coles.com.au':
          // Coles product ID
          const colesMatch = urlObj.pathname.match(/\/product\/([^\/]+)/)
          return colesMatch?.[1]
          
        default:
          // Generic approach - try to find product ID in pathname
          const genericMatch = urlObj.pathname.match(/\/(?:product|item|p)\/([^\/\?]+)/)
          return genericMatch?.[1]
      }
    } catch (error) {
      return undefined
    }
  }
  
  /**
   * Validate if a URL is trackable (has a supported store)
   */
  static async isTrackable(url: string): Promise<boolean> {
    try {
      const parsed = await this.parseURL(url)
      return parsed.isSupported
    } catch (error) {
      return false
    }
  }
  
  /**
   * Get the default price selector for a domain
   */
  static async getDefaultSelector(domain: string): Promise<string | null> {
    try {
      const store = await db
        .select({ defaultSelector: stores.defaultSelector })
        .from(stores)
        .where(eq(stores.domain, domain))
        .limit(1)
      
      return store[0]?.defaultSelector || null
    } catch (error) {
      return null
    }
  }
}