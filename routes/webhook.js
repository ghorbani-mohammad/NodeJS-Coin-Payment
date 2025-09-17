const express = require('express');
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
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type')
      }
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

    // Verify the callback signature if provided
    const signature = req.get('X-Payid19-Signature') || req.get('signature');
    if (signature) {
      const isValid = payid19Service.verifyCallback(callbackData, signature);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed'
        });
      }
      console.log('✅ Webhook signature verified');
    }

    // Process the payment notification
    await processPaymentNotification(callbackData);

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

  switch (paymentStatus) {
    case 'waiting':
      await handleWaitingPayment(callbackData);
      break;
    
    case 'confirming':
      await handleConfirmingPayment(callbackData);
      break;
    
    case 'confirmed':
      await handleConfirmedPayment(callbackData);
      break;
    
    case 'sending':
      await handleSendingPayment(callbackData);
      break;
    
    case 'partially_paid':
      await handlePartiallyPaidPayment(callbackData);
      break;
    
    case 'finished':
    case 'completed':
    case 'complete':
      await handleFinishedPayment(callbackData);
      break;
    
    case 'failed':
      await handleFailedPayment(callbackData);
      break;
    
    case 'refunded':
      await handleRefundedPayment(callbackData);
      break;
    
    case 'expired':
      await handleExpiredPayment(callbackData);
      break;
    
    default:
      console.warn(`⚠️ Unknown payment status: ${paymentStatus}`);
      await handleUnknownStatus(callbackData);
  }
}

/**
 * Handle waiting payment status
 */
async function handleWaitingPayment(data) {
  console.log(`⏳ Payment waiting for order ${data.order_id}`);
  
  // TODO: Update your database with waiting status
  // Example: await updateOrderStatus(data.order_id, 'waiting', data);
  
  // You can implement custom logic here, such as:
  // - Send email notification to customer
  // - Update order status in database
  // - Log the event
}

/**
 * Handle confirming payment status
 */
async function handleConfirmingPayment(data) {
  console.log(`🔄 Payment confirming for order ${data.order_id}`);
  console.log(`   Expected: ${data.price_amount} ${data.price_currency}`);
  console.log(`   Received: ${data.pay_amount || data.amount} ${data.pay_currency || data.amount_currency}`);
  
  // Check if payment appears to be complete based on amount received
  const expectedAmount = parseFloat(data.price_amount);
  const receivedAmount = parseFloat(data.pay_amount || data.amount || 0);
  
  if (receivedAmount > 0 && receivedAmount >= expectedAmount * 0.95) { // Allow 5% tolerance for fees
    console.log(`✅ Payment amount sufficient (${receivedAmount} >= ${expectedAmount * 0.95}), treating as finished`);
    await handleFinishedPayment(data);
    return;
  }
  
  // TODO: Update your database with confirming status
  // Example: await updateOrderStatus(data.order_id, 'confirming', data);
  
  // You can implement custom logic here, such as:
  // - Send confirmation email to customer
  // - Update order status in database
  // - Log the confirmation event
}

/**
 * Handle confirmed payment status
 */
async function handleConfirmedPayment(data) {
  console.log(`✅ Payment confirmed for order ${data.order_id}`);
  
  // TODO: Update your database with confirmed status
  // Example: await updateOrderStatus(data.order_id, 'confirmed', data);
  
  // You can implement custom logic here, such as:
  // - Send confirmation email
  // - Trigger order fulfillment
  // - Update inventory
}

/**
 * Handle sending payment status
 */
async function handleSendingPayment(data) {
  console.log(`📤 Payment sending for order ${data.order_id}`);
  
  // TODO: Update your database with sending status
  // Example: await updateOrderStatus(data.order_id, 'sending', data);
}

/**
 * Handle partially paid payment status
 */
async function handlePartiallyPaidPayment(data) {
  console.log(`💰 Payment partially paid for order ${data.order_id}`);
  console.log(`   Expected: ${data.price_amount} ${data.price_currency}`);
  console.log(`   Received: ${data.actually_paid} ${data.pay_currency}`);
  
  // TODO: Handle partial payment logic
  // Example: await handlePartialPayment(data.order_id, data);
  
  // You might want to:
  // - Request additional payment
  // - Accept partial payment and adjust order
  // - Send notification to customer
}

/**
 * Handle finished payment status
 */
