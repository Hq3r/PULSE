// messageUtils.js - Complete fixed version with proper message filtering

import axios from 'axios';
import { 
  CHAT_CONTRACT, 
  MESSAGE_PAGE_SIZE, 
  STORAGE_KEYS, 
  API_ENDPOINTS,
  ADMIN_WALLET_ADDRESS,
  MEMPOOL_CLEANUP_INTERVAL
} from '$lib/common/mainConsts.js';

import { 
  cleanAddress, 
  decodeErgoHex, 
  extractRegisterValue, 
  isEncryptedText, 
  decryptMessage, 
  extractAndDecryptAll, 
  encryptRoomCode, 
  decryptRoomCode, 
  isEncryptedRoomCode,
  getFromStorage,
  setToStorage,
  createLogger,
  isValidMessage
} from './mainUtils.js';

const logger = createLogger('MessageUtils');

// ============= Message Fetching =============

/**
 * Fetch confirmed messages from the blockchain
 * @param {Object} params - Fetch parameters
 * @returns {Promise<Array>} - Array of messages
 */
export async function fetchConfirmedMessages(params) {
  const {
    loadMore = false,
    chatroomId = 'general',
    chatrooms = [],
    currentUserAddress = '',
    offset = 0,
    limit = MESSAGE_PAGE_SIZE
  } = params;
  
  try {
    const isAdmin = currentUserAddress === ADMIN_WALLET_ADDRESS;
    const isInboxMode = chatroomId === 'all' || chatroomId === 'inbox';
    
    logger.debug(`Fetching confirmed messages: loadMore=${loadMore}, chatroomId=${chatroomId}, isInboxMode=${isInboxMode}`);
    
    // Construct API URL
    const url = `${API_ENDPOINTS.BOXES_BY_ADDRESS(CHAT_CONTRACT)}?limit=${limit}&offset=${offset}`;
    
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.items || data.items.length === 0) {
      logger.debug('No messages found in API response');
      return {
        messages: [],
        hasMore: false
      };
    }
    
    logger.debug(`Processing ${data.items.length} boxes from API`);
    const fetchedMessages = [];
    
    for (const box of data.items) {
      if (!box.additionalRegisters || 
          !box.additionalRegisters.R4 || 
          !box.additionalRegisters.R5 || 
          !box.additionalRegisters.R6) {
        continue;
      }
      
      try {
        const message = await processMessageBox(box, {
          isAdmin,
          isInboxMode,
          chatroomId,
          chatrooms,
          currentUserAddress
        });
        
        if (message) {
          fetchedMessages.push(message);
        }
      } catch (error) {
        logger.debug("Error processing message box:", error);
      }
    }
    
    const hasMore = data.items.length >= limit;
    
    logger.debug(`Successfully fetched ${fetchedMessages.length} confirmed messages, hasMore: ${hasMore}`);
    
    return {
      messages: fetchedMessages,
      hasMore
    };
    
  } catch (error) {
    logger.error("Error fetching confirmed messages:", error);
    return {
      messages: [],
      hasMore: false
    };
  }
}

/**
 * Process a message box from the blockchain
 * @param {Object} box - Message box data
 * @param {Object} context - Processing context
 * @returns {Object|null} - Processed message or null
 */
