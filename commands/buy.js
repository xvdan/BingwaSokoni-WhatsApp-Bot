const { sendButtons } = require('gifted-btns');
const bundles = require('../lib/bundles');
const sessions = require('../lib/sessions');
const utils = require('../lib/utils');
const config = require('../config');

module.exports = {
  name: 'buy',
  description: 'Purchase data bundles',
  aliases: ['data', 'bundle', 'purchase'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    
    // Create or get session
    let session = sessions.getSession(jid);
    if (!session) {
      session = sessions.createSession(jid);
    }
    
    // Update session step
    sessions.updateSession(jid, { step: sessions.sessionSteps.SELECTING_CATEGORY });
    
    // Show category selection with buttons
    await sendButtons(sock, jid, {
      text: '📱 *Bingwa Sokoni*\n\nChoose what you want to purchase:',
      footer: 'Select payment method after choosing bundle',
      buttons: [
        {
          id: 'category_data',
          text: '📶 Data Bundles'
        },
        {
          id: 'category_sms',
          text: '💬 SMS Bundles'
        },
        {
          id: 'category_voice',
          text: '📞 Voice Bundles'
        }
      ]
    });
  },

  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid;
    const session = sessions.getSession(jid);
    
    if (!session) return;
    
    if (buttonId.startsWith('category_')) {
      const category = buttonId.replace('category_', '');
      const categoryBundles = bundles.getByCategory(category);
      
      sessions.updateSession(jid, { 
        step: sessions.sessionSteps.SELECTING_BUNDLE,
        category: category
      });
      
      const bundleText = utils.formatBundleList(categoryBundles, category);
      
      // Send bundle list as numbers for easy selection
      let listText = bundleText + '\n\n';
      categoryBundles.forEach((bundle, index) => {
        listText += `${index + 1}. ${bundle.name} - ${utils.formatCurrency(bundle.amount)}\n`;
      });
      
      await sock.sendMessage(jid, { text: listText });
    }
    
    else if (buttonId.startsWith('pay_')) {
      const method = buttonId.replace('pay_', '');
      sessions.updateSession(jid, { 
        paymentMethod: method,
        step: method === 'auto' ? sessions.sessionSteps.ENTERING_PHONE : sessions.sessionSteps.MANUAL_PAYMENT
      });
      
      if (method === 'auto') {
        await sock.sendMessage(jid, { 
          text: `📱 *Automatic Payment*\n\nPlease enter your Safaricom phone number:\n\nExample: *0712345678* or *254712345678*` 
        });
      } else {
        const bundle = session.bundle;
        await sock.sendMessage(jid, { 
          text: `💰 *Manual Payment Instructions*\n\n` +
                `1️⃣ Go to M-Pesa\n` +
                `2️⃣ Select *Lipa na M-Pesa*\n` +
                `3️⃣ Select *Buy Goods and Services*\n` +
                `4️⃣ Enter Till Number: *${config.TILL_NUMBER}*\n` +
                `5️⃣ Enter Amount: *${utils.formatCurrency(bundle.amount)}*\n` +
                `6️⃣ Enter PIN and Complete\n\n` +
                `After payment, you'll receive confirmation automatically.` 
        });
      }
    }
  }
};