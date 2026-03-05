const fs = require('fs');
const path = require('path');
const config = require('./config');
const sessions = require('./lib/sessions');
const bundles = require('./lib/bundles');
const utils = require('./lib/utils');
const mpesa = require('./lib/mpesa');

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
    const message = msg.message;
    
    if (!message) return;
    
    // Get message text
    const text = 
      message.conversation ||
      message.extendedTextMessage?.text ||
      '';
    
    // Handle button responses
    if (message.buttonsResponseMessage) {
      const buttonId = message.buttonsResponseMessage.selectedButtonId;
      const command = commands.get(buttonId?.split('_')[0]);
      
      if (command && command.handleButton) {
        await command.handleButton(sock, msg, buttonId);
      }
      return;
    }
    
    // Handle interactive messages (list responses)
    if (message.listResponseMessage) {
      const selection = message.listResponseMessage.singleSelectReply?.selectedRowId;
      // Handle list selection
      return;
    }
    
    // Get user session
    const session = sessions.getSession(jid);
    
    // Handle purchase flow
    if (session) {
      
      // STEP 1: Bundle selection (user sends number)
      if (session.step === 'selecting_bundle' && /^\d+$/.test(text)) {
        const categoryBundles = bundles.getByCategory(session.category);
        const index = parseInt(text) - 1;
        
        if (index >= 0 && index < categoryBundles.length) {
          const selectedBundle = categoryBundles[index];
          sessions.updateSession(jid, { 
            bundle: selectedBundle,
            step: 'selecting_payment_method'
          });
          
          // Show payment method buttons
          const { sendButtons } = require('gifted-btns');
          await sendButtons(sock, jid, {
            text: `📦 *Selected: ${selectedBundle.name}*\n💰 *Amount: ${utils.formatCurrency(selectedBundle.amount)}*\n\nChoose payment method:`,
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
        } else {
          await sock.sendMessage(jid, { text: '❌ Invalid selection. Please try again.' });
        }
        return;
      }
      
      // STEP 2: Phone number input for auto payment
      if (session.step === 'entering_phone' && session.paymentMethod === 'auto') {
        const phone = utils.formatPhoneNumber(text);
        
        if (phone.length === 12 && phone.startsWith('254')) {
          sessions.updateSession(jid, { 
            phone: phone,
            step: 'processing_payment'
          });
          
          // Initiate STK Push
          await sock.sendMessage(jid, { 
            text: `⏳ *Processing Payment*\n\n` +
                  `Please check your phone for STK Push prompt.\n` +
                  `Enter your PIN to complete payment.` 
          });
          
          const transactionId = utils.generateTransactionId();
          const result = await mpesa.stkPush(phone, session.bundle.amount, transactionId);
          
          if (result.success) {
            sessions.updateSession(jid, { transactionId: result.transactionId });
            
            // Wait for payment confirmation (you can implement a polling mechanism)
            setTimeout(async () => {
              const verifyResult = await mpesa.verifyPayment(result.transactionId);
              
              if (verifyResult.success && verifyResult.data.status === 'completed') {
                await sock.sendMessage(jid, { 
                  text: `✅ *Payment Successful!*\n\n` +
                        `Bundle: ${session.bundle.name}\n` +
                        `Amount: ${utils.formatCurrency(session.bundle.amount)}\n` +
                        `Transaction: ${result.transactionId}\n\n` +
                        `Your bundle will be delivered shortly.\n` +
                        `Join our channel for updates: t.me/bingwasokoni` 
                });
                
                sessions.clearSession(jid);
              } else {
                await sock.sendMessage(jid, { 
                  text: `❌ *Payment Failed*\n\nPlease try again or use manual payment.` 
                });
              }
            }, 15000); // Check after 15 seconds
            
          } else {
            await sock.sendMessage(jid, { 
              text: `❌ *STK Push Failed*\n\nPlease try again or use manual payment.` 
            });
          }
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
        console.log(`⚡ Executing command: ${commandName}`);
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