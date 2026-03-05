const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('gifted-baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');
const config = require('./config');
const { loadCommands, handleMessage, handleStatus } = require('./handler-simple');

// Create session directory if it doesn't exist
const sessionDir = path.join(__dirname, 'session');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Load session from SESSION_ID (LINGO~ format)
async function loadSessionFromEnv() {
  try {
    if (!config.SESSION_ID) {
      console.log('❌ No SESSION_ID provided in .env file');
      console.log('📱 QR code will be generated for pairing');
      return false;
    }

    console.log('🔐 Loading session from SESSION_ID...');
    
    // Check if it's in LINGO~ format
    if (!config.SESSION_ID.startsWith('LINGO~')) {
      console.log('❌ Invalid session format. Expected LINGO~...');
      return false;
    }

    // Remove LINGO~ prefix
    const encoded = config.SESSION_ID.replace('LINGO~', '');
    
    // Decode base64
    const buffer = Buffer.from(encoded, 'base64');
    
    // Decompress gzip
    const decompressed = zlib.gunzipSync(buffer);
    
    // Parse JSON
    const sessionData = JSON.parse(decompressed.toString());
    
    // Save to creds.json
    const credsPath = path.join(sessionDir, 'creds.json');
    fs.writeFileSync(credsPath, JSON.stringify(sessionData, null, 2));
    
    console.log('✅ Session loaded successfully from SESSION_ID');
    console.log('📁 Session saved to:', credsPath);
    
    // Verify the file was written
    if (fs.existsSync(credsPath)) {
      const stats = fs.statSync(credsPath);
      console.log(`📊 Session file size: ${stats.size} bytes`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to load session:', error.message);
    console.log('📱 Falling back to QR code authentication...');
    return false;
  }
}

// Main bot function
async function startBot() {
  try {
    console.log('🚀 Starting Bingwa Sokoni Bot...');
    
    // Load commands
    loadCommands();
    console.log('✅ Commands loaded');
    
    // Load session from env
    const sessionLoaded = await loadSessionFromEnv();
    
    // Get auth state
    console.log('📂 Loading auth state from session folder...');
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // Get latest Baileys version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📱 Using WA version: ${version.join('.')} (${isLatest ? 'latest' : 'outdated'})`);
    
    // Create socket connection
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: !sessionLoaded, // Only print QR if no session
      logger: P({ level: 'silent' }),
      browser: ['Bingwa Sokoni', 'Safari', '3.0'],
      version,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false
    });
    
    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr && !sessionLoaded) {
        console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:\n');
        require('qrcode-terminal').generate(qr, { small: true });
        console.log('\n⏳ Waiting for scan...');
      }
      
      if (connection === 'open') {
        console.log('\n✅✅✅ BOT CONNECTED SUCCESSFULLY ✅✅✅');
        console.log('=' .repeat(50));
        console.log(`🤖 Bot Name: ${config.BOT_NAME}`);
        console.log(`📱 Owner: ${config.OWNER_NUMBER}`);
        console.log(`⚡ Prefix: ${config.PREFIX}`);
        console.log(`📊 Session: ${sessionLoaded ? 'Loaded from ENV' : 'New session'}`);
        console.log(`⏰ Time: ${new Date().toLocaleString()}`);
        console.log('=' .repeat(50));
        
        // Send startup message to owner
        try {
          await sock.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', {
            text: `✅ *${config.BOT_NAME}* is now online!\n\n` +
                  `📱 *Status:* Connected\n` +
                  `⚡ *Mode:* ${config.MODE}\n` +
                  `⏰ *Time:* ${new Date().toLocaleString()}\n\n` +
                  `Type *${config.PREFIX}help* to see commands.`
          });
          console.log('📨 Startup message sent to owner');
        } catch (e) {
          console.log('⚠️ Could not send startup message to owner');
        }
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error instanceof Boom 
          ? lastDisconnect.error.output.statusCode 
          : 500;
        
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`⚠️ Connection closed. Status code: ${statusCode}`);
        console.log('Reconnecting:', shouldReconnect);
        
        if (shouldReconnect) {
          console.log('🔄 Attempting to reconnect in 5 seconds...');
          setTimeout(() => {
            startBot();
          }, 5000);
        } else {
          console.log('❌ Logged out. Session expired or invalid.');
          console.log('🗑️ Please delete the session folder and get a new SESSION_ID');
          
          // Clean up invalid session
          if (fs.existsSync(sessionDir)) {
            fs.emptyDirSync(sessionDir);
          }
        }
      }
    });
    
    // Handle messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      const msg = messages[0];
      
      if (!msg.message) return;
      
      // Handle status updates
      if (msg.key.remoteJid === 'status@broadcast') {
        if (config.AUTO_READ_STATUS || config.AUTO_LIKE_STATUS) {
          await handleStatus(sock, msg);
        }
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
    console.error('❌ Fatal error in startBot:', error);
    console.log('🔄 Restarting in 10 seconds...');
    setTimeout(() => {
      startBot();
    }, 10000);
  }
}

// Handle process termination
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.log('⚠️ Bot will continue running...');
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  console.log('⚠️ Bot will continue running...');
});

// Start the bot
startBot();

module.exports = { startBot };