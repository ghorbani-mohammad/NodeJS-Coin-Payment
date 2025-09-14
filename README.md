# NodeJS Coin Payment Service

A comprehensive NodeJS integration for PayID19.com cryptocurrency payment service. This project provides a complete solution for accepting cryptocurrency payments on your website.

## 🚀 Features

- **Complete PayID19 Integration**: Full API integration with PayID19.com
- **Invoice Management**: Create and manage cryptocurrency payment invoices
- **Webhook Handling**: Automatic payment status notifications
- **Multiple Cryptocurrencies**: Support for Bitcoin, Ethereum, and other cryptocurrencies
- **Withdrawal System**: Automated cryptocurrency withdrawals
- **Balance Tracking**: Real-time account balance monitoring
- **Express.js Server**: Production-ready web server
- **Security**: Built-in security features and signature verification
- **Error Handling**: Comprehensive error handling and logging

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PayID19.com account with API keys
- Domain with HTTPS support

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd NodeJS-Coin-Payment
npm install
```

### 2. Configuration

Create a `.env` file in the root directory:

```env
# PayID19 API Configuration
PAYID19_PUBLIC_KEY=your_public_key_here
PAYID19_PRIVATE_KEY=your_private_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Domain Configuration
DOMAIN_URL=https://coin-payment.m-gh.com

# Callback URLs (relative to DOMAIN_URL)
CALLBACK_URL=/api/payment/callback
SUCCESS_URL=/payment/success
CANCEL_URL=/payment/cancel

# Security
API_SECRET=your_api_secret_for_webhook_verification
```

### 3. Get PayID19 API Keys

1. Register at [PayID19.com](https://payid19.com)
2. Login to your account
3. Go to **Settings** page
4. Copy your `public_key` and `private_key`
5. Update your `.env` file with these keys

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Your server will be running at `http://localhost:3000`

## 📚 API Documentation

### Base URL
- Development: `http://localhost:3000`
- Production: `https://coin-payment.m-gh.com`

### Endpoints

#### 1. Create Payment Invoice
**POST** `/api/payment/create-invoice`

Create a new cryptocurrency payment invoice.

**Request Body:**
```json
{
  "priceAmount": 100,
  "priceCurrency": "USD",
  "orderId": "order_123",
  "orderDescription": "Purchase of digital goods",
  "customerEmail": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "orderId": "order_123",
    "invoiceId": "invoice_456",
    "paymentUrl": "https://payid19.com/invoice/...",
    "priceAmount": 100,
    "priceCurrency": "USD",
    "payAmount": 0.0025,
    "payCurrency": "BTC",
    "status": "waiting",
    "createdAt": "2023-12-01T10:00:00Z",
    "expiresAt": "2023-12-01T11:00:00Z"
  }
}
```

#### 2. Get Invoice Details
**GET** `/api/payment/invoices?orderId=order_123`

Retrieve invoice information by order ID or invoice ID.

**Query Parameters:**
- `orderId` (optional): Order identifier
- `invoiceId` (optional): Invoice identifier

#### 3. Get Account Balance
**GET** `/api/payment/balance`

Get current account balance for all supported cryptocurrencies.

#### 4. Get Supported Currencies
**GET** `/api/payment/currencies`

Get list of supported cryptocurrencies and their details.

#### 5. Create Withdrawal
**POST** `/api/payment/withdraw`

Create a cryptocurrency withdrawal request.

**Request Body:**
```json
{
  "currency": "BTC",
  "amount": 0.001,
  "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "tag": ""
}
```

#### 6. Get Withdrawal History
**GET** `/api/payment/withdraws?withdrawId=123`

Get withdrawal history and status.

### Webhook Endpoint

#### Payment Callback
**POST** `/api/webhook/callback`

This endpoint receives payment status updates from PayID19. It's automatically configured when creating invoices.

**Webhook Data:**
```json
{
  "order_id": "order_123",
  "invoice_id": "invoice_456",
  "status": "finished",
  "price_amount": 100,
  "price_currency": "USD",
  "pay_amount": 0.0025,
  "pay_currency": "BTC",
  "actually_paid": 0.0025,
  "actually_paid_at_fiat": 100.50,
  "purchase_id": "purchase_789"
}
```

