const express = require('express');
const { v4: uuidv4 } = require('uuid');
const PayID19Service = require('../services/PayID19Service');
const { urlValidation } = require('../utils/validation');

const router = express.Router();
const payid19Service = new PayID19Service();

/**
 * Create a new payment invoice
 * POST /api/payment/create-invoice
 */
router.post('/create-invoice', async (req, res) => {
  try {
    console.log('💳 Creating invoice for order raw body:', req.body);
    const {
      priceAmount,
      priceCurrency = 'USD',
      orderId,
      orderDescription,
      customerEmail,
      successUrl,
      failureUrl,
      cancelUrl
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

    // Validate URL formats if provided
    const successUrlError = urlValidation(successUrl, 'successUrl');
    const failureUrlError = urlValidation(failureUrl, 'failureUrl');
    const cancelUrlError = urlValidation(cancelUrl, 'cancelUrl');

    if (successUrlError || failureUrlError || cancelUrlError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: successUrlError || failureUrlError || cancelUrlError
      });
    }

    // Generate order ID if not provided
    const finalOrderId = orderId || `order_${uuidv4()}`;

    console.log(`💳 Creating invoice for order ${finalOrderId}:`, {
      priceAmount,
      priceCurrency,
      orderDescription,
      customerEmail: customerEmail ? '***@***.***' : 'not provided',
      successUrl: successUrl || 'default',
      failureUrl: failureUrl || 'default',
      cancelUrl: cancelUrl || 'default'
    });

    // Create invoice using PayID19 service
    console.log(`🔄 Calling PayID19Service.createInvoice() for order ${finalOrderId}`);
    const result = await payid19Service.createInvoice({
      priceAmount,
      priceCurrency,
      orderId: finalOrderId,
      orderDescription: orderDescription || `Payment for order ${finalOrderId}`,
      customerEmail,
      successUrl,
      failureUrl,
      cancelUrl
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

      res.status(400).json({
        success: false,
        error: 'Invoice Creation Failed',
        message: result.message,
        details: result.error,
        debug: result.debug,
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

    const result = await payid19Service.getInvoices(orderId, invoiceId);

    // Return the simple status format
    res.json({
      status: result.status || 'waiting'
    });

  } catch (error) {
    res.status(500).json({
      status: 'waiting'
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
    }
  });
});


module.exports = router;
