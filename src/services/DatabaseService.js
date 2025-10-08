const mongoose = require('mongoose');
const config = require('../config/config');

class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  async connect() {
    try {
      console.log('🔄 Connecting to MongoDB...');
      
      this.connection = await mongoose.connect(config.mongoUrl, {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4 // Use IPv4, skip trying IPv6
      });

      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');
      console.log(`📍 Database: ${mongoose.connection.name}`);
      
      // Log connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('📡 MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('👋 MongoDB disconnected');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error.message);
    }
  }

  async saveProducts(products, storeName) {
    try {
      if (!products || products.length === 0) {
        console.log('⚠️  No products to save');
        return { saved: 0, errors: 0 };
      }

      const { getStoreModel } = require('../models/Product');
      const ProductModel = getStoreModel(storeName);
      
      // Clear existing data for this store
      console.log(`🗑️  Clearing existing ${storeName} products...`);
      await ProductModel.deleteMany({});
      console.log(`✅ Cleared existing ${storeName} products`);

      // Prepare products for saving (Hebrew as-is)
      console.log(`🔄 Preparing ${products.length} products for saving...`);
      const processedProducts = products.map(product => ({
        name: product.name, // Keep Hebrew name as-is
        price: product.price,
        store: storeName,
        category: product.category, // Keep Hebrew category as-is
        barcode: product.barcode,
        image_url: product.imageUrl || product.image_url, // Handle both field names
        in_stock: product.in_stock !== undefined ? product.in_stock : true,
        scraped_at: new Date()
      }));

      // Remove duplicates by name (case-insensitive and trim whitespace)
      console.log(`🔍 Removing duplicates from ${processedProducts.length} products...`);
      const seenNames = new Set();
      const uniqueProducts = processedProducts.filter(product => {
        const normalizedName = product.name ? product.name.trim().toLowerCase() : '';
        if (!normalizedName || seenNames.has(normalizedName)) {
          return false; // Skip duplicates or products without names
        }
        seenNames.add(normalizedName);
        return true;
      });

      const duplicateCount = processedProducts.length - uniqueProducts.length;
      if (duplicateCount > 0) {
        console.log(`� Removed ${duplicateCount} duplicate products`);
      }
      console.log(`✅ Final unique products: ${uniqueProducts.length}`);

      // Save all unique products at once
      console.log(`💾 Saving ${uniqueProducts.length} unique products to ${storeName}...`);
      const savedProducts = await ProductModel.insertMany(uniqueProducts, { 
        ordered: false, // Continue on error
        lean: true // Better performance
      });

      console.log(`✅ Successfully saved ${savedProducts.length} products to ${storeName}`);
      return { 
        saved: savedProducts.length, 
        duplicatesRemoved: duplicateCount,
        errors: uniqueProducts.length - savedProducts.length,
        totalScraped: products.length,
        totalUnique: uniqueProducts.length
      };

    } catch (error) {
      console.error('❌ Error saving products:', error);
      throw error;
    }
  }

  async getProducts(store, options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const { getStoreModel } = require('../models/Product');
      const StoreModel = getStoreModel(store);
      
      const {
        search,
        category,
        limit = null,
        skip = 0,
        sortBy = 'scraped_at',
        sortOrder = -1,
        inStock = null
      } = options;

      // Build query
      let query = { store: store.toLowerCase() };
      
      if (search) {
        // Enhanced search to support both Hebrew and English, plus barcode
        query.$or = [
          { 'name-HE': { $regex: search, $options: 'i' } },
          { 'name-EN': { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }, // Backward compatibility
          { brand: { $regex: search, $options: 'i' } },
          { 'brand-HE': { $regex: search, $options: 'i' } },
          { 'brand-EN': { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { barcode: search } // Exact barcode match (string)
        ];
      }
      
      if (category) {
        // Enhanced category search to support both Hebrew and English
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { 'category-HE': { $regex: category, $options: 'i' } },
            { 'category-EN': { $regex: category, $options: 'i' } },
            { category: { $regex: category, $options: 'i' } } // Backward compatibility
          ]
        });
      }
      
      if (inStock !== null) {
        query.in_stock = inStock;
      }

      // Execute query with sorting and pagination
      let query_builder = StoreModel
        .find(query)
        .sort({ [sortBy]: sortOrder });
      
      if (limit) {
        query_builder = query_builder.limit(parseInt(limit));
      }
      
      const products = await query_builder
        .skip(parseInt(skip))
        .lean(); // Return plain objects for better performance

      const total = await StoreModel.countDocuments(query);
      
      console.log(`📊 Retrieved ${products.length}/${total} products from ${store}`);
      
      return {
        products,
        total,
        hasMore: limit ? (skip + products.length) < total : false,
        pagination: limit ? {
          current: Math.floor(skip / limit) + 1,
          pages: Math.ceil(total / limit),
          limit,
          skip
        } : null
      };
      
    } catch (error) {
      console.error(`❌ Error retrieving products from ${store}:`, error.message);
      throw error;
    }
  }

  async getDatabaseStats() {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const { RamiLevyProduct, VictoryProduct, ShufersalProduct } = require('../models/Product');
      
      const stats = {
        connected: true,
        database: mongoose.connection.name,
        collections: {
          'ramilevi-products': await RamiLevyProduct.countDocuments(),
          'victory-products': await VictoryProduct.countDocuments(),
          'shufersal-products': await ShufersalProduct.countDocuments()
        }
      };

      stats.totalProducts = Object.values(stats.collections).reduce((sum, count) => sum + count, 0);
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting database stats:', error.message);
      return { connected: false, error: error.message };
    }
  }

  async clearCollection(store) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const { getStoreModel } = require('../models/Product');
      const StoreModel = getStoreModel(store);
      
      const result = await StoreModel.deleteMany({});
      console.log(`🧹 Cleared ${result.deletedCount} products from ${store} collection`);
      
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ Error clearing ${store} collection:`, error.message);
      throw error;
    }
  }

  get connected() {
    return this.isConnected;
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;