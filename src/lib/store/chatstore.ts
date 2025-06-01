// chatstore.ts - Message store with mempool monitoring
import { decodeHexMessage, fetchMempoolTransactionsByContract } from '$lib/api-explorer/explorer';

// Message interface
export interface ChatMessage {
  id: string;          // Transaction ID
  content: string;     // Message content
  sender: string;      // Sender address or public key
  timestamp: number;   // Unix timestamp
  pending: boolean;    // Whether the message is pending or confirmed
}

// Explorer transaction interface
interface ExplorerTransaction {
  id: string;
  inputs: any[];
  outputs: Array<{
    id: string;
    boxId: string;
    address: string;
    ergoTree: string;
    assets: any[];
    additionalRegisters: {
      R4?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
      R5?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
      R6?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
      [key: string]: any;
    };
    value: number;
  }>;
}

// Explorer box interface
interface ExplorerBox {
  id: string;
  boxId: string;
  transactionId: string;
  address: string;
  ergoTree: string;
  assets: any[];
  additionalRegisters: {
    R4?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
    R5?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
    R6?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
    [key: string]: any;
  };
  value: number;
}

// Message update listener type
type MessageUpdateListener = (messages: ChatMessage[]) => void;

/**
 * Manages chat messages from both mempool and confirmed transactions
 */
export class ChatStore {
  private messages: ChatMessage[];
  private pendingMessages: Map<string, ChatMessage>;
  private explorerApiUrl: string;
  private contractAddress: string;
  private listeners: MessageUpdateListener[];
  private pollingInterval: number | null;
  
  /**
   * Create a new ChatStore instance
   * @param explorerApiUrl The URL for the Ergo explorer API
   * @param contractAddress The P2S address of the chat contract
   */
  constructor(explorerApiUrl: string, contractAddress: string) {
    this.messages = [];
    this.pendingMessages = new Map<string, ChatMessage>();
    this.explorerApiUrl = explorerApiUrl;
    this.contractAddress = contractAddress;
    this.listeners = [];
    this.pollingInterval = null;
    
    console.log(`ChatStore initialized with contract: ${contractAddress}`);
  }
  