async function processMessageBox(box, context) {
  const { isAdmin, isInboxMode, chatroomId, chatrooms, currentUserAddress } = context;
  
  try {
    // Extract sender
    const senderRaw = extractRegisterValue(box.additionalRegisters.R4);
    let sender = decodeErgoHex(senderRaw);
    sender = cleanAddress(sender);
    
    // Extract content
    const contentRaw = extractRegisterValue(box.additionalRegisters.R5);
    let content = decodeErgoHex(contentRaw);
    
    // Decrypt content if encrypted
    if (content && content.includes("enc-")) {
      content = extractAndDecryptAll(content);
    }
    
    // Extract timestamp
    const timestampRaw = extractRegisterValue(box.additionalRegisters.R6);
    let timestamp = 0;
    if (typeof timestampRaw === 'number') {
      timestamp = timestampRaw;
    } else if (typeof timestampRaw === 'string') {
      timestamp = parseInt(timestampRaw);
    }
    
    // Extract chatroom ID
    let msgChatroomId = 'general';
    if (box.additionalRegisters.R7) {
      const chatroomRaw = extractRegisterValue(box.additionalRegisters.R7);
      msgChatroomId = decodeErgoHex(chatroomRaw);
      
      // Handle private rooms with encryption
      if (msgChatroomId.startsWith('private-')) {
        msgChatroomId = await processPrivateRoom(msgChatroomId, {
          isAdmin,
          isInboxMode,
          chatroomId,
          chatrooms
        });
        
        if (!msgChatroomId) return null; // Skip if not accessible
      }
    }
    
    // Extract parent message ID
    let parentId = null;
    if (box.additionalRegisters.R8) {
      const parentIdRaw = extractRegisterValue(box.additionalRegisters.R8);
      parentId = decodeErgoHex(parentIdRaw);
      
      if (!parentId || parentId.length === 0) {
        parentId = null;
      }
    }
    
    // Check if message should be included
    const isDMMessage = msgChatroomId.startsWith('dm-');
    let includeMessage = false;
    
    if (isInboxMode) {
      if (isDMMessage) {
        // Check if current user is involved in this DM
        const cleanCurrentUser = cleanAddress(currentUserAddress);
        const parts = msgChatroomId.replace('dm-', '').split('-');
        const addr1 = parts[0];
        const addr2 = parts[1];
        
        if (cleanAddress(addr1) === cleanCurrentUser || cleanAddress(addr2) === cleanCurrentUser) {
          includeMessage = true;
        }
      } else {
        includeMessage = true;
      }
    } else {
      // For specific chatroom, include if it matches OR if no chatroom specified (legacy messages)
      includeMessage = (chatroomId === 'all' || msgChatroomId === chatroomId || (!msgChatroomId && chatroomId === 'general'));
    }
    
    if (!includeMessage) return null;
    
    // Create message object
    const message = {
      id: box.boxId || box.transactionId,
      sender,
      content,
      timestamp,
      chatroomId: msgChatroomId,
      parentId,
      pending: false
    };
    
    return message;
  } catch (error) {
    logger.error("Error processing message box:", error);
    return null;
  }
}

/**
 * Process private room access
 * @param {string} msgChatroomId - Message chatroom ID
 * @param {Object} context - Processing context
 * @returns {string|null} - Processed room ID or null if not accessible
 */
async function processPrivateRoom(msgChatroomId, context) {
  const { isAdmin, isInboxMode, chatroomId, chatrooms } = context;
  
  const privatePart = msgChatroomId.substring(8);
  
  // ADMIN OVERRIDE: Admin can see all private rooms
  if (isAdmin && chatroomId.startsWith('private-')) {
    if (chatroomId === msgChatroomId) {
      return msgChatroomId;
    } else if (chatroomId.substring(8) === privatePart || 
              'private-' + encryptRoomCode(chatroomId.substring(8)) === msgChatroomId) {
      return chatroomId;
    } else {
      if (!isInboxMode) return null;
    }
  }
  // NORMAL USER HANDLING
  else {
    if (isEncryptedRoomCode(privatePart)) {
      const decryptedCode = decryptRoomCode(privatePart);
      
      if (decryptedCode && decryptedCode.length === 10 && /^\d+$/.test(decryptedCode)) {
        const localRoomId = 'private-' + decryptedCode;
        const knownRoom = chatrooms.find(r => r.id === localRoomId);
        
        if (knownRoom) {
          msgChatroomId = knownRoom.id;
          
          if (!knownRoom.blockchainRoomId) {
            knownRoom.blockchainRoomId = 'private-' + privatePart;
          }
        } else {
          if (!isInboxMode) return null;
        }
      } else {
        const blockchainRoomId = 'private-' + privatePart;
        const knownRoom = chatrooms.find(r => r.blockchainRoomId === blockchainRoomId);
        
        if (knownRoom) {
          msgChatroomId = knownRoom.id;
        } else {
          if (!isInboxMode) return null;
        }
      }
    } else {
      if (chatrooms.some(r => r.id === msgChatroomId)) {
        // We've joined this room already
      } else {
        if (!isInboxMode) return null;
      }
    }
  }
  
  return msgChatroomId;
}

// ============= Mempool Message Fetching =============

/**
 * Fetch mempool messages
 * @param {Object} params - Fetch parameters
 * @returns {Promise<Array>} - Array of mempool messages
 */
