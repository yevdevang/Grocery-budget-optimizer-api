require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  cacheTTL: process.env.CACHE_TTL || 3600,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/supermarket-api',
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security'
    ]
  },
  stores: {
    ramiLevy: {
      name: 'Rami Levy',
      url: 'https://www.rami-levy.co.il',
      enabled: true
    },
    shufersal: {
      name: 'Shufersal',
      url: 'https://www.shufersal.co.il',
      enabled: false
    }
  }
};