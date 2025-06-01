// chatstore.js - Message store with mempool monitoring

class ChatStore {
  constructor(explorerApiUrl, contractAddress) {
    this.messages = [];
    this.pendingMessages = new Map(); // txId -> message
    this.explorerApiUrl = explorerApiUrl;
    this.contractAddress = contractAddress;
    this.listeners = [];
    this.pollingInterval = null;
  }
  
  // Start monitoring the mempool and confirmed transactions
  start() {
    // Poll every 5 seconds
    this.pollingInterval = setInterval(() => {
      this.pollMempool();
      this.pollConfirmedTransactions();
    }, 5000);
  }
  
  // Stop monitoring
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  // Add a local message (from current user)
  addLocalMessage(txId, message, senderAddress, timestamp) {
    const msgObj = {
      id: txId,
      content: message,
      sender: senderAddress,
      timestamp: timestamp,
      pending: true
    };
    
    this.pendingMessages.set(txId, msgObj);
    this.notifyListeners();
  }
  
  // Poll mempool for new messages
  async pollMempool() {
    try {
      const response = await fetch(`${this.explorerApiUrl}/mempool/transactions`);
      const data = await response.json();
      
      // Filter for transactions to our contract
      const chatTxs = data.items.filter(tx => {
        return tx.outputs.some(output => output.ergoTree === this.contractAddress);
      });
      
      // Process each relevant transaction
      for (const tx of chatTxs) {
        const output = tx.outputs.find(o => o.ergoTree === this.contractAddress);
        if (output) {
          // Extract message data from registers
          const senderPubKey = output.additionalRegisters.R4;
          const messageHex = output.additionalRegisters.R5;
          const timestamp = parseInt(output.additionalRegisters.R6);
          
          // Convert hex message to string
          const message = Buffer.from(messageHex, 'hex').toString('utf8');
          
          // Create message object
          const msgObj = {
            id: tx.id,
            content: message,
            sender: senderPubKey, // In a real app, you might want to map this to a username
            timestamp: timestamp,
            pending: true
          };
          
          // Add to pending messages if not already there
          if (!this.pendingMessages.has(tx.id)) {
            this.pendingMessages.set(tx.id, msgObj);
            this.notifyListeners();
          }
        }
      }
    } catch (error) {
      console.error("Error polling mempool:", error);
    }
  }
  
  // Poll for confirmed transactions
  async pollConfirmedTransactions() {
    try {
      // Get confirmed boxes at our contract address
      const response = await fetch(`${this.explorerApiUrl}/boxes/byAddress/${this.contractAddress}`);
      const data = await response.json();
      
      const confirmedTxIds = new Set();
      const newMessages = [];
      
      // Process confirmed boxes
      for (const box of data.items) {
        // Extract data from registers
        const senderPubKey = box.additionalRegisters.R4;
        const messageHex = box.additionalRegisters.R5;
        const timestamp = parseInt(box.additionalRegisters.R6);
        
        // Convert hex message to string
        const message = Buffer.from(messageHex, 'hex').toString('utf8');
        
        // Create message object
        const msgObj = {
          id: box.txId,
          content: message,
          sender: senderPubKey,
          timestamp: timestamp,
          pending: false
        };
        
        confirmedTxIds.add(box.txId);
        
        // Add to confirmed messages if not already there
        if (!this.messages.some(m => m.id === box.txId)) {
          newMessages.push(msgObj);
        }
      }
      
      // Add new confirmed messages
      if (newMessages.length > 0) {
        this.messages = [...this.messages, ...newMessages]
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove these from pending
        for (const txId of confirmedTxIds) {
          this.pendingMessages.delete(txId);
        }
        
        this.notifyListeners();
      }
    } catch (error) {
      console.error("Error polling confirmed transactions:", error);
    }
  }
  
  // Subscribe to store updates
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  
  // Notify all listeners of changes
  notifyListeners() {
    // Combine confirmed and pending messages for display
    const allMessages = [
      ...this.messages,
      ...Array.from(this.pendingMessages.values())
    ].sort((a, b) => a.timestamp - b.timestamp);
    
    // Notify all listeners
    for (const listener of this.listeners) {
      listener(allMessages);
    }
  }
  
  // Get all messages (confirmed + pending)
  getAllMessages() {
    return [
      ...this.messages,
      ...Array.from(this.pendingMessages.values())
    ].sort((a, b) => a.timestamp - b.timestamp);
  }
}

export { ChatStore };