export async function fetchMempoolMessages(params) {
  const {
    chatroomId = 'general',
    chatrooms = [],
    currentUserAddress = ''
  } = params;
  
  try {
    const isInboxMode = chatroomId === 'inbox' || chatroomId === 'all';
    
    logger.debug(`fetchMempoolMessages: chatroomId=${chatroomId}, isInboxMode=${isInboxMode}`);
    
    const response = await axios.get(
      API_ENDPOINTS.MEMPOOL_TRANSACTIONS(CHAT_CONTRACT),
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        responseType: 'arraybuffer'
      }
    );
    
    const buffer = new TextDecoder('utf-8').decode(response.data);
    const data = JSON.parse(buffer);
    
    if (!data || !data.items) {
      return [];
    }
    
    const newMempoolMessages = [];
    
    for (const tx of data.items) {
      const chatOutputs = tx.outputs.filter(out => 
        out.address === CHAT_CONTRACT || out.ergoTree === CHAT_CONTRACT);
      
      for (const output of chatOutputs) {
        if (output.additionalRegisters && 
            output.additionalRegisters.R4 && 
            output.additionalRegisters.R5 && 
            output.additionalRegisters.R6) {
          
          try {
            const message = await processMempoolOutput(output, tx.id, {
              isInboxMode,
              chatroomId,
              chatrooms,
              currentUserAddress
            });
            
            if (message) {
              newMempoolMessages.push(message);
            }
          } catch (error) {
            logger.error("Error processing mempool output:", error);
          }
        }
      }
    }
    
    logger.debug(`Fetched ${newMempoolMessages.length} mempool messages`);
    
    return newMempoolMessages;
    
  } catch (error) {
    logger.error("fetchMempoolMessages: Error:", error);
    return [];
  }
}

/**
 * Process mempool output
 * @param {Object} output - Mempool output
 * @param {string} txId - Transaction ID
 * @param {Object} context - Processing context
 * @returns {Object|null} - Processed message or null
 */
async function processMempoolOutput(output, txId, context) {
  const { isInboxMode, chatroomId, chatrooms, currentUserAddress } = context;
  
  try {
    // Extract sender
    const senderRaw = extractRegisterValue(output.additionalRegisters.R4);
    const sender = decodeErgoHex(senderRaw);
    
    // Extract content
    const messageRaw = extractRegisterValue(output.additionalRegisters.R5);
    let content = decodeErgoHex(messageRaw);
    
    // Check and decrypt if encrypted
    if (isEncryptedText(content)) {
      content = decryptMessage(content);
    }
    
    // Extract timestamp
    const timestampRaw = extractRegisterValue(output.additionalRegisters.R6);
    let timestamp = 0;
    if (typeof timestampRaw === 'number') {
      timestamp = timestampRaw;
    } else {
      timestamp = parseInt(timestampRaw);
    }
    
    // Extract chatroom ID
    let msgChatroomId = "general";
    if (output.additionalRegisters.R7) {
      const chatroomRaw = extractRegisterValue(output.additionalRegisters.R7);
      msgChatroomId = decodeErgoHex(chatroomRaw);
      
      // Handle private rooms (similar to confirmed messages)
      if (msgChatroomId.startsWith('private-')) {
        msgChatroomId = await processPrivateRoom(msgChatroomId, {
          isAdmin: currentUserAddress === ADMIN_WALLET_ADDRESS,
          isInboxMode,
          chatroomId,
          chatrooms
        });
        
        if (!msgChatroomId) return null;
      }
    }
    
    // Extract parent ID
    let parentId = null;
    if (output.additionalRegisters.R8) {
      const parentIdRaw = extractRegisterValue(output.additionalRegisters.R8);
      parentId = decodeErgoHex(parentIdRaw);
      if (!parentId) parentId = null;
    }
    
    // Check inclusion (same logic as confirmed messages)
    const isDMMessage = msgChatroomId.startsWith('dm-');
    let includeMessage = false;
    
    if (isInboxMode) {
      if (isDMMessage) {
        const cleanCurrentUser = cleanAddress(currentUserAddress);
        const parts = msgChatroomId.replace('dm-', '').split('-');
        const addr1 = parts[0];
        const addr2 = parts[1];
        
        if (cleanAddress(addr1) === cleanCurrentUser || cleanAddress(addr2) === cleanCurrentUser) {
          includeMessage = true;
        }
      } else {
        includeMessage = true;
      }
    } else {
      // For specific chatroom, include if it matches OR if no chatroom specified (legacy messages)
      includeMessage = (msgChatroomId === chatroomId || (!msgChatroomId && chatroomId === 'general'));
    }
    
    if (!includeMessage) return null;
    
    // Create message object
    const message = {
      id: txId,
      sender,
      content,
      timestamp,
      chatroomId: msgChatroomId,
      parentId,
      pending: true
    };
    
    return message;
  } catch (error) {
    logger.error("Error processing mempool output:", error);
    return null;
  }
}

// ============= Message Storage =============

/**
 * Save messages to localStorage
 * @param {Array} messages - Messages to save
 * @param {string} chatroomId - Chatroom ID
 * @param {boolean} isInboxMode - Whether in inbox mode
 */
