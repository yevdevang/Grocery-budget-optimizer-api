const mongoose = require('mongoose');
const config = require('./src/config/config');

// Product schema for testing
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  store: { type: String, required: true },
  category: String,
  brand: String,
  scraped_at: { type: Date, default: Date.now },
  url: String,
  image_url: String,
  in_stock: { type: Boolean, default: true }
});

// Define separate models for each store collection
const RamiLevyProduct = mongoose.model('RamiLevi-products', productSchema);
const VictoryProduct = mongoose.model('Victory-products', productSchema);
const ShufersalProduct = mongoose.model('Shufersal-products', productSchema);

async function setupTestData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.mongoUrl);
    console.log('✅ Connected to MongoDB');

    // Drop all existing collections to start fresh
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.length > 0) {
      console.log('🧹 Removing previous collections...');
      for (const collection of collections) {
        await mongoose.connection.db.dropCollection(collection.name);
        console.log(`   ❌ Dropped: ${collection.name}`);
      }
    }

    console.log('\n🏪 Creating store-specific collections with test data...');

    // Create RamiLevi-products collection
    const ramiLevyProducts = [
      {
        name: 'חלב תנובה 3%',
        price: 5.90,
        store: 'rami-levy',
        category: 'dairy',
        brand: 'תנובה',
        url: 'https://www.rami-levy.co.il/product/123',
        in_stock: true
      },
      {
        name: 'לחם כפרי',
        price: 8.50,
        store: 'rami-levy',
        category: 'bakery',
        brand: 'אנג׳ל',
        url: 'https://www.rami-levy.co.il/product/456',
        in_stock: true
      },
      {
        name: 'תפוחים אדומים',
        price: 12.90,
        store: 'rami-levy',
        category: 'fruits',
        brand: 'ישראלי',
        url: 'https://www.rami-levy.co.il/product/789',
        in_stock: true
      }
    ];

    // Create Victory-products collection
    const victoryProducts = [
      {
        name: 'גבינה צהובה',
        price: 22.90,
        store: 'victory',
        category: 'dairy',
        brand: 'תנובה',
        url: 'https://www.victory.co.il/product/111',
        in_stock: true
      },
      {
        name: 'בננות',
        price: 8.90,
        store: 'victory',
        category: 'fruits',
        brand: 'מקומי',
        url: 'https://www.victory.co.il/product/222',
        in_stock: true
      }
    ];

    // Create Shufersal-products collection
    const shufersalProducts = [
      {
        name: 'יוגורט יופלה',
        price: 6.50,
        store: 'shufersal',
        category: 'dairy',
        brand: 'יופלה',
        url: 'https://www.shufersal.co.il/product/333',
        in_stock: false
      },
      {
        name: 'עגבניות שרי',
        price: 15.90,
        store: 'shufersal',
        category: 'vegetables',
        brand: 'מקומי',
        url: 'https://www.shufersal.co.il/product/444',
        in_stock: true
      },
      {
        name: 'פסטה ברילה',
        price: 7.20,
        store: 'shufersal',
        category: 'pantry',
        brand: 'ברילא',
        url: 'https://www.shufersal.co.il/product/555',
        in_stock: true
      }
    ];

    // Insert data into each collection
    const ramiLevyInserted = await RamiLevyProduct.insertMany(ramiLevyProducts);
    console.log(`✅ RamiLevi-products: ${ramiLevyInserted.length} products`);

    const victoryInserted = await VictoryProduct.insertMany(victoryProducts);
    console.log(`✅ Victory-products: ${victoryInserted.length} products`);

    const shufersalInserted = await ShufersalProduct.insertMany(shufersalProducts);
    console.log(`✅ Shufersal-products: ${shufersalInserted.length} products`);

    // Display collection statistics
    console.log('\n📊 Collection Statistics:');
    console.log(`🏪 RamiLevi-products: ${await RamiLevyProduct.countDocuments()} items`);
    console.log(`🏪 Victory-products: ${await VictoryProduct.countDocuments()} items`);
    console.log(`🏪 Shufersal-products: ${await ShufersalProduct.countDocuments()} items`);

    const totalProducts = await RamiLevyProduct.countDocuments() + 
                         await VictoryProduct.countDocuments() + 
                         await ShufersalProduct.countDocuments();
    console.log(`\n📈 Total products across all stores: ${totalProducts}`);

    console.log('\n🎯 MongoDB MCP Connection String for VS Code:');
    console.log(`mongodb://localhost:27017/supermarket-api`);
    console.log('\n✨ Collections created successfully for MongoDB MCP testing!');

  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  setupTestData();
}

module.exports = { RamiLevyProduct, VictoryProduct, ShufersalProduct, setupTestData };