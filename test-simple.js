const RamiLevyScraper = require('./src/scrapers/RamiLevyScraper');

async function simpleTest() {
  console.log('🧪 Starting simple scraper test...');
  
  try {
    const scraper = new RamiLevyScraper();
    
    // Test with search term - should be faster
    console.log('Testing with search term "לחם"...');
    const products = await scraper.scrape('לחם', 5, 3); // 5 products max, 3 scrolls max
    
    console.log(`\n✅ Found ${products.length} products`);
    
    if (products.length > 0) {
      console.log('\n📦 Sample products:');
      products.slice(0, 3).forEach((product, i) => {
        console.log(`${i + 1}. ${product.name || 'No name'} - ${product.price || 'No price'}`);
        if (product.text) {
          console.log(`   Text: ${product.text.substring(0, 50)}...`);
        }
      });
    } else {
      console.log('❌ No products found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

simpleTest();