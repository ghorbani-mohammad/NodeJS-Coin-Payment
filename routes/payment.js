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
      checkStatus: 'POST /api/payment/check-status',
      checkStatusBoth: 'POST /api/payment/check-status-both',
      getStatus: 'GET /api/payment/status/:orderId',
      refreshStatus: 'POST /api/payment/refresh-status',
      debugInvoice: 'POST /api/payment/debug-invoice'
    }
  });
});

/**
 * Debug endpoint to test invoice retrieval and see raw API response
 * POST /api/payment/debug-invoice
 * Body: { "order_id": "sub_35_d854a873", "status": 0 }
 */
router.post('/debug-invoice', async (req, res) => {
  try {
    const { order_id, invoice_id, status } = req.body;

    if (!order_id && !invoice_id) {
      return res.status(400).json({
        error: 'Missing required parameter: order_id or invoice_id'
      });
    }

    console.log(`🐛 DEBUG: Testing invoice retrieval for order: ${order_id}, invoice: ${invoice_id}, status: ${status}`);

    // Test with different status values
    const testResults = {};
    
    // Test without status (original behavior)
    console.log('🐛 DEBUG: Testing without status parameter...');
    const noStatusResult = await payid19Service.getInvoices(order_id, invoice_id);
    testResults.no_status = {
      success: noStatusResult.success,
      hasData: !!noStatusResult.data,
      dataType: typeof noStatusResult.data,
      dataKeys: noStatusResult.data ? Object.keys(noStatusResult.data) : 'no data',
      message: noStatusResult.message,
      error: noStatusResult.error,
      data: noStatusResult.data
    };

    // Test with status = 0 (waiting payment)
    console.log('🐛 DEBUG: Testing with status = 0 (waiting payment)...');
    const status0Result = await payid19Service.getInvoices(order_id, invoice_id, 0);
    testResults.status_0 = {
      success: status0Result.success,
      hasData: !!status0Result.data,
      dataType: typeof status0Result.data,
      dataKeys: status0Result.data ? Object.keys(status0Result.data) : 'no data',
      message: status0Result.message,
      error: status0Result.error,
      data: status0Result.data
    };

    // Test with status = 1 (successful payment)
    console.log('🐛 DEBUG: Testing with status = 1 (successful payment)...');
    const status1Result = await payid19Service.getInvoices(order_id, invoice_id, 1);
    testResults.status_1 = {
      success: status1Result.success,
      hasData: !!status1Result.data,
      dataType: typeof status1Result.data,
      dataKeys: status1Result.data ? Object.keys(status1Result.data) : 'no data',
      message: status1Result.message,
      error: status1Result.error,
      data: status1Result.data
    };

    // If specific status was requested, also test that
    if (status !== undefined && status !== null && (status === 0 || status === 1)) {
      console.log(`🐛 DEBUG: Testing with requested status = ${status}...`);
      const specificResult = await payid19Service.getInvoices(order_id, invoice_id, status);
      testResults[`requested_status_${status}`] = {
        success: specificResult.success,
        hasData: !!specificResult.data,
        dataType: typeof specificResult.data,
        dataKeys: specificResult.data ? Object.keys(specificResult.data) : 'no data',
        message: specificResult.message,
        error: specificResult.error,
        data: specificResult.data
      };
    }

    console.log(`🐛 DEBUG: All tests completed`);

    // Return comprehensive debug information
    res.json({
      debug_info: {
        request_params: { order_id, invoice_id, status },
        test_results: testResults,
        timestamp: new Date().toISOString()
      },
      success: true,
      message: 'Debug tests completed',
      test_summary: {
        no_status_success: testResults.no_status.success,
        status_0_success: testResults.status_0.success,
        status_1_success: testResults.status_1.success,
        which_returned_data: Object.keys(testResults).filter(key => testResults[key].hasData)
      }
    });

  } catch (error) {
    console.error('🐛 DEBUG: Error in debug endpoint:', error);
    res.status(500).json({
      debug_info: {
        error_type: error.constructor.name,
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString()
      },
      success: false,
      error: error.message,
      message: 'Debug endpoint error'
    });
  }
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
 * Check payment status using the required format with numeric status codes
 * POST /api/payment/check-status
 * Body: { "order_id": "sub_35_d854a873" }
 * 
 * Returns format:
 * {
 *   "public_key": "C3tQQlbVmlBKuwW2QFhLMiiZl",
 *   "private_key": "6LLASjer3JEDlCwRABIOiRqXgUHPcmfDQpeBs77k", 
 *   "order_id": "sub_35_d854a873",
 *   "status": 1  // 1 = successful payment, 0 = waiting payment
 * }
 */
router.post('/check-status', async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        error: 'Missing required parameter: order_id'
      });
    }

    console.log(`🔍 Checking payment status for order: ${order_id}`);

    // Use the new checkPaymentStatus method from PayID19Service
    const result = await payid19Service.checkPaymentStatus(order_id);

    console.log(`📊 Payment status check result:`, {
      order_id: result.order_id,
      status: result.status,
      message: result.message
    });

    // Return the exact format requested
    res.json({
      public_key: result.public_key,
      private_key: result.private_key,
      order_id: result.order_id,
      status: result.status,
      message: result.message,
      invoice_data: result.invoice_data
    });

  } catch (error) {
    console.error('💥 Error checking payment status:', error);
    res.status(500).json({
      error: error.message,
      message: 'Internal server error while checking payment status'
    });
  }
});

