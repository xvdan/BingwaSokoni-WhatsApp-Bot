const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('../config');
const mpesa = require('../lib/mpesa');
const sessions = require('../lib/sessions');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'M-Pesa API Server Running' });
});

// Initiate STK Push
app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phone, amount, reference } = req.body;
    
    const result = await mpesa.stkPush(phone, amount, reference);
    
    if (result.success) {
      res.json({
        success: true,
        transactionId: result.transactionId,
        message: 'STK Push sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify Payment
app.get('/api/mpesa/verify/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await mpesa.verifyPayment(id);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// M-Pesa Callback
app.post('/api/mpesa/callback', (req, res) => {
  console.log('📞 M-Pesa Callback Received:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Here you can:
  // 1. Update transaction status
  // 2. Notify user via WhatsApp
  // 3. Trigger delivery automation
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Start server
app.listen(config.PORT, () => {
  console.log(`✅ API Server running on port ${config.PORT}`);
});

module.exports = app;