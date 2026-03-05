const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'testbtn',
  description: 'Test buttons with proper format',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    console.log(`🧪 Test button command by: ${sender}`);
    
    try {
      await sendButtons(sock, jid, {
        title: '🧪 *Button Test*',
        text: 'Testing different button types:',
        footer: 'Click any button',
        buttons: [
          { 
            name: 'quick_reply', 
            buttonParamsJson: JSON.stringify({ 
              display_text: '📋 Quick Reply', 
              id: 'test_quick' 
            }) 
          },
          { 
            name: 'cta_copy', 
            buttonParamsJson: JSON.stringify({ 
              display_text: '📋 COPY THIS', 
              copy_code: 'TEST-CODE-123' 
            }) 
          },
          { 
            name: 'cta_url', 
            buttonParamsJson: JSON.stringify({ 
              display_text: '🌐 VISIT SITE', 
              url: 'https://example.com' 
            }) 
          }
        ]
      });
      console.log(`✅ Test buttons sent to: ${sender}`);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
};