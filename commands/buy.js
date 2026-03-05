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
    const sender = msg.key.participant || jid;
    
    console.log(`📝 Buy command executed by: ${sender}`);
    
    // Clear any existing session
    sessions.clearSession(sender);
    
    // Create new session
    const session = sessions.createSession(sender);
    sessions.updateSession(sender, { 
      step: sessions.sessionSteps.SELECTING_CATEGORY,
      jid: jid
    });
    
    console.log(`📋 New session created for: ${sender}`);
    
    // Show category selection with SIMPLE button format
    try {
      await sendButtons(sock, jid, {
        text: '📱 *Bingwa Sokoni*\n\nChoose what you want to purchase:',
        footer: 'Select a category',
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
      console.log(`✅ Category buttons sent to: ${sender}`);
    } catch (error) {
      console.error('❌ Error sending buttons:', error);
    }
  },

  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🔘 HANDLE BUTTON: ${buttonId} from: ${sender}`);
    
    try {
      const session = sessions.getSession(sender);
      
      if (!session) {
        console.log(`⚠️ No session found for: ${sender}`);
        await sock.sendMessage(jid, { 
          text: 'Please start a new purchase by typing .buy' 
        });
        return;
      }
      
      // Handle category selection
      if (buttonId.startsWith('category_')) {
        const category = buttonId.replace('category_', '');
        console.log(`📦 Category selected: ${category}`);
        
        const categoryBundles = bundles.getByCategory(category);
        
        if (!categoryBundles || categoryBundles.length === 0) {
          await sock.sendMessage(jid, { 
            text: `❌ No bundles available for ${category} at the moment.` 
          });
          return;
        }
        
        sessions.updateSession(sender, { 
          step: 'selecting_bundle',
          category: category
        });
        
        // Format bundle list
        let listText = `📦 *${category.toUpperCase()} BUNDLES*\n\n`;
        categoryBundles.forEach((bundle, index) => {
          listText += `${index + 1}. *${bundle.name}*\n`;
          listText += `   💰 ${utils.formatCurrency(bundle.amount)}\n`;
          listText += `   ⏱️ ${bundle.validity}\n\n`;
        });
        
        listText += `Reply with the *number* (1-${categoryBundles.length}) of the bundle you want.`;
        
        await sock.sendMessage(jid, { text: listText });
        console.log(`✅ Bundle list sent for category: ${category}`);
      }
      
      // Handle payment method selection
      else if (buttonId.startsWith('pay_')) {
        const method = buttonId.replace('pay_', '');
        console.log(`💳 Payment method selected: ${method}`);
        
        const bundle = session.bundle;
        
        if (!bundle) {
          await sock.sendMessage(jid, { 
            text: 'Session expired. Please start over with .buy' 
          });
          sessions.clearSession(sender);
          return;
        }
        
        sessions.updateSession(sender, { 
          paymentMethod: method,
          step: method === 'auto' ? 'entering_phone' : 'manual_payment'
        });
        
        if (method === 'auto') {
          await sock.sendMessage(jid, { 
            text: `📱 *Automatic Payment*\n\n` +
                  `Bundle: *${bundle.name}*\n` +
                  `Amount: *${utils.formatCurrency(bundle.amount)}*\n\n` +
                  `Please enter your Safaricom phone number:\n\n` +
                  `Example: *0712345678* or *254712345678*` 
          });
        } else {
          await sock.sendMessage(jid, { 
            text: `💰 *Manual Payment Instructions*\n\n` +
                  `Bundle: *${bundle.name}*\n` +
                  `Amount: *${utils.formatCurrency(bundle.amount)}*\n\n` +
                  `1️⃣ Go to M-Pesa\n` +
                  `2️⃣ Select *Lipa na M-Pesa*\n` +
                  `3️⃣ Select *Buy Goods and Services*\n` +
                  `4️⃣ Enter Till Number: *${config.TILL_NUMBER}*\n` +
                  `5️⃣ Enter Amount: *${utils.formatCurrency(bundle.amount)}*\n` +
                  `6️⃣ Enter PIN and Complete` 
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error in handleButton:', error);
    }
  }
};