const express = require('express');
const router = express.Router();
const RamiLevyScraper = require('../scrapers/RamiLevyScraper');
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
      forceRefresh = 'false'
    } = req.query;
    
    const productLimit = limit ? parseInt(limit) : null;
    const scrollLimit = maxScrolls ? parseInt(maxScrolls) : 50;
    const requirePrice = priceFilter === 'true';
    const shouldForceRefresh = forceRefresh === 'true';
    
    console.log(`🔄 [Rami Levy] Starting scrape...`);
    
    const cacheKey = `rami-levy-scrape-${search}-${productLimit}-${scrollLimit}-${requirePrice}`;
    const cached = cache.get(cacheKey);
    
    if (cached && !shouldForceRefresh) {
      console.log('📦 Returning cached results');
      return res.json({
        ...cached,
        cached: true
      });
    }

    // Direct scraping
    const scraper = new RamiLevyScraper();
    await scraper.init();
    
    try {
      let products = await scraper.scrape(search, null, scrollLimit);

      // Apply price filter if requested
      if (requirePrice) {
        products = products.filter(product => product.price && typeof product.price === 'number' && product.price > 0);
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
        cached: false,
        timestamp: new Date().toISOString()
      };

      cache.set(cacheKey, response);
      res.json(response);
      
    } finally {
      await scraper.close();
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

// Search for a specific product by barcode or name
router.get('/rami-levy/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { search } = req.query;
    
    // Use search term if provided, otherwise use barcode
    const searchTerm = search || barcode;
    
    console.log(`🔍 [Rami Levy] Searching for: ${searchTerm}`);
    
    const scraper = new RamiLevyScraper();
    await scraper.init();
    
    try {
      let products = await scraper.scrape(searchTerm, null, 10); // Small scroll limit for specific search

      // Filter for products with prices
      products = products.filter(product => product.price && typeof product.price === 'number' && product.price > 0);

      // Find exact matches first
      const exactMatches = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode === searchTerm)
      );

      res.json({
        success: true,
        store: 'Rami Levy',
        searchTerm,
        exactMatches: exactMatches.length,
        products: exactMatches.length > 0 ? exactMatches.slice(0, 10) : products.slice(0, 10),
        timestamp: new Date().toISOString()
      });

    } finally {
      await scraper.close();
    }

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;