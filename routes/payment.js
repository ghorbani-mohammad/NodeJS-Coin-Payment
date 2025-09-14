const express = require('express');
const { v4: uuidv4 } = require('uuid');
const PayID19Service = require('../services/PayID19Service');

const router = express.Router();
const payid19Service = new PayID19Service();

/**
 * Create a new payment invoice
 * POST /api/payment/create-invoice
 */
router.post('/create-invoice', async (req, res) => {
  try {
    const {
      priceAmount,
      priceCurrency = 'USD',
      orderId,
      orderDescription,
      customerEmail
    } = req.body;

    // Validate required fields
    if (!priceAmount) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'priceAmount is required'
      });
    }

    if (priceAmount <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'priceAmount must be greater than 0'
      });
    }

    // Generate order ID if not provided
    const finalOrderId = orderId || `order_${uuidv4()}`;

    console.log(`💳 Creating invoice for order ${finalOrderId}:`, {
      priceAmount,
      priceCurrency,
      orderDescription,
      customerEmail: customerEmail ? '***@***.***' : 'not provided'
    });

    // Create invoice using PayID19 service
    console.log(`🔄 Calling PayID19Service.createInvoice() for order ${finalOrderId}`);
    const result = await payid19Service.createInvoice({
      priceAmount,
      priceCurrency,
      orderId: finalOrderId,
      orderDescription: orderDescription || `Payment for order ${finalOrderId}`,
      customerEmail
    });

    console.log(`📊 PayID19Service.createInvoice() result for order ${finalOrderId}:`);
    console.log('  - Success:', result.success);
    console.log('  - Message:', result.message);
    console.log('  - Error:', result.error);
    if (result.debug) {
      console.log('  - Debug info:', result.debug);
    }
    if (result.data) {
      console.log('  - Data keys:', Object.keys(result.data));
    }

    if (result.success) {
      console.log(`✅ Invoice created successfully for order ${finalOrderId}`);
      res.json({
        success: true,
        message: 'Invoice created successfully',
        data: {
          orderId: finalOrderId,
          invoiceId: result.data.invoice_id,
          paymentUrl: result.data.invoice_url,
          priceAmount: result.data.price_amount,
          priceCurrency: result.data.price_currency,
          payAmount: result.data.pay_amount || null,
          payCurrency: result.data.pay_currency || null,
          status: result.data.status,
          createdAt: result.data.created_at,
          expiresAt: result.data.expires_at
        }
      });
    } else {
      console.error(`❌ Failed to create invoice for order ${finalOrderId}:`);
      console.error('  - Error details:', result.error);
      console.error('  - Message:', result.message);
      if (result.debug) {
        console.error('  - Debug information:', JSON.stringify(result.debug, null, 2));
      }
      
      // Determine if the error is a URL (which seems to be the case based on your logs)
      const errorMessage = result.error;
      const isUrl = typeof errorMessage === 'string' && (
        errorMessage.startsWith('http://') || 
        errorMessage.startsWith('https://') ||
        errorMessage.includes('payid19.com')
      );
      
      if (isUrl) {
        console.error('🚨 WARNING: Error appears to be a URL instead of an error message!');
        console.error('  - This suggests the API is returning a URL in the error field');
        console.error('  - URL:', errorMessage);
      }
      
      res.status(400).json({
        success: false,
        error: 'Invoice Creation Failed',
        message: result.message,
        details: result.error,
        debug: result.debug,
        isUrlError: isUrl
      });
    }

  } catch (error) {
    console.error('💥 Error creating invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create invoice'
    });
  }
});

/**
 * Get invoice details
 * GET /api/payment/invoices?orderId=xxx&invoiceId=xxx
 */
router.get('/invoices', async (req, res) => {
  try {
    const { orderId, invoiceId } = req.query;

    console.log('📋 Retrieving invoices:', { orderId, invoiceId });

    const result = await payid19Service.getInvoices(orderId, invoiceId);

    if (result.success) {
      console.log('✅ Invoices retrieved successfully');
      res.json({
        success: true,
        message: 'Invoices retrieved successfully',
        data: result.data
      });
    } else {
      console.error('❌ Failed to retrieve invoices:', result.error);
      res.status(400).json({
        success: false,
        error: 'Retrieval Failed',
        message: result.message,
        details: result.error
      });
    }

  } catch (error) {
    console.error('💥 Error retrieving invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve invoices'
    });
  }
});

