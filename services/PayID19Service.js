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
   * Retrieve invoice details by testing both status values (0 and 1)
   * @param {string} orderId - Order ID to retrieve (optional)
   * @param {string} invoiceId - Invoice ID to retrieve (optional)
   * @returns {Promise<Object>} Invoice details response with determined status
   */
  async getInvoices(orderId = null, invoiceId = null) {
    try {
      // Make request with status = 0 (check for waiting payments)
      const status0Result = await this._makeInvoiceRequest(orderId, invoiceId, 0);

      console.log('🔍 Status 0 result:', status0Result);
      if (status0Result.success) {
        // Check if message is empty array (successful payment) or has data (waiting payment)
        if (status0Result.isEmpty) {
          // Empty message = Payment successful
          return {
            success: true,
            status: 'finished'
          };
        } else {
          // Message has data = Payment waiting
          return {
            success: true,
            data: status0Result.data,
            status: 'waiting'
          };
        }
      } else {
        return {
          success: false,
          status: 'waiting'
        };
      }
    } catch (error) {
      return {
        success: false,
        status: 'waiting'
      };
    }
  }

  /**
   * Make a single invoice request with specific status
   * @param {string} orderId - Order ID to retrieve (optional)
   * @param {string} invoiceId - Invoice ID to retrieve (optional)
   * @param {number} status - Status to check (0 = waiting, 1 = successful)
   * @returns {Promise<Object>} API response
   */
  async _makeInvoiceRequest(orderId = null, invoiceId = null, status) {
    try {
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey,
        status: status
      };

      // Only add order_id if it's provided and not null/undefined
      if (orderId && orderId !== null && orderId !== undefined && orderId !== '') {
        requestData.order_id = orderId;
      }

      // Only add invoice_id if it's provided and not null/undefined
      if (invoiceId && invoiceId !== null && invoiceId !== undefined && invoiceId !== '') {
        requestData.invoice_id = invoiceId;
      }

      const response = await axios.post(`${this.apiUrl}/get_invoices`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          isEmpty: false
        };
      } else if (response.data && response.data.status === 'success') {
        // Check if message is empty array or has data
        const message = response.data.message || '';
        
        if (message === '[]') {
          // Empty message = Payment successful (no waiting invoices found)
          return {
            success: true,
            data: [],
            isEmpty: true
          };
        } else if (message) {
          // Parse the message field which contains the actual invoice data as JSON string
          try {
            const invoiceData = JSON.parse(message);
            return {
              success: true,
              data: invoiceData,
              isEmpty: false
            };
          } catch (parseError) {
            return {
              success: false,
              isEmpty: false
            };
          }
        } else {
          return {
            success: false,
            isEmpty: false
          };
        }
      } else {
        return {
          success: false,
          isEmpty: false
        };
      }
    } catch (error) {
      return {
        success: false,
        isEmpty: false
      };
    }
  }

  /**
   * Check payment status using the simplified getInvoices method
   * @param {string} orderId - Order ID to check
   * @returns {Promise<Object>} Payment status response
   */
  async checkPaymentStatus(orderId) {
    try {
      // Use the new getInvoices method which automatically tests both status values
      const result = await this.getInvoices(orderId);

      return {
        status: result.status || 'waiting'
      };

    } catch (error) {
      return {
        status: 'waiting'
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
