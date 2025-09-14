require('dotenv').config();

module.exports = {
  // PayID19 API Configuration
  payid19: {
    publicKey: process.env.PAYID19_PUBLIC_KEY || 'your_public_key_here',
    privateKey: process.env.PAYID19_PRIVATE_KEY || 'your_private_key_here',
    apiUrl: 'https://payid19.com/api/v1'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Domain Configuration
  domain: {
    url: process.env.DOMAIN_URL || 'https://coin-payment.m-gh.com'
  },

  // Callback URLs
  callbacks: {
    callback: process.env.CALLBACK_URL || '/api/payment/callback',
    success: process.env.SUCCESS_URL || '/payment/success',
    cancel: process.env.CANCEL_URL || '/payment/cancel'
  },

  // Security
  security: {
    apiSecret: process.env.API_SECRET || 'your_api_secret_for_webhook_verification'
  }
};
