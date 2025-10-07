const express = require('express');
const config = require('./config/config');
const storesRouter = require('./routes/stores');
const cacheRouter = require('./routes/cache');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString() 
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Supermarket API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      stores: 'GET /api/stores',
      products: 'GET /api/stores/:store/products',
      barcode: 'GET /api/stores/:store/products/:barcode',
      cache: {
        stats: 'GET /api/cache/stats',
        clear: 'POST /api/cache/clear',
        keys: 'GET /api/cache/keys'
      }
    }
  });
});

app.use('/api/stores', storesRouter);
app.use('/api/cache', cacheRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error Handler
app.use(errorHandler);

// Start Server
const PORT = config.port;

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log('╔════════════════════════════════════════╗');
      console.log('║   🛒 Supermarket API Server           ║');
      console.log('╚════════════════════════════════════════╝');
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📦 Cache TTL: ${config.cacheTTL}s`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);

      
      console.log('\n📚 Available Endpoints:');
      console.log(`   GET  http://localhost:${PORT}/`);
      console.log(`   GET  http://localhost:${PORT}/health`);
      console.log(`   GET  http://localhost:${PORT}/api/stores`);
      console.log(`   GET  http://localhost:${PORT}/api/stores/rami-levy/products`);
      console.log(`   GET  http://localhost:${PORT}/api/stores/rami-levy/products?search=חלב`);
      console.log(`   GET  http://localhost:${PORT}/api/stores/rami-levy/products?search=חלב&limit=50`);

      
      console.log(`   POST http://localhost:${PORT}/api/cache/clear`);
      console.log(`   GET  http://localhost:${PORT}/api/cache/stats`);
      console.log('\n✅ Server is ready!\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

startServer();