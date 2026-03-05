const fs = require('fs');
const path = require('path');
const config = require('./config');
const sessions = require('./lib/sessions');
const bundles = require('./lib/bundles');
const utils = require('./lib/utils');

const commands = new Map();

// Load all commands
function loadCommands() {
  const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'));
  
  for (const file of commandFiles) {
    if (file.endsWith('.js')) {
      const command = require(`./commands/${file}`);
      commands.set(command.name, command);
      
      if (command.aliases) {
        command.aliases.forEach(alias => {
          commands.set(alias, command);
        });
      }
    }
  }
  
  console.log(`✅ Loaded ${commands.size} commands`);
}

// Handle incoming messages
async function handleMessage(sock, msg) {
  try {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const message = msg.message;
    
    if (!message) return;
    
    // Get message text
    let text = '';
    let messageType = 'unknown';
    
    if (message.conversation) {
      text = message.conversation;
      messageType = 'text';
    } else if (message.extendedTextMessage?.text) {
      text = message.extendedTextMessage.text;
      messageType = 'extended_text';
    } 
    
    // Log message type for debugging
    const msgKeys = Object.keys(message);
    if (msgKeys.length > 0) {
      messageType = msgKeys[0];
      console.log(`📨 Message type: ${messageType} from ${sender}`);
    }
    
    // ============= HANDLE BUTTON RESPONSES =============
    
    // Handle quick_reply buttons
    if (message.buttonsResponseMessage) {
      const buttonId = message.buttonsResponseMessage.selectedButtonId;
      const buttonText = message.buttonsResponseMessage.selectedDisplayText;
      console.log(`🔴 BUTTON CLICK - quick_reply: ID=${buttonId}, Text=${buttonText}`);
      
      // Handle the button click - pass msg along
      await handleButtonClick(sock, msg, jid, sender, buttonId);
      return;
    }
    
    // Handle template button replies (like in the working code)
    if (message.templateButtonReplyMessage) {
      const buttonId = message.templateButtonReplyMessage.selectedId;
      const buttonText = message.templateButtonReplyMessage.selectedDisplayText;
      console.log(`🔴 TEMPLATE BUTTON: ID=${buttonId}, Text=${buttonText}`);
      
      // Handle the button click - pass msg along
      await handleButtonClick(sock, msg, jid, sender, buttonId);
      return;
    }
    
    // Handle interactive responses
    if (message.interactiveResponseMessage) {
      console.log(`🔴 INTERACTIVE RESPONSE`);
      
      if (message.interactiveResponseMessage.nativeFlowResponseMessage) {
        try {
          const params = JSON.parse(
            message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson
          );
          if (params.id) {
            await handleButtonClick(sock, msg, jid, sender, params.id);
            return;
          }
        } catch (e) {
          console.log('Error parsing interactive response:', e);
        }
      }
    }
    
    // Handle list responses
    if (message.listResponseMessage) {
      const selection = message.listResponseMessage.singleSelectReply?.selectedRowId;
      console.log(`🔴 LIST SELECTION: ${selection}`);
      
      if (selection) {
        await handleButtonClick(sock, msg, jid, sender, selection);
        return;
      }
    }
    
    // Log non-text messages
    if (text === '') {
      console.log(`📨 [NON-TEXT] from ${sender} - Type: ${messageType}`);
    } else {
      console.log(`📨 Message from ${sender}: ${text}`);
    }
    
    // Get user session for text-based flow
    const session = sessions.getSession(sender);
    
    // Handle purchase flow for text responses
    if (session) {
      console.log(`🔄 Session step: ${session.step} for user: ${sender}`);
      
      // STEP 1: Bundle selection (user sends number)
      if (session.step === 'selecting_bundle' && /^\d+$/.test(text)) {
        console.log(`🔢 Bundle number selected: ${text}`);
        
        const categoryBundles = bundles.getByCategory(session.category);
        const index = parseInt(text) - 1;
        
        if (index >= 0 && index < categoryBundles.length) {
          const selectedBundle = categoryBundles[index];
          console.log(`✅ Bundle selected: ${selectedBundle.name}`);
          
          sessions.updateSession(sender, { 
            bundle: selectedBundle,
            step: 'selecting_payment_method'
          });
          
          // Show payment method buttons with simple format
          try {
            const { sendButtons } = require('gifted-btns');
            await sendButtons(sock, jid, {
              text: `📦 *Selected: ${selectedBundle.name}*\n💰 *Amount: ${utils.formatCurrency(selectedBundle.amount)}*\n\nChoose payment method:`,
              footer: 'Select payment option',
              buttons: [
                { id: 'pay_auto', text: '💳 Auto (STK Push)' },
                { id: 'pay_manual', text: '💵 Manual (Till)' }
              ]
            });
            console.log(`✅ Payment buttons sent`);
          } catch (error) {
            console.error('❌ Error sending payment buttons:', error);
          }
        } else {
          await sock.sendMessage(jid, { 
            text: '❌ Invalid selection. Please reply with a valid number.' 
          });
        }
        return;
      }
      
      // STEP 2: Phone number input
      if (session.step === 'entering_phone' && session.paymentMethod === 'auto') {
        console.log(`📱 Phone number: ${text}`);
        
        const phone = utils.formatPhoneNumber(text);
        
        if (phone.length === 12 && phone.startsWith('254')) {
          sessions.updateSession(sender, { 
            phone: phone,
            step: 'processing_payment'
          });
          
          await sock.sendMessage(jid, { 
            text: `⏳ *Processing Payment*\n\nPlease check your phone for STK Push prompt.` 
          });
          
          setTimeout(async () => {
            await sock.sendMessage(jid, { 
              text: `✅ *Payment Successful!*\n\nBundle: ${session.bundle.name}\nAmount: ${utils.formatCurrency(session.bundle.amount)}` 
            });
            sessions.clearSession(sender);
          }, 5000);
          
        } else {
          await sock.sendMessage(jid, { 
            text: '❌ Invalid phone number. Use format: 0712345678' 
          });
        }
        return;
      }
    }
    
    // Handle commands
    if (text.startsWith(config.PREFIX)) {
      const args = text.slice(config.PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      
      const command = commands.get(commandName);
      
      if (command) {
        console.log(`⚡ Executing command: ${commandName}`);
        await command.execute(sock, msg, args);
      } else {
        await sock.sendMessage(jid, { 
          text: `❌ Unknown command. Type ${config.PREFIX}help to see commands.` 
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error in handleMessage:', error);
  }
}

// Handle button clicks - FIXED: Added msg parameter
async function handleButtonClick(sock, msg, jid, sender, buttonId) {
  console.log(`🔴🔴🔴 HANDLING BUTTON: ${buttonId} for ${sender}`);
  
  try {
    // Get or create session
    let session = sessions.getSession(sender);
    
    if (!session) {
      console.log(`⚠️ No session, creating new`);
      session = sessions.createSession(sender);
    }
    
    // Find which command handles this button
    if (buttonId.startsWith('category_') || buttonId.startsWith('pay_')) {
      const buyCommand = commands.get('buy');
      if (buyCommand && buyCommand.handleButton) {
        // Pass the original msg to the command's handleButton
        await buyCommand.handleButton(sock, msg, buttonId);
      } else {
        console.log('❌ Buy command or handleButton not found');
      }
    } else if (buttonId.startsWith('test_')) {
      const testCommand = commands.get('testbtn');
      if (testCommand && testCommand.handleButton) {
        await testCommand.handleButton(sock, msg, buttonId);
      } else {
        // Fallback response for test buttons
        await sock.sendMessage(jid, { 
          text: `✅ Test button *${buttonId}* clicked successfully!` 
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error in handleButtonClick:', error);
  }
}

// Handle status updates
async function handleStatus(sock, msg) {
  try {
    if (config.AUTO_READ_STATUS) {
      await sock.readMessages([msg.key]);
    }
    if (config.AUTO_LIKE_STATUS) {
      await sock.sendMessage('status@broadcast', {
        react: { text: '❤️', key: msg.key }
      });
    }
  } catch (error) {
    console.error('❌ Error handling status:', error);
  }
}

module.exports = {
  loadCommands,
  handleMessage,
  handleStatus
};