module.exports = {
  name: 'ping',
  description: 'Check bot status',
  aliases: ['alive', 'test'],

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const start = Date.now();
    
    await sock.sendMessage(jid, { text: '⚡ *Pong!*' });
    
    const end = Date.now();
    await sock.sendMessage(jid, { text: `⏱️ Response time: ${end - start}ms` });
  }
};