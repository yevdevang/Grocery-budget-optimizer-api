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

// Search for a specific product by barcode or name - MongoDB integrated
router.get('/rami-levy/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { search, source = 'auto' } = req.query;
    
    // Use search term if provided, otherwise use barcode
    const searchTerm = search || barcode;
    
    console.log(`🔍 [Rami Levy] Searching for: ${searchTerm}, source: ${source}`);
    
    // Try database first
    if (source !== 'scrape' && DatabaseService.connected) {
      try {
        const dbResult = await DatabaseService.getProducts('rami-levy', {
          search: searchTerm,
          limit: 10
        });

        if (dbResult.products.length > 0) {
          console.log(`✅ [Rami Levy] Found ${dbResult.products.length} products in database`);
          
          return res.json({
            success: true,
            store: 'Rami Levy',
            searchTerm,
            source: 'database',
            exactMatches: dbResult.products.length,
            products: dbResult.products,
            timestamp: new Date().toISOString()
          });
        }
      } catch (dbError) {
        console.log(`⚠️  [Rami Levy] Database search failed:`, dbError.message);
      }
    }
    
    // Fall back to scraping
    console.log(`🕷️  [Rami Levy] Scraping for: ${searchTerm}`);
    const scraper = new RamiLevyScraper();
    await scraper.init();
    
    try {
      let products = await scraper.scrape(searchTerm, null, 10); // Small scroll limit for specific search

      // Filter for products with prices
      products = products.filter(product => product.price && typeof product.price === 'number' && product.price > 0);

      // Save to database if connected
      if (DatabaseService.connected && products.length > 0) {
        try {
          await DatabaseService.saveProducts(products, 'rami-levy');
          console.log(`✅ [Rami Levy] Saved search results to database`);
        } catch (saveError) {
          console.error(`❌ [Rami Levy] Failed to save search results:`, saveError.message);
        }
      }

      // Find exact matches first
      const exactMatches = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode === searchTerm)
      );

      res.json({
        success: true,
        store: 'Rami Levy',
        searchTerm,
        source: 'scraping',
        exactMatches: exactMatches.length,
        products: exactMatches.length > 0 ? exactMatches.slice(0, 10) : products.slice(0, 10),
        savedToDatabase: DatabaseService.connected,
        timestamp: new Date().toISOString()
      });

    } finally {
      await scraper.close();
    }

  } catch (error) {
    console.error('❌ [Rami Levy] Search error:', error);
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