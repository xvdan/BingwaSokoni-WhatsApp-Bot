const config = require('../config');

module.exports = {
  name: 'help',
  description: 'Show all commands',
  aliases: ['menu', 'commands', 'cmd'],

  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    
    const helpText = `🤖 *${config.BOT_NAME} HELP MENU*\n\n` +
                    `📌 *Commands*\n\n` +
                    `${config.PREFIX}buy - Purchase bundles\n` +
                    `${config.PREFIX}plans - View all plans\n` +
                    `${config.PREFIX}balance - Check your balance\n` +
                    `${config.PREFIX}help - Show this menu\n` +
                    `${config.PREFIX}ping - Check bot status\n\n` +
                    `💡 *How to Buy*\n` +
                    `1. Type .buy\n` +
                    `2. Choose bundle type\n` +
                    `3. Select bundle\n` +
                    `4. Choose payment method\n` +
                    `5. Complete payment\n\n` +
                    `📞 Support: ${config.OWNER_NUMBER}`;
    
    await sock.sendMessage(jid, { text: helpText });
  }
};