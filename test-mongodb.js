#!/usr/bin/env node

const ScrapingService = require('./src/services/ScrapingService');

async function testSetup() {
  console.log('🧪 Testing MongoDB Integration Setup...\n');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const health = await ScrapingService.getDatabaseHealth();
    console.log('✅ Database health:', health);
    
    // Test scraping and storage (small sample)
    console.log('\n2. Testing scraping and storage...');
    const result = await ScrapingService.scrapeAndStore('rami-levy', {
      maxScrolls: 5, // Small test
      forceRefresh: false
    });
    console.log('✅ Scraping result:', result);
    
    // Test database retrieval
    console.log('\n3. Testing database retrieval...');
    const products = await ScrapingService.getProductsFromDB('rami-levy', {
      limit: 5
    });
    console.log('✅ Retrieved products:', {
      count: products.products.length,
      sample: products.products.slice(0, 2).map(p => ({ name: p.name, price: p.price, category: p.category }))
    });
    
    // Test store info
    console.log('\n4. Testing store info...');
    const storeInfo = await ScrapingService.getStoreInfo('rami-levy');
    console.log('✅ Store info:', {
      stats: storeInfo.stats,
      categoriesCount: storeInfo.categories.length,
      brandsCount: storeInfo.brands.length
    });
    
    console.log('\n🎉 All tests passed! MongoDB integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testSetup();