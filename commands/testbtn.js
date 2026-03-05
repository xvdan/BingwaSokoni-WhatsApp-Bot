const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'testbtn',
  description: 'Test buttons with simple format',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🧪 Test button command by: ${sender}`);
    
    try {
      await sendButtons(sock, jid, {
        text: '🧪 *Button Test*\n\nClick any button to test:',
        footer: 'Simple button format',
        buttons: [
          { id: 'test_1', text: 'Button 1' },
          { id: 'test_2', text: 'Button 2' },
          { id: 'test_3', text: 'Button 3' }
        ]
      });
      console.log(`✅ Test buttons sent to: ${sender}`);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  },

  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🧪 Test button clicked: ${buttonId}`);
    
    await sock.sendMessage(jid, { 
      text: `✅ Button *${buttonId}* clicked successfully!` 
    });
  }
};