export function saveMessages(messages, chatroomId, isInboxMode = false) {
  try {
    const messagesToStore = messages.slice(-1000); // Keep last 1000 messages
    const storageKey = isInboxMode ? STORAGE_KEYS.MESSAGES_ALL : `${STORAGE_KEYS.MESSAGES}_${chatroomId}`;
    setToStorage(storageKey, messagesToStore);
    logger.debug(`Saved ${messagesToStore.length} messages to localStorage with key: ${storageKey}`);
  } catch (error) {
    logger.error("Error saving messages:", error);
  }
}

/**
 * Load messages from localStorage
 * @param {string} chatroomId - Chatroom ID
 * @param {boolean} isInboxMode - Whether in inbox mode
 * @returns {Array} - Loaded messages
 */
export function loadMessages(chatroomId, isInboxMode = false) {
  try {
    const storageKey = isInboxMode ? STORAGE_KEYS.MESSAGES_ALL : `${STORAGE_KEYS.MESSAGES}_${chatroomId}`;
    const messages = getFromStorage(storageKey, []);
    logger.debug(`Loaded ${messages.length} messages from localStorage with key: ${storageKey}`);
    return messages;
  } catch (error) {
    logger.error("Error loading messages:", error);
    return [];
  }
}

/**
 * Save mempool messages to localStorage
 * @param {Array} mempoolMessages - Mempool messages to save
 */
export function saveMempoolMessages(mempoolMessages) {
  try {
    setToStorage(STORAGE_KEYS.MEMPOOL, mempoolMessages);
    logger.debug(`Saved ${mempoolMessages.length} mempool messages`);
  } catch (error) {
    logger.error("Error saving mempool messages:", error);
  }
}

/**
 * Load mempool messages from localStorage
 * @returns {Array} - Loaded mempool messages
 */
export function loadMempoolMessages() {
  try {
    const messages = getFromStorage(STORAGE_KEYS.MEMPOOL, []);
    
    // Filter out old messages (older than 10 minutes)
    const now = Date.now();
    const tenMinutesAgo = now - MEMPOOL_CLEANUP_INTERVAL;
    
    const filteredMessages = messages.filter(msg => {
      return (msg.timestamp * 1000) > tenMinutesAgo;
    });
    
    logger.debug(`Loaded ${filteredMessages.length} mempool messages (filtered from ${messages.length})`);
    
    // Save filtered messages back
    if (filteredMessages.length !== messages.length) {
      saveMempoolMessages(filteredMessages);
    }
    
    return filteredMessages;
  } catch (error) {
    logger.error("Error loading mempool messages:", error);
    return [];
  }
}

// ============= Message Processing =============

/**
 * Merge confirmed and mempool messages, removing duplicates
 * @param {Array} confirmedMessages - Confirmed messages
 * @param {Array} mempoolMessages - Mempool messages
 * @param {string} currentChatroomId - Current chatroom for filtering
 * @returns {Array} - Merged messages
 */
export function mergeMessages(confirmedMessages, mempoolMessages, currentChatroomId = null) {
  const messageMap = new Map();
  
  // Filter messages by chatroom if specified
  const filteredConfirmed = currentChatroomId 
    ? confirmedMessages.filter(m => !m.chatroomId || m.chatroomId === currentChatroomId || (!m.chatroomId && currentChatroomId === 'general'))
    : confirmedMessages;
    
  const filteredMempool = currentChatroomId
    ? mempoolMessages.filter(m => !m.chatroomId || m.chatroomId === currentChatroomId || (!m.chatroomId && currentChatroomId === 'general'))
    : mempoolMessages;
  
  // Add confirmed messages (they take precedence)
  for (const msg of filteredConfirmed) {
    const key = `${msg.content}-${Math.floor(msg.timestamp / 60)}`; // Group by minute
    messageMap.set(key, msg);
  }
  
  // Add mempool messages only if they don't duplicate content
  for (const msg of filteredMempool) {
    const key = `${msg.content}-${Math.floor(msg.timestamp / 60)}`;
    if (!messageMap.has(key)) {
      messageMap.set(key, msg);
    }
  }
  
  // Convert back to array and sort
  const mergedMessages = Array.from(messageMap.values())
    .sort((a, b) => a.timestamp - b.timestamp);
  
  logger.debug(`Merged ${filteredConfirmed.length} confirmed + ${filteredMempool.length} mempool = ${mergedMessages.length} total messages for chatroom: ${currentChatroomId || 'all'}`);
  
  return mergedMessages;
}

// ============= ALSO UPDATE YOUR mergeMessages FUNCTION =============
/**
 * Organize messages into threaded structure
 */
