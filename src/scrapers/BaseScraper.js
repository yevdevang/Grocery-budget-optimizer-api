const puppeteer = require('puppeteer');
const config = require('../config/config');

class BaseScraper {
  constructor(storeName, baseUrl) {
    this.storeName = storeName;
    this.baseUrl = baseUrl;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch(config.puppeteer);
    this.page = await this.browser.newPage();
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanPrice(priceString) {
    if (!priceString) return null;
    const cleaned = priceString.replace(/[^\d.]/g, '');
    return cleaned ? parseFloat(cleaned) : null;
  }

  async scrape(searchTerm, limit) {
    throw new Error('scrape() must be implemented by subclass');
  }
}

module.exports = BaseScraper;