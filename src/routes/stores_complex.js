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

// Get Rami Levy products (Fast response from memory!)
router.get('/rami-levy/products', async (req, res) => {
  try {
    const { 
      search = '', 
      category = '',
      limit = 50, 
      page = 1,
      sortBy = 'name',
      sortOrder = 'asc',
      priceMin,
      priceMax,
      priceFilter = 'true'
    } = req.query;
    
    const requirePrice = priceFilter === 'true';
    
    // Get products from memory (super fast!)
    const result = BackgroundScrapingService.getProducts('rami-levy', {
      search,
      category,
      limit: parseInt(limit),
      page: parseInt(page),
      sortBy,
      sortOrder,
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      requirePrice
    });
    
    if (!result.success) {
      return res.status(503).json({
        success: false,
        error: result.error,
        message: 'Products are being loaded in the background. Please try again in a few moments.',
        retryAfter: 30 // seconds
      });
    }

    res.json({
      success: true,
      store: 'Rami Levy',
      search,
      category,
      count: result.products.length,
      products: result.products,
      pagination: result.pagination,
      fromMemory: true,
      lastUpdate: result.lastUpdate,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

// Force refresh products (trigger immediate background scraping)
router.post('/rami-levy/refresh', async (req, res) => {
  try {
    console.log('🔄 [Rami Levy] Force refresh requested');
    
    // Trigger immediate scraping
    const result = await BackgroundScrapingService.forceScraping('rami-levy');
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to refresh products'
      });
    }

    res.json({
      success: true,
      message: 'Products refreshed successfully',
      stats: result.stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

// Get scraping info and statistics
router.get('/rami-levy/info', async (req, res) => {
  try {
    const stats = BackgroundScrapingService.getStats('rami-levy');
    const categories = BackgroundScrapingService.getCategories('rami-levy');
    
    res.json({
      success: true,
      store: 'Rami Levy',
      stats,
      categories: categories.success ? categories.categories : [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Info error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

// Search for a specific product by barcode or name (fast search)
router.get('/rami-levy/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { search } = req.query;
    
    // Use search term if provided, otherwise use barcode
    const searchTerm = search || barcode;
    
    console.log(`🔍 [Rami Levy] Searching for: ${searchTerm}`);
    
    // Get from memory with specific search
    const result = BackgroundScrapingService.getProducts('rami-levy', {
      search: searchTerm,
      limit: 10, // Small limit for specific search
      page: 1,
      requirePrice: true
    });
    
    if (!result.success) {
      return res.status(503).json({
        success: false,
        error: result.error,
        message: 'Products are being loaded in the background. Please try again in a few moments.'
      });
    }

    // Find exact matches first
    const exactMatches = result.products.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode === searchTerm)
    );

    res.json({
      success: true,
      store: 'Rami Levy',
      searchTerm,
      exactMatches: exactMatches.length,
      products: exactMatches.length > 0 ? exactMatches : result.products,
      fromMemory: true,
      lastUpdate: result.lastUpdate,
      timestamp: new Date().toISOString()
    });

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