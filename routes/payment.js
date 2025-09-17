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
    const urlValidation = (url, fieldName) => {
      if (url) {
        try {
          new URL(url);
        } catch (error) {
          return `${fieldName} must be a valid URL`;
        }
      }
      return null;
    };

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

/**
 * Check the status of a specific invoice by querying PayID19 API
 * GET /api/payment/status/:orderId
 * GET /api/payment/status?order_id=xxx&invoice_id=xxx
 */
router.get('/status/:orderId?', async (req, res) => {
  try {
    const orderId = req.params.orderId || req.query.order_id;
    const invoiceId = req.query.invoice_id;

    if (!orderId && !invoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: order_id or invoice_id'
      });
    }

    console.log(`🔍 Checking payment status for order: ${orderId}, invoice: ${invoiceId}`);

    // Query PayID19 API for current invoice status
    const result = await payid19Service.getInvoices(orderId, invoiceId);

    if (!result.success) {
      console.error('❌ Failed to retrieve invoice status:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to retrieve invoice status'
      });
    }

    // Handle both single invoice and array of invoices
    const invoices = Array.isArray(result.data) ? result.data : [result.data];
    
    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        message: 'No invoices found for the provided parameters'
      });
    }

    // Process each invoice and determine status
    const processedInvoices = invoices.map(invoice => {
      const {
        invoice_id,
        order_id,
        status,
        price_amount,
        price_currency,
        pay_amount,
        pay_currency,
        actually_paid,
        actually_paid_at_fiat,
        created_at,
        expires_at,
        invoice_url
      } = invoice;

      // Determine if payment is complete
      let isComplete = false;
      let completionReason = '';

      if (status) {
        isComplete = ['finished', 'completed', 'complete', 'confirmed'].includes(status.toLowerCase());
        completionReason = isComplete ? `Status: ${status}` : `Status: ${status} (not complete)`;
      } else if (actually_paid && price_amount) {
        // Check if payment amount is sufficient
        const expectedAmount = parseFloat(price_amount);
        const paidAmount = parseFloat(actually_paid);
        isComplete = paidAmount >= expectedAmount * 0.95; // 95% tolerance
        completionReason = isComplete 
          ? `Payment sufficient: ${paidAmount} >= ${expectedAmount * 0.95}`
          : `Payment insufficient: ${paidAmount} < ${expectedAmount * 0.95}`;
      }

      return {
        invoice_id,
        order_id,
        status,
        price_amount,
        price_currency,
        pay_amount,
        pay_currency,
        actually_paid,
        actually_paid_at_fiat,
        created_at,
        expires_at,
        invoice_url,
        is_complete: isComplete,
        completion_reason: completionReason,
        raw_data: invoice // Include raw data for debugging
      };
    });

    console.log(`📊 Invoice status check results:`, {
      order_id: orderId,
      invoice_id: invoiceId,
      found_invoices: processedInvoices.length,
      completed_invoices: processedInvoices.filter(inv => inv.is_complete).length
    });

    // If checking a specific invoice, return just that one
    const responseData = invoices.length === 1 ? processedInvoices[0] : processedInvoices;

    res.json({
      success: true,
      data: responseData,
      message: `Found ${invoices.length} invoice(s)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error checking payment status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Internal server error while checking payment status'
    });
  }
});

/**
 * Force refresh status for a specific invoice
 * POST /api/payment/refresh-status
 * Body: { order_id: "xxx", invoice_id: "xxx" }
 */
router.post('/refresh-status', async (req, res) => {
  try {
    const { order_id, invoice_id } = req.body;

    if (!order_id && !invoice_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: order_id or invoice_id'
      });
    }

    console.log(`🔄 Force refreshing status for order: ${order_id}, invoice: ${invoice_id}`);

    // Get current status from PayID19
    const result = await payid19Service.getInvoices(order_id, invoice_id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to refresh invoice status'
      });
    }

    const invoices = Array.isArray(result.data) ? result.data : [result.data];
    
    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    // Process each invoice through webhook logic
    const processedResults = [];
    
    for (const invoice of invoices) {
      console.log(`🔄 Processing invoice ${invoice.invoice_id || invoice.id} through webhook logic...`);
      
      // Simulate webhook processing with API data
      const webhookData = {
        id: invoice.invoice_id || invoice.id,
        invoice_id: invoice.invoice_id || invoice.id,
        order_id: invoice.order_id,
        status: invoice.status,
        price_amount: invoice.price_amount,
        price_currency: invoice.price_currency,
        pay_amount: invoice.pay_amount,
        pay_currency: invoice.pay_currency,
        amount: invoice.pay_amount,
        amount_currency: invoice.pay_currency,
        actually_paid: invoice.actually_paid,
        actually_paid_at_fiat: invoice.actually_paid_at_fiat,
        created_at: invoice.created_at,
        expiration_date: invoice.expires_at
      };

      // Import the webhook processing function
      const webhook = require('./webhook');
      
      // Process through webhook logic (this will trigger appropriate handlers)
      try {
        // We need to call the processPaymentNotification function
        // Since it's not exported, we'll recreate the logic here
        await processInvoiceStatus(webhookData);
        
        processedResults.push({
          invoice_id: webhookData.invoice_id,
          order_id: webhookData.order_id,
          status: webhookData.status,
          processed: true,
          message: 'Status refreshed and processed through webhook logic'
        });
      } catch (processingError) {
        console.error(`❌ Error processing invoice ${webhookData.invoice_id}:`, processingError);
        processedResults.push({
          invoice_id: webhookData.invoice_id,
          order_id: webhookData.order_id,
          status: webhookData.status,
          processed: false,
          error: processingError.message
        });
      }
    }

    res.json({
      success: true,
      data: processedResults,
      message: `Refreshed status for ${invoices.length} invoice(s)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error refreshing payment status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Internal server error while refreshing payment status'
    });
  }
});

