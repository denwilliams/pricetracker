import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'

describe('Gamesmen Page Scraping', () => {
  let testHtml: string

  beforeAll(() => {
    testHtml = fs.readFileSync(
      path.join(process.cwd(), 'tests', 'fixtures', 'gamesmen-wheel-hub-real.html'),
      'utf-8'
    )
  })

  it('should extract price from Gamesmen structured data', () => {
    const $ = cheerio.load(testHtml)
    
    // Test JSON-LD structured data extraction
    const jsonLdScripts = $('script[type="application/ld+json"]')
    let productFound = false
    let extractedPrice: number | null = null
    
    jsonLdScripts.each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).text())
        if (jsonData['@type'] === 'Product' && jsonData.offers) {
          productFound = true
          extractedPrice = parseFloat(jsonData.offers.price)
        }
      } catch (error) {
        // Continue to next script
      }
    })
    
    expect(productFound).toBe(true)
    expect(extractedPrice).toBe(299.95)
  })

  it('should extract price from Open Graph meta tags', () => {
    const $ = cheerio.load(testHtml)
    
    const ogPriceAmount = $('meta[property="product:price:amount"]').attr('content')
    const twitterPrice = $('meta[name="twitter:data1"]').attr('content')
    
    expect(ogPriceAmount).toBe('299.95')
    expect(twitterPrice).toBe('299.95')
    expect(parseFloat(ogPriceAmount!)).toBe(299.95)
  })

  it('should extract product name from structured data', () => {
    const $ = cheerio.load(testHtml)
    
    const jsonLdScripts = $('script[type="application/ld+json"]')
    let productName: string | null = null
    
    jsonLdScripts.each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).text())
        if (jsonData['@type'] === 'Product' && jsonData.name) {
          productName = jsonData.name
        }
      } catch (error) {
        // Continue to next script
      }
    })
    
    expect(productName).toBe('Logitech G RS Wheel Hub for PC & PlayStation')
  })

  it('should detect availability from structured data', () => {
    const $ = cheerio.load(testHtml)
    
    const jsonLdScripts = $('script[type="application/ld+json"]')
    let isAvailable = false
    
    jsonLdScripts.each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).text())
        if (jsonData['@type'] === 'Product' && jsonData.offers && jsonData.offers.availability) {
          const availability = jsonData.offers.availability.toLowerCase()
          isAvailable = availability.includes('instock')
        }
      } catch (error) {
        // Continue to next script
      }
    })
    
    expect(isAvailable).toBe(true)
  })

  it('should extract multiple price elements from DOM', () => {
    const $ = cheerio.load(testHtml)
    
    // Find all price spans
    const priceSpans = $('.price')
    expect(priceSpans.length).toBeGreaterThan(0)
    
    // Check that they contain the expected price
    let foundPrice = false
    priceSpans.each((_, element) => {
      const text = $(element).text().trim()
      if (text === '$299.95') {
        foundPrice = true
      }
    })
    
    expect(foundPrice).toBe(true)
  })

  it('should have downloaded test fixture', () => {
    expect(testHtml.length).toBeGreaterThan(0)
    expect(testHtml).toContain('299.95')
    expect(testHtml).toContain('Logitech G RS Wheel Hub for PC & PlayStation')
  })
})