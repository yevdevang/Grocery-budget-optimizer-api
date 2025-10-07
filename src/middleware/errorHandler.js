const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;