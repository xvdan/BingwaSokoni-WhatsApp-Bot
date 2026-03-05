const config = require('../config');
const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'help',
  description: 'Show all commands',
  aliases: ['menu', 'commands', 'cmd'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    
    const helpText = `🤖 *${config.BOT_NAME} - HELP MENU*\n\n` +
                    `📌 *MAIN COMMANDS*\n` +
                    `└ ${config.PREFIX}buy - Purchase bundles\n` +
                    `└ ${config.PREFIX}plans - View all plans\n` +
                    `└ ${config.PREFIX}balance - Check balance\n` +
                    `└ ${config.PREFIX}status - Check payment status\n` +
                    `└ ${config.PREFIX}receipt - Get payment receipt\n` +
                    `└ ${config.PREFIX}help - Show this menu\n` +
                    `└ ${config.PREFIX}ping - Check bot status\n\n` +
                    
                    `💡 *HOW TO BUY*\n` +
                    `1️⃣ Type .buy\n` +
                    `2️⃣ Choose bundle category\n` +
                    `3️⃣ Select bundle number\n` +
                    `4️⃣ Choose payment method\n` +
                    `5️⃣ Enter phone number\n` +
                    `6️⃣ Complete STK Push on phone\n\n` +
                    
                    `📞 *SUPPORT*: ${config.OWNER_NUMBER}\n` +
                    `📢 *Channel*: Join our WhatsApp channel for updates!\n\n` +
                    
                    `_Type any command to get started._`;
    
    // Send with buttons for quick access
    try {
      await sendButtons(sock, jid, {
        text: helpText,
        footer: 'Bingwa Sokoni - Your Trusted Dealer',
        buttons: [
          { id: 'category_data', text: '📶 Buy Data' },
          { id: 'help_support', text: '📞 Support' },
          { 
            name: 'cta_url', 
            buttonParamsJson: JSON.stringify({ 
              display_text: '📢 Channel', 
              url: 'https://whatsapp.com/channel/0029Vb81SnR42DcZd0kd7j28' 
            }) 
          }
        ]
      });
    } catch (error) {
      // Fallback to plain text if buttons fail
      await sock.sendMessage(jid, { text: helpText });
    }
  },

  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid;
    const config = require('../config');
    
    if (buttonId === 'help_support') {
      await sock.sendMessage(jid, { 
        text: `📞 *Support*\n\nContact us at: ${config.OWNER_NUMBER}\n\nWe're here to help 24/7!` 
      });
    }
  }
};