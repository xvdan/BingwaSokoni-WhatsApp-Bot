const bundles = {
  data: [
    // Hourly Bundles
    { id: 'd1', name: '1GB - 1 Hour', amount: 19, validity: '1 Hour', category: 'data' },
    { id: 'd2', name: '1.5GB - 3 Hours', amount: 52, validity: '3 Hours', category: 'data' },
    
    // Daily Bundles
    { id: 'd3', name: '250MB - 24Hrs', amount: 20, validity: '24 Hours', category: 'data' },
    { id: 'd4', name: '1GB - 24Hrs', amount: 99, validity: '24 Hours', category: 'data' },
    { id: 'd5', name: '2GB - 24Hrs', amount: 100, validity: '24 Hours', category: 'data' },
    
    // Weekly Bundles
    { id: 'd6', name: '350MB - 7 Days', amount: 49, validity: '7 Days', category: 'data' },
    { id: 'd7', name: '1.25GB - 7 Days', amount: 50, validity: '7 Days', category: 'data' },
    { id: 'd8', name: '2.5GB - 7 Days', amount: 300, validity: '7 Days', category: 'data' },
    { id: 'd9', name: '5GB - 3 Days', amount: 250, validity: '3 Days', category: 'data' },
    { id: 'd10', name: '6GB - 7 Days', amount: 650, validity: '7 Days', category: 'data' }
  ],
  
  sms: [
    { id: 's1', name: '20 SMS', amount: 5, validity: '24 Hours', category: 'sms' },
    { id: 's2', name: '200 SMS', amount: 10, validity: '24 Hours', category: 'sms' },
    { id: 's3', name: '1000 SMS', amount: 30, validity: '7 Days', category: 'sms' }
  ],
  
  voice: [
    { id: 'v1', name: '20 Mins', amount: 22, validity: 'Till Midnight', category: 'voice' },
    { id: 'v2', name: '45 Mins', amount: 25, validity: '3 Hours', category: 'voice' },
    { id: 'v3', name: '50 Mins', amount: 48, validity: 'Till Midnight', category: 'voice' },
    { id: 'v4', name: '100 Mins', amount: 95, validity: 'Till Midnight', category: 'voice' },
    { id: 'v5', name: '100 Mins', amount: 101, validity: 'Till Midnight', category: 'voice' },
    { id: 'v6', name: '200 Mins', amount: 245, validity: '7 Days', category: 'voice' },
    { id: 'v7', name: '500 Mins', amount: 497, validity: '7 Days', category: 'voice' }
  ],
  
  getByCategory(category) {
    return this[category] || [];
  },
  
  getById(id) {
    const allBundles = [...this.data, ...this.sms, ...this.voice];
    return allBundles.find(item => item.id === id);
  }
};

module.exports = bundles;