const express = require('express');
const router = express.Router();
const RamiLevyScraper = require('../scrapers/RamiLevyScraper');
const BackgroundScrapingService = require('../services/BackgroundScrapingService');
const cache = require('../utils/cache');
const config = require('../config/config');

// Get all stores
router.get('/', (req, res) => {
  const stores = Object.entries(config.stores).map(([id, store]) => ({
    id,
    name: store.name,
    endpoint: `/api/stores/${id}/products`,
    enabled: store.enabled
  }));

  res.json({
    success: true,
    stores
  });
});

// Get Rami Levy products
router.get('/rami-levy/products', async (req, res) => {
  try {
    const { 
      search = '', 
      limit, 
      maxScrolls, 
      priceFilter = 'true',
      forceRefresh = 'false',
      source = 'auto' // 'auto', 'database', 'scrape'
    } = req.query;
    
    const productLimit = limit ? parseInt(limit) : 50;
    const scrollLimit = maxScrolls ? parseInt(maxScrolls) : 50;
    const requirePrice = priceFilter === 'true';
    const shouldForceRefresh = forceRefresh === 'true';
    
        // Try database first unless forcing scrape
    if (source !== 'scrape' && !shouldForceRefresh && DatabaseService.connected) {
      try {
        console.log(`�️ [Rami Levy] Attempting to fetch from database...`);
        
        const dbResult = await ScrapingService.getProductsFromDB('rami-levy', {
          search,
          limit: productLimit,
          page: 1
        });
        
        if (dbResult.products && dbResult.products.length > 0) {
          console.log(`✅ [Rami Levy] Found ${dbResult.products.length} products in database`);
          
          let filteredProducts = dbResult.products;
          if (requirePrice) {
            filteredProducts = dbResult.products.filter(product => 
              product.price && product.price.trim().length > 0
            );
          }
          
          return res.json({
            success: true,
            store: 'Rami Levy',
            search: search,
            count: filteredProducts.length,
            limit: productLimit,
            priceFilter: requirePrice,
            products: filteredProducts,
            fromDatabase: true,
            pagination: dbResult.pagination,
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (dbError) {
        console.log(`⚠️ [Rami Levy] Database query failed, falling back to scraping:`, dbError.message);
      }
    } else if (!DatabaseService.connected) {
      console.log(`📦 [Rami Levy] Database not connected, using direct scraping mode`);
    }
    
    // Fallback to scraping or if forced refresh
    console.log(`🔄 [Rami Levy] ${shouldForceRefresh ? 'Force refresh' : 'Fallback to'} scraping...`);
    
    const cacheKey = `rami-levy-scrape-${search}-${productLimit}-${scrollLimit}-${requirePrice}`;
    const cached = cache.get(cacheKey);
    
    if (cached && !shouldForceRefresh) {
      console.log('📦 מחזיר תוצאות מ-cache');
      return res.json({
        ...cached,
        cached: true
      });
    }

    // Use ScrapingService for integrated scrape and store (if database available)
    if (DatabaseService.connected) {
      const scrapingResult = await ScrapingService.scrapeAndStore('rami-levy', {
        maxScrolls: scrollLimit,
        forceRefresh: shouldForceRefresh,
        searchQuery: search
      });
      
      if (!scrapingResult.success) {
        return res.status(500).json({
          success: false,
          error: scrapingResult.error || 'Scraping failed',
          timestamp: new Date().toISOString()
        });
      }
      
      // Get results from database after scraping
      const dbResult = await ScrapingService.getProductsFromDB('rami-levy', {
        search,
        limit: productLimit,
        page: 1
      });
      
      let finalProducts = dbResult.products || [];
      if (requirePrice) {
        finalProducts = finalProducts.filter(product => 
          product.price && product.price.trim().length > 0
        );
      }

      const response = {
        success: true,
        store: 'Rami Levy',
        search: search,
        count: finalProducts.length,
        limit: productLimit,
        maxScrolls: scrollLimit,
        priceFilter: requirePrice,
        products: finalProducts,
        scrapingStats: scrapingResult.stats,
        fromDatabase: true,
        justScraped: true,
        cached: false,
        timestamp: new Date().toISOString()
      };

      // Cache the response
      cache.set(cacheKey, response);
      res.json(response);
      
    } else {
      // Fallback to direct scraping without database storage
      console.log(`📦 [Rami Levy] Direct scraping mode (no database)`);
      
      const scraper = new RamiLevyScraper();
      await scraper.init();
      
      try {
        let products = await scraper.scrape(search, null, scrollLimit);

        // Apply price filter if requested
        if (requirePrice) {
          products = products.filter(product => product.price && product.price.trim().length > 0);
        }

        // Apply limit after filtering
        const finalProducts = productLimit ? products.slice(0, productLimit) : products;

        const response = {
          success: true,
          store: 'Rami Levy',
          search: search,
          count: finalProducts.length,
          totalBeforeLimit: products.length,
          limit: productLimit || 'unlimited',
          maxScrolls: scrollLimit,
          priceFilter: requirePrice,
          products: finalProducts,
          fromDatabase: false,
          cached: false,
          timestamp: new Date().toISOString()
        };

        cache.set(cacheKey, response);
        res.json(response);
        
      } finally {
        await scraper.close();
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

// Force refresh products (scrape and update database)
router.post('/rami-levy/refresh', async (req, res) => {
  try {
    const { maxScrolls = 50 } = req.body;
    
    console.log(`🔄 [Rami Levy] Force refresh initiated with maxScrolls: ${maxScrolls}`);
    
    const result = await ScrapingService.scrapeAndStore('rami-levy', {
      maxScrolls: parseInt(maxScrolls),
      forceRefresh: true
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Refresh Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get store statistics and info
router.get('/rami-levy/info', async (req, res) => {
  try {
    const storeInfo = await ScrapingService.getStoreInfo('rami-levy');
    res.json({
      success: true,
      ...storeInfo
    });
  } catch (error) {
    console.error('❌ Store Info Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get database health
router.get('/database/health', async (req, res) => {
  try {
    const health = await ScrapingService.getDatabaseHealth();
    res.json({
      success: true,
      database: health
    });
  } catch (error) {
    console.error('❌ Database Health Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search across all stores
router.get('/search', async (req, res) => {
  try {
    const { q: searchTerm, limit = 50 } = req.query;
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }
    
    const results = await ScrapingService.searchAllStores(searchTerm, {
      limit: parseInt(limit)
    });
    
    res.json(results);
    
  } catch (error) {
    console.error('❌ Search Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get product by barcode
router.get('/rami-levy/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    const cacheKey = `rami-levy-barcode-${barcode}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const scraper = new RamiLevyScraper();
    const products = await scraper.scrape(barcode, 20);
    
    const product = products.find(p => p.barcode === barcode);

    if (product) {
      const response = {
        success: true,
        product: product,
        cached: false
      };
      cache.set(cacheKey, response);
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;