/**
 * Check payment status by testing both status values (0 and 1)
 * POST /api/payment/check-status-both
 * Body: { "order_id": "sub_35_d854a873" }
 * 
 * This endpoint will test both status=0 and status=1 to determine the correct payment state
 */
router.post('/check-status-both', async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        error: 'Missing required parameter: order_id'
      });
    }

    console.log(`🔍 Checking payment status (both 0 and 1) for order: ${order_id}`);

    // Get the actual invoice data first
    const invoiceResult = await payid19Service.getInvoices(order_id);
    
    if (!invoiceResult.success) {
      console.log('❌ Failed to retrieve invoice details:', invoiceResult.error);
      return res.status(404).json({
        public_key: payid19Service.publicKey,
        private_key: payid19Service.privateKey,
        order_id: order_id,
        status: 0, // Default to waiting if we can't get invoice data
        message: 'Failed to retrieve invoice details',
        error: invoiceResult.error,
        test_results: {
          status_0: { tested: false, reason: 'Could not retrieve invoice data' },
          status_1: { tested: false, reason: 'Could not retrieve invoice data' }
        }
      });
    }

    // Handle both single invoice and array of invoices
    const invoices = Array.isArray(invoiceResult.data) ? invoiceResult.data : [invoiceResult.data];
    
    if (invoices.length === 0) {
      return res.status(404).json({
        public_key: payid19Service.publicKey,
        private_key: payid19Service.privateKey,
        order_id: order_id,
        status: 0,
        message: 'No invoices found for the provided order ID',
        test_results: {
          status_0: { tested: false, reason: 'No invoices found' },
          status_1: { tested: false, reason: 'No invoices found' }
        }
      });
    }

    const invoice = invoices[0];
    
    console.log('📊 Invoice data for testing:', {
      invoice_id: invoice.invoice_id || invoice.id,
      original_status: invoice.status,
      price_amount: invoice.price_amount,
      actually_paid: invoice.actually_paid,
      pay_amount: invoice.pay_amount
    });

    // Test results for both status values
    const testResults = {
      status_0: {
        tested: true,
        description: 'Waiting payment',
        conditions: []
      },
      status_1: {
        tested: true,
        description: 'Successful payment',
        conditions: []
      }
    };

    let finalStatus = 0; // Default to waiting
    let finalMessage = 'Payment waiting';
    let reasoning = [];

    // Check various conditions to determine the correct status
    if (invoice.status) {
      const status = invoice.status.toLowerCase();
      
      if (['finished', 'completed', 'complete', 'confirmed'].includes(status)) {
        finalStatus = 1;
        finalMessage = 'Payment successful';
        reasoning.push(`Invoice status is '${invoice.status}' which indicates completion`);
        testResults.status_1.conditions.push(`Invoice status: ${invoice.status} (completed)`);
        testResults.status_0.conditions.push(`Invoice status: ${invoice.status} (NOT waiting)`);
      }
      else if (['waiting', 'pending', 'new', 'created'].includes(status)) {
        finalStatus = 0;
        finalMessage = 'Payment waiting';
        reasoning.push(`Invoice status is '${invoice.status}' which indicates waiting`);
        testResults.status_0.conditions.push(`Invoice status: ${invoice.status} (waiting)`);
        testResults.status_1.conditions.push(`Invoice status: ${invoice.status} (NOT completed)`);
      }
      else if (['confirming', 'partially_paid'].includes(status)) {
        // Check payment amount for confirming status
        if (invoice.actually_paid && invoice.price_amount) {
          const expectedAmount = parseFloat(invoice.price_amount);
          const paidAmount = parseFloat(invoice.actually_paid);
          
          if (paidAmount >= expectedAmount * 0.95) {
            finalStatus = 1;
            finalMessage = 'Payment successful (confirmed by amount)';
            reasoning.push(`Status is '${invoice.status}' but payment amount ${paidAmount} >= ${expectedAmount * 0.95} indicates completion`);
            testResults.status_1.conditions.push(`Payment amount sufficient: ${paidAmount} >= ${expectedAmount * 0.95}`);
          } else {
            finalStatus = 0;
            finalMessage = 'Payment waiting (insufficient amount)';
            reasoning.push(`Status is '${invoice.status}' and payment amount ${paidAmount} < ${expectedAmount * 0.95} indicates still waiting`);
            testResults.status_0.conditions.push(`Payment amount insufficient: ${paidAmount} < ${expectedAmount * 0.95}`);
          }
        } else {
          finalStatus = 0;
          finalMessage = 'Payment waiting (confirming)';
          reasoning.push(`Status is '${invoice.status}' with no payment amount data indicates waiting`);
          testResults.status_0.conditions.push(`Status '${invoice.status}' with no payment data`);
        }
      }
      else {
        // Unknown status, check payment amounts
        if (invoice.actually_paid && invoice.price_amount) {
          const expectedAmount = parseFloat(invoice.price_amount);
          const paidAmount = parseFloat(invoice.actually_paid);
          
          if (paidAmount >= expectedAmount * 0.95) {
            finalStatus = 1;
            finalMessage = 'Payment successful (determined by amount)';
            reasoning.push(`Unknown status '${invoice.status}' but payment amount ${paidAmount} >= ${expectedAmount * 0.95} indicates completion`);
            testResults.status_1.conditions.push(`Payment amount sufficient despite unknown status: ${paidAmount} >= ${expectedAmount * 0.95}`);
          } else {
            finalStatus = 0;
            finalMessage = `Payment waiting (unknown status: ${invoice.status})`;
            reasoning.push(`Unknown status '${invoice.status}' and insufficient payment amount indicates waiting`);
            testResults.status_0.conditions.push(`Unknown status with insufficient payment: ${paidAmount} < ${expectedAmount * 0.95}`);
          }
        } else {
          finalStatus = 0;
          finalMessage = `Payment waiting (unknown status: ${invoice.status})`;
          reasoning.push(`Unknown status '${invoice.status}' with no payment data indicates waiting`);
          testResults.status_0.conditions.push(`Unknown status '${invoice.status}' with no payment data`);
        }
      }
    } else {
      // No status field, check payment amounts only
      if (invoice.actually_paid && invoice.price_amount) {
        const expectedAmount = parseFloat(invoice.price_amount);
        const paidAmount = parseFloat(invoice.actually_paid);
        
        if (paidAmount >= expectedAmount * 0.95) {
          finalStatus = 1;
          finalMessage = 'Payment successful (determined by amount)';
          reasoning.push(`No status field but payment amount ${paidAmount} >= ${expectedAmount * 0.95} indicates completion`);
          testResults.status_1.conditions.push(`Payment amount sufficient: ${paidAmount} >= ${expectedAmount * 0.95}`);
        } else if (paidAmount > 0) {
          finalStatus = 0;
          finalMessage = 'Payment waiting (partial amount received)';
          reasoning.push(`Partial payment received ${paidAmount} < ${expectedAmount * 0.95} indicates still waiting`);
          testResults.status_0.conditions.push(`Partial payment: ${paidAmount} < ${expectedAmount * 0.95}`);
        } else {
          finalStatus = 0;
          finalMessage = 'Payment waiting (no amount received)';
          reasoning.push(`No payment amount received indicates waiting`);
          testResults.status_0.conditions.push(`No payment amount received`);
        }
      } else {
        finalStatus = 0;
        finalMessage = 'Payment waiting (no payment data)';
        reasoning.push(`No status field and no payment data indicates waiting`);
        testResults.status_0.conditions.push(`No status field and no payment data`);
      }
    }

    // Mark which status is correct based on our analysis
    testResults.status_0.is_correct = (finalStatus === 0);
    testResults.status_1.is_correct = (finalStatus === 1);

    console.log(`✅ Payment status determined: ${finalStatus} (${finalMessage})`);
    console.log(`🔍 Reasoning: ${reasoning.join('; ')}`);

    res.json({
      public_key: payid19Service.publicKey,
      private_key: payid19Service.privateKey,
      order_id: order_id,
      status: finalStatus,
      message: finalMessage,
      reasoning: reasoning,
      test_results: testResults,
      invoice_data: {
        invoice_id: invoice.invoice_id || invoice.id,
        original_status: invoice.status,
        price_amount: invoice.price_amount,
        price_currency: invoice.price_currency,
        actually_paid: invoice.actually_paid,
        pay_amount: invoice.pay_amount,
        pay_currency: invoice.pay_currency,
        created_at: invoice.created_at,
        expires_at: invoice.expires_at
      }
    });

  } catch (error) {
    console.error('💥 Error checking payment status (both):', error);
    res.status(500).json({
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
