const BaseScraper = require('./BaseScraper');

class RamiLevyScraper extends BaseScraper {
  constructor() {
    super('Rami Levy', 'https://www.rami-levy.co.il/he/online/market');
    this.apiResponses = [];
  }

  async init() {
    await super.initialize();
    
    // Intercept API responses to capture product data
    await this.page.setRequestInterception(true);
    
    this.page.on('request', (request) => {
      request.continue();
    });
    
    this.page.on('response', async (response) => {
      const url = response.url();
      
      // Look for product API endpoints
      if (url.includes('/api/') && 
          (url.includes('product') || url.includes('item') || url.includes('search')) &&
          response.status() === 200) {
        
        try {
          const text = await response.text();
          if (text && text.includes('{')) {
            const data = JSON.parse(text);
            this.apiResponses.push({ url, data });
            console.log(`📡 [Rami Levy] Captured API response: ${url}`);
          }
        } catch (error) {
          // Ignore JSON parse errors
        }
      }
    });
  }

  async scrape(searchQuery = '', limit = 50, maxScrolls = 20) {
    console.log(`🏪 [Rami Levy] Starting scrape with query: "${searchQuery}", limit: ${limit}, maxScrolls: ${maxScrolls}`);
    
    try {
      // Ensure scraper is initialized
      if (!this.page) {
        console.log(`🔄 [Rami Levy] Page not initialized, initializing scraper...`);
        await this.init();
      }
      
      if (!this.page) {
        throw new Error('Failed to initialize browser page');
      }
      
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(`✅ [Rami Levy] Navigated to ${this.baseUrl}`);
      
      // Try category-based scraping for better results
      const products = await this.scrapeProductsByCategories(maxScrolls);
      
      // Filter by search query if provided
      let filteredProducts = products;
      if (searchQuery && searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        filteredProducts = products.filter(product => 
          product.name.toLowerCase().includes(query) ||
          (product.description && product.description.toLowerCase().includes(query))
        );
        console.log(`🔍 [Rami Levy] Filtered ${products.length} → ${filteredProducts.length} products for query: "${searchQuery}"`);
      }
      
      // Apply limit
      const limitedProducts = limit ? filteredProducts.slice(0, limit) : filteredProducts;
      
      console.log(`📦 [Rami Levy] Final result: ${limitedProducts.length} products`);
      return limitedProducts;
      
    } catch (error) {
      console.error(`❌ [Rami Levy] Scraping failed: ${error.message}`);
      throw error;
    }
  }