async function handleFinishedPayment(data) {
  console.log(`🎉 Payment finished for order ${data.order_id}`);
  console.log(`   Amount: ${data.actually_paid} ${data.pay_currency}`);
  console.log(`   Fiat equivalent: ${data.actually_paid_at_fiat} ${data.price_currency}`);
  
  // TODO: Complete the order process
  // Example: await completeOrder(data.order_id, data);
  
  // This is where you would:
  // - Mark order as completed
  // - Send receipt to customer
  // - Trigger product delivery
  // - Update analytics
}

/**
 * Handle failed payment status
 */
async function handleFailedPayment(data) {
  console.log(`❌ Payment failed for order ${data.order_id}`);
  
  // TODO: Handle failed payment
  // Example: await handleFailedPayment(data.order_id, data);
  
  // You might want to:
  // - Send failure notification
  // - Offer alternative payment methods
  // - Log for analysis
}

/**
 * Handle refunded payment status
 */
async function handleRefundedPayment(data) {
  console.log(`💸 Payment refunded for order ${data.order_id}`);
  
  // TODO: Process refund
  // Example: await processRefund(data.order_id, data);
  
  // Handle refund logic:
  // - Update order status
  // - Send refund confirmation
  // - Reverse inventory changes
}

/**
 * Handle expired payment status
 */
async function handleExpiredPayment(data) {
  console.log(`⏰ Payment expired for order ${data.order_id}`);
  
  // TODO: Handle expired payment
  // Example: await handleExpiredPayment(data.order_id, data);
  
  // You might want to:
  // - Cancel the order
  // - Send expiration notification
  // - Release reserved inventory
}

/**
 * Handle unknown payment status
 */
async function handleUnknownStatus(data) {
  console.log(`❓ Unknown payment status for order ${data.order_id}:`, data.status);
  console.log('📋 Full webhook data for investigation:', JSON.stringify(data, null, 2));
  
  // Try to fetch current status from API as a fallback
  try {
    console.log('🔄 Attempting to fetch current invoice status from API...');
    const invoiceResult = await payid19Service.getInvoices(data.order_id, data.invoice_id);
    
    if (invoiceResult.success && invoiceResult.data) {
      const invoiceData = Array.isArray(invoiceResult.data) ? invoiceResult.data[0] : invoiceResult.data;
      console.log('📊 Current invoice data from API:', JSON.stringify(invoiceData, null, 2));
      
      if (invoiceData && invoiceData.status) {
        console.log(`🔄 Re-processing with API status: ${invoiceData.status}`);
        // Update data with API information and reprocess
        const updatedData = { ...data, ...invoiceData };
        await processPaymentNotification(updatedData);
        return;
      }
    }
  } catch (error) {
    console.error('❌ Failed to fetch status from API in unknown status handler:', error.message);
  }
  
  // If we still can't determine status, assume it's waiting for payment
  console.log('💡 Defaulting to "waiting" status for unknown status');
  await handleWaitingPayment(data);
}

// Test webhook endpoint for development
router.post('/test', async (req, res) => {
  console.log('🧪 Test webhook received:', req.body);
  
  // If no body provided, simulate the webhook data from your logs
  const testData = req.body && Object.keys(req.body).length > 0 ? req.body : {
    id: 237727,
    user_id: 2957,
    email: 'aali361@gmail.com',
    merchant_id: null,
    order_id: 'sub_21_a7594de2',
    customer_id: null,
    price_amount: '2.00000000',
    price_currency: 'USD',
    amount: '1.80000000',
    amount_currency: 'USDT',
    add_fee_to_price: null,
    title: '',
    description: '',
    ref_url: 'https://job-board.m-gh.com/',
    cancel_url: 'https://coin-payment.m-gh.com/payment/cancel?return_url=https%3A%2F%2Fjob-board.m-gh.com%2Fpayment%2Fcancelled',
    success_url: 'https://coin-payment.m-gh.com/payment/success?return_url=https%3A%2F%2Fjob-board.m-gh.com%2Fpayment%2Fsuccess',
    callback_url: 'https://coin-payment.m-gh.com/api/webhook/callback',
    ip: '217.142.21.58',
    test: null,
    created_at: '2025-09-17 12:58:09',
    expiration_date: '2025-09-19 12:58:09',
    privatekey: '6LLASjer3JEDlCwRABIOiRqXgUHPcmfDQpeBs77k'
  };
  
  try {
    console.log('🧪 Processing test webhook data...');
    await processPaymentNotification(testData);
    
    res.json({
      status: 'success',
      message: 'Test webhook processed successfully',
      data: testData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🧪 Test webhook processing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test webhook processing failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
