const express = require('express');
const router = express.Router();
const cache = require('../utils/cache');

// Clear cache
router.post('/clear', (req, res) => {
  cache.flushAll();
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
});

// Get cache stats
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: cache.getStats()
  });
});

// Get cache keys
router.get('/keys', (req, res) => {
  res.json({
    success: true,
    keys: cache.keys()
  });
});

module.exports = router;