function organizeThreadedMessages(messages) {
    try {
      if (!Array.isArray(messages)) {
        console.warn('organizeThreadedMessages: messages is not an array');
        return [];
      }
      
      const rootMessages = [];
      const messageMap = new Map();
      
      console.log(`Threading ${messages.length} messages...`);
      
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
            console.log(`Added reply ${message.id} to parent ${parent.id}`);
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
          console.log(`Message ${msg.id} has ${msg.replies.length} replies`);
        }
      }
      
      console.log(`Threading complete: ${rootMessages.length} root messages`);
      
      return rootMessages;
      
    } catch (error) {
      console.error('Error organizing threaded messages:', error);
      return [];
    }
  }
  /**
   * Populate reply information for threaded messages
   */
   function populateReplyInfo(messages, mempoolMessages) {
    const allMessages = [...messages, ...mempoolMessages];
    
    // Go through all messages to find parent-child relationships
    for (const message of allMessages) {
      if (message.parentId && !message.replyTo) {
        // Search for parent message
        const parent = allMessages.find(msg => msg.id === message.parentId);
        
        if (parent) {
          message.replyTo = {
            id: parent.id,
            sender: parent.sender,
            content: parent.content
          };
        }
      }
    }
  }
/**
 * Populate reply information for messages
 * @param {Array} messages - Array of messages
 * @param {Array} mempoolMessages - Array of mempool messages
 */
export function populateReplyInfo(messages, mempoolMessages) {
  const allMessages = [...messages, ...mempoolMessages];
  
  for (const message of allMessages) {
    if (message.parentId && !message.replyTo) {
      // Search for parent message
      const parent = allMessages.find(msg => msg.id === message.parentId);
      
      if (parent) {
        message.replyTo = {
          id: parent.id,
          sender: parent.sender,
          content: parent.content
        };
      }
    }
  }
}

/**
 * Clean up old mempool messages
 * @param {Array} mempoolMessages - Current mempool messages
 * @returns {Array} - Cleaned mempool messages
 */
export function cleanupMempoolMessages(mempoolMessages) {
  const now = Date.now();
  const tenMinutesAgo = now - MEMPOOL_CLEANUP_INTERVAL;
  
  const originalLength = mempoolMessages.length;
  
  // Remove old messages
  let cleaned = mempoolMessages.filter(msg => {
    return (msg.timestamp * 1000) > tenMinutesAgo;
  });
  
  // Remove duplicates
  const uniqueMessages = [];
  const seenContent = new Set();
  
  for (const msg of cleaned) {
    const key = `${msg.content}-${Math.floor(msg.timestamp / 60)}-${msg.chatroomId}`;
    
    if (!seenContent.has(key)) {
      seenContent.add(key);
      uniqueMessages.push(msg);
    }
  }
  
  if (originalLength !== uniqueMessages.length) {
    logger.debug(`Cleaned up mempool: ${originalLength} -> ${uniqueMessages.length} messages`);
  }
  
  return uniqueMessages;
}

/**
 * Find message by ID in multiple arrays
 * @param {string} messageId - Message ID to find
 * @param {Array} messages - Confirmed messages
 * @param {Array} mempoolMessages - Mempool messages
 * @returns {Object|null} - Found message or null
 */
export function findMessageById(messageId, messages, mempoolMessages) {
  // Check confirmed messages first
  const confirmedMessage = messages.find(msg => msg.id === messageId);
  if (confirmedMessage) return confirmedMessage;
  
  // Check mempool messages
  const mempoolMessage = mempoolMessages.find(msg => msg.id === messageId);
  if (mempoolMessage) return mempoolMessage;
  
  return null;
}

// ============= Message Validation =============

/**
 * Validate message array
 * @param {Array} messages - Messages to validate
 * @returns {Array} - Valid messages only
 */
export function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    logger.warn("Messages is not an array:", typeof messages);
    return [];
  }
  
  const validMessages = messages.filter(msg => {
    if (!isValidMessage(msg)) {
      logger.warn("Invalid message found:", msg);
      return false;
    }
    return true;
  });
  
  if (validMessages.length !== messages.length) {
    logger.warn(`Filtered out ${messages.length - validMessages.length} invalid messages`);
  }
  
  return validMessages;
}

// ============= Export Functions =============

export default {
  // Fetching
  fetchConfirmedMessages,
  fetchMempoolMessages,
  
  // Storage
  saveMessages,
  loadMessages,
  saveMempoolMessages,
  loadMempoolMessages,
  
  // Processing
  mergeMessages,
  organizeThreadedMessages,
  populateReplyInfo,
  cleanupMempoolMessages,
  findMessageById,
  
  // Validation
  validateMessages
};