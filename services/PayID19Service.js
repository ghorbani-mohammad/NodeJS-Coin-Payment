const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class PayID19Service {
  constructor() {
    this.apiUrl = config.payid19.apiUrl;
    this.publicKey = config.payid19.publicKey;
    this.privateKey = config.payid19.privateKey;
    this.domainUrl = config.domain.url;
  }

  /**
   * Create a new invoice for cryptocurrency payment
   * @param {Object} invoiceData - Invoice details
   * @param {number} invoiceData.priceAmount - Amount in specified currency
   * @param {string} invoiceData.priceCurrency - Currency code (USD, EUR, etc.)
   * @param {string} invoiceData.orderId - Unique order identifier
   * @param {string} invoiceData.orderDescription - Description of the order
   * @param {string} invoiceData.customerEmail - Customer email (optional)
   * @returns {Promise<Object>} Invoice creation response
   */
  async createInvoice(invoiceData) {
    try {
      const {
        priceAmount,
        priceCurrency = 'USD',
        orderId = uuidv4(),
        orderDescription = 'Cryptocurrency Payment',
        customerEmail = ''
      } = invoiceData;

      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey,
        price_amount: priceAmount,
        price_currency: priceCurrency,
        order_id: orderId,
        order_description: orderDescription,
        callback_url: `${this.domainUrl}${config.callbacks.callback}`,
        success_url: `${this.domainUrl}${config.callbacks.success}`,
        cancel_url: `${this.domainUrl}${config.callbacks.cancel}`
      };

      if (customerEmail) {
        requestData.customer_email = customerEmail;
      }

      const response = await axios.post(`${this.apiUrl}/create_invoice`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          message: 'Invoice created successfully'
        };
      } else {
        throw new Error(response.data.message || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to create invoice'
      };
    }
  }

  /**
   * Retrieve invoice details
   * @param {string} orderId - Order ID to retrieve (optional)
   * @param {string} invoiceId - Invoice ID to retrieve (optional)
   * @returns {Promise<Object>} Invoice details response
   */
  async getInvoices(orderId = null, invoiceId = null) {
    try {
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey
      };

      if (orderId) {
        requestData.order_id = orderId;
      }

      if (invoiceId) {
        requestData.invoice_id = invoiceId;
      }

      const response = await axios.post(`${this.apiUrl}/get_invoices`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          message: 'Invoices retrieved successfully'
        };
      } else {
        throw new Error(response.data.message || 'Failed to retrieve invoices');
      }
    } catch (error) {
      console.error('Error retrieving invoices:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to retrieve invoices'
      };
    }
  }

  /**
   * Create a withdrawal request
   * @param {Object} withdrawData - Withdrawal details
   * @param {string} withdrawData.currency - Cryptocurrency to withdraw
   * @param {number} withdrawData.amount - Amount to withdraw
   * @param {string} withdrawData.address - Wallet address for withdrawal
   * @param {string} withdrawData.tag - Additional tag if required (optional)
   * @returns {Promise<Object>} Withdrawal creation response
   */
  async createWithdraw(withdrawData) {
    try {
      const {
        currency,
        amount,
        address,
        tag = ''
      } = withdrawData;

      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey,
        currency: currency.toUpperCase(),
        amount: amount,
        address: address
      };

      if (tag) {
        requestData.tag = tag;
      }

      const response = await axios.post(`${this.apiUrl}/create_withdraw`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          message: 'Withdrawal created successfully'
        };
      } else {
        throw new Error(response.data.message || 'Failed to create withdrawal');
      }
    } catch (error) {
      console.error('Error creating withdrawal:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to create withdrawal'
      };
    }
  }

  /**
   * Get withdrawal history
   * @param {string} withdrawId - Specific withdrawal ID (optional)
   * @returns {Promise<Object>} Withdrawal history response
   */
  async getWithdraws(withdrawId = null) {
    try {
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey
      };

      if (withdrawId) {
        requestData.withdraw_id = withdrawId;
      }

      const response = await axios.post(`${this.apiUrl}/get_withdraws`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          message: 'Withdrawals retrieved successfully'
        };
      } else {
        throw new Error(response.data.message || 'Failed to retrieve withdrawals');
      }
    } catch (error) {
      console.error('Error retrieving withdrawals:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to retrieve withdrawals'
      };
    }
  }

  /**
   * Get account balance
   * @returns {Promise<Object>} Balance information
   */
  async getBalance() {
    try {
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey
      };

      const response = await axios.post(`${this.apiUrl}/get_balance`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          message: 'Balance retrieved successfully'
        };
      } else {
        throw new Error(response.data.message || 'Failed to retrieve balance');
      }
    } catch (error) {
      console.error('Error retrieving balance:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to retrieve balance'
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

  /**
   * Get supported currencies
   * @returns {Promise<Object>} Supported currencies list
   */
  async getCurrencies() {
    try {
      const requestData = {
        public_key: this.publicKey,
        private_key: this.privateKey
      };

      const response = await axios.post(`${this.apiUrl}/get_currencies`, requestData);
      
      if (response.data && response.data.result) {
        return {
          success: true,
          data: response.data.result,
          message: 'Currencies retrieved successfully'
        };
      } else {
        throw new Error(response.data.message || 'Failed to retrieve currencies');
      }
    } catch (error) {
      console.error('Error retrieving currencies:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        message: 'Failed to retrieve currencies'
      };
    }
  }
}

module.exports = PayID19Service;
