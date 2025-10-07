const mongoose = require('mongoose');

// Product schema that will be used for all store collections
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    index: true // Index for faster searches
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  store: { 
    type: String, 
    required: true,
    enum: ['rami-levy', 'victory', 'shufersal'],
    index: true
  },
  category: {
    type: String,
    index: true
  },
  brand: String,
  barcode: {
    type: String,
    index: true,
    sparse: true // Allow null values but index non-null ones
  },
  url: String,
  image_url: String,
  in_stock: { 
    type: Boolean, 
    default: true,
    index: true
  },
  scraped_at: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  },
  // Additional metadata
  description: String,
  unit: String, // e.g., "kg", "liter", "piece"
  weight: Number,
  original_price: Number, // For sale tracking
  is_on_sale: { 
    type: Boolean, 
    default: false 
  },
  sale_end_date: Date
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  collection: function() {
    // Dynamic collection name based on store
    return `${this.store}-products`;
  }
});

// Create indexes for better performance
productSchema.index({ name: 'text', brand: 'text', description: 'text' }); // Text search
productSchema.index({ store: 1, category: 1 }); // Compound index for categories
productSchema.index({ store: 1, price: 1 }); // Price sorting
productSchema.index({ scraped_at: -1 }); // Recent products first
productSchema.index({ unique_id: 1 }, { unique: true, sparse: true }); // Unique constraint

// Store-specific models
const RamiLevyProduct = mongoose.model('RamiLevi-products', productSchema, 'ramilevi-products');
const VictoryProduct = mongoose.model('Victory-products', productSchema, 'victory-products');
const ShufersalProduct = mongoose.model('Shufersal-products', productSchema, 'shufersal-products');

// Helper function to get the right model based on store
function getStoreModel(store) {
  switch (store.toLowerCase()) {
    case 'rami-levy':
    case 'ramilevi':
      return RamiLevyProduct;
    case 'victory':
      return VictoryProduct;
    case 'shufersal':
      return ShufersalProduct;
    default:
      throw new Error(`Unknown store: ${store}`);
  }
}

module.exports = {
  RamiLevyProduct,
  VictoryProduct,
  ShufersalProduct,
  getStoreModel,
  productSchema
};