/**
 * Process invoice status (similar to webhook processing)
 * @param {Object} invoiceData - Invoice data from API
 */
async function processInvoiceStatus(invoiceData) {
  const {
    order_id,
    invoice_id,
    status,
    price_amount,
    price_currency,
    pay_amount,
    pay_currency,
    amount,
    amount_currency,
    actually_paid,
    actually_paid_at_fiat
  } = invoiceData;

  console.log(`🔄 Processing invoice status for order ${order_id}:`, {
    invoice_id,
    status,
    price_amount,
    price_currency,
    pay_amount: pay_amount || amount,
    pay_currency: pay_currency || amount_currency,
    actually_paid
  });

  // Determine final status
  let finalStatus = status;
  
  if (!finalStatus && actually_paid && price_amount) {
    const expectedAmount = parseFloat(price_amount);
    const paidAmount = parseFloat(actually_paid);
    
    if (paidAmount >= expectedAmount * 0.95) {
      finalStatus = 'finished';
      console.log(`✅ Payment complete: ${paidAmount} >= ${expectedAmount * 0.95}`);
    } else if (paidAmount > 0) {
      finalStatus = 'confirming';
      console.log(`🔄 Payment partial: ${paidAmount} < ${expectedAmount * 0.95}`);
    } else {
      finalStatus = 'waiting';
      console.log(`⏳ No payment detected`);
    }
  }

  // Handle the status
  switch (finalStatus) {
    case 'finished':
    case 'completed':
    case 'complete':
      console.log(`🎉 Payment finished for order ${order_id}`);
      console.log(`   Amount: ${actually_paid || pay_amount || amount} ${pay_currency || amount_currency}`);
      console.log(`   Fiat equivalent: ${actually_paid_at_fiat} ${price_currency}`);
      
      // TODO: Complete the order process
      // Example: await completeOrder(order_id, invoiceData);
      break;
      
    case 'confirmed':
      console.log(`✅ Payment confirmed for order ${order_id}`);
      // TODO: Update order status
      break;
      
    case 'confirming':
      console.log(`🔄 Payment confirming for order ${order_id}`);
      // TODO: Update order status
      break;
      
    case 'waiting':
      console.log(`⏳ Payment waiting for order ${order_id}`);
      // TODO: Update order status
      break;
      
    default:
      console.warn(`⚠️ Unknown payment status for order ${order_id}: ${finalStatus}`);
  }

  return { status: finalStatus, processed: true };
}

module.exports = router;