  /**
   * Start monitoring the mempool and confirmed transactions
   */
  public start(): void {
    // Poll every 5 seconds
    this.pollingInterval = window.setInterval(() => {
      this.pollMempool();
      this.pollConfirmedTransactions();
    }, 5000);
    
    // Do an initial poll immediately
    this.pollConfirmedTransactions();
    this.pollMempool();
    
    console.log("ChatStore polling started");
  }
  
  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("ChatStore polling stopped");
    }
  }
  
  /**
   * Add a local message (from current user)
   * @param txId Transaction ID
   * @param message Message content
   * @param senderAddress Sender address
   * @param timestamp Unix timestamp
   */
  public addLocalMessage(
    txId: string, 
    message: string, 
    senderAddress: string, 
    timestamp: number
  ): void {
    const msgObj: ChatMessage = {
      id: txId,
      content: message,
      sender: senderAddress,
      timestamp: timestamp,
      pending: true
    };
    
    this.pendingMessages.set(txId, msgObj);
    this.notifyListeners();
    
    console.log(`Local message added: ${message.substring(0, 20)}...`);
  }
  
  /**
   * Extract register value regardless of format
   * @param register The register value which could be a string or object
   * @returns The extracted value as a string
   */
  private extractRegisterValue(register: any): string {
    if (!register) return '';
    
    // If it's a string, return it directly
    if (typeof register === 'string') {
      return register;
    }
    
    // If it's an object with renderedValue, use that
    if (register.renderedValue) {
      return register.renderedValue;
    }
    
    // If it's an object with serializedValue, use that
    if (register.serializedValue) {
      return register.serializedValue;
    }
    
    // If it has a value field, use that
    if (register.value) {
      return register.value;
    }
    
    // Fall back to string representation
    return String(register);
  }
  
  /**
   * Poll mempool for new messages
   */
  private async pollMempool(): Promise<void> {
    try {
      // Use the byAddress endpoint to get mempool transactions for our contract
      const transactions = await fetchMempoolTransactionsByContract(this.contractAddress);
      
      // Process each relevant transaction
      for (const tx of transactions) {
        // Find outputs to our contract address
        const chatOutputs = tx.outputs.filter(out => out.address === this.contractAddress || out.ergoTree === this.contractAddress);
        
        for (const output of chatOutputs) {
          if (output.additionalRegisters && output.additionalRegisters.R4 && 
              output.additionalRegisters.R5 && output.additionalRegisters.R6) {
            
            try {
              // Extract message data from registers
              const senderRaw = this.extractRegisterValue(output.additionalRegisters.R4);
              const messageRaw = this.extractRegisterValue(output.additionalRegisters.R5);
              const timestampRaw = this.extractRegisterValue(output.additionalRegisters.R6);
              
              // Decode sender if it's hex
              const sender = decodeHexMessage(senderRaw);
              
              // Decode message content if it's hex
              const content = decodeHexMessage(messageRaw);
              
              // Parse timestamp
              let timestamp = 0;
              if (typeof timestampRaw === 'number') {
                timestamp = timestampRaw;
              } else {
                timestamp = parseInt(timestampRaw);
              }
              
              // Create message object
              const msgObj: ChatMessage = {
                id: tx.id,
                content,
                sender,
                timestamp,
                pending: true
              };
              
              // Add to pending messages if not already there
              if (!this.pendingMessages.has(tx.id)) {
                this.pendingMessages.set(tx.id, msgObj);
                console.log(`Mempool message added: ${content.substring(0, 20)}...`);
                this.notifyListeners();
              }
            } catch (error) {
              console.error("Error processing mempool output:", error, output);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error polling mempool:", error);
    }
  }
  
  /**
   * Poll for confirmed transactions
   */
  private async pollConfirmedTransactions(): Promise<void> {
    try {
      // Get confirmed boxes at our contract address
      const response = await fetch(`${this.explorerApiUrl}/boxes/byAddress/${this.contractAddress}`);
      
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      console.log(`Found ${data.items.length} confirmed boxes`);
      
      const confirmedTxIds = new Set<string>();
      const newMessages: ChatMessage[] = [];
      
      // Process confirmed boxes
      for (const box of data.items as ExplorerBox[]) {
        if (box.additionalRegisters && box.additionalRegisters.R4 && 
            box.additionalRegisters.R5 && box.additionalRegisters.R6) {
            
          try {
            // Extract data from registers
            const senderRaw = this.extractRegisterValue(box.additionalRegisters.R4);
            const messageRaw = this.extractRegisterValue(box.additionalRegisters.R5);
            const timestampRaw = this.extractRegisterValue(box.additionalRegisters.R6);
            
            // Decode sender if it's hex
            const sender = decodeHexMessage(senderRaw);
            
            // Decode message content if it's hex
            const content = decodeHexMessage(messageRaw);
            
            // Parse timestamp
            let timestamp = 0;
            if (typeof timestampRaw === 'number') {
              timestamp = timestampRaw;
            } else {
              timestamp = parseInt(timestampRaw);
            }
            
            // Create message object
            const msgObj: ChatMessage = {
              id: box.transactionId || box.boxId,
              content,
              sender,
              timestamp,
              pending: false
            };
            
            confirmedTxIds.add(msgObj.id);
            
            // Add to confirmed messages if not already there
            if (!this.messages.some(m => m.id === msgObj.id)) {
              console.log(`Confirmed message added: ${content.substring(0, 20)}...`);
              newMessages.push(msgObj);
            }
          } catch (error) {
            console.error("Error processing confirmed box:", error, box);
          }
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
  
  /**
   * Subscribe to store updates
   * @param callback Function to call when messages are updated
   * @returns Unsubscribe function
   */
  public subscribe(callback: MessageUpdateListener): () => void {
    this.listeners.push(callback);
    // Call immediately with current state
    callback(this.getAllMessages());
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  
  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    // Combine confirmed and pending messages for display
    const allMessages = this.getAllMessages();
    
    // Notify all listeners
    for (const listener of this.listeners) {
      listener(allMessages);
    }
  }
  
  /**
   * Get all messages (confirmed + pending)
   * @returns Array of all messages, sorted by timestamp
   */
  public getAllMessages(): ChatMessage[] {
    return [
      ...this.messages,
      ...Array.from(this.pendingMessages.values())
    ].sort((a, b) => a.timestamp - b.timestamp);
  }
}