// mainUtils.js - Complete fixed version with all missing functions

import { 
    ENCRYPTION_CONFIG, 
    STORAGE_KEYS, 
    REGEX_PATTERNS, 
    ERROR_MESSAGES,
    SUPPORTED_TOKENS,
    API_ENDPOINTS
  } from '$lib/common/mainConsts.js';
  
  // ============= Address Utilities =============
  
  /**
   * Clean address by removing "3" prefix if present
   * @param {string} address - The address to clean
   * @returns {string} - Cleaned address
   */
  export function cleanAddress(address) {
    if (!address) return '';
    if (address.startsWith('3') && address.length > 50) {
      return address.substring(1);
    }
    return address;
  }
  export async function createStream({ url, name }) {
  if (!url || !name) {
    throw new Error("Missing stream URL or name");
  }

  // Example structure you may use — adapt as per your blockchain method
  const streamData = {
    name,
    url,
    timestamp: Date.now(),
  };

  try {
    // Assuming your project uses a transaction builder
    const tx = await createStreamRoomTx(streamData);
    const result = await signAndSubmit(tx);
    return result;
  } catch (error) {
    console.error("Error creating stream:", error);
    throw error;
  }
}
  /**
   * Truncate address for display
   * @param {string} address - The address to truncate
   * @param {number} startChars - Number of characters to show at start
   * @param {number} endChars - Number of characters to show at end
   * @returns {string} - Truncated address
   */
  export function truncateAddress(address, startChars = 6, endChars = 4) {
    if (!address) return 'Unknown';
    
    const cleaned = cleanAddress(address);
    if (cleaned.length <= startChars + endChars) {
      return cleaned;
    }
    
    return `${cleaned.substring(0, startChars)}...${cleaned.substring(cleaned.length - endChars)}`;
  }
  
  // ============= Encryption/Decryption Utilities =============
  
  /**
   * Encrypt a message for blockchain storage
   * @param {string} message - The plain text message to encrypt
   * @param {string} secretKey - Optional secret key
   * @returns {string} - Encrypted message with prefix
   */
  export function encryptMessage(message, secretKey = ENCRYPTION_CONFIG.SECRET_KEY) {
    if (!message) return "";
    
    let encrypted = "";
    
    for (let i = 0; i < message.length; i++) {
      const charCode = message.charCodeAt(i);
      const keyChar = secretKey.charCodeAt((i + (i % 5)) % secretKey.length);
      const encryptedChar = charCode ^ keyChar;
      const hexChar = encryptedChar.toString(16).padStart(2, '0');
      encrypted += hexChar;
    }
    
    return ENCRYPTION_CONFIG.ENCRYPTED_PREFIX + encrypted;
  }
  
 
  
  /**
   * Check if text appears to be encrypted
   * @param {string} text - Text to check
   * @returns {boolean} - True if it looks encrypted
   */
  export function isEncryptedText(text) {
    if (!text || typeof text !== 'string' || !text.startsWith(ENCRYPTION_CONFIG.ENCRYPTED_PREFIX)) {
      return false;
    }
    
    const hexPart = text.substring(4);
    return REGEX_PATTERNS.HEX.test(hexPart);
  }

  
  // ============= Room Code Encryption =============
  
  /**
   * Encrypt room codes
   * @param {string} code - The room code to encrypt
   * @param {string} secretKey - Optional secret key
   * @returns {string} - Encrypted room code
   */
  export function encryptRoomCode(code, secretKey = ENCRYPTION_CONFIG.SECRET_KEY) {
    if (!code) return "";
    
    const codeStr = String(code);
    let encrypted = "";
    
    for (let i = 0; i < codeStr.length; i++) {
      const codeChar = codeStr.charCodeAt(i);
      const keyChar = secretKey.charCodeAt(i % secretKey.length);
      const encryptedChar = codeChar ^ keyChar;
      const hexChar = encryptedChar.toString(16).padStart(2, '0');
      encrypted += hexChar;
    }
    
    return ENCRYPTION_CONFIG.ENCRYPTED_PREFIX + encrypted;
  }
  
  /**
   * Decrypt room codes
   * @param {string} encrypted - The encrypted room code
   * @param {string} secretKey - Optional secret key
   * @returns {string} - Decrypted room code
   */
  export function decryptRoomCode(encrypted, secretKey = ENCRYPTION_CONFIG.SECRET_KEY) {
    if (!encrypted || !encrypted.startsWith(ENCRYPTION_CONFIG.ENCRYPTED_PREFIX)) return "";
    
    const hexStr = encrypted.substring(4);
    let decrypted = "";
    
    for (let i = 0; i < hexStr.length; i += 2) {
      if (i + 1 >= hexStr.length) break;
      
      const hexPair = hexStr.substring(i, i + 2);
      const encryptedChar = parseInt(hexPair, 16);
      const keyChar = secretKey.charCodeAt((i/2) % secretKey.length);
      const decryptedChar = encryptedChar ^ keyChar;
      
      decrypted += String.fromCharCode(decryptedChar);
    }
    
    return decrypted;
  }
  
  /**
   * Check if a string looks like an encrypted room code
   * @param {string} code - The code to check
   * @returns {boolean} - True if encrypted
   */
  export function isEncryptedRoomCode(code) {
    return code && typeof code === 'string' && code.startsWith(ENCRYPTION_CONFIG.ENCRYPTED_PREFIX);
  }
  
  // ============= Data Encoding/Decoding =============
  
  /**
   * Decode Ergo hex data
   * @param {string} hex - The hex string to decode
   * @returns {string} - Decoded string
   */
  export function decodeErgoHex(hex) {
    try {
      if (!hex || typeof hex !== 'string') {
        return String(hex);
      }
      
      if (REGEX_PATTERNS.HEX.test(hex)) {
        if (hex.startsWith('0e')) {
          hex = hex.substring(4);
          const bytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substring(i, i + 2), 16));
          }
          const result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
          return result;
        }
      }
      
      return hex;
    } catch (e) {
      return String(hex);
    }
  }
  
  /**
   * Extract register value from various formats
   * @param {*} register - The register data
   * @returns {string} - Extracted value
   */
  export function extractRegisterValue(register) {
    if (!register) return '';
    
    if (typeof register === 'string') {
      return register;
    }
    
    if (register.renderedValue) {
      return register.renderedValue;
    }
    
    if (register.serializedValue) {
      return register.serializedValue;
    }
    
    return String(register);
  }
  
  // ============= Token Utilities =============
  
  /**
   * Resolve token information from name or ID
   * @param {string} tokenIdOrName - Token identifier
   * @returns {Promise<Object>} - Token information
   */
  export async function resolveTokenInfo(tokenIdOrName) {
    console.log(`Resolving token info for: ${tokenIdOrName}`);
    
    // Check if it's a supported token name (case insensitive)
    const upperTokenName = tokenIdOrName.toUpperCase();
    if (SUPPORTED_TOKENS[upperTokenName]) {
      const [tokenId, decimals] = SUPPORTED_TOKENS[upperTokenName];
      console.log(`Found supported token: ${upperTokenName}, ID: ${tokenId}, decimals: ${decimals}`);
      return {
        tokenId: tokenId,
        name: upperTokenName,
        decimals: decimals
      };
    }
    
    // Check if it's a supported token ID
    for (const [name, [id, decimals]] of Object.entries(SUPPORTED_TOKENS)) {
      if (id === tokenIdOrName) {
        return {
          tokenId: id,
          name: name,
          decimals: decimals
        };
      }
    }
    
    // Check if it's a valid token ID
    const isTokenId = REGEX_PATTERNS.TOKEN_ID.test(tokenIdOrName);
    
    if (isTokenId) {
      console.log(`${tokenIdOrName} appears to be an unsupported token ID, using fallback...`);
      // Fallback for unsupported tokens
      return {
        tokenId: tokenIdOrName,
        name: tokenIdOrName.substring(0, 8) + '...',
        decimals: 0
      };
    }
    
    throw new Error(`Unsupported token: ${tokenIdOrName}. Please use one of the supported tokens or a valid token ID.`);
  }
  
  // ============= DM Room Utilities =============
  
  /**
   * Create DM room ID from two addresses
   * @param {string} addr1 - First address
   * @param {string} addr2 - Second address
   * @returns {string} - DM room ID
   */
  export function createDMRoomId(addr1, addr2) {
    const cleanAddr1 = cleanAddress(addr1);
    const cleanAddr2 = cleanAddress(addr2);
    const addresses = [cleanAddr1, cleanAddr2].sort();
    return `dm-${addresses[0]}-${addresses[1]}`;
  }
  
  /**
   * Get other user from DM room ID
   * @param {string} roomId - DM room ID
   * @param {string} currentUser - Current user address
   * @returns {string} - Other user address
   */
  export function getOtherUserFromDMRoom(roomId, currentUser) {
    if (!roomId.startsWith('dm-')) return '';
    
    const parts = roomId.replace('dm-', '').split('-');
    const addr1 = parts[0];
    const addr2 = parts[1];
    
    const cleanCurrentUser = cleanAddress(currentUser);
    
    if (cleanAddress(addr1) === cleanCurrentUser) {
      return addr2;
    } else if (cleanAddress(addr2) === cleanCurrentUser) {
      return addr1;
    }
    
    return '';
  }
  
  // ============= Stream Utilities =============
  
  /**
   * Check if a message is a stream announcement
   * @param {Object} message - Message object
   * @returns {boolean} - True if it's a stream announcement
   */
  export function isStreamAnnouncement(message) {
    if (message.isStreamAnnouncement) return true;
    
    // Detect stream URLs in content
    const streamPatterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|live\/)/i,
      /(?:https?:\/\/)?youtu\.be\//i,
      /(?:https?:\/\/)?(?:www\.)?twitch\.tv\//i,
      /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/i\/spaces\//i,
      /(?:https?:\/\/)?(?:www\.)?kick\.com\//i
    ];
    
    return streamPatterns.some(pattern => pattern.test(message.content));
  }
  
  // ============= Storage Utilities =============
  
  /**
   * Safe localStorage getter
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} - Stored value or default
   */
  export function getFromStorage(key, defaultValue = null) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage key ${key}:`, error);
      return defaultValue;
    }
  }
  
  /**
   * Safe localStorage setter
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} - True if successful
   */
  export function setToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} - True if successful
   */
  export function removeFromStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage key ${key}:`, error);
      return false;
    }
  }
  
  // ============= Time Utilities =============
  
  /**
   * Format timestamp for display
   * @param {number} timestamp - Unix timestamp
   * @param {Object} options - Format options
   * @returns {string} - Formatted time
   */
  export function formatTime(timestamp, options = {}) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (options.relative) {
      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // ============= Validation Utilities =============
  
  /**
   * Validate Ergo address format
   * @param {string} address - Address to validate
   * @returns {boolean} - True if valid
   */
  export function isValidErgoAddress(address) {
    if (!address || typeof address !== 'string') return false;
    
    // Basic validation - you may want to use ErgoAddress.fromBase58() for full validation
    return address.length >= 50 && (address.startsWith('9') || address.startsWith('3'));
  }
  
  /**
   * Validate tip command format
   * @param {string} amount - Tip amount
   * @param {string} token - Token name
   * @param {string} address - Recipient address
   * @returns {Object} - Validation result
   */
  export function validateTipCommand(amount, token, address) {
    const errors = [];
    
    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push('Amount must be a positive number');
    }
    
    // Validate token
    if (!SUPPORTED_TOKENS[token.toUpperCase()]) {
      errors.push('Unsupported token');
    }
    
    // Validate address
    if (!isValidErgoAddress(address)) {
      errors.push('Invalid Ergo address format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // ============= Message Utilities =============
  
  /**
   * Create message object
   * @param {Object} params - Message parameters
   * @returns {Object} - Message object
   */
  export function createMessage(params) {
    const {
      id,
      sender,
      content,
      timestamp = Math.floor(Date.now() / 1000),
      chatroomId = 'general',
      parentId = null,
      pending = false,
      isStealthMessage = false,
      stealthDisplayName = undefined
    } = params;
    
    return {
      id,
      sender,
      content,
      timestamp,
      chatroomId,
      parentId,
      pending,
      isStealthMessage,
      stealthDisplayName
    };
  }
  
  /**
   * Filter out DM rooms from room lists
   * @param {Array} rooms - Array of room objects
   * @returns {Array} - Filtered rooms
   */
  export function filterOutDMRooms(rooms) {
    return rooms.filter(room => !room.id || !room.id.startsWith('dm-'));
  }
  
  /**
   * Format discovered room name
   * @param {string} id - Room ID
   * @returns {string} - Formatted name
   */
  export function formatDiscoveredRoomName(id) {
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  }
  
  // ============= Error Handling =============
  
  /**
   * Create standardized error object
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {*} details - Additional error details
   * @returns {Object} - Error object
   */
  export function createError(type, message, details = null) {
    return {
      type,
      message,
      details,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @returns {string} - User-friendly message
   */
  export function getUserFriendlyError(error) {
    if (error.message.includes('Invalid Ergo address')) {
      return ERROR_MESSAGES.INVALID_ADDRESS;
    } else if (error.message.includes('UTXO')) {
      return ERROR_MESSAGES.UTXO_ERROR;
    } else if (error.message.includes('insufficient')) {
      return ERROR_MESSAGES.INSUFFICIENT_BALANCE;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    } else if (error.message.includes('Malformed transaction')) {
      return 'Transaction error: UTXOs may be stale. Please reconnect your wallet and try again.';
    } else {
      return error.message || ERROR_MESSAGES.TRANSACTION_FAILED;
    }
  }
  
  // ============= URL Utilities =============
  
  /**
   * Create transaction explorer URL
   * @param {string} txId - Transaction ID
   * @returns {string} - Explorer URL
   */
  export function createExplorerUrl(txId) {
    return API_ENDPOINTS.EXPLORER_TX_URL(txId);
  }
  
  /**
   * Truncate transaction ID for display
   * @param {string} txId - Transaction ID
   * @param {number} length - Number of characters to show
   * @returns {string} - Truncated TX ID
   */
  export function truncateTxId(txId, length = 8) {
    if (!txId) return '';
    return txId.length > length ? `${txId.substring(0, length)}...` : txId;
  }
  
  // ============= Command Parsing =============
  
  /**
   * Parse chat command
   * @param {string} message - Message content
   * @returns {Object|null} - Parsed command or null
   */
  export function parseCommand(message) {
    if (!message.startsWith('/')) {
      return null;
    }
  
    const parts = message.trim().split(' ').filter(p => p);
    const command = parts[0].toLowerCase();
  
    switch(command) {
      case '/tip':
        if (parts.length < 3) {
          return {
            type: 'tip',
            valid: false,
            error: 'Usage: /tip [amount] [token] [address]'
          };
        }
        
        const amount = parts[1];
        const token = parts[2].toUpperCase();
        const address = parts.slice(3).join(' ');
        
        const validation = validateTipCommand(amount, token, address);
        
        return {
          type: 'tip',
          valid: validation.isValid,
          error: validation.errors.join(', '),
          data: { amount, token, address }
        };
  
      case '/price':
        return {
          type: 'price',
          valid: true,
          data: { token: parts[1] || 'ERG' }
        };
  
      case '/help':
        return {
          type: 'help',
          valid: true
        };
  
      default:
        return {
          type: 'unknown',
          valid: false,
          error: `Unknown command: ${command}. Type /help for available commands.`
        };
    }
  }
  
  // ============= Array Utilities =============
  
  /**
   * Remove duplicates from array based on a key
   * @param {Array} array - Array to deduplicate
   * @param {string} key - Key to use for comparison
   * @returns {Array} - Deduplicated array
   */
  export function deduplicateByKey(array, key) {
    const seen = new Set();
    return array.filter(item => {
      const keyValue = item[key];
      if (seen.has(keyValue)) {
        return false;
      }
      seen.add(keyValue);
      return true;
    });
  }
  
  /**
   * Chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} - Array of chunks
   */
  export function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  // ============= Async Utilities =============
  
  /**
   * Create a delay promise
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Retry an async function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in ms
   * @returns {Promise} - Result of function
   */
  export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries) {
          throw lastError;
        }
        
        const delayMs = baseDelay * Math.pow(2, i);
        await delay(delayMs);
      }
    }
  }
  
  // ============= Debug Utilities =============
  
  /**
   * Create debug logger with prefix
   * @param {string} prefix - Log prefix
   * @returns {Object} - Logger object
   */
  export function createLogger(prefix) {
    return {
      log: (...args) => console.log(`[${prefix}]`, ...args),
      warn: (...args) => console.warn(`[${prefix}]`, ...args),
      error: (...args) => console.error(`[${prefix}]`, ...args),
      debug: (...args) => {
        if (window.ergoChat_debugMode) {
          console.log(`[${prefix}:DEBUG]`, ...args);
        }
      }
    };
  }
  
  // ============= Type Checking Utilities =============
  
  /**
   * Check if value is a valid timestamp
   * @param {*} value - Value to check
   * @returns {boolean} - True if valid timestamp
   */
  export function isValidTimestamp(value) {
    const timestamp = Number(value);
    return !isNaN(timestamp) && timestamp > 0 && timestamp < Date.now() / 1000 + 86400; // Not more than 24h in future
  }
  
  /**
   * Check if value is a valid message object
   * @param {*} value - Value to check
   * @returns {boolean} - True if valid message
   */
  export function isValidMessage(value) {
    return value && 
           typeof value === 'object' &&
           typeof value.id === 'string' &&
           typeof value.sender === 'string' &&
           typeof value.content === 'string' &&
           isValidTimestamp(value.timestamp);
  }
  // messageUtils.js - Complete message handling utilities
// Save this as: src/lib/utils/messageUtils.js


  
  
  /**
   * Fetch mempool messages (pending transactions)
   */
  export async function fetchMempoolMessages({ chatroomId, chatrooms, currentUserAddress }) {
    try {
      console.log('fetchMempoolMessages called - returning empty for now');
      // For now, return empty array - implement mempool fetching if needed
      return [];
      
    } catch (error) {
      console.error('Error in fetchMempoolMessages:', error);
      return [];
    }
  }
  
  /**
   * Merge confirmed and mempool messages
   */
  export function mergeMessages(confirmedMessages, mempoolMessages, chatroomId) {
    try {
      const confirmed = Array.isArray(confirmedMessages) ? confirmedMessages : [];
      const mempool = Array.isArray(mempoolMessages) ? mempoolMessages : [];
      
      // Filter messages by chatroom
      const filteredConfirmed = confirmed.filter(msg => 
        !chatroomId || chatroomId === 'all' || chatroomId === 'inbox' || 
        !msg.chatroomId || msg.chatroomId === chatroomId
      );
      
      const filteredMempool = mempool.filter(msg => 
        !chatroomId || chatroomId === 'all' || chatroomId === 'inbox' ||
        !msg.chatroomId || msg.chatroomId === chatroomId
      );
      
      // Combine and sort by timestamp (oldest first for display)
      const allMessages = [...filteredConfirmed, ...filteredMempool];
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      return allMessages;
      
    } catch (error) {
      console.error('Error merging messages:', error);
      return [];
    }
  }
  
  /**
   * Organize messages into threaded structure (like Landing3.svelte)
   */
  export function organizeThreadedMessages(messages) {
    try {
      if (!Array.isArray(messages)) {
        return [];
      }
      
      const rootMessages = [];
      const messageMap = new Map();
      
      // Create a map for fast lookup
      for (const msg of messages) {
        if (!messageMap.has(msg.id)) {
          messageMap.set(msg.id, {...msg, replies: []});
        }
      }
      
      // Organize into parent-child relationships
      for (const msg of messages) {
        const message = messageMap.get(msg.id);
        
        if (msg.parentId && messageMap.has(msg.parentId)) {
          // This is a reply - add to parent's replies
          const parent = messageMap.get(msg.parentId);
          
          // Make sure parent has a replies array
          if (!parent.replies) {
            parent.replies = [];
          }
          
          // Add this message as a reply if not already there
          if (!parent.replies.some(reply => reply.id === message.id)) {
            parent.replies.push(message);
          }
        } else {
          // This is a root message
          if (!rootMessages.some(root => root.id === message.id)) {
            rootMessages.push(message);
          }
        }
      }
      
      // Sort all messages by timestamp
      rootMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Sort all replies by timestamp
      for (const msg of rootMessages) {
        if (msg.replies && msg.replies.length > 0) {
          msg.replies.sort((a, b) => a.timestamp - b.timestamp);
        }
      }
      
      return rootMessages;
      
    } catch (error) {
      console.error('Error organizing threaded messages:', error);
      return [];
    }
  }
  
  /**
   * Save messages to localStorage
   */
  export function saveMessages(messages, chatroomId, includeAll = false) {
    try {
      const key = includeAll ? 'ergochat_all_messages' : `ergochat_messages_${chatroomId}`;
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.warn('Error saving messages:', error);
    }
  }
  
  /**
   * Load messages from localStorage
   */
  export function loadMessages(chatroomId) {
    try {
      const key = `ergochat_messages_${chatroomId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Error loading messages:', error);
      return [];
    }
  }
  
  /**
   * Save mempool messages to localStorage
   */
  export function saveMempoolMessages(messages) {
    try {
      localStorage.setItem('ergochat_mempool_messages', JSON.stringify(messages));
    } catch (error) {
      console.warn('Error saving mempool messages:', error);
    }
  }
  
  /**
   * Load mempool messages from localStorage
   */
  export function loadMempoolMessages() {
    try {
      const stored = localStorage.getItem('ergochat_mempool_messages');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Error loading mempool messages:', error);
      return [];
    }
  }
  
  /**
   * Populate reply information for threaded messages
   */
  export function populateReplyInfo(messages, mempoolMessages) {
    try {
      const allMessages = [...messages, ...mempoolMessages];
      
      for (const message of allMessages) {
        if (message.parentId && !message.replyTo) {
          const parent = allMessages.find(m => m.id === message.parentId);
          if (parent) {
            message.replyTo = {
              id: parent.id,
              sender: parent.sender,
              content: parent.content
            };
          }
        }
      }
    } catch (error) {
      console.error('Error populating reply info:', error);
    }
  }
  
  /**
   * Clean up old mempool messages
   */
  export function cleanupMempoolMessages(mempoolMessages) {
    try {
      // Remove messages older than 1 hour from mempool
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      return mempoolMessages.filter(msg => msg.timestamp > oneHourAgo);
    } catch (error) {
      console.error('Error cleaning up mempool messages:', error);
      return mempoolMessages;
    }
  }
  
  /**
   * Find message by ID
   */
  export function findMessageById(messages, id) {
    try {
      return messages.find(msg => msg.id === id);
    } catch (error) {
      console.error('Error finding message by ID:', error);
      return null;
    }
  }
  
  /**
   * Decrypt a message that was encrypted with encryptMessage
   */
  export function decryptMessage(encrypted, secretKey = "ergochat") {
    // Basic validation
    if (!encrypted || typeof encrypted !== 'string') {
      return encrypted;
    }
    
    // Must start with the encryption prefix
    if (!encrypted.startsWith("enc-")) {
      return encrypted;
    }
    
    try {
      // Remove prefix
      const hexStr = encrypted.substring(4);
      
      // Validate hex characters
      if (!/^[0-9a-fA-F]+$/.test(hexStr)) {
        return encrypted;
      }
      
      let decrypted = "";
      
      // Process hex pairs
      for (let i = 0; i < hexStr.length; i += 2) {
        if (i + 1 >= hexStr.length) break; // Skip incomplete pair
        
        // Convert hex pair to character code
        const hexPair = hexStr.substring(i, i + 2);
        const encryptedChar = parseInt(hexPair, 16);
        
        // Calculate position and key character - exactly matching encryption
        const position = i/2;
        const keyChar = secretKey.charCodeAt((position + (position % 5)) % secretKey.length);
        
        // XOR operation for decryption
        const decryptedChar = encryptedChar ^ keyChar;
        
        // Add character to result
        decrypted += String.fromCharCode(decryptedChar);
      }
      
      return decrypted;
    } catch (error) {
      console.error("Error in decryption:", error);
      return encrypted; // Return original on error
    }
  }
  
  /**
   * Convert hex string to UTF-8 string
   */
  export function hexToUtf8(hex) {
    try {
      // Remove any 0x prefix
      const cleanHex = hex.replace(/^0x/, '');
      
      // Check if it's valid hex
      if (!/^[a-f0-9]*$/i.test(cleanHex)) {
        console.warn('Invalid hex string:', hex);
        return hex;
      }
      
      // Convert hex to bytes
      const bytes = [];
      for (let i = 0; i < cleanHex.length; i += 2) {
        const hexPair = cleanHex.substr(i, 2);
        if (hexPair.length === 2) {
          bytes.push(parseInt(hexPair, 16));
        }
      }
      
      // Convert bytes to UTF-8 string
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const uint8Array = new Uint8Array(bytes);
      const decoded = decoder.decode(uint8Array);
      
      // Check if the decoded string contains valid characters
      if (/[\x00-\x08\x0E-\x1F\x7F]/.test(decoded)) {
        console.warn('Decoded string contains control characters, might be binary data');
        return hex; // Return original hex if it looks like binary
      }
      
      return decoded;
      
    } catch (error) {
      console.error('Error decoding hex to UTF-8:', error);
      return hex; // Return original if decoding fails
    }
  }
  
  /**
   * Extract and decrypt any encrypted strings found in the content
   */
  export function extractAndDecryptAll(content) {
    // Basic input validation
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    // Case 1: If the content is simply an encrypted string, decrypt it directly
    if (content.startsWith("enc-") && /^enc-[0-9a-fA-F]+$/.test(content)) {
      return decryptMessage(content);
    }
    
    // Case 2: If the content doesn't contain "enc-", no decryption needed
    if (!content.includes("enc-")) {
      return content;
    }
    
    // Case 3: The message has an encrypted part somewhere in the string
    
    // Look for a clean match of "enc-" followed by hex characters at the end of the string
    const endEncryptedMatch = content.match(/(.*?)(enc-[0-9a-fA-F]+)$/);
    
    if (endEncryptedMatch) {
      // We found a clean encrypted part at the end
      const plainPrefix = endEncryptedMatch[1];
      const encryptedPart = endEncryptedMatch[2];
      
      // Decrypt the encrypted part
      const decryptedPart = decryptMessage(encryptedPart);
      
      // Combine the plain prefix with the decrypted part
      return plainPrefix + decryptedPart;
    }
    
    // If not a clean end match, look for all enc- patterns
    const encryptedPattern = /enc-[0-9a-fA-F]+/g;
    let result = content;
    let match;
    
    // Find all matches of encrypted text
    while ((match = encryptedPattern.exec(content)) !== null) {
      const startPos = match.index;
      
      // Try to find where this encrypted part ends
      let endPos = startPos + 4; // Start after "enc-"
      
      while (endPos < content.length && /[0-9a-fA-F]/.test(content[endPos])) {
        endPos++;
      }
      
      // Extract the full encrypted string
      const fullEncrypted = content.substring(startPos, endPos);
      
      // Only decrypt if it looks like a proper encrypted string
      if (fullEncrypted.length > 8) { // At least "enc-" plus some hex
        const decryptedPart = decryptMessage(fullEncrypted);
        
        // Replace this encrypted part with the decrypted version
        result = result.replace(fullEncrypted, decryptedPart);
      }
      
      // Update the regex lastIndex to avoid infinite loop
      encryptedPattern.lastIndex = startPos + 1;
    }
    
    return result;
  }
  // ============= Export all utilities =============
  export default {
    // Address utilities
    cleanAddress,
    truncateAddress,
    
    // Encryption utilities
    encryptMessage,
    decryptMessage,
    isEncryptedText,
    extractAndDecryptAll,
    encryptRoomCode,
    decryptRoomCode,
    isEncryptedRoomCode,
    
    // Data utilities
    decodeErgoHex,
    extractRegisterValue,
    
    // Token utilities
    resolveTokenInfo,
    
    // DM utilities
    createDMRoomId,
    getOtherUserFromDMRoom,
    
    // Stream utilities
    isStreamAnnouncement,
    
    // Storage utilities
    getFromStorage,
    setToStorage,
    removeFromStorage,
    
    // Time utilities
    formatTime,
    
    // Validation utilities
    isValidErgoAddress,
    validateTipCommand,
    
    // Message utilities
    createMessage,
    filterOutDMRooms,
    formatDiscoveredRoomName,
    
    // Error utilities
    createError,
    getUserFriendlyError,
    
    // URL utilities
    createExplorerUrl,
    truncateTxId,
    
    // Command utilities
    parseCommand,
    
    // Array utilities
    deduplicateByKey,
    chunkArray,
    
    // Async utilities
    delay,
    retryWithBackoff,
    
    // Debug utilities
    createLogger,
    
    // Type checking utilities
    isValidTimestamp,
    isValidMessage
  };