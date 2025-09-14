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
    if (!callbackData.order_id || !callbackData.invoice_id) {
      console.error('❌ Invalid webhook data: missing required fields');
      return res.status(400).json({
        error: 'Invalid webhook data',
        message: 'Missing required fields: order_id, invoice_id'
      });
    }

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
    actually_paid,
    actually_paid_at_fiat,
    purchase_id,
    outcome_amount,
    outcome_currency
  } = callbackData;

  console.log(`🔄 Processing payment notification for order ${order_id}:`, {
    invoice_id,
    status,
    price_amount,
    price_currency,
    pay_amount,
    pay_currency
  });

  switch (status) {
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
      console.warn(`⚠️ Unknown payment status: ${status}`);
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
  
  // TODO: Update your database with confirming status
  // Example: await updateOrderStatus(data.order_id, 'confirming', data);
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
  
  // TODO: Log unknown status for investigation
  // Example: await logUnknownStatus(data.order_id, data);
}

// Test webhook endpoint for development
router.post('/test', (req, res) => {
  console.log('🧪 Test webhook received:', req.body);
  res.json({
    status: 'success',
    message: 'Test webhook received',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
