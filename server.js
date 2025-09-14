const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config');

// Import routes
const paymentRoutes = require('./routes/payment');
const webhookRoutes = require('./routes/webhook');

const app = express();
const PORT = config.server.port;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [config.domain.url] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/payment', paymentRoutes);
app.use('/api/webhook', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    domain: config.domain.url
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NodeJS Coin Payment Service',
    description: 'PayID19.com integration for cryptocurrency payments',
    domain: config.domain.url,
    endpoints: {
      health: '/health',
      createInvoice: '/api/payment/create-invoice',
      getInvoices: '/api/payment/invoices',
      getBalance: '/api/payment/balance',
      getCurrencies: '/api/payment/currencies',
      webhook: '/api/webhook/callback'
    }
  });
});

// Payment success page
app.get('/payment/success', (req, res) => {
  const { order_id, invoice_id, status } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .success { color: #28a745; }
        .container { background: #f8f9fa; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="success">✅ Payment Successful!</h1>
        <p>Your cryptocurrency payment has been processed successfully.</p>
        <div class="details">
          <p><strong>Order ID:</strong> ${order_id || 'N/A'}</p>
          <p><strong>Invoice ID:</strong> ${invoice_id || 'N/A'}</p>
          <p><strong>Status:</strong> ${status || 'Completed'}</p>
        </div>
        <p>Thank you for your payment!</p>
      </div>
    </body>
    </html>
  `);
});

// Payment cancel page
app.get('/payment/cancel', (req, res) => {
  const { order_id, invoice_id } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .cancel { color: #dc3545; }
        .container { background: #f8f9fa; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="cancel">❌ Payment Cancelled</h1>
        <p>Your payment has been cancelled.</p>
        <div class="details">
          <p><strong>Order ID:</strong> ${order_id || 'N/A'}</p>
          <p><strong>Invoice ID:</strong> ${invoice_id || 'N/A'}</p>
        </div>
        <p>You can try again or contact support if you need assistance.</p>
        <a href="/" class="btn">Return to Home</a>
      </div>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 NodeJS Coin Payment Service running on port ${PORT}`);
  console.log(`🌐 Domain: ${config.domain.url}`);
  console.log(`📊 Environment: ${config.server.nodeEnv}`);
  console.log(`💰 PayID19 API: ${config.payid19.apiUrl}`);
  
  if (config.server.nodeEnv === 'development') {
    console.log(`\n📋 Available endpoints:`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log(`   API Docs: http://localhost:${PORT}/`);
    console.log(`   Create Invoice: POST http://localhost:${PORT}/api/payment/create-invoice`);
    console.log(`   Webhook: POST http://localhost:${PORT}/api/webhook/callback`);
  }
});

module.exports = app;
