const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const PayID19Service = require('../services/PayID19Service');
const config = require('../config');

const router = express.Router();
const payid19Service = new PayID19Service();

/**
 * Webhook endpoint for PayID19 payment notifications
 * This endpoint receives payment status updates from PayID19
 */
router.post('/callback', async (req, res) => {
  try {
    
    console.log('📨 Webhook received:', {
      timestamp: new Date().toISOString(),
      body: req.body,
      headers: req.headers
    });

    const callbackData = req.body;
    
    // Validate required fields
    if (!callbackData.order_id) {
      console.error('❌ Invalid webhook data: missing order_id');
      return res.status(400).json({
        error: 'Invalid webhook data',
        message: 'Missing required field: order_id'
      });
    }

    // Use 'id' field as invoice_id if invoice_id is not present
    const invoiceId = callbackData.invoice_id || callbackData.id;
    if (!invoiceId) {
      console.error('❌ Invalid webhook data: missing invoice_id or id');
      return res.status(400).json({
        error: 'Invalid webhook data',
        message: 'Missing required field: invoice_id or id'
      });
    }

    // Add invoice_id to callbackData for consistency
    callbackData.invoice_id = invoiceId;

    // Verify the private key from webhook data - MANDATORY for security
    if (!callbackData.privatekey) {
      console.error('❌ Missing privatekey in webhook data - rejecting request for security');
      return res.status(401).json({
        error: 'Missing private key',
        message: 'Private key is required in webhook data for security verification'
      });
    }

    // Get client IP address for logging
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    // Verify the private key matches our configured private key
    const isValidPrivateKey = payid19Service.verifyPrivateKey(callbackData.privatekey);
    if (!isValidPrivateKey) {
      console.error('❌ Invalid private key in webhook data - potential security threat');
      console.error('🔍 Private key verification details:', {
        receivedPrivateKey: callbackData.privatekey.substring(0, 8) + '...',
        orderId: callbackData.order_id,
        timestamp: new Date().toISOString(),
        ipAddress: clientIP
      });
      return res.status(401).json({
        error: 'Invalid private key',
        message: 'Private key verification failed'
      });
    }
    
    console.log('✅ Webhook private key verified successfully');
    // Process the payment notification
    // await processPaymentNotification(callbackData);

    // POST https://social.m-gh.com/api/v1/user/payments/webhook/
    const response = await axios.post('https://social.m-gh.com/api/v1/user/payments/webhook/', callbackData);
    console.log('🔄 Webhook response:', response.data);

    // Respond to PayID19 to acknowledge receipt
    res.status(200).json({
      status: 'success',
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process webhook'
    });
  }
});

/**
 * Process payment notification based on status
 * @param {Object} callbackData - Payment notification data from PayID19
 */
async function processPaymentNotification(callbackData) {
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
    actually_paid_at_fiat,
    purchase_id,
    outcome_amount,
    outcome_currency,
    created_at,
    expiration_date
  } = callbackData;

  // PayID19 might not send status directly in webhook, so we need to determine it
  let paymentStatus = status;
  
  // If status is undefined, try to determine status from available data or fetch from API
  if (!paymentStatus) {
    console.log('🔍 Status field not found in webhook, attempting to determine status...');
    
    // Try to fetch current invoice status from PayID19 API
    try {
      const invoiceResult = await payid19Service.getInvoices(order_id, invoice_id);
      if (invoiceResult.success && invoiceResult.data) {
        // Handle both single invoice and array of invoices
        const invoiceData = Array.isArray(invoiceResult.data) ? invoiceResult.data[0] : invoiceResult.data;
        if (invoiceData && invoiceData.status) {
          paymentStatus = invoiceData.status;
          console.log(`✅ Retrieved status from API: ${paymentStatus}`);
          
          // Update callbackData with additional info from API
          Object.assign(callbackData, {
            status: paymentStatus,
            pay_amount: invoiceData.pay_amount || amount,
            pay_currency: invoiceData.pay_currency || amount_currency,
            actually_paid: invoiceData.actually_paid,
            actually_paid_at_fiat: invoiceData.actually_paid_at_fiat
          });
        }
      }
    } catch (apiError) {
      console.error('❌ Failed to fetch status from API:', apiError.message);
    }
    
    // If still no status, try to infer from webhook data
    if (!paymentStatus) {
      console.log('🤔 Attempting to infer status from webhook data...');
      
      // Check if payment has been made (has amount and currency)
      if (amount && amount_currency) {
        const expectedAmount = parseFloat(price_amount);
        const receivedAmount = parseFloat(amount);
        
        console.log(`💰 Payment analysis: Expected ${expectedAmount} ${price_currency}, Received ${receivedAmount} ${amount_currency}`);
        
        // If payment amount meets or exceeds expected amount (with tolerance), consider it finished
        if (receivedAmount >= expectedAmount * 0.95) {
          paymentStatus = 'finished';
          console.log('💡 Inferred status as "finished" - payment amount sufficient');
        } else if (receivedAmount > 0) {
          paymentStatus = 'confirming';
          console.log('💡 Inferred status as "confirming" - partial payment detected');
        } else {
          paymentStatus = 'waiting';
          console.log('💡 Inferred status as "waiting" - no payment amount');
        }
      } else {
        // No payment amount, likely waiting for payment
        paymentStatus = 'waiting';
        console.log('💡 Inferred status as "waiting" - no payment amount detected');
      }
      
      // Update callbackData with inferred status and normalized amounts
      callbackData.status = paymentStatus;
      callbackData.pay_amount = amount;
      callbackData.pay_currency = amount_currency;
    }
  }

  console.log(`🔄 Processing payment notification for order ${order_id}:`, {
    invoice_id,
    status: paymentStatus,
    price_amount,
    price_currency,
    pay_amount: callbackData.pay_amount,
    pay_currency: callbackData.pay_currency,
    inferred: !status // indicate if status was inferred
  });
}


module.exports = router;
