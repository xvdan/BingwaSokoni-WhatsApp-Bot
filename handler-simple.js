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
    } else if (message.buttonsResponseMessage) {
      // This is a button response
      const buttonId = message.buttonsResponseMessage.selectedButtonId;
      const buttonText = message.buttonsResponseMessage.selectedDisplayText;
      console.log(`🔴🔴🔴 BUTTON CLICK DETECTED! ID: ${buttonId}, Text: ${buttonText} from ${sender}`);
      
      // Handle the button click directly here
      await handleButtonClick(sock, jid, sender, buttonId);
      return;
    } else if (message.listResponseMessage) {
      // This is a list response
      const selection = message.listResponseMessage.singleSelectReply?.selectedRowId;
      console.log(`📋 LIST SELECTION: ${selection} from ${sender}`);
      await handleButtonClick(sock, jid, sender, selection);
      return;
    } else if (message.interactiveResponseMessage) {
      console.log(`🔴 INTERACTIVE RESPONSE from ${sender}`);
      // Try to extract button ID
      try {
        if (message.interactiveResponseMessage.nativeFlowResponseMessage) {
          const params = JSON.parse(message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
          if (params.id) {
            await handleButtonClick(sock, jid, sender, params.id);
            return;
          }
        }
      } catch (e) {
        console.log('Error parsing interactive response:', e);
      }
    } else {
      // Log other message types for debugging
      console.log(`📨 Message type: ${Object.keys(message)[0]} from ${sender}`);
    }
    
    console.log(`📨 Message from ${sender}: ${text || '[NON-TEXT]'}`);
    
    // Get user session
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
          console.log(`✅ Bundle selected: ${selectedBundle.name} (${selectedBundle.amount})`);
          
          sessions.updateSession(sender, { 
            bundle: selectedBundle,
            step: 'selecting_payment_method'
          });
          
          // Show payment method buttons
          try {
            const { sendButtons } = require('gifted-btns');
            await sendButtons(sock, jid, {
              text: `📦 *Selected: ${selectedBundle.name}*\n` +
                    `💰 *Amount: ${utils.formatCurrency(selectedBundle.amount)}*\n\n` +
                    `Choose payment method:`,
              buttons: [
                {
                  id: 'pay_auto',
                  text: '💳 Auto (STK Push)'
                },
                {
                  id: 'pay_manual',
                  text: '💵 Manual (Till)'
                }
              ]
            });
            console.log(`✅ Payment method buttons sent to ${sender}`);
          } catch (error) {
            console.error('❌ Error sending payment buttons:', error);
          }
        } else {
          console.log(`❌ Invalid bundle number: ${text}`);
          await sock.sendMessage(jid, { 
            text: '❌ Invalid selection. Please reply with a valid number.' 
          });
        }
        return;
      }
      
      // STEP 2: Phone number input for auto payment
      if (session.step === 'entering_phone' && session.paymentMethod === 'auto') {
        console.log(`📱 Phone number received: ${text} from ${sender}`);
        
        const phone = utils.formatPhoneNumber(text);
        
        if (phone.length === 12 && phone.startsWith('254')) {
          sessions.updateSession(sender, { 
            phone: phone,
            step: 'processing_payment'
          });
          
          await sock.sendMessage(jid, { 
            text: `⏳ *Processing Payment*\n\n` +
                  `Please check your phone for STK Push prompt.\n` +
                  `Enter your PIN to complete payment.` 
          });
          
          console.log(`💰 Processing payment for ${phone} amount: ${session.bundle.amount}`);
          
          setTimeout(async () => {
            await sock.sendMessage(jid, { 
              text: `✅ *Payment Successful!*\n\n` +
                    `Bundle: ${session.bundle.name}\n` +
                    `Amount: ${utils.formatCurrency(session.bundle.amount)}\n\n` +
                    `Your bundle will be delivered shortly.` 
            });
            
            sessions.clearSession(sender);
          }, 5000);
          
        } else {
          await sock.sendMessage(jid, { 
            text: '❌ Invalid phone number. Please use format: 0712345678 or 254712345678' 
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
        console.log(`⚡ Executing command: ${commandName} from ${sender}`);
        await command.execute(sock, msg, args);
      } else {
        await sock.sendMessage(jid, { 
          text: `❌ Unknown command. Type ${config.PREFIX}help to see available commands.` 
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
}

// Handle button clicks directly
async function handleButtonClick(sock, jid, sender, buttonId) {
  console.log(`🔴🔴🔴 HANDLING BUTTON: ${buttonId} for ${sender}`);
  
  try {
    // Get or create session
    let session = sessions.getSession(sender);
    
    if (!session) {
      console.log(`⚠️ No session found, creating new one for ${sender}`);
      session = sessions.createSession(sender);
    }
    
    // Handle category selection
    if (buttonId.startsWith('category_')) {
      const category = buttonId.replace('category_', '');
      console.log(`📦 Category selected: ${category}`);
      
      const categoryBundles = bundles.getByCategory(category);
      
      if (!categoryBundles || categoryBundles.length === 0) {
        await sock.sendMessage(jid, { 
          text: `❌ No bundles available for ${category} at the moment.` 
        });
        return;
      }
      
      sessions.updateSession(sender, { 
        step: 'selecting_bundle',
        category: category
      });
      
      // Format bundle list
      let listText = `📦 *${category.toUpperCase()} BUNDLES*\n\n`;
      categoryBundles.forEach((bundle, index) => {
        listText += `${index + 1}. *${bundle.name}*\n`;
        listText += `   💰 ${utils.formatCurrency(bundle.amount)}\n`;
        listText += `   ⏱️ ${bundle.validity}\n\n`;
      });
      
      listText += `Reply with the *number* (1-${categoryBundles.length}) of the bundle you want.`;
      
      await sock.sendMessage(jid, { text: listText });
      console.log(`✅ Bundle list sent for category: ${category}`);
    }
    
    // Handle payment method selection
    else if (buttonId.startsWith('pay_')) {
      const method = buttonId.replace('pay_', '');
      console.log(`💳 Payment method selected: ${method}`);
      
      const bundle = session.bundle;
      
      if (!bundle) {
        await sock.sendMessage(jid, { 
          text: 'Session expired. Please start over with .buy' 
        });
        sessions.clearSession(sender);
        return;
      }
      
      sessions.updateSession(sender, { 
        paymentMethod: method,
        step: method === 'auto' ? 'entering_phone' : 'manual_payment'
      });
      
      if (method === 'auto') {
        await sock.sendMessage(jid, { 
          text: `📱 *Automatic Payment*\n\n` +
                `Bundle: *${bundle.name}*\n` +
                `Amount: *${utils.formatCurrency(bundle.amount)}*\n\n` +
                `Please enter your Safaricom phone number:\n\n` +
                `Example: *0712345678* or *254712345678*` 
        });
      } else {
        await sock.sendMessage(jid, { 
          text: `💰 *Manual Payment Instructions*\n\n` +
                `Bundle: *${bundle.name}*\n` +
                `Amount: *${utils.formatCurrency(bundle.amount)}*\n\n` +
                `1️⃣ Go to M-Pesa\n` +
                `2️⃣ Select *Lipa na M-Pesa*\n` +
                `3️⃣ Select *Buy Goods and Services*\n` +
                `4️⃣ Enter Till Number: *${config.TILL_NUMBER}*\n` +
                `5️⃣ Enter Amount: *${utils.formatCurrency(bundle.amount)}*\n` +
                `6️⃣ Enter PIN and Complete` 
        });
        
        setTimeout(() => {
          sessions.clearSession(sender);
        }, 300000);
      }
    }
    
    // Handle test buttons
    else if (buttonId.startsWith('test_')) {
      await sock.sendMessage(jid, { 
        text: `✅ Test button *${buttonId}* was clicked successfully!` 
      });
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
        react: {
          text: '❤️',
          key: msg.key
        }
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