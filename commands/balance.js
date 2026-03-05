module.exports = {
  name: 'balance',
  description: 'Check your account balance',
  aliases: ['acc', 'points'],

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    // You can integrate with your database here
    await sock.sendMessage(jid, { 
      text: `💰 *Your Balance*\n\n` +
            `Account: ${sender.split('@')[0]}\n` +
            `Points: 0\n` +
            `Purchases: 0\n\n` +
            `Make a purchase to earn points!` 
    });
  }
};