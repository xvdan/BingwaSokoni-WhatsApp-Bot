const axios = require('axios');
const config = require('../config');

class MpesaAPI {
  constructor() {
    this.apiKey = config.MPESA_API_KEY;
    this.email = config.MPESA_EMAIL;
    this.baseURL = 'https://api.pesapath.com/v1';
  }

  async stkPush(phone, amount, reference = 'Test Payment') {
    try {
      const payload = {
        api_key: this.apiKey,
        email: this.email,
        amount: amount,
        msisdn: phone,
        reference: reference
      };

      console.log('📤 STK Push Request:', payload);

      const response = await axios.post(`${this.baseURL}/stkpush`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📥 STK Push Response:', response.data);
      
      return {
        success: true,
        data: response.data,
        transactionId: response.data.transaction_request_id
      };
    } catch (error) {
      console.error('❌ STK Push Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  async verifyPayment(transactionId) {
    try {
      const payload = {
        api_key: this.apiKey,
        email: this.email,
        transaction_request_id: transactionId
      };

      const response = await axios.post(`${this.baseURL}/transactionstatus`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Verify Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new MpesaAPI();