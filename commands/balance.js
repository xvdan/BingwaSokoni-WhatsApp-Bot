const utils = require('../lib/utils');
const { sendButtons } = require('gifted-btns');

// Simple in-memory balance storage
const userBalances = new Map();

module.exports = {
  name: 'balance',
  description: 'Check your account balance and points',
  aliases: ['acc', 'points', 'wallet'],

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    // Get or create user balance
    if (!userBalances.has(sender)) {
      userBalances.set(sender, {
        points: 0,
        purchases: 0,
        totalSpent: 0,
        joined: new Date().toLocaleDateString()
      });
    }
    
    const balance = userBalances.get(sender);
    
    const balanceText = `💰 *YOUR ACCOUNT*\n\n` +
                        `📱 *User:* ${sender.split('@')[0]}\n` +
                        `⭐ *Loyalty Points:* ${balance.points}\n` +
                        `📦 *Total Purchases:* ${balance.purchases}\n` +
                        `💵 *Total Spent:* ${utils.formatCurrency(balance.totalSpent)}\n` +
                        `📅 *Member Since:* ${balance.joined}\n\n` +
                        `_Earn 10 points for every purchase!_`;
    
    // Add buttons for quick actions
    try {
      await sendButtons(sock, jid, {
        text: balanceText,
        footer: 'Bingwa Sokoni Rewards',
        buttons: [
          { id: 'category_data', text: '📶 Buy Now' },
          { 
            name: 'cta_url', 
            buttonParamsJson: JSON.stringify({ 
              display_text: '🎁 Redeem Points', 
              url: 'https://bingwasokoni.co.ke/redeem' 
            }) 
          }
        ]
      });
    } catch (error) {
      await sock.sendMessage(jid, { text: balanceText });
    }
  },

  // Helper function to add points after purchase
  addPoints(sender, amount) {
    if (!userBalances.has(sender)) {
      userBalances.set(sender, {
        points: 0,
        purchases: 0,
        totalSpent: 0,
        joined: new Date().toLocaleDateString()
      });
    }
    
    const balance = userBalances.get(sender);
    balance.purchases += 1;
    balance.totalSpent += amount;
    balance.points += 10; // 10 points per purchase
    
    return balance;
  }
};