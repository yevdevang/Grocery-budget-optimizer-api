const NodeCache = require('node-cache');
const config = require('../config/config');

const cache = new NodeCache({ 
  stdTTL: config.cacheTTL,
  checkperiod: 600 
});

module.exports = cache;