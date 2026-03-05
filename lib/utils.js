function formatPhoneNumber(phone) {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.slice(1);
  }
  
  // If starts with 7, add 254
  if (cleaned.startsWith('7')) {
    cleaned = '254' + cleaned;
  }
  
  // If it's exactly 12 digits starting with 254, return as is
  if (cleaned.length === 12 && cleaned.startsWith('254')) {
    return cleaned;
  }
  
  // If it's 9 digits (like 712345678), add 254
  if (cleaned.length === 9) {
    return '254' + cleaned;
  }
  
  return cleaned;
}

function formatCurrency(amount) {
  return `KES ${amount.toLocaleString()}`;
}

function formatBundleList(bundles, category) {
  let text = `📦 *${category.toUpperCase()} BUNDLES*\n\n`;
  
  bundles.forEach((bundle, index) => {
    text += `${index + 1}️⃣ *${bundle.name}*\n`;
    text += `   💰 ${formatCurrency(bundle.amount)}\n`;
    text += `   ⏱️ ${bundle.validity}\n\n`;
  });
  
  text += `Reply with the *number* of the bundle you want.`;
  return text;
}

function generateTransactionId() {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
}

module.exports = {
  formatPhoneNumber,
  formatCurrency,
  formatBundleList,
  generateTransactionId
};