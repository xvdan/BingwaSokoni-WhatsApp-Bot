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
    const sender = msg.key.participant || jid;
    const message = msg.message;
    
    if (!message) return;
    
    // Get message text
    const text = 
      message.conversation ||
      message.extendedTextMessage?.text ||
      '';
    
    console.log(`📨 Message from ${sender}: ${text}`);
    
    // Handle button responses
    if (message.buttonsResponseMessage) {
      const buttonId = message.buttonsResponseMessage.selectedButtonId;
      console.log(`🔘 Button response received: ${buttonId} from ${sender}`);
      
      // Find which command handles this button
      if (buttonId.startsWith('category_') || buttonId.startsWith('pay_')) {
        const buyCommand = commands.get('buy');
        if (buyCommand && buyCommand.handleButton) {
          await buyCommand.handleButton(sock, msg, buttonId);
        } else {
          console.log('❌ Buy command or handleButton not found');
        }
      } else {
        // Handle other button types if needed
        console.log(`⚠️ Unhandled button type: ${buttonId}`);
      }
      return;
    }
    
    // Handle list responses (if you use list messages)
    if (message.listResponseMessage) {
      const selection = message.listResponseMessage.singleSelectReply?.selectedRowId;
      console.log(`📋 List selection: ${selection} from ${sender}`);
      // Handle list selections here
      return;
    }
    
    // Get user session
    const session = sessions.getSession(sender);
    
    // Handle purchase flow
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
          
          // Initiate STK Push
          await sock.sendMessage(jid, { 
            text: `⏳ *Processing Payment*\n\n` +
                  `Please check your phone for STK Push prompt.\n` +
                  `Enter your PIN to complete payment.` 
          });
          
          // Here you would call your M-Pesa API
          console.log(`💰 Initiating STK Push for ${phone} amount: ${session.bundle.amount}`);
          
          // Simulate payment processing
          setTimeout(async () => {
            await sock.sendMessage(jid, { 
              text: `✅ *Payment Successful!*\n\n` +
                    `Bundle: ${session.bundle.name}\n` +
                    `Amount: ${utils.formatCurrency(session.bundle.amount)}\n\n` +
                    `Your bundle will be delivered shortly.\n` +
                    `Join our channel for updates: t.me/bingwasokoni` 
            });
            
            sessions.clearSession(sender);
            console.log(`✅ Payment completed and session cleared for: ${sender}`);
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