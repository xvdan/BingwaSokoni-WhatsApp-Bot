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
      await handleButtonClick(sock, msg, jid, sender, buttonId);
      return;
    }
    
    // Handle template button replies
    if (message.templateButtonReplyMessage) {
      const buttonId = message.templateButtonReplyMessage.selectedId;
      const buttonText = message.templateButtonReplyMessage.selectedDisplayText;
      console.log(`🔴 TEMPLATE BUTTON: ID=${buttonId}, Text=${buttonText}`);
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
          
          // Show payment method buttons
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
      
      // STEP 2: Phone number input for auto payment
      if (session.step === 'entering_phone' && session.paymentMethod === 'auto') {
        console.log(`📱 Raw input received: "${text}"`);
        
        // Skip if empty
        if (!text || text.trim() === '') {
          console.log('⚠️ Empty message, ignoring');
          return;
        }
        
        // Skip if this is our own instruction message
        if (text.includes('*Automatic Payment*') || 
            text.includes('Please enter your Safaricom phone number')) {
          console.log('⚠️ Ignoring instruction message');
          return;
        }
        
        // Extract digits only
        const cleanedInput = text.replace(/\D/g, '');
        console.log(`📱 Cleaned input: "${cleanedInput}"`);
        
        // Validate phone number (Kenyan format)
        if (cleanedInput.length >= 9 && cleanedInput.length <= 12) {
          const phone = utils.formatPhoneNumber(text);
          console.log(`📱 Formatted phone: ${phone}`);
          
          if (phone.length === 12 && phone.startsWith('254')) {
            sessions.updateSession(sender, { 
              phone: phone,
              step: 'processing_payment'
            });
            
            // Send processing message
            await sock.sendMessage(jid, { 
              text: `⏳ *Processing Payment*\n\nPlease check your phone for STK Push prompt.\nEnter your PIN to complete payment.` 
            });
            
            // Call M-Pesa API
            console.log(`💰 Calling M-Pesa API for ${phone} amount: ${session.bundle.amount}`);
            
            try {
              const result = await mpesa.stkPush(
                phone, 
                session.bundle.amount, 
                `BUNDLE-${Date.now()}`
              );
              
              if (result.success) {
                console.log(`✅ STK Push sent successfully: ${result.transactionId}`);
                
                // Store transaction ID
                sessions.updateSession(sender, { 
                  transactionId: result.transactionId 
                });
                
                // Wait for payment confirmation
                setTimeout(async () => {
                  const currentSession = sessions.getSession(sender);
                  if (currentSession && currentSession.step === 'processing_payment') {
                    
                    // Send success message with buttons
                    const { sendButtons } = require('gifted-btns');
                    
                    await sendButtons(sock, jid, {
                      text: `✅ *PAYMENT SUCCESSFUL!*\n\n` +
                            `📦 *Bundle:* ${session.bundle.name}\n` +
                            `💰 *Amount:* ${utils.formatCurrency(session.bundle.amount)}\n` +
                            `📱 *Phone:* ${session.phone}\n\n` +
                            `Your bundle will be delivered within 5 minutes.`,
                      footer: 'Thank you for choosing Bingwa Sokoni',
                      buttons: [
                        { 
                          name: 'cta_url', 
                          buttonParamsJson: JSON.stringify({ 
                            display_text: '📢 JOIN WHATSAPP CHANNEL', 
                            url: 'https://whatsapp.com/channel/0029Vb81SnR42DcZd0kd7j28' 
                          }) 
                        },
                        { 
                          name: 'cta_url', 
                          buttonParamsJson: JSON.stringify({ 
                            display_text: '👥 JOIN WHATSAPP GROUP', 
                            url: 'https://chat.whatsapp.com/CcGe1DV3vzzBvaNZd9hsoO' 
                          }) 
                        },
                        { 
                          name: 'cta_url', 
                          buttonParamsJson: JSON.stringify({ 
                            display_text: '📱 JOIN TELEGRAM', 
                            url: 'https://t.me/bingwasokoni' 
                          }) 
                        },
                        { 
                          name: 'cta_url', 
                          buttonParamsJson: JSON.stringify({ 
                            display_text: '🌐 VISIT WEBSITE', 
                            url: 'https://bingwasokoni.co.ke' 
                          }) 
                        }
                      ]
                    });
                    
                    sessions.clearSession(sender);
                  }
                }, 30000); // 30 seconds delay
                
              } else {
                console.error('❌ STK Push failed:', result.error);
                await sock.sendMessage(jid, { 
                  text: `❌ *Payment Failed*\n\n${result.error || 'Please try again or use manual payment.'}` 
                });
                sessions.clearSession(sender);
              }
            } catch (error) {
              console.error('❌ M-Pesa API error:', error);
              await sock.sendMessage(jid, { 
                text: `❌ *Payment Error*\n\nPlease try again later or use manual payment.` 
              });
              sessions.clearSession(sender);
            }
            
          } else {
            await sock.sendMessage(jid, { 
              text: '❌ Invalid phone number format. Please use format: 0712345678' 
            });
          }
        } else {
          console.log(`❌ Invalid phone number length: ${cleanedInput.length}`);
          await sock.sendMessage(jid, { 
            text: '❌ Invalid phone number. Please enter a valid Safaricom number.\n\nExample: 0712345678' 
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

// Handle button clicks
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
        await buyCommand.handleButton(sock, msg, buttonId);
      } else {
        console.log('❌ Buy command or handleButton not found');
      }
    } else if (buttonId.startsWith('test_')) {
      const testCommand = commands.get('testbtn');
      if (testCommand && testCommand.handleButton) {
        await testCommand.handleButton(sock, msg, buttonId);
      } else {
        await sock.sendMessage(jid, { 
          text: `✅ Test button *${buttonId}* clicked successfully!` 
        });
      }
    } else if (buttonId === 'help_support') {
      await sock.sendMessage(jid, { 
        text: `📞 *Support*\n\nContact us at: ${config.OWNER_NUMBER}\n\nWe're here to help 24/7!` 
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