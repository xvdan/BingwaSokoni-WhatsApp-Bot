const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'test',
  description: 'Test button functionality',
  aliases: ['btn'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🧪 Test command executed by: ${sender}`);
    
    try {
      await sendButtons(sock, jid, {
        text: '🧪 *Button Test*\n\nClick a button to test:',
        buttons: [
          {
            id: 'test_1',
            text: 'Button 1'
          },
          {
            id: 'test_2',
            text: 'Button 2'
          },
          {
            id: 'test_3',
            text: 'Button 3'
          }
        ]
      });
      console.log(`✅ Test buttons sent to: ${sender}`);
    } catch (error) {
      console.error('❌ Error sending test buttons:', error);
    }
  }
};