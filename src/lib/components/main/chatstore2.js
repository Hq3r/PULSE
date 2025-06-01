// chatstore.ts - Updated for chatrooms and threading
import { decodeHexMessage, fetchMempoolTransactionsByContract } from '$lib/api-explorer/explorer';
import { writable } from 'svelte/store';

// Store for selected chatroom
export const selectedChatroomId = writable('general');

// Message interface with chatroom and threading support
export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  pending: boolean;
  chatroomId: string;
  parentId?: string; // For threads - ID of parent message
  replies?: ChatMessage[]; // Child messages in thread
  replyTo?: {
    id: string;
    sender: string;
    content: string;
  } | null;
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
      R7?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
      R8?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
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
    R7?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
    R8?: string | { serializedValue: string, sigmaType: string, renderedValue: string };
    [key: string]: any;
  };
  value: number;
}

// Message update listener type
type MessageUpdateListener = (messages: ChatMessage[], chatroomId: string) => void;

/**
 * Manages chat messages from both mempool and confirmed transactions
 * with support for chatrooms and threading
 */
export class ChatStore {
  private messagesByChatroom: Map<string, ChatMessage[]>;
  private pendingMessages: Map<string, ChatMessage>;
  private explorerApiUrl: string;
  private contractAddress: string;
  private listeners: MessageUpdateListener[];
  private pollingInterval: number | null;
  private currentChatroomId: string;
  
