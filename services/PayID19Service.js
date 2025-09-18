const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Add axios interceptors for detailed logging
axios.interceptors.request.use(
  (config) => {
    console.log('🌐 HTTP Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      headers: config.headers,
      timeout: config.timeout,
      data: config.data ? JSON.stringify(config.data, null, 2) : 'no data'
    });
    return config;
  },
  (error) => {
    console.error('💥 Request interceptor error:', error);
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    console.log('📥 HTTP Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: JSON.stringify(response.data, null, 2)
    });
    return response;
  },
  (error) => {
    console.error('💥 Response interceptor error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'no data',
      config: {
        method: error.config?.method,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      }
    });
    return Promise.reject(error);
  }
);

class PayID19Service {
  constructor() {
    console.log('🏗️ Initializing PayID19Service...');
    
    this.apiUrl = config.payid19.apiUrl;
    this.publicKey = config.payid19.publicKey;
    this.privateKey = config.payid19.privateKey;
    this.domainUrl = config.domain.url;
    
    // Validate configuration on startup
    console.log('🔍 Configuration validation:');
    console.log('  - API URL:', this.apiUrl);
    console.log('  - Public Key:', this.publicKey ? `${this.publicKey.substring(0, 8)}...` : 'NOT SET');
    console.log('  - Private Key:', this.privateKey ? `${this.privateKey.substring(0, 8)}...` : 'NOT SET');
    console.log('  - Domain URL:', this.domainUrl);
    
    // Check for default/placeholder values
    const issues = [];
    if (!this.publicKey || this.publicKey === 'your_public_key_here') {
      issues.push('Public key not properly configured');
    }
    if (!this.privateKey || this.privateKey === 'your_private_key_here') {
      issues.push('Private key not properly configured');
    }
    if (!this.apiUrl || this.apiUrl.includes('your_')) {
      issues.push('API URL not properly configured');
    }
    if (!this.domainUrl || this.domainUrl.includes('your_')) {
      issues.push('Domain URL not properly configured');
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Configuration issues detected:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
    } else {
      console.log('✅ Configuration validation passed');
    }
    
    console.log('📋 Callback URLs:');
    console.log('  - Callback:', `${this.domainUrl}${config.callbacks.callback}`);
    console.log('  - Success:', `${this.domainUrl}${config.callbacks.success}`);
    console.log('  - Cancel:', `${this.domainUrl}${config.callbacks.cancel}`);
  }

