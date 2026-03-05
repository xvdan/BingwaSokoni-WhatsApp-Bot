const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'test',
  description: 'Test button functionality',
  aliases: ['btn', 'button'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🧪 Test command executed by: ${sender}`);
    
    try {
      await sendButtons(sock, jid, {
        text: '🧪 *Button Test*\n\nIf you see this message and buttons, click one to test:',
        footer: 'This is a test footer',
        buttons: [
          {
            id: 'test_1',
            text: '✅ Test Button 1'
          },
          {
            id: 'test_2',
            text: '✅ Test Button 2'
          },
          {
            id: 'test_3',
            text: '✅ Test Button 3'
          }
        ]
      });
      console.log(`✅ Test buttons sent to: ${sender}`);
    } catch (error) {
      console.error('❌ Error sending test buttons:', error);
    }
  },

  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🧪 TEST BUTTON CLICKED: ${buttonId} from: ${sender}`);
    
    await sock.sendMessage(jid, { 
      text: `✅ Test button *${buttonId}* was clicked successfully!\n\nButton handling is working properly.` 
    });
  }
};