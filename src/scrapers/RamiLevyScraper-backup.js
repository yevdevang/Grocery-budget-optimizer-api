const BaseScraper = require('./BaseScraper');

class RamiLevyScraper extends BaseScraper {
  constructor() {
    super('Rami Levy', 'https://www.rami-levy.co.il');
    this.apiResponses = [];
  }

  async scrape(searchTerm = '', limit = null, maxScrolls = 50) {
    try {
      await this.initialize();
      this.setupAPIListener();

      console.log(`🔍 [Rami Levy] פותח את האתר...`);
      await this.page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await this.delay(3000);

      let allProducts = [];

      if (searchTerm) {
        console.log(`🔎 [Rami Levy] מחפש: ${searchTerm}`);
        await this.performSearch(searchTerm);
        await this.delay(3000);
        
        console.log(`📜 [Rami Levy] גולל את העמוד... (עד ${maxScrolls} גלילות)`);
        await this.scrollAndLoadProducts(maxScrolls);

        console.log(`📦 [Rami Levy] אוסף מוצרים...`);
        const scrapedProducts = await this.extractProducts();
        const apiProducts = this.extractFromAPI();
        allProducts = this.mergeProducts(scrapedProducts, apiProducts);
      } else {
        // Navigate through categories to get products
        console.log(`🏪 [Rami Levy] מנווט בקטגוריות לאיסוף מוצרים...`);
        allProducts = await this.scrapeProductsByCategories(maxScrolls);
      }

      const finalProducts = limit ? allProducts.slice(0, limit) : allProducts;
      
      console.log(`✅ [Rami Levy] נמצאו ${finalProducts.length} מוצרים`);
      
      await this.close();
      return finalProducts;

    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async scrapeProductsByCategories(maxScrolls) {
    const allProducts = [];
    
    try {
      // Wait for the category menu to load
      await this.delay(3000);
      
      // Find category menu items from the top navigation
      const categories = await this.page.evaluate(() => {
        const categoryItems = [];
        
        // Look for category navigation elements - be less restrictive
        const selectors = [
          'nav a[href]',
          '.menu a[href]',
          '.navigation a[href]',
          'header a[href]',
          '.header a[href]'
        ];
        
        const foundLinks = new Set();
        
        for (const selector of selectors) {
          const links = document.querySelectorAll(selector);
          links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent?.trim();
            
            if (href && text && 
                href.length > 1 && 
                !href.startsWith('#') && 
                !href.includes('javascript:') &&
                text.length > 1 && text.length < 30 &&
                !foundLinks.has(href)) {
              
              foundLinks.add(href);
              categoryItems.push({
                name: text,
                url: href.startsWith('http') ? href : new URL(href, window.location.origin).href
              });
            }
          });
        }
        
        return categoryItems.slice(0, 10); // Limit to 10 categories
      });
      
      console.log(`📂 [Rami Levy] נמצאו ${categories.length} קטגוריות`);
      
      if (categories.length === 0) {
        // If no categories found, try to scrape from current page
        console.log(`🏪 [Rami Levy] לא נמצאו קטגוריות, מנסה לגרד מהעמוד הנוכחי...`);
        
        await this.scrollAndLoadProducts(maxScrolls);
        const scrapedProducts = await this.extractProducts();
        const apiProducts = this.extractFromAPI();
        const currentPageProducts = this.mergeProducts(scrapedProducts, apiProducts);
        
        console.log(`� [Rami Levy] ${currentPageProducts.length} מוצרים מהעמוד הנוכחי`);
        allProducts.push(...currentPageProducts);
        
        return allProducts;
      }
      
      // Limit categories to avoid too long scraping
      const limitedCategories = categories.slice(0, 5); // Max 5 categories
      
      for (let i = 0; i < limitedCategories.length; i++) {
        const category = limitedCategories[i];
        console.log(`📂 [Rami Levy] גורד קטגוריה ${i + 1}/${limitedCategories.length}: ${category.name}`);
        
        try {
          // Navigate to category page
          await this.page.goto(category.url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          await this.delay(3000);
          
          // Clear previous API responses
          this.apiResponses = [];
          
          // Scroll and load products in this category
          const scrollsPerCategory = Math.max(3, Math.floor(maxScrolls / limitedCategories.length));
          await this.scrollAndLoadProducts(scrollsPerCategory);
          
          // Extract products from this category
          const scrapedProducts = await this.extractProducts();
          const apiProducts = this.extractFromAPI();
          const categoryProducts = this.mergeProducts(scrapedProducts, apiProducts);
          
          // Add category info to products
          const categorizedProducts = categoryProducts.map(product => ({
            ...product,
            category: category.name,
            categoryUrl: category.url
          }));
          
          console.log(`📦 [Rami Levy] ${categorizedProducts.length} מוצרים מקטגוריה: ${category.name}`);
          allProducts.push(...categorizedProducts);
          
        } catch (error) {
          console.log(`❌ [Rami Levy] שגיאה בקטגוריה ${category.name}: ${error.message}`);
          continue;
        }
      }
      
    } catch (error) {
      console.log(`❌ [Rami Levy] שגיאה כללית בגרידת קטגוריות: ${error.message}`);
      
      // Fallback: try to scrape from main page
      console.log(`🏪 [Rami Levy] מנסה לגרד מהעמוד הראשי כ-fallback...`);
      try {
        await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.delay(3000);
        await this.scrollAndLoadProducts(maxScrolls);
        
        const scrapedProducts = await this.extractProducts();
        const apiProducts = this.extractFromAPI();
        const fallbackProducts = this.mergeProducts(scrapedProducts, apiProducts);
        
        console.log(`📦 [Rami Levy] ${fallbackProducts.length} מוצרים מ-fallback`);
        allProducts.push(...fallbackProducts);
      } catch (fallbackError) {
        console.log(`❌ [Rami Levy] גם fallback נכשל: ${fallbackError.message}`);
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

  async scrapeFromCategories(maxScrolls) {
    const allProducts = [];
    const categories = await this.findCategories();
    
    console.log(`📂 [Rami Levy] נמצאו ${categories.length} קטגוריות`);
    
    // Limit to first 5 categories to avoid taking too long
    const limitedCategories = categories.slice(0, 5);
    
    for (let i = 0; i < limitedCategories.length; i++) {
      const category = limitedCategories[i];
      console.log(`� [Rami Levy] גורד קטגוריה ${i + 1}/${limitedCategories.length}: ${category.name}`);
      
      try {
        // Navigate to category
        await this.page.goto(category.url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        await this.delay(2000);
        
        // Scroll and collect products from this category
        await this.scrollAndLoadProducts(Math.floor(maxScrolls / limitedCategories.length));
        
        const scrapedProducts = await this.extractProducts();
        const apiProducts = this.extractFromAPI();
        const categoryProducts = this.mergeProducts(scrapedProducts, apiProducts);
        
        console.log(`📦 [Rami Levy] ${categoryProducts.length} מוצרים מקטגוריה: ${category.name}`);
        allProducts.push(...categoryProducts);
        
        // Clear API responses for next category
        this.apiResponses = [];
        
      } catch (error) {
        console.log(`❌ [Rami Levy] שגיאה בקטגוריה ${category.name}: ${error.message}`);
      }
    }
    
    // Remove duplicates
    const uniqueProducts = this.removeDuplicates(allProducts);
    console.log(`🔄 [Rami Levy] ${allProducts.length} מוצרים, ${uniqueProducts.length} ייחודיים`);
    
    return uniqueProducts;
  }

  async findCategories() {
    try {
      // Go back to home page to find categories
      await this.page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.delay(2000);
      
      const categories = await this.page.evaluate(() => {
        const categorySelectors = [
          'a[href*="category"]',
          'a[href*="קטגוריה"]',
          '.category-link',
          '.menu-item a',
          'nav a',
          '[data-category] a',
          'a[href*="products"]'
        ];
        
        const found = [];
        
        for (const selector of categorySelectors) {
          const links = document.querySelectorAll(selector);
          links.forEach(link => {
            const href = link.href;
            const text = link.textContent?.trim();
            
            if (href && text && href.includes('http') && 
                !href.includes('javascript:') && 
                !href.includes('#') &&
                text.length > 1 && text.length < 50) {
              
              found.push({
                name: text,
                url: href
              });
            }
          });
        }
        
        return found;
      });
      
      // Remove duplicates and filter
      const uniqueCategories = categories.filter((category, index, self) => 
        index === self.findIndex(c => c.url === category.url)
      );
      
      return uniqueCategories.slice(0, 10); // Limit to 10 categories
      
    } catch (error) {
      console.log('❌ [Rami Levy] שגיאה בחיפוש קטגוריות');
      return [];
    }
  }

  removeDuplicates(products) {
    const seen = new Set();
    return products.filter(product => {
      const key = product.barcode || product.id || product.name;
      if (key && !seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    });
  }

  async navigateToProductsSection() {
    try {
      // Try to find and click on product categories or "all products" links
      const productSectionSelectors = [
        'a[href*="products"]',
        'a[href*="מוצרים"]',
        'a[contains(text(), "מוצרים")]',
        'a[contains(text(), "קטגוריות")]',
        'a[contains(text(), "כל המוצרים")]',
        '.category-link',
        '.products-link',
        '[data-category]',
        'nav a[href*="category"]'
      ];

      for (const selector of productSectionSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          console.log(`🔗 [Rami Levy] מצא קישור מוצרים: ${selector}`);
          await this.page.click(selector);
          await this.page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 10000 
          }).catch(() => {});
          await this.delay(2000);
          return;
        } catch (e) {
          continue;
        }
      }

      // If no specific products link found, try to find categories
      const categorySelectors = [
        '.category',
        '.category-item',
        '[data-category-id]',
        '.menu-item'
      ];

      for (const selector of categorySelectors) {
        try {
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            console.log(`📂 [Rami Levy] מצא ${elements.length} קטגוריות`);
            // Click on the first category to get to products
            await elements[0].click();
            await this.delay(2000);
            return;
          }
        } catch (e) {
          continue;
        }
      }

      console.log('⚠️  [Rami Levy] לא נמצא קישור למוצרים, נשאר בעמוד הראשי');
    } catch (error) {
      console.log('⚠️  [Rami Levy] שגיאה בניווט למוצרים');
    }
  }

  setupAPIListener() {
    this.page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('products')) {
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            this.apiResponses.push(data);
          }
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });
  }

  async performSearch(searchTerm) {
    try {
      const searchSelectors = [
        'input[type="search"]',
        'input[placeholder*="חיפוש"]',
        '#search-input',
        '.search-input',
        '[name="search"]'
      ];

      for (const selector of searchSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          await this.page.type(selector, searchTerm);
          await this.page.keyboard.press('Enter');
          await this.page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 10000 
          }).catch(() => {});
          await this.delay(2000);
          return;
        } catch (e) {
          continue;
        }
      }
      console.log('⚠️  [Rami Levy] לא נמצאה תיבת חיפוש');
    } catch (error) {
      console.log('⚠️  [Rami Levy] שגיאה בחיפוש');
    }
  }

  async scrollAndLoadProducts(maxScrolls = 50) {
    let previousHeight = 0;
    let scrollAttempts = 0;
    let stableCount = 0;
    const maxStableAttempts = 3;

    console.log(`🔄 [Rami Levy] מתחיל גלילה עם עד ${maxScrolls} ניסיונות`);

    while (scrollAttempts < maxScrolls && stableCount < maxStableAttempts) {
      // Get current product count
      const currentProductCount = await this.page.evaluate(() => {
        const allSelectors = [
          '.product-item',
          '.product-card', 
          '[data-product]',
          '.item-product',
          '.product',
          '.item',
          '[class*="product"]',
          '[class*="item"]'
        ];
        
        let maxCount = 0;
        for (const selector of allSelectors) {
          const count = document.querySelectorAll(selector).length;
          if (count > maxCount) maxCount = count;
        }
        return maxCount;
      });

      console.log(`📦 [Rami Levy] גלילה ${scrollAttempts + 1}: ${currentProductCount} מוצרים`);

      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for content to load
      await this.delay(2000);
      
      // Get new height
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      if (currentHeight === previousHeight) {
        stableCount++;
        console.log(`📍 [Rami Levy] גובה יציב ${stableCount}/${maxStableAttempts}`);
      } else {
        stableCount = 0;
        previousHeight = currentHeight;
      }
      
      scrollAttempts++;
    }
    
    const finalProductCount = await this.page.evaluate(() => {
      const allSelectors = [
        '.product-item',
        '.product-card', 
        '[data-product]',
        '.item-product',
        '.product',
        '.item',
        '[class*="product"]',
        '[class*="item"]'
      ];
      
      let maxCount = 0;
      for (const selector of allSelectors) {
        const count = document.querySelectorAll(selector).length;
        if (count > maxCount) maxCount = count;
      }
      return maxCount;
    });
    
    console.log(`✅ [Rami Levy] סיום גלילה: ${scrollAttempts} ניסיונות, ${finalProductCount} מוצרים`);
  }

  async tryPagination() {
    try {
      const paginationSelectors = [
        'a[contains(text(), "הבא")]',
        'a[contains(text(), "Next")]', 
        'button[contains(text(), "הבא")]',
        '.pagination .next',
        '.pagination-next',
        '[class*="next"]',
        '[class*="pagination"] a:last-child',
        'a[rel="next"]'
      ];

      for (const selector of paginationSelectors) {
        const nextButton = await this.page.$(selector);
        if (nextButton) {
          const isEnabled = await this.page.evaluate(btn => {
            return !btn.disabled && !btn.classList.contains('disabled') && btn.offsetParent !== null;
          }, nextButton);
          
          if (isEnabled) {
            console.log(`📄 [Rami Levy] לוחץ על עמוד הבא: ${selector}`);
            await nextButton.click();
            await this.page.waitForNavigation({ 
              waitUntil: 'networkidle2', 
              timeout: 10000 
            }).catch(() => {});
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async extractProducts() {
    return await this.page.evaluate(() => {
      const results = [];
      
      // First, try to find any elements that contain text and might be products
      // Cast to more generic approach since specific selectors aren't working
      const allElements = document.querySelectorAll('*');
      const potentialProductElements = [];
      
      // Look for elements that contain text that looks like product information
      for (const element of allElements) {
        const text = element.textContent?.trim();
        const hasChildren = element.children.length > 0;
        const hasText = text && text.length > 5 && text.length < 200;
        
        // Skip if it's a script, style, or meta element
        if (['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD'].includes(element.tagName)) {
          continue;
        }
        
        // Look for elements that might contain product info
        if (hasText && hasChildren && 
            (text.includes('₪') || text.includes('ש"ח') || 
             element.querySelector('img') || 
             element.getAttribute('data-id') ||
             element.getAttribute('data-product') ||
             element.classList.contains('item') ||
             element.classList.contains('product') ||
             element.classList.contains('card'))) {
          
          potentialProductElements.push(element);
        }
      }
      
      console.log(`Found ${potentialProductElements.length} potential product elements`);
      
      // Extract products from potential elements
      potentialProductElements.slice(0, 200).forEach((element, index) => {
        try {
          const text = element.textContent?.trim() || '';
          
          // Extract name - try to find the main text content
          let name = '';
          
          // Try to find name in various ways
          const nameElement = element.querySelector('h1, h2, h3, h4, h5, h6') ||
                             element.querySelector('[class*="title"]') ||
                             element.querySelector('[class*="name"]') ||
                             element.querySelector('a[href]') ||
                             element.querySelector('span, div');
          
          if (nameElement && nameElement.textContent) {
            name = nameElement.textContent.trim();
          } else if (text) {
            // Take first meaningful line of text
            const lines = text.split('\n').filter(line => line.trim().length > 2);
            name = lines[0]?.trim() || '';
          }
          
          // Extract price - look for currency symbols or numbers with improved patterns
          let price = '';
          const pricePatterns = [
            /₪\s*[\d,.]+ ?/,           // ₪ before number
            /[\d,]+\.?\d*\s*₪/,       // number before ₪
            /[\d,]+\.?\d*\s*ש"ח/,     // number before ש"ח  
            /\d+[.,]\d+/,             // decimal numbers
            /\d+\s*₪/,                // simple number with ₪
            /[\d,]+/                  // just numbers (as last resort)
          ];
          
          for (const pattern of pricePatterns) {
            const match = text.match(pattern);
            if (match) {
              const priceText = match[0].trim();
              // Validate it looks like a price (has numbers)
              if (/\d/.test(priceText)) {
                price = priceText;
                break;
              }
            }
          }
          
          // Get image
          const img = element.querySelector('img');
          const imageUrl = img ? (img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') || '') : '';
          
          // Get link
          const link = element.querySelector('a[href]') || element.closest('a[href]');
          const productUrl = link ? link.href : '';
          
          // Get any data attributes that might be useful
          const id = element.getAttribute('data-id') || 
                   element.getAttribute('data-product-id') || 
                   element.getAttribute('data-sku') ||
                   element.id || 
                   `extracted-${index}`;
          
          const barcode = element.getAttribute('data-barcode') || 
                         element.getAttribute('data-code') || 
                         element.getAttribute('data-ean') || '';
          
          // Only include if we have meaningful data AND a price (key indicator of actual products)
          if (name && name.length > 3 && name.length < 150 && price && price.length > 0) {
            const product = {
              id: id,
              name: name,
              price: price,
              image: imageUrl,
              url: productUrl,
              barcode: barcode,
              text: text.substring(0, 100), // Include raw text for debugging
              inStock: !element.classList.contains('out-of-stock'),
              category: '' // Will be filled by category scraper
            };
            
            results.push(product);
          }
        } catch (e) {
          // Continue on error
        }
      });
      
      console.log(`Extracted ${results.length} products from ${potentialProductElements.length} potential elements`);
      return results;
    });
  }

  extractFromAPI() {
    const products = [];
    
    this.apiResponses.forEach((data) => {
      if (Array.isArray(data)) {
        products.push(...this.parseProductArray(data));
      } else if (data.products) {
        products.push(...this.parseProductArray(data.products));
      } else if (data.items) {
        products.push(...this.parseProductArray(data.items));
      } else if (data.data) {
        if (Array.isArray(data.data)) {
          products.push(...this.parseProductArray(data.data));
        } else if (data.data.products) {
          products.push(...this.parseProductArray(data.data.products));
        }
      }
    });

    return products;
  }

  parseProductArray(arr) {
    return arr.map(item => ({
      id: item.id || item.productId || item.code || '',
      name: item.name || item.productName || item.title || '',
      price: item.price || item.currentPrice || item.salePrice || '',
      originalPrice: item.originalPrice || item.regularPrice || '',
      barcode: item.barcode || item.ean || item.gtin || '',
      image: item.image || item.imageUrl || item.thumbnail || item.img || '',
      unit: item.unit || item.unitType || '',
      inStock: item.inStock !== false,
      category: item.category || item.categoryName || '',
      manufacturer: item.manufacturer || item.brand || ''
    })).filter(p => p.name);
  }

  mergeProducts(scraped, api) {
    const merged = new Map();
    
    [...scraped, ...api].forEach(p => {
      const key = p.barcode || p.id || p.name;
      if (key) {
        const existing = merged.get(key);
        merged.set(key, { ...existing, ...p });
      }
    });
    
    return Array.from(merged.values());
  }
}

module.exports = RamiLevyScraper;