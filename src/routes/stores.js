const express = require('express');
const router = express.Router();
const RamiLevyScraper = require('../scrapers/RamiLevyScraper');
const DatabaseService = require('../services/DatabaseService');
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

// Get Rami Levy products - MongoDB integrated
router.get('/rami-levy/products', async (req, res) => {
  try {
    const { 
      search = '', 
      limit, 
      maxScrolls, 
      priceFilter = 'true',
      forceRefresh = 'false',
      source = 'auto', // 'auto', 'database', 'scrape'
      category
    } = req.query;
    
    const productLimit = limit ? parseInt(limit) : null;
    const scrollLimit = maxScrolls ? parseInt(maxScrolls) : 50;
    const requirePrice = priceFilter === 'true';
    const shouldForceRefresh = forceRefresh === 'true';
    
    console.log(`🔄 [Rami Levy] Request: search="${search}", limit=${productLimit}, source=${source}`);
    
    // Try database first unless forcing scrape
    if (source !== 'scrape' && !shouldForceRefresh && DatabaseService.connected) {
      try {
        console.log(`🗄️  [Rami Levy] Attempting to fetch from database...`);
        
        const dbResult = await DatabaseService.getProducts('rami-levy', {
          search,
          category,
          limit: productLimit,
          inStock: requirePrice ? true : null
        });

        if (dbResult.products.length > 0) {
          console.log(`✅ [Rami Levy] Found ${dbResult.products.length} products in database`);
          
          return res.json({
            success: true,
            store: 'Rami Levy',
            search: search,
            count: dbResult.products.length,
            total: dbResult.total,
            hasMore: dbResult.hasMore,
            pagination: dbResult.pagination,
            limit: productLimit || 'unlimited',
            priceFilter: requirePrice,
            products: dbResult.products,
            source: 'database',
            cached: false,
            timestamp: new Date().toISOString()
          });
        } else if (source === 'database') {
          // If specifically requesting database and no results, return empty
          return res.json({
            success: true,
            store: 'Rami Levy',
            search: search,
            count: 0,
            total: 0,
            products: [],
            source: 'database',
            message: 'No products found in database',
            timestamp: new Date().toISOString()
          });
        }
        
        console.log(`ℹ️  [Rami Levy] No products in database, falling back to scraping`);
        
      } catch (dbError) {
        console.log(`⚠️  [Rami Levy] Database query failed, falling back to scraping:`, dbError.message);
      }
    } else if (!DatabaseService.connected) {
      console.log(`📦 [Rami Levy] Database not connected, using direct scraping mode`);
    }

    // Check cache for scraping results
    const cacheKey = `rami-levy-scrape-${search}-${productLimit}-${scrollLimit}-${requirePrice}`;
    const cached = cache.get(cacheKey);
    
    if (cached && !shouldForceRefresh && source !== 'database') {
      console.log('📦 [Rami Levy] Returning cached scraping results');
      return res.json({
        ...cached,
        cached: true
      });
    }

    // Perform scraping
    console.log(`🕷️  [Rami Levy] Starting web scraping...`);
    const scraper = new RamiLevyScraper();
    await scraper.init();
    
    try {
      let products = await scraper.scrape(search, null, scrollLimit);

      // Apply price filter if requested
      if (requirePrice) {
        products = products.filter(product => product.price && typeof product.price === 'number' && product.price > 0);
      }

      console.log(`📊 [Rami Levy] Scraped ${products.length} products`);

      // Save to database if connected
      if (DatabaseService.connected && products.length > 0) {
        try {
          console.log(`💾 [Rami Levy] Saving ${products.length} products to database...`);
          await DatabaseService.saveProducts(products, 'rami-levy');
          console.log(`✅ [Rami Levy] Successfully saved products to database`);
        } catch (saveError) {
          console.error(`❌ [Rami Levy] Failed to save to database:`, saveError.message);
          // Continue even if save fails
        }
      }

      // Apply limit after saving all to database
      const finalProducts = productLimit ? products.slice(0, productLimit) : products;

      const response = {
        success: true,
        store: 'Rami Levy',
        search: search,
        count: finalProducts.length,
        totalScraped: products.length,
        limit: productLimit || 'unlimited',
        maxScrolls: scrollLimit,
        priceFilter: requirePrice,
        products: finalProducts,
        source: 'scraping',
        savedToDatabase: DatabaseService.connected,
        cached: false,
        timestamp: new Date().toISOString()
      };

      // Cache the results
      cache.set(cacheKey, response);
      res.json(response);
      
    } finally {
      await scraper.close();
    }

  } catch (error) {
    console.error('❌ [Rami Levy] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

// Search for a specific product by barcode or name - DATABASE ONLY (no scraping)
router.get('/rami-levy/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { search } = req.query;
    
    // Use search term if provided, otherwise use barcode
    const searchTerm = search || barcode;
    
    console.log(`🔍 [Rami Levy] Database-only search for: ${searchTerm}`);
    
    // Check if database is connected
    if (!DatabaseService.connected) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected',
        message: 'Barcode search requires database connection. Please ensure MongoDB is running.',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check cache first
    const cacheKey = `rami-levy-barcode-${searchTerm}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('📦 [Rami Levy] Returning cached database result');
      return res.json({
        ...cached,
        cached: true
      });
    }
    
    // Search database only - NO SCRAPING
    try {
      const dbResult = await DatabaseService.getProducts('rami-levy', {
        search: searchTerm,
        limit: 10
      });

      const response = {
        success: true,
        store: 'Rami Levy',
        searchTerm,
        source: 'database',
        exactMatches: dbResult.products.length,
        products: dbResult.products,
        message: dbResult.products.length === 0 ? 
          'Product not found in database. Use the main products endpoint to populate database first.' : 
          undefined,
        cached: false,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      cache.set(cacheKey, response);

      if (dbResult.products.length > 0) {
        console.log(`✅ [Rami Levy] Found ${dbResult.products.length} products in database`);
      } else {
        console.log(`ℹ️  [Rami Levy] No products found in database for: ${searchTerm}`);
      }
      
      return res.json(response);

    } catch (dbError) {
      console.log(`❌ [Rami Levy] Database search failed:`, dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database search failed',
        details: dbError.message,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ [Rami Levy] Barcode search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

// Database management endpoints
router.get('/database/stats', async (req, res) => {
  try {
    const stats = await DatabaseService.getDatabaseStats();
    res.json({
      success: true,
      database: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear database collection for a store
router.delete('/:store/database', async (req, res) => {
  try {
    const { store } = req.params;
    
    if (!DatabaseService.connected) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    const deletedCount = await DatabaseService.clearCollection(store);
    
    res.json({
      success: true,
      message: `Cleared ${deletedCount} products from ${store} database`,
      deletedCount,
      store,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get products from database only (no scraping)
router.get('/:store/database/products', async (req, res) => {
  try {
    const { store } = req.params;
    const { 
      search, 
      category, 
      limit, 
      skip = 0,
      sortBy = 'scraped_at',
      sortOrder = -1
    } = req.query;
    
    if (!DatabaseService.connected) {
      return res.status(503).json({
        success: false,
        error: 'Database not connected'
      });
    }

    const result = await DatabaseService.getProducts(store, {
      search,
      category,
      limit: limit ? parseInt(limit) : null,
      skip: parseInt(skip),
      sortBy,
      sortOrder: parseInt(sortOrder)
    });

    res.json({
      success: true,
      store,
      source: 'database',
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;