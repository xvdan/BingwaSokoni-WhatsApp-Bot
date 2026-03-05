const bundles = require('../lib/bundles');
const utils = require('../lib/utils');
const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'plans',
  description: 'View all available plans',
  aliases: ['bundles', 'packages', 'prices'],

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    
    // Send as separate messages for better readability
    await sock.sendMessage(jid, { 
      text: '📋 *BINGWA SOKONI - ALL PLANS*\n\n' +
            'Reply with *.buy* to purchase any plan.' 
    });
    
    // Data Bundles
    let dataText = '📶 *DATA BUNDLES*\n';
    bundles.getByCategory('data').forEach(b => {
      dataText += `└ ${b.name} - ${utils.formatCurrency(b.amount)} (${b.validity})\n`;
    });
    await sock.sendMessage(jid, { text: dataText });
    
    // SMS Bundles
    let smsText = '💬 *SMS BUNDLES*\n';
    bundles.getByCategory('sms').forEach(b => {
      smsText += `└ ${b.name} - ${utils.formatCurrency(b.amount)} (${b.validity})\n`;
    });
    await sock.sendMessage(jid, { text: smsText });
    
    // Voice Bundles
    let voiceText = '📞 *VOICE BUNDLES*\n';
    bundles.getByCategory('voice').forEach(b => {
      voiceText += `└ ${b.name} - ${utils.formatCurrency(b.amount)} (${b.validity})\n`;
    });
    await sock.sendMessage(jid, { text: voiceText });
    
    // Quick action buttons
    try {
      await sendButtons(sock, jid, {
        text: 'Ready to purchase?',
        footer: 'Click below to start',
        buttons: [
          { id: 'category_data', text: '📶 Buy Data' },
          { id: 'category_sms', text: '💬 Buy SMS' },
          { id: 'category_voice', text: '📞 Buy Voice' }
        ]
      });
    } catch (error) {
      await sock.sendMessage(jid, { text: 'Type .buy to start purchasing' });
    }
  }
};