  /**
   * Create a new invoice for cryptocurrency payment
   * @param {Object} invoiceData - Invoice details
   * @param {number} invoiceData.priceAmount - Amount in specified currency
   * @param {string} invoiceData.priceCurrency - Currency code (USD, EUR, etc.)
   * @param {string} invoiceData.orderId - Unique order identifier
   * @param {string} invoiceData.orderDescription - Description of the order
   * @param {string} invoiceData.customerEmail - Customer email (optional)
   * @param {string} invoiceData.successUrl - Custom success page URL (optional)
   * @param {string} invoiceData.failureUrl - Custom failure page URL (optional)
   * @param {string} invoiceData.cancelUrl - Custom cancel page URL (optional)
   * @returns {Promise<Object>} Invoice creation response
   */
  async createInvoice(invoiceData) {
    try {
      console.log('🔧 PayID19Service.createInvoice() - Starting invoice creation');
      console.log('📋 Input data:', {
        priceAmount: invoiceData.priceAmount,
        priceCurrency: invoiceData.priceCurrency,
        orderId: invoiceData.orderId,
        orderDescription: invoiceData.orderDescription,
        customerEmail: invoiceData.customerEmail ? '***@***.***' : 'not provided'
      });

      // Validate configuration
      console.log('⚙️ Configuration check:');
      console.log('  - API URL:', this.apiUrl);
      console.log('  - Public Key:', this.publicKey ? `${this.publicKey.substring(0, 8)}...` : 'NOT SET');
      console.log('  - Private Key:', this.privateKey ? `${this.privateKey.substring(0, 8)}...` : 'NOT SET');
      console.log('  - Domain URL:', this.domainUrl);

      const {
        priceAmount,
        priceCurrency = 'USD',
        orderId = uuidv4(),
        orderDescription = 'Cryptocurrency Payment',
        customerEmail = '',
        successUrl,
        failureUrl,
        cancelUrl
      } = invoiceData;

      // Determine success and cancel URLs
      // If custom URLs are provided (frontend URLs), redirect through our endpoints with return_url parameter
      // If no custom URLs provided, use our default endpoints directly
      let finalSuccessUrl, finalCancelUrl;
      
      if (successUrl) {
        // Frontend provided a success URL - redirect through our success page with auto-redirect
        const separator = successUrl.includes('?') ? '&' : '?';
        finalSuccessUrl = `${this.domainUrl}${config.callbacks.success}?order_id=${encodeURIComponent(orderId)}&return_url=${encodeURIComponent(successUrl)}`;
      } else {
        // No custom success URL - use our default success page
        finalSuccessUrl = `${this.domainUrl}${config.callbacks.success}?order_id=${encodeURIComponent(orderId)}`;
      }
      
      if (cancelUrl) {
        // Frontend provided a cancel URL - redirect through our cancel page with auto-redirect  
        const separator = cancelUrl.includes('?') ? '&' : '?';
        finalCancelUrl = `${this.domainUrl}${config.callbacks.cancel}?order_id=${encodeURIComponent(orderId)}&return_url=${encodeURIComponent(cancelUrl)}`;
      } else {
        // No custom cancel URL - use our default cancel page
        finalCancelUrl = `${this.domainUrl}${config.callbacks.cancel}?order_id=${encodeURIComponent(orderId)}`;
      }
      
      console.log('🔗 URL Configuration:', {
        successUrl: finalSuccessUrl,
        cancelUrl: finalCancelUrl,
        originalSuccessUrl: successUrl,
        originalCancelUrl: cancelUrl,
        isCustomSuccess: !!successUrl,
        isCustomCancel: !!cancelUrl,
        isCustomFailure: !!failureUrl
      });
      
      console.log('🔍 URL Details:');
      console.log('  - Success URL components:', {
        domain: this.domainUrl,
        callback: config.callbacks.success,
        orderId: orderId,
        returnUrl: successUrl
      });
      console.log('  - Cancel URL components:', {
        domain: this.domainUrl,
        callback: config.callbacks.cancel,
        orderId: orderId,
        returnUrl: cancelUrl
      });

      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey,
        price_amount: priceAmount,
        price_currency: priceCurrency,
        order_id: orderId,
        order_description: orderDescription,
        callback_url: `${this.domainUrl}${config.callbacks.callback}`,
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl
      };

      if (customerEmail) {
        requestData.customer_email = customerEmail;
      }

      console.log('📤 Request payload (sensitive data masked):', {
        public_key: requestData.public_key ? `${requestData.public_key.substring(0, 8)}...` : 'NOT SET',
        private_key: requestData.private_key ? `${requestData.private_key.substring(0, 8)}...` : 'NOT SET',
        price_amount: requestData.price_amount,
        price_currency: requestData.price_currency,
        order_id: requestData.order_id,
        order_description: requestData.order_description,
        callback_url: requestData.callback_url,
        success_url: requestData.success_url,
        cancel_url: requestData.cancel_url,
        customer_email: requestData.customer_email || 'not provided',
        custom_urls: {
          success: !!successUrl,
          cancel: !!cancelUrl,
          failure: !!failureUrl
        }
      });

      console.log('🌐 Making API request to:', `${this.apiUrl}/create_invoice`);
      const response = await axios.post(`${this.apiUrl}/create_invoice`, requestData);
      
      console.log('📥 Raw API response:');
      console.log('  - Status:', response.status);
      console.log('  - Status Text:', response.statusText);
      console.log('  - Headers:', response.headers);
      console.log('  - Data:', JSON.stringify(response.data, null, 2));
      
      // Handle different API response formats
      if (response.data) {
        // Check for the expected format with 'result' field
        if (response.data.result) {
          console.log('✅ Invoice creation successful (result format)');
          return {
            success: true,
            data: response.data.result,
            message: 'Invoice created successfully'
          };
        }
        // Check for alternative format where invoice URL is in 'message' field
        else if (response.data.status === 'success' && response.data.message) {
          const invoiceUrl = response.data.message;
          console.log('✅ Invoice creation successful (message format)');
          console.log('🔗 Invoice URL:', invoiceUrl);
          
          // Extract invoice ID from URL
          const invoiceId = invoiceUrl.split('/').pop();
          
          // Create a standardized response format
          const invoiceData = {
            invoice_id: invoiceId,
            invoice_url: invoiceUrl,
            price_amount: priceAmount,
            price_currency: priceCurrency,
            pay_amount: null, // Will be determined by the payment processor
            pay_currency: null, // Will be determined by the payment processor
            order_id: orderId,
            status: 'waiting',
            created_at: new Date().toISOString(),
            // Set expiry to 24 hours from now (common default)
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          };
          
          console.log('📋 Standardized invoice data:', invoiceData);
          
          return {
            success: true,
            data: invoiceData,
            message: 'Invoice created successfully'
          };
        }
        // Check for error status
        else if (response.data.status === 'error') {
          console.log('❌ Invoice creation failed - API returned error status');
          throw new Error(response.data.message || 'API returned error status');
        }
        // Unknown format
        else {
          console.log('❌ Invoice creation failed - Unknown response format');
          console.log('📋 Response data structure:', {
            hasData: !!response.data,
            hasResult: !!(response.data && response.data.result),
            hasMessage: !!(response.data && response.data.message),
            hasStatus: !!(response.data && response.data.status),
            status: response.data.status,
            dataKeys: response.data ? Object.keys(response.data) : 'no data'
          });
          throw new Error(`Unknown API response format: ${JSON.stringify(response.data)}`);
        }
      } else {
        console.log('❌ Invoice creation failed - No response data');
        throw new Error('No response data received from API');
      }
    } catch (error) {
      console.log('💥 Exception caught in createInvoice:');
      console.log('  - Error type:', error.constructor.name);
      console.log('  - Error message:', error.message);
      console.log('  - Error code:', error.code);
      
      if (error.response) {
        console.log('📥 HTTP Error Response:');
        console.log('  - Status:', error.response.status);
        console.log('  - Status Text:', error.response.statusText);
        console.log('  - Headers:', error.response.headers);
        console.log('  - Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.log('📤 HTTP Request made but no response received:');
        console.log('  - Request config:', {
          method: error.config?.method,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout
        });
      } else {
        console.log('🔧 Error in request setup:', error.message);
      }
      
      console.log('📋 Full error object:', JSON.stringify(error, null, 2));
      
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data || error.message,
        message: 'Failed to create invoice',
        debug: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          errorType: error.constructor.name,
          errorCode: error.code
        }
      };
    }
  }

  /**
   * Retrieve invoice details
   * @param {string} orderId - Order ID to retrieve (optional)
   * @param {string} invoiceId - Invoice ID to retrieve (optional)
   * @param {number} status - Status to check (0 = waiting, 1 = successful) (optional)
   * @returns {Promise<Object>} Invoice details response
   */
  async getInvoices(orderId = null, invoiceId = null, status = null) {
    try {
      console.log('🔍 getInvoices called with:', { orderId, invoiceId, status });
      
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey
      };

      // Only add order_id if it's provided and not null/undefined
      if (orderId && orderId !== null && orderId !== undefined && orderId !== '') {
        requestData.order_id = orderId;
        console.log('✅ Added order_id to request:', orderId);
      } else {
        console.log('⚠️ No valid order_id provided, skipping');
      }

      // Only add invoice_id if it's provided and not null/undefined
      if (invoiceId && invoiceId !== null && invoiceId !== undefined && invoiceId !== '') {
        requestData.invoice_id = invoiceId;
        console.log('✅ Added invoice_id to request:', invoiceId);
      } else {
        console.log('⚠️ No valid invoice_id provided, skipping');
      }

      // Add status if provided (0 or 1)
      if (status !== null && status !== undefined && (status === 0 || status === 1)) {
        requestData.status = status;
        console.log('✅ Added status to request:', status);
      } else {
        console.log('⚠️ No valid status provided (should be 0 or 1), skipping');
      }

      console.log('📤 Final request data (sensitive masked):', {
        public_key: requestData.public_key ? `${requestData.public_key.substring(0, 8)}...` : 'NOT SET',
        private_key: requestData.private_key ? `${requestData.private_key.substring(0, 8)}...` : 'NOT SET',
        order_id: requestData.order_id || 'NOT PROVIDED',
        invoice_id: requestData.invoice_id || 'NOT PROVIDED',
        status: requestData.status !== undefined ? requestData.status : 'NOT PROVIDED'
      });

      console.log('🌐 Making request to:', `${this.apiUrl}/get_invoices`);
      const response = await axios.post(`${this.apiUrl}/get_invoices`, requestData);
      
      console.log('📥 getInvoices response analysis:');
      console.log('  - Status:', response.status);
      console.log('  - Has data:', !!response.data);
      console.log('  - Data type:', typeof response.data);
      console.log('  - Data keys:', response.data ? Object.keys(response.data) : 'no data');
      console.log('  - Has result:', !!(response.data && response.data.result));
      console.log('  - Raw data:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.result) {
        console.log('✅ Successfully retrieved invoices from result field');
        return {
          success: true,
          data: response.data.result,
          message: 'Invoices retrieved successfully'
        };
      } else if (response.data && response.data.status === 'success') {
        console.log('✅ API returned success status, checking for data in other fields');
        // Sometimes the data might be directly in response.data without a result wrapper
        return {
          success: true,
          data: response.data,
          message: 'Invoices retrieved successfully (direct data)'
        };
      } else if (response.data && response.data.status === 'error') {
        console.log('❌ API returned error status:', response.data.message);
        throw new Error(response.data.message || 'API returned error status');
      } else {
        console.log('❌ Unexpected response format from API');
        console.log('📋 Full response data:', JSON.stringify(response.data, null, 2));
        throw new Error(`Unexpected API response format: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('Error retrieving invoices:', error.response?.data || error.message);
      
      // Include full response data in error field as it might contain invoice information
      let errorData = error.response?.data?.message || error.message;
      
      // If the response data contains result field (which might be invoice data), include it
      if (error.response?.data?.result) {
        errorData = JSON.stringify(error.response.data.result);
      } else if (error.response?.data && typeof error.response.data === 'object') {
        // If response data is an object but not the expected format, stringify it
        errorData = JSON.stringify(error.response.data);
      }
      
      return {
        success: false,
        error: errorData,
        message: 'Failed to retrieve invoices',
        debug: {
          originalError: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data
        }
      };
    }
  }

  /**
   * Check payment status with numeric status codes by testing both 0 and 1
   * @param {string} orderId - Order ID to check
   * @returns {Promise<Object>} Payment status response with numeric status
   */
  async checkPaymentStatus(orderId) {
    try {
      console.log(`🔍 Checking payment status for order: ${orderId} (testing both status 0 and 1)`);
      
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey,
        order_id: orderId
      };

      console.log('📤 Request payload (sensitive data masked):', {
        public_key: requestData.public_key ? `${requestData.public_key.substring(0, 8)}...` : 'NOT SET',
        private_key: requestData.private_key ? `${requestData.private_key.substring(0, 8)}...` : 'NOT SET',
        order_id: requestData.order_id
      });

      // Try both status values (0 and 1) to see which one returns valid data
      console.log('🔄 Testing status = 0 (waiting payment)...');
      const status0Result = await this.getInvoices(orderId, null, 0);
      
      console.log('🔄 Testing status = 1 (successful payment)...');  
      const status1Result = await this.getInvoices(orderId, null, 1);

      console.log('📊 Status test results:');
      console.log('  - Status 0 success:', status0Result.success);
      console.log('  - Status 1 success:', status1Result.success);

      // Determine which status returned valid data
      let finalStatus = 0; // Default to waiting
      let finalMessage = 'Payment waiting';
      let invoiceData = null;
      let testResults = {
        status_0: { success: status0Result.success, data: status0Result.data, error: status0Result.error },
        status_1: { success: status1Result.success, data: status1Result.data, error: status1Result.error }
      };

      // If status 1 (successful) returns valid data, use it
      if (status1Result.success && status1Result.data) {
        finalStatus = 1;
        finalMessage = 'Payment successful';
        invoiceData = status1Result.data;
        console.log('✅ Status 1 (successful) returned valid data');
      }
      // If status 0 (waiting) returns valid data, use it
      else if (status0Result.success && status0Result.data) {
        finalStatus = 0;
        finalMessage = 'Payment waiting';
        invoiceData = status0Result.data;
        console.log('✅ Status 0 (waiting) returned valid data');
      }
      // If neither returned valid data, try without status parameter as fallback
      else {
        console.log('⚠️ Neither status 0 nor 1 returned valid data, trying without status...');
        const fallbackResult = await this.getInvoices(orderId);
        
        if (fallbackResult.success && fallbackResult.data) {
          // Try to determine status from the invoice data
          const invoices = Array.isArray(fallbackResult.data) ? fallbackResult.data : [fallbackResult.data];
          if (invoices.length > 0) {
            const invoice = invoices[0];
            
            // Analyze the invoice to determine if it's completed or waiting
            if (invoice.status) {
              const status = invoice.status.toLowerCase();
              if (['finished', 'completed', 'complete', 'confirmed'].includes(status)) {
                finalStatus = 1;
                finalMessage = 'Payment successful (determined from fallback)';
              } else {
                finalStatus = 0;
                finalMessage = 'Payment waiting (determined from fallback)';
              }
            } else if (invoice.actually_paid && invoice.price_amount) {
              const expectedAmount = parseFloat(invoice.price_amount);
              const paidAmount = parseFloat(invoice.actually_paid);
              
              if (paidAmount >= expectedAmount * 0.95) {
                finalStatus = 1;
                finalMessage = 'Payment successful (determined by amount from fallback)';
              } else {
                finalStatus = 0;
                finalMessage = 'Payment waiting (determined by amount from fallback)';
              }
            }
            
            invoiceData = fallbackResult.data;
            console.log(`✅ Fallback method returned data, determined status: ${finalStatus}`);
          }
        } else {
          console.log('❌ All methods failed to retrieve invoice details');
          return {
            public_key: this.publicKey,
            private_key: this.privateKey,
            order_id: orderId,
            status: 0, // 0 = waiting payment (failed to get status)
            message: 'Failed to retrieve invoice details with any method',
            error: 'All API calls failed',
            test_results: testResults
          };
        }
      }

      // Handle both single invoice and array of invoices
      const invoices = Array.isArray(invoiceData) ? invoiceData : [invoiceData];
      
      if (invoices.length === 0) {
        console.log('❌ No invoices found for order:', orderId);
        return {
          public_key: this.publicKey,
          private_key: this.privateKey,
          order_id: orderId,
          status: 0, // 0 = waiting payment (no invoice found)
          message: 'No invoices found for the provided order ID',
          test_results: testResults
        };
      }

      // Get the first invoice (or the most relevant one)
      const invoice = invoices[0];
      
      console.log('📊 Final invoice data:', {
        invoice_id: invoice.invoice_id || invoice.id,
        status: invoice.status,
        price_amount: invoice.price_amount,
        actually_paid: invoice.actually_paid,
        pay_amount: invoice.pay_amount
      });

      console.log(`✅ Payment status determined: ${finalStatus} (${finalMessage})`);

      return {
        public_key: this.publicKey,
        private_key: this.privateKey,
        order_id: orderId,
        status: finalStatus,
        message: finalMessage,
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
      };

    } catch (error) {
      console.error('💥 Error checking payment status:', error);
      
      return {
        public_key: this.publicKey,
        private_key: this.privateKey,
        order_id: orderId,
        status: 0, // 0 = waiting payment (error occurred)
        message: 'Error occurred while checking payment status',
        error: error.message
      };
    }
  }

  /**
   * Verify webhook callback signature
   * @param {Object} callbackData - Data received from webhook
   * @param {string} signature - Signature to verify
   * @returns {boolean} True if signature is valid
   */
  verifyCallback(callbackData, signature) {
    try {
      // Create signature using private key and callback data
      const dataString = JSON.stringify(callbackData);
      const expectedSignature = crypto
        .createHmac('sha256', this.privateKey)
        .update(dataString)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying callback:', error);
      return false;
    }
  }

}

module.exports = PayID19Service;