  /**
   * Create a new ChatStore instance
   * @param explorerApiUrl The URL for the Ergo explorer API
   * @param contractAddress The P2S address of the chat contract
   */
  constructor(explorerApiUrl: string, contractAddress: string) {
    this.messagesByChatroom = new Map<string, ChatMessage[]>();
    this.pendingMessages = new Map<string, ChatMessage>();
    this.explorerApiUrl = explorerApiUrl;
    this.contractAddress = contractAddress;
    this.listeners = [];
    this.pollingInterval = null;
    this.currentChatroomId = 'general'; // Default chatroom
    
    // Subscribe to changes in selected chatroom
    selectedChatroomId.subscribe(chatroomId => {
      this.currentChatroomId = chatroomId;
      this.notifyListeners();
    });
    
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
   * @param chatroomId Chatroom identifier
   * @param parentId Optional parent message ID for replies
   */
  public addLocalMessage(
    txId: string, 
    message: string, 
    senderAddress: string, 
    timestamp: number,
    chatroomId: string = this.currentChatroomId,
    parentId?: string,
    replyTo?: { id: string, sender: string, content: string }
  ): void {
    const msgObj: ChatMessage = {
      id: txId,
      content: message,
      sender: senderAddress,
      timestamp: timestamp,
      chatroomId: chatroomId,
      pending: true
    };
    
    // Add threading information if this is a reply
    if (parentId) {
      msgObj.parentId = parentId;
      msgObj.replyTo = replyTo || null;
    }
    
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
              
              // Extract chatroom data (R7) - default to "general" if not present
              let chatroomRaw = this.extractRegisterValue(output.additionalRegisters.R7);
              const chatroomId = chatroomRaw ? decodeHexMessage(chatroomRaw) : "general";
              
              // Extract parent message ID if present (R8)
              let parentIdRaw = this.extractRegisterValue(output.additionalRegisters.R8);
              const parentId = parentIdRaw ? decodeHexMessage(parentIdRaw) : undefined;
              
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
                chatroomId,
                pending: true
              };
              
              // Add parent ID if it exists
              if (parentId) {
                msgObj.parentId = parentId;
                
                // Try to find parent message to extract reply preview info
                const parent = this.findMessageById(parentId);
                if (parent) {
                  msgObj.replyTo = {
                    id: parent.id,
                    sender: parent.sender,
                    content: parent.content
                  };
                }
              }
              
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
   * Find a message by its ID across all chatrooms and message types
   */
  private findMessageById(messageId: string): ChatMessage | undefined {
    // Check in current chatroom first
    const currentRoomMessages = this.messagesByChatroom.get(this.currentChatroomId) || [];
    
    // Function to search in a message and its replies
    const searchInMessages = (messages: ChatMessage[]): ChatMessage | undefined => {
      for (const msg of messages) {
        if (msg.id === messageId) {
          return msg;
        }
        
        // Recursively search in replies
        if (msg.replies && msg.replies.length > 0) {
          const found = searchInMessages(msg.replies);
          if (found) return found;
        }
      }
      return undefined;
    };
    
    // Search current room
    const found = searchInMessages(currentRoomMessages);
    if (found) return found;
    
    // Search all other chatrooms
    for (const [roomId, messages] of this.messagesByChatroom.entries()) {
      if (roomId !== this.currentChatroomId) {
        const found = searchInMessages(messages);
        if (found) return found;
      }
    }
    
    // Check pending messages
    for (const msg of this.pendingMessages.values()) {
      if (msg.id === messageId) {
        return msg;
      }
    }
    
    return undefined;
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
      const newMessagesByRoom = new Map<string, ChatMessage[]>();
      
      // Process confirmed boxes
      for (const box of data.items as ExplorerBox[]) {
        if (box.additionalRegisters && box.additionalRegisters.R4 && 
            box.additionalRegisters.R5 && box.additionalRegisters.R6) {
            
          try {
            // Extract data from registers
            const senderRaw = this.extractRegisterValue(box.additionalRegisters.R4);
            const messageRaw = this.extractRegisterValue(box.additionalRegisters.R5);
            const timestampRaw = this.extractRegisterValue(box.additionalRegisters.R6);
            
            // Extract chatroom data (R7) - default to "general" if not present
            let chatroomRaw = this.extractRegisterValue(box.additionalRegisters.R7);
            const chatroomId = chatroomRaw ? decodeHexMessage(chatroomRaw) : "general";
            
            // Extract parent message ID if present (R8)
            let parentIdRaw = this.extractRegisterValue(box.additionalRegisters.R8);
            const parentId = parentIdRaw ? decodeHexMessage(parentIdRaw) : undefined;
            
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
              chatroomId,
              pending: false
            };
            
            // Add parent ID if it exists
            if (parentId) {
              msgObj.parentId = parentId;
            }
            
            confirmedTxIds.add(msgObj.id);
            
            // Add to the appropriate chatroom collection
            if (!newMessagesByRoom.has(chatroomId)) {
              newMessagesByRoom.set(chatroomId, []);
            }
            newMessagesByRoom.get(chatroomId)!.push(msgObj);
          } catch (error) {
            console.error("Error processing confirmed box:", error, box);
          }
        }
      }
      
      // Process new messages by room
      for (const [roomId, messages] of newMessagesByRoom.entries()) {
        // Get current messages for this room
        const currentMessages = this.messagesByChatroom.get(roomId) || [];
        
        // Filter out messages that are already known
        const newMessages = messages.filter(newMsg => 
          !currentMessages.some(existingMsg => existingMsg.id === newMsg.id)
        );
        
        if (newMessages.length > 0) {
          console.log(`Added ${newMessages.length} new messages to room ${roomId}`);
          
          // Add new messages to this room
          this.messagesByChatroom.set(roomId, [
            ...currentMessages,
            ...newMessages
          ]);
        }
      }
      
      // Organize threaded messages after all messages are loaded
      this.organizeThreadedMessages();
      
      // Remove confirmed messages from pending
      for (const txId of confirmedTxIds) {
        this.pendingMessages.delete(txId);
      }
      
      // Notify listeners of changes
      this.notifyListeners();
      
      // Save to localStorage for persistence
      this.saveToLocalStorage();
    } catch (error) {
      console.error("Error polling confirmed transactions:", error);
    }
  }
  
  /**
   * Organize messages into a threaded structure
   */
  private organizeThreadedMessages(): void {
    // Process each chatroom
    for (const [roomId, messages] of this.messagesByChatroom.entries()) {
      // First, reset any existing reply structures to start fresh
      for (const msg of messages) {
        msg.replies = [];
      }
      
      // Create a map of message IDs to messages for easy lookup
      const messageMap = new Map<string, ChatMessage>();
      for (const msg of messages) {
        messageMap.set(msg.id, msg);
      }
      
      // Collect root messages and assign child messages to parents
      const rootMessages: ChatMessage[] = [];
      
      for (const msg of messages) {
        if (msg.parentId) {
          // This is a reply - find its parent
          const parent = messageMap.get(msg.parentId);
          if (parent) {
            // Add this message as a reply to its parent
            if (!parent.replies) {
              parent.replies = [];
            }
            
            // Add reply info if it's missing
            if (!msg.replyTo) {
              msg.replyTo = {
                id: parent.id,
                sender: parent.sender,
                content: parent.content
              };
            }
            
            parent.replies.push(msg);
          } else {
            // Parent not found - treat as a root message
            rootMessages.push(msg);
          }
        } else {
          // This is a root message
          rootMessages.push(msg);
        }
      }
      
      // Sort replies by timestamp within each parent message
      for (const msg of messages) {
        if (msg.replies && msg.replies.length > 0) {
          msg.replies.sort((a, b) => a.timestamp - b.timestamp);
        }
      }
      
      // Update the chatroom with organized messages
      this.messagesByChatroom.set(roomId, rootMessages.sort((a, b) => a.timestamp - b.timestamp));
    }
  }
  
  /**
   * Save messages to localStorage for persistence
   */
  private saveToLocalStorage(): void {
    try {
      // Store messages by chatroom
      for (const [roomId, messages] of this.messagesByChatroom.entries()) {
        // Only store the most recent 1000 messages per room to avoid size limits
        const messagesToStore = messages.slice(-1000);
        localStorage.setItem(`ergoChat_messages_${roomId}`, JSON.stringify(messagesToStore));
      }
      
      // Store pending messages
      localStorage.setItem('ergoChat_mempool', JSON.stringify(Array.from(this.pendingMessages.values())));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }
  
  /**
   * Load messages from localStorage
   */
  public loadFromLocalStorage(): void {
    try {
      // Attempt to find any chatroom data in localStorage
      const keys = Object.keys(localStorage);
      const chatRoomKeys = keys.filter(key => key.startsWith('ergoChat_messages_'));
      
      for (const key of chatRoomKeys) {
        const roomId = key.replace('ergoChat_messages_', '');
        const storedData = localStorage.getItem(key);
        
        if (storedData) {
          const messages = JSON.parse(storedData) as ChatMessage[];
          this.messagesByChatroom.set(roomId, messages);
          console.log(`Loaded ${messages.length} cached messages for room ${roomId}`);
        }
      }
      
      // Load pending messages
      const pendingData = localStorage.getItem('ergoChat_mempool');
      if (pendingData) {
        const pendingMessages = JSON.parse(pendingData) as ChatMessage[];
        
        // Filter out old messages (older than 10 minutes)
        const now = Date.now();
        const recentPending = pendingMessages.filter(msg => 
          (now - msg.timestamp * 1000) < 10 * 60 * 1000
        );
        
        for (const msg of recentPending) {
          this.pendingMessages.set(msg.id, msg);
        }
        
        console.log(`Loaded ${recentPending.length} cached pending messages`);
      }
      
      // Organize threaded messages
      this.organizeThreadedMessages();
      
      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      console.error("Error loading from localStorage:", error);
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
    callback(this.getMessagesForCurrentRoom(), this.currentChatroomId);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  
  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    const messages = this.getMessagesForCurrentRoom();
    
    // Notify all listeners
    for (const listener of this.listeners) {
      listener(messages, this.currentChatroomId);
    }
  }
  
  /**
   * Get messages for current chatroom
   * @returns Array of messages for current room, sorted by timestamp
   */
  private getMessagesForCurrentRoom(): ChatMessage[] {
    // Get confirmed messages for the current room
    const confirmedMessages = this.messagesByChatroom.get(this.currentChatroomId) || [];
    
    // Get pending messages for the current room
    const pendingForRoom = Array.from(this.pendingMessages.values())
      .filter(msg => msg.chatroomId === this.currentChatroomId || !msg.chatroomId);
    
    // Combine and sort all messages
    return [
      ...confirmedMessages,
      ...pendingForRoom
    ].sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Get all chatroom IDs
   * @returns Array of all chatroom IDs
   */
  public getAllChatroomIds(): string[] {
    return Array.from(this.messagesByChatroom.keys());
  }
  
  /**
   * Get message count by chatroom
   * @returns Map of chatroom IDs to message counts
   */
  public getMessageCountByRoom(): Map<string, number> {
    const counts = new Map<string, number>();
    
    for (const [roomId, messages] of this.messagesByChatroom.entries()) {
      counts.set(roomId, messages.length);
    }
    
    // Add pending messages to counts
    for (const msg of this.pendingMessages.values()) {
      const roomId = msg.chatroomId || 'general';
      counts.set(roomId, (counts.get(roomId) || 0) + 1);
    }
    
    return counts;
  }
}