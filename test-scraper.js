import fs from 'fs'
import * as cheerio from 'cheerio'

// Test captured pages locally
async function testLocalPages() {
  const testPages = [
    {
      name: 'JB Hi-Fi iPhone 16',
      file: 'client/test-data/pages/jbhifi-iphone16.html',
      url: 'https://www.jbhifi.com.au/products/apple-iphone-16-128gb-ultramarine',
      domain: 'jbhifi.com.au'
    },
    {
      name: 'Bonmaxie Tote Bag',
      file: 'client/test-data/pages/bonmaxie-tote-bag.html',
      url: 'https://www.bonmaxie.com.au/products/bon-vivant-canvas-tote-bag-pink-gingham',
      domain: 'bonmaxie.com.au'
    }
  ]

  for (const page of testPages) {
    console.log(`\n=== Testing ${page.name} ===`)
    
    if (!fs.existsSync(page.file)) {
      console.log(`❌ File not found: ${page.file}`)
      continue
    }

    const html = fs.readFileSync(page.file, 'utf8')
    const $ = cheerio.load(html)
    
    console.log(`✅ Loaded ${page.file} (${(html.length / 1024).toFixed(1)}KB)`)
    
    // Check availability indicators
    console.log('\n--- Availability Analysis ---')
    const unavailableIndicators = [
      'out of stock', 'unavailable', 'sold out', 'not available'
    ]
    
    const pageText = $.text().toLowerCase()
    const foundIndicators = unavailableIndicators.filter(indicator => 
      pageText.includes(indicator)
    )
    
    if (foundIndicators.length > 0) {
      console.log(`❌ Found availability indicators: ${foundIndicators.join(', ')}`)
    } else {
      console.log(`✅ No availability indicators found`)
    }
    
    // Check for specific availability selectors
    console.log('\n--- Stock Status Elements ---')
    const stockSelectors = [
      '.stock-status', '.availability', '.product-stock', 
      '[class*="stock"]', '[class*="available"]', '[data-stock]',
      '.add-to-cart', '.buy-now', 'button[type="submit"]'
    ]
    
    stockSelectors.forEach(selector => {
      const elements = $(selector)
      if (elements.length > 0) {
        elements.each((i, el) => {
          const text = $(el).text().trim().toLowerCase()
          const classes = $(el).attr('class') || ''
          if (text.length > 0 && text.length < 100) {
            console.log(`  ${selector}: "${text}" (classes: ${classes})`)
          }
        })
      }
    })
    
    // Try JSON-LD extraction
    console.log('\n--- JSON-LD Analysis ---')
    $('script[type="application/ld+json"]').each((i, element) => {
      try {
        const jsonData = JSON.parse($(element).text())
        if (jsonData['@type'] === 'Product' || (Array.isArray(jsonData['@type']) && jsonData['@type'].includes('Product'))) {
          console.log(`  Product found: ${jsonData.name || 'No name'}`)
          if (jsonData.offers) {
            const offers = Array.isArray(jsonData.offers) ? jsonData.offers : [jsonData.offers]
            offers.forEach((offer, idx) => {
              console.log(`    Offer ${idx + 1}: price=${offer.price || offer.lowPrice}, availability=${offer.availability}`)
            })
          }
        }
      } catch (error) {
        console.log(`  Invalid JSON-LD: ${error.message}`)
      }
    })
    
    // Try Open Graph meta tags
    console.log('\n--- Open Graph Meta Tags ---')
    const ogTags = [
      'og:price:amount', 'product:price:amount', 'og:availability', 'product:availability'
    ]
    
    ogTags.forEach(tag => {
      const content = $(`meta[property="${tag}"]`).attr('content')
      if (content) {
        console.log(`  ${tag}: ${content}`)
      }
    })
  }
  
  console.log('\n=== Analysis Complete ===')
}

testLocalPages().catch(console.error)