## 🔧 Usage Examples

### Creating a Payment

```javascript
const axios = require('axios');

async function createPayment() {
  try {
    const response = await axios.post('http://localhost:3000/api/payment/create-invoice', {
      priceAmount: 50,
      priceCurrency: 'USD',
      orderId: 'my_order_123',
      orderDescription: 'Digital Product Purchase',
      customerEmail: 'customer@example.com'
    });

    console.log('Payment URL:', response.data.data.paymentUrl);
    
    // Redirect customer to payment URL
    window.location.href = response.data.data.paymentUrl;
    
  } catch (error) {
    console.error('Error creating payment:', error);
  }
}
```

### Checking Payment Status

```javascript
async function checkPaymentStatus(orderId) {
  try {
    const response = await axios.get(`http://localhost:3000/api/payment/invoices?orderId=${orderId}`);
    
    const invoice = response.data.data[0];
    console.log('Payment Status:', invoice.status);
    
    return invoice.status;
    
  } catch (error) {
    console.error('Error checking status:', error);
  }
}
```

## 🔐 Security Features

- **Signature Verification**: Webhook signatures are verified using HMAC-SHA256
- **HTTPS Only**: Production environment requires HTTPS
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: Built-in protection against abuse
- **CORS Configuration**: Proper CORS setup for web applications

## 📊 Payment Status Flow

1. **waiting** - Invoice created, waiting for payment
2. **confirming** - Payment received, confirming on blockchain
3. **confirmed** - Payment confirmed on blockchain
4. **sending** - Payment is being processed
5. **partially_paid** - Partial payment received
6. **finished** - Payment completed successfully
7. **failed** - Payment failed
8. **refunded** - Payment was refunded
9. **expired** - Payment invoice expired

## 🛠️ Customization

### Adding Custom Payment Logic

Edit `routes/webhook.js` to add your custom payment processing logic:

```javascript
async function handleFinishedPayment(data) {
  console.log(`🎉 Payment finished for order ${data.order_id}`);
  
  // Add your custom logic here:
  // - Update database
  // - Send confirmation email
  // - Trigger order fulfillment
  // - Update inventory
  
  // Example:
  await updateOrderInDatabase(data.order_id, 'completed', data);
  await sendConfirmationEmail(data.customer_email, data);
  await triggerOrderFulfillment(data.order_id);
}
```

### Environment Configuration

The application supports different configurations for different environments:

- **Development**: `NODE_ENV=development`
- **Production**: `NODE_ENV=production`

## 📝 Logging

The application includes comprehensive logging:

- Payment creation and status updates
- Webhook notifications
- Error tracking
- API requests and responses

Logs are output to console with emojis for easy identification:
- 🚀 Server startup
- 💳 Payment creation
- 📨 Webhook received
- ✅ Success operations
- ❌ Error operations
- 🔄 Processing operations

## 🚀 Deployment

### Production Deployment

1. **Set Environment Variables**:
   ```bash
   export NODE_ENV=production
   export PAYID19_PUBLIC_KEY=your_production_public_key
   export PAYID19_PRIVATE_KEY=your_production_private_key
   export DOMAIN_URL=https://coin-payment.m-gh.com
   ```

2. **Install Dependencies**:
   ```bash
   npm install --production
   ```

3. **Start the Server**:
   ```bash
   npm start
   ```

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start server.js --name "coin-payment"
pm2 startup
pm2 save
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 Troubleshooting

### Common Issues

1. **Invalid API Keys**
   - Verify your PayID19 API keys in the `.env` file
   - Ensure keys are from the correct environment (sandbox/production)

2. **Webhook Not Receiving**
   - Check your domain URL configuration
   - Ensure your server is accessible from the internet
   - Verify HTTPS is working properly

3. **Payment Not Processing**
   - Check the webhook logs for error messages
   - Verify the payment status using the API
   - Ensure your callback URL is properly configured

### Debug Mode

Enable debug mode by setting:
```bash
NODE_ENV=development
```

This will provide detailed logging and error messages.
