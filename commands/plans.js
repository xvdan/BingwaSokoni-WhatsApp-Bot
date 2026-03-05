const bundles = require('../lib/bundles');
const utils = require('../lib/utils');

module.exports = {
  name: 'plans',
  description: 'View all available plans',
  aliases: ['bundles', 'packages', 'prices'],

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    
    let text = '📋 *ALL AVAILABLE PLANS*\n\n';
    
    // Data Bundles
    text += '📶 *DATA BUNDLES*\n';
    bundles.getByCategory('data').forEach(b => {
      text += `• ${b.name} - ${utils.formatCurrency(b.amount)} (${b.validity})\n`;
    });
    
    text += '\n💬 *SMS BUNDLES*\n';
    bundles.getByCategory('sms').forEach(b => {
      text += `• ${b.name} - ${utils.formatCurrency(b.amount)} (${b.validity})\n`;
    });
    
    text += '\n📞 *VOICE BUNDLES*\n';
    bundles.getByCategory('voice').forEach(b => {
      text += `• ${b.name} - ${utils.formatCurrency(b.amount)} (${b.validity})\n`;
    });
    
    text += '\n\nType *.buy* to purchase';
    
    await sock.sendMessage(jid, { text });
  }
};