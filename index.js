const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('gifted-baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const { loadCommands, handleMessage, handleStatus } = require('./handler');

// Create session directory if it doesn't exist
if (!fs.existsSync('./session')) {
  fs.mkdirSync('./session');
}

// Load session from SESSION_ID
async function loadSessionFromEnv() {
  if (config.SESSION_ID) {
    try {
      const sessionBuffer = Buffer.from(config.SESSION_ID, 'base64');
      fs.writeFileSync('./session/creds.json', sessionBuffer);
      console.log('✅ Session loaded from SESSION_ID');
    } catch (error) {
      console.error('❌ Failed to load session:', error.message);
    }
  }
}

// Main bot function
async function startBot() {
  try {
    // Load commands
    loadCommands();
    
    // Load session from env
    await loadSessionFromEnv();
    
    // Get auth state
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    // Create socket connection
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'silent' }),
      browser: ['Bingwa Sokoni', 'Safari', '3.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true
    });
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 Scan this QR code with WhatsApp:');
        require('qrcode-terminal').generate(qr, { small: true });
      }
      
      if (connection === 'open') {
        console.log('✅ Bot connected successfully!');
        console.log(`🤖 Bot Name: ${config.BOT_NAME}`);
        console.log(`📱 Owner: ${config.OWNER_NUMBER}`);
        console.log(`⚡ Prefix: ${config.PREFIX}`);
        
        // Send startup message to owner
        await sock.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
          text: `✅ *${config.BOT_NAME}* is now online!\n\nMode: ${config.MODE}\nTime: ${new Date().toLocaleString()}`
        });
      }
      
      if (connection === 'close') {
        const shouldReconnect = 
          (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== 
          DisconnectReason.loggedOut;
        
        console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
        
        if (shouldReconnect) {
          startBot();
        } else {
          console.log('❌ Logged out. Please update SESSION_ID');
        }
      }
    });
    
    // Handle messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      const msg = messages[0];
      
      if (!msg.message) return;
      
      // Handle status updates
      if (msg.key.remoteJid === 'status@broadcast') {
        await handleStatus(sock, msg);
        return;
      }
      
      // Handle normal messages
      await handleMessage(sock, msg);
    });
    
    // Handle group participants update
    sock.ev.on('group-participants.update', async (update) => {
      // Handle group events if needed
    });
    
    return sock;
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Start the bot
startBot();

// Handle process termination
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});