const fs = require('fs-extra');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config();
}

module.exports = {
  // Bot Config
  SESSION_ID: process.env.SESSION_ID,
  BOT_NAME: process.env.BOT_NAME || 'BingwaSokoni',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '254712345678',
  PREFIX: process.env.PREFIX || '.',
  MODE: process.env.MODE || 'public',
  
  // M-Pesa Config
  MPESA_API_KEY: process.env.MPESA_API_KEY,
  MPESA_EMAIL: process.env.MPESA_EMAIL,
  MPESA_SHORTCODE: process.env.MPESA_SHORTCODE || '174379',
  MPESA_PASSKEY: process.env.MPESA_PASSKEY,
  
  // Server
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  CALLBACK_URL: process.env.CALLBACK_URL || 'http://localhost:3000/api/mpesa/callback',
  PORT: process.env.PORT || 3000,
  
  // Payment
  TILL_NUMBER: process.env.TILL_NUMBER || '4895010',
  
  // Features
  AUTO_READ_STATUS: process.env.AUTO_READ_STATUS === 'true',
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS === 'true'
};