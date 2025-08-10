import puppeteer, { Browser, Page } from 'puppeteer'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { URLParser } from './url-parser.js'

export interface ScrapeResult {
  price: number | null
  currency: string
  isAvailable: boolean
  productName?: string
  imageUrl?: string
  error?: string
}

export class PriceScraper {
  private static browser: Browser | null = null
  
  /**
   * Get or create a shared browser instance
   */
  private static async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor'
        ]
      })
    }
    return this.browser
  }
  
  /**
   * Close the browser instance
   */
  static async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
  
  /**
   * Scrape price from a product URL
   */
  static async scrapePrice(url: string, customSelector?: string): Promise<ScrapeResult> {
    const parsed = await URLParser.parseURL(url)
    
    // Since we now support all stores with fallback scraping, always proceed
    console.log(`Scraping ${parsed.store} (${parsed.domain})${customSelector ? ' with custom selector' : ''}`)
    
    // Try different scraping methods based on the site
    const methods = [
      () => this.scrapeWithPuppeteer(parsed.cleanUrl, customSelector, parsed.domain),
      () => this.scrapeWithCheerio(parsed.cleanUrl, customSelector, parsed.domain)
    ]
    
    for (const method of methods) {
      try {
        const result = await method()
        if (result.price !== null) {
          return result
        }
      } catch (error) {
        console.warn(`Scraping method failed for ${url}:`, error)
      }
    }
    
    return {
      price: null,
      currency: 'AUD',
      isAvailable: false,
      error: 'Unable to extract price with any method'
    }
  }
  
  /**
   * Scrape using Puppeteer (for dynamic content)
   */
  private static async scrapeWithPuppeteer(
    url: string, 
    customSelector: string | undefined, 
    domain: string
  ): Promise<ScrapeResult> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    
    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 })
      
      // Navigate to page
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      })
      
      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Get selector for this domain
      const selector = customSelector || await URLParser.getDefaultSelector(domain) || this.getDefaultSelector(domain)
      
      if (!selector) {
        throw new Error(`No price selector available for domain: ${domain}`)
      }
      
      // Try to find price element (optional wait - don't fail if not found)
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
      } catch {
        // Continue anyway - we'll try to extract what we can
        console.log(`Selector ${selector} not found, continuing with best-effort extraction`)
      }
      
      const result = await page.evaluate((sel, dom) => {
        const priceElements = document.querySelectorAll(sel)
        let price: number | null = null
        let productName: string | undefined
        let imageUrl: string | undefined
        let isAvailable = true
        let currency = 'AUD'
        
        // First try JSON-LD structured data (most reliable for e-commerce sites)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')
        for (const script of jsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent || '')
            const product = findProductInJsonLd(jsonData)
            if (product && product.price) {
              price = parseFloat(product.price)
              if (product.currency) {
                currency = product.currency
              }
              if (product.name && !productName) {
                productName = product.name
              }
              break
            }
          } catch (error) {
            // Continue to next JSON-LD script if parsing fails
          }
        }
        
        // If no JSON-LD price found, try Open Graph meta tags
        if (price === null) {
          const ogPriceAmount = document.querySelector('meta[property="og:price:amount"]')?.getAttribute('content') ||
                               document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                               document.querySelector('meta[name="price"]')?.getAttribute('content') ||
                               document.querySelector('meta[property="product:price"]')?.getAttribute('content') ||
                               document.querySelector('meta[name="twitter:data1"]')?.getAttribute('content')
          const ogPriceCurrency = document.querySelector('meta[property="og:price:currency"]')?.getAttribute('content') ||
                                 document.querySelector('meta[property="product:price:currency"]')?.getAttribute('content') ||
                                 document.querySelector('meta[name="currency"]')?.getAttribute('content') ||
                                 document.querySelector('meta[property="product:currency"]')?.getAttribute('content')
          
          if (ogPriceAmount) {
            // Remove commas from price string before parsing (e.g., "1,237.00" -> "1237.00")
            const cleanPriceString = ogPriceAmount.replace(/,/g, '')
            const numericPrice = parseFloat(cleanPriceString)
            if (!isNaN(numericPrice) && numericPrice > 0) {
              price = numericPrice
              if (ogPriceCurrency) {
                currency = ogPriceCurrency
              }
            }
          }
        }
        
        // If no Open Graph price found, fall back to CSS selectors
        if (price === null) {
          for (const element of priceElements) {
            const text = element.textContent?.trim()
            if (text) {
              // Try multiple price patterns
              const pricePatterns = [
                /\$[\d,]+\.?\d*/g,           // $123.45 or $123
                /[\d,]+\.?\d*\s*\$/g,       // 123.45$ or 123$
                /AUD?\s*[\d,]+\.?\d*/gi,    // AUD 123.45 or AU 123.45
                /[\d,]+\.?\d*/g             // Just numbers 123.45
              ]
              
              for (const pattern of pricePatterns) {
                const matches = text.match(pattern)
                if (matches) {
                  for (const match of matches) {
                    // Extract numeric value from match
                    const numericText = match.replace(/[^\d.,]/g, '')
                    const numericPrice = parseFloat(numericText.replace(/,/g, ''))
                    
                    // Valid price should be > 0 and < 1,000,000 (reasonable bounds)
                    if (!isNaN(numericPrice) && numericPrice > 0 && numericPrice < 1000000) {
                      price = numericPrice
                      break
                    }
                  }
                  if (price !== null) break
                }
              }
              if (price !== null) break
            }
          }
        }
        
        // Extract product name
        const nameSelectors = [
          '#productTitle', '.product-title', 'h1', '.name', '.title',
          '.product-name', '.item-title'
        ]
        for (const nameSelector of nameSelectors) {
          const nameElement = document.querySelector(nameSelector)
          if (nameElement?.textContent?.trim()) {
            productName = nameElement.textContent.trim()
            break
          }
        }
        
        // Fallback to title tag if no product name found
        if (!productName) {
          const titleElement = document.querySelector('title')
          if (titleElement?.textContent?.trim()) {
            // Clean up title by removing common store suffixes
            productName = titleElement.textContent.trim()
              .replace(/ - JB Hi-Fi$/i, '')
              .replace(/ \| JB Hi-Fi$/i, '')
              .replace(/ - Amazon\.com\.au$/i, '')
              .replace(/ \| Amazon\.com\.au$/i, '')
              .replace(/ - eBay$/i, '')
              .replace(/ \| eBay$/i, '')
              .trim()
          }
        }
        
        // Extract image URL
        const imgSelectors = [
          '#landingImage', '.product-image img', '.main-image img', 
          'img[data-src]', '.gallery img', '.product-photo img'
        ]
        for (const imgSelector of imgSelectors) {
          const imgElement = document.querySelector(imgSelector) as HTMLImageElement
          if (imgElement?.src) {
            imageUrl = imgElement.src
            break
          }
        }
        
        // Check availability - prioritize structured data and specific indicators
        let availabilityFromJsonLD = null
        
        // First check JSON-LD for availability info
        const availabilityJsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')
        for (const script of availabilityJsonLdScripts) {
          try {
            const jsonData = JSON.parse(script.textContent || '')
            // Check for Product schema type directly in browser
            function findProductInBrowser(data) {
              if (!data) return null
              
              if (Array.isArray(data)) {
                for (const item of data) {
                  const result = findProductInBrowser(item)
                  if (result) return result
                }
                return null
              }
              
              if (data['@type'] === 'Product' || (Array.isArray(data['@type']) && data['@type'].includes('Product'))) {
                return data
              }
              
              if (data['@graph']) {
                return findProductInBrowser(data['@graph'])
              }
              
              for (const key in data) {
                if (typeof data[key] === 'object' && data[key] !== null) {
                  const result = findProductInBrowser(data[key])
                  if (result) return result
                }
              }
              
              return null
            }
            
            const product = findProductInBrowser(jsonData)
            if (product && product.offers) {
              const offers = Array.isArray(product.offers) ? product.offers : [product.offers]
              for (const offer of offers) {
                if (offer.availability) {
                  const availability = offer.availability.toLowerCase()
                  if (availability.includes('instock') || availability.includes('in_stock')) {
                    availabilityFromJsonLD = true
                    break
                  } else if (availability.includes('outofstock') || availability.includes('out_of_stock')) {
                    availabilityFromJsonLD = false
                    break
                  }
                }
              }
            }
            if (availabilityFromJsonLD !== null) break
          } catch (error) {
            // Continue to next script
          }
        }
        
        // Use JSON-LD availability if found, otherwise check specific product areas
        if (availabilityFromJsonLD !== null) {
          isAvailable = availabilityFromJsonLD
        } else {
          // Check for add to cart buttons (strong indicator of availability)
          const addToCartButtons = document.querySelectorAll('button[type="submit"], .add-to-cart, .buy-now, [class*="add-cart"]')
          let hasActiveAddToCart = false
          
          for (const button of addToCartButtons) {
            const buttonText = button.textContent?.toLowerCase() || ''
            const isDisabled = button.hasAttribute('disabled')
            
            if ((buttonText.includes('add to cart') || buttonText.includes('buy now')) && !isDisabled) {
              hasActiveAddToCart = true
              break
            }
          }
          
          if (hasActiveAddToCart) {
            isAvailable = true
          } else {
            // Check for specific unavailability indicators in product area only
            const productAreaSelectors = [
              '.product-info', '.product-details', '.product-main', '.product-form',
              '.availability', '.stock-status', '[class*="stock"]', '[class*="available"]'
            ]
            
            let productAreaText = ''
            for (const selector of productAreaSelectors) {
              const elements = document.querySelectorAll(selector)
              for (const element of elements) {
                productAreaText += ' ' + (element.textContent || '')
              }
            }
            
            productAreaText = productAreaText.toLowerCase()
            
            const unavailableIndicators = [
              'out of stock', 'sold out', 'currently unavailable', 'temporarily unavailable'
            ]
            
            isAvailable = !unavailableIndicators.some(indicator => 
              productAreaText.includes(indicator)
            )
          }
        }
        
        return { price, productName, imageUrl, isAvailable, currency }
      }, selector, domain)
      
      return {
        ...result
      }
      
    } finally {
      await page.close()
    }
  }
  
  /**
   * Scrape using Cheerio (for static content)
   */
  private static async scrapeWithCheerio(
    url: string, 
    customSelector: string | undefined, 
    domain: string
  ): Promise<ScrapeResult> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000
    })
    
    const $ = cheerio.load(response.data)
    const selector = customSelector || await URLParser.getDefaultSelector(domain) || this.getDefaultSelector(domain)
    
    if (!selector) {
      throw new Error(`No price selector available for domain: ${domain}`)
    }
    
    let price: number | null = null
    let productName: string | undefined
    let imageUrl: string | undefined
    let currency = 'AUD'
    
    // First try JSON-LD structured data (most reliable for e-commerce sites)
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).text())
        const product = this.findProductInJsonLd(jsonData)
        if (product && product.price) {
          price = parseFloat(product.price)
          if (product.currency) {
            currency = product.currency
          }
          if (product.name && !productName) {
            productName = product.name
          }
          return false // Break the loop
        }
      } catch (error) {
        // Continue to next JSON-LD script if parsing fails
      }
    })
    
    // If no JSON-LD price found, try Open Graph meta tags
    if (price === null) {
      const ogPriceAmount = $('meta[property="og:price:amount"]').attr('content') ||
                           $('meta[property="product:price:amount"]').attr('content') ||
                           $('meta[name="price"]').attr('content') ||
                           $('meta[property="product:price"]').attr('content') ||
                           $('meta[name="twitter:data1"]').attr('content')
      const ogPriceCurrency = $('meta[property="og:price:currency"]').attr('content') ||
                             $('meta[property="product:price:currency"]').attr('content') ||
                             $('meta[name="currency"]').attr('content') ||
                             $('meta[property="product:currency"]').attr('content')
      
      if (ogPriceAmount) {
        // Remove commas from price string before parsing (e.g., "1,237.00" -> "1237.00")
        const cleanPriceString = ogPriceAmount.replace(/,/g, '')
        const numericPrice = parseFloat(cleanPriceString)
        if (!isNaN(numericPrice) && numericPrice > 0) {
          price = numericPrice
          if (ogPriceCurrency) {
            currency = ogPriceCurrency
          }
        }
      }
    }
    
    // If no Open Graph price found, fall back to CSS selectors
    if (price === null) {
      $(selector).each((_, element) => {
        const text = $(element).text().trim()
        
        // Try multiple price patterns
        const pricePatterns = [
          /\$[\d,]+\.?\d*/g,           // $123.45 or $123
          /[\d,]+\.?\d*\s*\$/g,       // 123.45$ or 123$
          /AUD?\s*[\d,]+\.?\d*/gi,    // AUD 123.45 or AU 123.45
          /[\d,]+\.?\d*/g             // Just numbers 123.45
        ]
        
        for (const pattern of pricePatterns) {
          const matches = text.match(pattern)
          if (matches) {
            for (const match of matches) {
              // Extract numeric value from match
              const numericText = match.replace(/[^\d.,]/g, '')
              const numericPrice = parseFloat(numericText.replace(/,/g, ''))
              
              // Valid price should be > 0 and < 1,000,000 (reasonable bounds)
              if (!isNaN(numericPrice) && numericPrice > 0 && numericPrice < 1000000) {
                price = numericPrice
                return false // Break the loop
              }
            }
          }
        }
      })
    }
    
    // Extract product name
    const nameSelectors = [
      '#productTitle', '.product-title', 'h1', '.name', '.title',
      '.product-name', '.item-title'
    ]
    for (const nameSelector of nameSelectors) {
      const nameText = $(nameSelector).first().text().trim()
      if (nameText) {
        productName = nameText
        break
      }
    }
    
    // Fallback to title tag if no product name found
    if (!productName) {
      const titleText = $('title').text().trim()
      if (titleText) {
        // Clean up title by removing common store suffixes
        productName = titleText
          .replace(/ - JB Hi-Fi$/i, '')
          .replace(/ \| JB Hi-Fi$/i, '')
          .replace(/ - Amazon\.com\.au$/i, '')
          .replace(/ \| Amazon\.com\.au$/i, '')
          .replace(/ - eBay$/i, '')
          .replace(/ \| eBay$/i, '')
          .trim()
      }
    }
    
    // Extract image URL
    const imgSelectors = [
      '#landingImage', '.product-image img', '.main-image img', 
      'img[data-src]', '.gallery img', '.product-photo img'
    ]
    for (const imgSelector of imgSelectors) {
      const imgSrc = $(imgSelector).first().attr('src')
      if (imgSrc) {
        imageUrl = imgSrc
        break
      }
    }
    
    // Check availability - prioritize structured data and specific indicators
    let availabilityFromJsonLD = null
    let isAvailable = true
    
    // First check JSON-LD for availability info
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).text())
        const product = this.findProductInJsonLd(jsonData)
        if (product && product.offers) {
          const offers = Array.isArray(product.offers) ? product.offers : [product.offers]
          for (const offer of offers) {
            if (offer.availability) {
              const availability = offer.availability.toLowerCase()
              if (availability.includes('instock') || availability.includes('in_stock')) {
                availabilityFromJsonLD = true
                return false // Break the loop
              } else if (availability.includes('outofstock') || availability.includes('out_of_stock')) {
                availabilityFromJsonLD = false
                return false // Break the loop
              }
            }
          }
        }
      } catch (error) {
        // Continue to next script
      }
    })
    
    // Use JSON-LD availability if found, otherwise check specific product areas
    if (availabilityFromJsonLD !== null) {
      isAvailable = availabilityFromJsonLD
    } else {
      // Check for add to cart buttons (strong indicator of availability)
      const addToCartButtons = $('button[type="submit"], .add-to-cart, .buy-now, [class*="add-cart"]')
      let hasActiveAddToCart = false
      
      addToCartButtons.each((_, button) => {
        const buttonText = $(button).text().toLowerCase()
        const isDisabled = $(button).prop('disabled')
        
        if ((buttonText.includes('add to cart') || buttonText.includes('buy now')) && !isDisabled) {
          hasActiveAddToCart = true
          return false // Break the loop
        }
      })
      
      if (hasActiveAddToCart) {
        isAvailable = true
      } else {
        // Check for specific unavailability indicators in product area only
        const productAreaSelectors = [
          '.product-info', '.product-details', '.product-main', '.product-form',
          '.availability', '.stock-status', '[class*="stock"]', '[class*="available"]'
        ]
        
        let productAreaText = ''
        productAreaSelectors.forEach(selector => {
          $(selector).each((_, element) => {
            productAreaText += ' ' + $(element).text()
          })
        })
        
        productAreaText = productAreaText.toLowerCase()
        
        const unavailableIndicators = [
          'out of stock', 'sold out', 'currently unavailable', 'temporarily unavailable'
        ]
        
        isAvailable = !unavailableIndicators.some(indicator => 
          productAreaText.includes(indicator)
        )
      }
    }
    
    return {
      price,
      currency,
      isAvailable,
      productName,
      imageUrl
    }
  }
  
  /**
   * Extract product information from JSON-LD structured data
   */
  private static findProductInJsonLd(jsonData: any): {price?: string, currency?: string, name?: string} | null {
    if (!jsonData) return null
    
    // Handle arrays of JSON-LD objects
    if (Array.isArray(jsonData)) {
      for (const item of jsonData) {
        const result = this.findProductInJsonLd(item)
        if (result) return result
      }
      return null
    }
    
    // Check for Product schema type
    if (jsonData['@type'] === 'Product' || (Array.isArray(jsonData['@type']) && jsonData['@type'].includes('Product'))) {
      const offers = jsonData.offers
      if (offers) {
        // Handle single offer or array of offers
        const offerArray = Array.isArray(offers) ? offers : [offers]
        for (const offer of offerArray) {
          if (offer.price || offer.lowPrice) {
            return {
              price: offer.price || offer.lowPrice,
              currency: offer.priceCurrency || 'AUD',
              name: jsonData.name
            }
          }
        }
      }
      
      // Check for direct price on product
      if (jsonData.price) {
        return {
          price: jsonData.price,
          currency: jsonData.priceCurrency || 'AUD',
          name: jsonData.name
        }
      }
    }
    
    // Check for BreadcrumbList or other nested structures
    if (jsonData['@graph']) {
      return this.findProductInJsonLd(jsonData['@graph'])
    }
    
    // Recursively search nested objects
    for (const key in jsonData) {
      if (typeof jsonData[key] === 'object' && jsonData[key] !== null) {
        const result = this.findProductInJsonLd(jsonData[key])
        if (result) return result
      }
    }
    
    return null
  }
  
  /**
   * Get default price selector for a domain
   */
  private static getDefaultSelector(domain: string): string {
    const selectors: Record<string, string> = {
      'amazon.com.au': '.a-price .a-offscreen, .a-price-whole',
      'amazon.com': '.a-price .a-offscreen, .a-price-whole',
      'ebay.com.au': '.u-flL.condensedfont, .price .notranslate',
      'ebay.com': '.u-flL.condensedfont, .price .notranslate',
      'jbhifi.com.au': '.price, .current-price',
      'harveynorman.com.au': '.price, .product-price',
      'woolworths.com.au': '.price, .shelfProductTile-price',
      'coles.com.au': '.price, .product-price'
    }
    
    // Enhanced fallback selectors for unknown stores
    return selectors[domain] || [
      '.price, [class*="price"], [id*="price"]',
      '.cost, [class*="cost"], [id*="cost"]',
      '.amount, [class*="amount"], [id*="amount"]',
      '[class*="dollar"], [class*="currency"]',
      '.sale-price, .current-price, .product-price',
      '.value, [data-price], [data-cost]'
    ].join(', ')
  }
  
  /**
   * Test scraping a URL (useful for debugging)
   */
  static async testScrape(url: string, customSelector?: string): Promise<ScrapeResult> {
    console.log(`Testing scrape for: ${url}`)
    const result = await this.scrapePrice(url, customSelector)
    console.log('Result:', result)
    return result
  }
}