/**
 * Get account balance
 * GET /api/payment/balance
 */
router.get('/balance', async (req, res) => {
  try {
    console.log('💰 Retrieving account balance');

    const result = await payid19Service.getBalance();

    if (result.success) {
      console.log('✅ Balance retrieved successfully');
      res.json({
        success: true,
        message: 'Balance retrieved successfully',
        data: result.data
      });
    } else {
      console.error('❌ Failed to retrieve balance:', result.error);
      res.status(400).json({
        success: false,
        error: 'Retrieval Failed',
        message: result.message,
        details: result.error
      });
    }

  } catch (error) {
    console.error('💥 Error retrieving balance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve balance'
    });
  }
});

/**
 * Get supported currencies
 * GET /api/payment/currencies
 */
router.get('/currencies', async (req, res) => {
  try {
    console.log('💱 Retrieving supported currencies');

    const result = await payid19Service.getCurrencies();

    if (result.success) {
      console.log('✅ Currencies retrieved successfully');
      res.json({
        success: true,
        message: 'Currencies retrieved successfully',
        data: result.data
      });
    } else {
      console.error('❌ Failed to retrieve currencies:', result.error);
      res.status(400).json({
        success: false,
        error: 'Retrieval Failed',
        message: result.message,
        details: result.error
      });
    }

  } catch (error) {
    console.error('💥 Error retrieving currencies:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve currencies'
    });
  }
});

/**
 * Create a withdrawal request
 * POST /api/payment/withdraw
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { currency, amount, address, tag } = req.body;

    // Validate required fields
    if (!currency || !amount || !address) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'currency, amount, and address are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'amount must be greater than 0'
      });
    }

    console.log(`💸 Creating withdrawal:`, {
      currency: currency.toUpperCase(),
      amount,
      address: `${address.substring(0, 10)}...${address.substring(address.length - 10)}`,
      tag: tag || 'none'
    });

    const result = await payid19Service.createWithdraw({
      currency,
      amount,
      address,
      tag
    });

    if (result.success) {
      console.log('✅ Withdrawal created successfully');
      res.json({
        success: true,
        message: 'Withdrawal created successfully',
        data: result.data
      });
    } else {
      console.error('❌ Failed to create withdrawal:', result.error);
      res.status(400).json({
        success: false,
        error: 'Withdrawal Failed',
        message: result.message,
        details: result.error
      });
    }

  } catch (error) {
    console.error('💥 Error creating withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create withdrawal'
    });
  }
});

/**
 * Get withdrawal history
 * GET /api/payment/withdraws?withdrawId=xxx
 */
router.get('/withdraws', async (req, res) => {
  try {
    const { withdrawId } = req.query;

    console.log('📋 Retrieving withdrawals:', { withdrawId });

    const result = await payid19Service.getWithdraws(withdrawId);

    if (result.success) {
      console.log('✅ Withdrawals retrieved successfully');
      res.json({
        success: true,
        message: 'Withdrawals retrieved successfully',
        data: result.data
      });
    } else {
      console.error('❌ Failed to retrieve withdrawals:', result.error);
      res.status(400).json({
        success: false,
        error: 'Retrieval Failed',
        message: result.message,
        details: result.error
      });
    }

  } catch (error) {
    console.error('💥 Error retrieving withdrawals:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve withdrawals'
    });
  }
});

/**
 * Health check for payment service
 * GET /api/payment/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'PayID19 Payment Service',
    timestamp: new Date().toISOString(),
    endpoints: {
      createInvoice: 'POST /api/payment/create-invoice',
      getInvoices: 'GET /api/payment/invoices',
      getBalance: 'GET /api/payment/balance',
      getCurrencies: 'GET /api/payment/currencies',
      createWithdraw: 'POST /api/payment/withdraw',
      getWithdraws: 'GET /api/payment/withdraws'
    }
  });
});

module.exports = router;