  async scrapeProductsByCategories(maxScrolls) {
    const allProducts = [];
    
    // Predefined category URLs from Rami Levy website
    const categories = [
      {
        name: 'פירות וירקות',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%A4%D7%99%D7%A8%D7%95%D7%AA-%D7%95%D7%99%D7%A8%D7%A7%D7%95%D7%AA'
      },
      {
        name: 'חלב ביצים וסלטים',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%97%D7%9C%D7%91-%D7%91%D7%99%D7%A6%D7%99%D7%9D-%D7%95%D7%A1%D7%9C%D7%98%D7%99%D7%9D'
      },
      {
        name: 'בשר ודגים',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%91%D7%A9%D7%A8-%D7%95%D7%93%D7%92%D7%99%D7%9D'
      },
      {
        name: 'משקאות',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%9E%D7%A9%D7%A7%D7%90%D7%95%D7%AA'
      },
      {
        name: 'אורגני ובריאות',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%90%D7%95%D7%A8%D7%92%D7%A0%D7%99-%D7%95%D7%91%D7%A8%D7%99%D7%90%D7%95%D7%AA'
      },
      {
        name: 'קפואים',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%A7%D7%A4%D7%95%D7%90%D7%99%D7%9D'
      },
      {
        name: 'שימורים בישול ואפיה',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%A9%D7%99%D7%9E%D7%95%D7%A8%D7%99%D7%9D-%D7%91%D7%99%D7%A9%D7%95%D7%9C-%D7%95%D7%90%D7%A4%D7%99%D7%94'
      },
      {
        name: 'קטניות ודגנים',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%A7%D7%98%D7%A0%D7%99%D7%95%D7%AA-%D7%95%D7%93%D7%92%D7%A0%D7%99%D7%9D'
      },
      {
        name: 'חטיפים ומתוקים',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%97%D7%98%D7%99%D7%A4%D7%99%D7%9D-%D7%95%D7%9E%D7%AA%D7%95%D7%A7%D7%99%D7%9D'
      },
      {
        name: 'אחזקת הבית ובעלי חיים',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%90%D7%97%D7%96%D7%A7%D7%AA-%D7%94%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%A2-%D7%97'
      },
      {
        name: 'חד פעמי ומתכלה',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%97%D7%93-%D7%A4%D7%A2%D7%9E%D7%99-%D7%95%D7%9E%D7%AA%D7%9B%D7%9C%D7%94'
      },
      {
        name: 'פארם ותינוקות',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%A4%D7%90%D7%A8%D7%9D-%D7%95%D7%AA%D7%99%D7%A0%D7%95%D7%A7%D7%95%D7%AA'
      },
      {
        name: 'לחם מאפים והמאפייה הטרייה',
        url: 'https://www.rami-levy.co.il/he/online/market/%D7%9C%D7%97%D7%9D-%D7%9E%D7%90%D7%A4%D7%99%D7%9D-%D7%95%D7%94%D7%9E%D7%90%D7%A4%D7%99%D7%99%D7%94-%D7%94%D7%98%D7%A8%D7%99%D7%94'
      }
    ];
    
    console.log(`📂 [Rami Levy] גורד ${categories.length} קטגוריות מוגדרות מראש`);
    
    // Limit categories based on maxScrolls to avoid timeout
    const scrollsPerCategory = Math.max(3, Math.floor(maxScrolls / categories.length));
    const maxCategories = Math.min(categories.length, 6); // Max 6 categories to avoid timeout
    const limitedCategories = categories.slice(0, maxCategories);
    
    for (let i = 0; i < limitedCategories.length; i++) {
      const category = limitedCategories[i];
      console.log(`📂 [Rami Levy] גורד קטגוריה ${i + 1}/${limitedCategories.length}: ${category.name}`);
      
      try {
        // Ensure page is still available before navigation
        if (!this.page) {
          console.log(`❌ [Rami Levy] Page lost during scraping, skipping category: ${category.name}`);
          continue;
        }
        
        // Navigate to category page
        await this.page.goto(category.url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        await this.delay(3000);
        
        // Clear previous API responses
        this.apiResponses = [];
        
        // Scroll and load products in this category
        await this.scrollAndLoadProducts(scrollsPerCategory);
        
        // Extract products from this category
        const scrapedProducts = await this.extractProducts();
        const apiProducts = this.extractFromAPI();
        const categoryProducts = this.mergeProducts(scrapedProducts, apiProducts);
        
        // Add category info to products and filter for products with prices
        const categorizedProducts = categoryProducts
          .map(product => ({
            ...product,
            category: category.name,
            categoryUrl: category.url
          }))
          .filter(product => product.price && typeof product.price === 'number' && product.price > 0); // Only products with prices
        
        console.log(`📦 [Rami Levy] ${categorizedProducts.length} מוצרים עם מחיר מקטגוריה: ${category.name}`);
        allProducts.push(...categorizedProducts);
        
      } catch (error) {
        console.log(`❌ [Rami Levy] שגיאה בקטגוריה ${category.name}: ${error.message}`);
        continue;
      }
    }
    
    // Remove duplicates
    const uniqueProducts = this.removeDuplicateProducts(allProducts);
    console.log(`🔄 [Rami Levy] ${allProducts.length} מוצרים סה"כ, ${uniqueProducts.length} ייחודיים`);
    
    return uniqueProducts;
  }

  removeDuplicateProducts(products) {
    const seen = new Map();
    
    return products.filter(product => {
      // Create unique key from multiple fields
      const key = [
        product.barcode,
        product.id, 
        product.name,
        product.url
      ].filter(Boolean).join('|');
      
      if (key && !seen.has(key)) {
        seen.set(key, true);
        return true;
      }
      return false;
    });
  }

  async scrollAndLoadProducts(maxScrolls) {
    console.log(`📜 [Rami Levy] Starting scroll process with ${maxScrolls} scrolls...`);
    
    let scrollCount = 0;
    let lastProductCount = 0;
    let stableCount = 0;
    
    while (scrollCount < maxScrolls) {
      // Get current product count
      const currentProductCount = await this.page.evaluate(() => {
        const products = document.querySelectorAll('[data-testid*="product"], .product, [class*="product"], [id*="product"]');
        return products.length;
      });
      
      console.log(`📜 [Rami Levy] Scroll ${scrollCount + 1}/${maxScrolls} - Found ${currentProductCount} elements`);
      
      // Check if product count is stable (not increasing)
      if (currentProductCount === lastProductCount) {
        stableCount++;
        if (stableCount >= 3) {
          console.log(`⏹️ [Rami Levy] Product count stable for 3 scrolls, stopping early`);
          break;
        }
      } else {
        stableCount = 0;
      }
      
      lastProductCount = currentProductCount;
      
      // Scroll down
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      
      // Wait for content to load
      await this.delay(2000);
      
      scrollCount++;
    }
    
    console.log(`✅ [Rami Levy] Scrolling completed after ${scrollCount} scrolls`);
  }

  async extractProducts() {
    console.log(`🎯 [Rami Levy] Extracting products from page...`);
    
    const products = await this.page.evaluate(() => {
      const productElements = [];
      
      // Try multiple selectors to find product containers
      const selectors = [
        '[data-testid*="product"]',
        '.product',
        '[class*="product"]',
        '[class*="item"]',
        '[data-testid*="item"]',
        '.card',
        '[class*="card"]'
      ];
      
      const foundElements = new Set();
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (!foundElements.has(element)) {
            foundElements.add(element);
            productElements.push(element);
          }
        });
      }
      
      console.log(`Found ${productElements.length} potential product elements`);
      
      const extractedProducts = [];
      
      productElements.forEach((element, index) => {
        try {
          // Extract product information with multiple fallback strategies
          const product = {};
          
          // Product name - try multiple selectors
          const nameSelectors = [
            'h1, h2, h3, h4, h5, h6',
            '[class*="name"]',
            '[class*="title"]',
            '[data-testid*="name"]',
            '.product-name',
            '.item-name'
          ];
          
          for (const nameSelector of nameSelectors) {
            const nameEl = element.querySelector(nameSelector);
            if (nameEl && nameEl.textContent.trim()) {
              product.name = nameEl.textContent.trim();
              break;
            }
          }
          
          // If no name found, try text content of element itself
          if (!product.name) {
            const textContent = element.textContent?.trim();
            if (textContent && textContent.length > 3 && textContent.length < 100) {
              product.name = textContent.split('\n')[0].trim();
            }
          }
          
          // Price - try multiple selectors
          const priceSelectors = [
            '[class*="price"]',
            '[data-testid*="price"]',
            '.price',
            '[class*="cost"]',
            '[class*="amount"]'
          ];
          
          for (const priceSelector of priceSelectors) {
            const priceEl = element.querySelector(priceSelector);
            if (priceEl && priceEl.textContent.trim()) {
              const priceText = priceEl.textContent.trim();
              // Look for price patterns (numbers with currency symbols)
              if (priceText.match(/[\d.,]+\s*[₪$€£]/)) {
                // Extract only the numeric part (remove currency symbols and extra text)
                const numericPrice = priceText.match(/[\d.,]+/);
                if (numericPrice) {
                  // Convert to number and handle decimal separators
                  const cleanPrice = numericPrice[0].replace(/,/g, '.');
                  const priceNumber = parseFloat(cleanPrice);
                  if (!isNaN(priceNumber)) {
                    product.price = priceNumber;
                    break;
                  }
                }
              }
            }
          }
          
          // Image URL
          const imgEl = element.querySelector('img');
          if (imgEl) {
            product.imageUrl = imgEl.src || imgEl.getAttribute('data-src');
          }
          
          // Product URL
          const linkEl = element.querySelector('a');
          if (linkEl) {
            const href = linkEl.getAttribute('href');
            if (href) {
              product.url = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            }
          }
          
          // Extract ID from various attributes
          product.id = element.getAttribute('data-id') || 
                     element.getAttribute('data-product-id') ||
                     element.getAttribute('id') ||
                     `product_${index}`;
          
          // Only include products that have at least a name and price
          if (product.name && product.price) {
            extractedProducts.push(product);
          }
          
        } catch (error) {
          console.log(`Error extracting product ${index}:`, error.message);
        }
      });
      
      return extractedProducts;
    });
    
    console.log(`📦 [Rami Levy] Extracted ${products.length} products from DOM`);
    return products;
  }

  extractFromAPI() {
    console.log(`🔌 [Rami Levy] Extracting products from ${this.apiResponses.length} API responses...`);
    
    const apiProducts = [];
    
    this.apiResponses.forEach((response, index) => {
      try {
        const data = response.data;
        
        // Handle different API response structures
        let products = [];
        
        if (Array.isArray(data)) {
          products = data;
        } else if (data.products && Array.isArray(data.products)) {
          products = data.products;
        } else if (data.items && Array.isArray(data.items)) {
          products = data.items;
        } else if (data.data && Array.isArray(data.data)) {
          products = data.data;
        } else if (data.results && Array.isArray(data.results)) {
          products = data.results;
        }
        
        products.forEach(item => {
          if (item && typeof item === 'object') {
            const product = {
              id: item.id || item.productId || item.itemId,
              name: item.name || item.title || item.productName,
              price: item.price || item.cost || item.amount,
              imageUrl: item.image || item.imageUrl || item.img,
              url: item.url || item.link,
              barcode: item.barcode || item.ean || item.gtin,
              description: item.description || item.desc,
              brand: item.brand || item.manufacturer,
              category: item.category || item.categoryName,
              source: 'api'
            };
            
            // Only add if has essential info
            if (product.name && product.price) {
              apiProducts.push(product);
            }
          }
        });
        
      } catch (error) {
        console.log(`Error parsing API response ${index}:`, error.message);
      }
    });
    
    console.log(`🔌 [Rami Levy] Extracted ${apiProducts.length} products from API`);
    return apiProducts;
  }

  mergeProducts(scrapedProducts, apiProducts) {
    console.log(`🔄 [Rami Levy] Merging ${scrapedProducts.length} scraped + ${apiProducts.length} API products...`);
    
    // Create a map of API products by ID for quick lookup
    const apiMap = new Map();
    apiProducts.forEach(product => {
      if (product.id) {
        apiMap.set(product.id, product);
      }
    });
    
    // Merge scraped products with API data
    const mergedProducts = scrapedProducts.map(scrapedProduct => {
      const apiProduct = apiMap.get(scrapedProduct.id);
      if (apiProduct) {
        // Merge scraped and API data, preferring API data for missing fields
        return {
          ...scrapedProduct,
          ...apiProduct,
          // Keep scraped name/price if API version is missing
          name: scrapedProduct.name || apiProduct.name,
          price: scrapedProduct.price || apiProduct.price
        };
      }
      return scrapedProduct;
    });
    
    // Add any API products that weren't matched with scraped products
    apiProducts.forEach(apiProduct => {
      const existsInMerged = mergedProducts.some(mp => mp.id === apiProduct.id);
      if (!existsInMerged) {
        mergedProducts.push(apiProduct);
      }
    });
    
    console.log(`🔄 [Rami Levy] Merged into ${mergedProducts.length} total products`);
    return mergedProducts;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    return await super.close();
  }
}

module.exports = RamiLevyScraper;