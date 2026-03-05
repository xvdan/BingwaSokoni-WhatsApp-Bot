const mpesa = require('../lib/mpesa');
const sessions = require('../lib/sessions');
const utils = require('../lib/utils');

module.exports = {
  name: 'status',
  description: 'Check payment status',
  aliases: ['check', 'verify'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    const session = sessions.getSession(sender);
    
    if (!session || !session.transactionId) {
      await sock.sendMessage(jid, { 
        text: '❌ No active transaction found. Start a new purchase with .buy' 
      });
      return;
    }
    
    await sock.sendMessage(jid, { 
      text: `⏳ Checking payment status for transaction: ${session.transactionId}...` 
    });
    
    const result = await mpesa.verifyPayment(session.transactionId);
    
    if (result.success && result.data.status === 'completed') {
      await sock.sendMessage(jid, { 
        text: `✅ *Payment Verified!*\n\nYour bundle has been delivered successfully.` 
      });
      sessions.clearSession(sender);
    } else {
      await sock.sendMessage(jid, { 
        text: `⏳ Payment still processing. Please wait or contact support.` 
      });
    }
  }
};