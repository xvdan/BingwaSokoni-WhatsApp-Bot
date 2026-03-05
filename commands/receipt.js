const sessions = require('../lib/sessions');
const utils = require('../lib/utils');

module.exports = {
  name: 'receipt',
  description: 'Get payment receipt',
  aliases: ['invoice', 'payment'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    const session = sessions.getSession(sender);
    
    if (!session || !session.transactionId) {
      await sock.sendMessage(jid, { 
        text: '❌ No recent transaction found.' 
      });
      return;
    }
    
    const receipt = `🧾 *PAYMENT RECEIPT*\n\n` +
                    `📱 *Transaction ID:* ${session.transactionId}\n` +
                    `📦 *Bundle:* ${session.bundle?.name || 'N/A'}\n` +
                    `💰 *Amount:* ${session.bundle ? utils.formatCurrency(session.bundle.amount) : 'N/A'}\n` +
                    `📅 *Date:* ${new Date().toLocaleString()}\n\n` +
                    `Thank you for using Bingwa Sokoni!`;
    
    await sock.sendMessage(jid, { text: receipt });
  }
};