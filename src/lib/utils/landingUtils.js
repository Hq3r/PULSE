// landingUtils.js - Main chat functionality utilities with fixed message ordering
import { stringToBytes } from '@scure/base';
import { SColl, SByte, SLong } from '@fleet-sdk/serializer';
import { OutputBuilder } from '@fleet-sdk/core';

import {
  DEMO_CHAT_CONTRACT,
  API_BASE,
  CUSTOM_MIN_BOX_VALUE,
  TRANSACTION_FEE,
  UI_CONFIG,
  truncateAddress,
  createToastMessage
} from './chatConstants.js';

import {
  getCurrentHeight,
  parseBoxToMessage,
  encryptMessage,
  fetchMempoolMessages
} from './chatUtils.js';

import {
  getWalletInfo,
  validateWalletBalance,
  createMessageTx,
  signAndSubmitTransaction,
  updateUTXOCache,
  getCommonBoxIds
} from './transactionUtils.js';

// ============= MESSAGE FETCHING =============

export async function fetchMessages(selectedChatroom) {
  try {
    console.log('🔄 Fetching messages for chatroom:', selectedChatroom);
    
    // Fetch both confirmed and mempool messages in parallel
    const [confirmedResponse, mempoolMessages] = await Promise.all([
      fetch(`${API_BASE}/boxes/byAddress/${DEMO_CHAT_CONTRACT}?limit=100`),
      fetchMempoolMessages(selectedChatroom)
    ]);

    console.log('Confirmed response:', confirmedResponse.status);
    console.log('Mempool messages received:', mempoolMessages);

    if (!confirmedResponse.ok) {
      throw new Error(`API error: ${confirmedResponse.status}`);
    }

    const confirmedData = await confirmedResponse.json();
    if (!confirmedData.items) {
      throw new Error('Invalid API response');
    }

    // Parse confirmed messages
    const confirmedMessages = [];
    for (const box of confirmedData.items) {
      const message = parseBoxToMessage(box);
      if (message && (!selectedChatroom || message.chatroomId === selectedChatroom)) {
        confirmedMessages.push(message);
      }
    }

    console.log(`Found ${confirmedMessages.length} confirmed messages`);
    console.log(`Found ${mempoolMessages.length} mempool messages`);

    // ===== KEY FIX: Proper sorting to show mempool messages at bottom =====
    
    // Sort confirmed messages by timestamp (oldest first)
    confirmedMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Sort mempool messages by timestamp (oldest first)  
    mempoolMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Combine: confirmed messages first, then mempool messages
    // This ensures mempool (pending) messages appear at the bottom
    const allMessages = [...confirmedMessages, ...mempoolMessages];
    
    console.log(`Total messages before dedup: ${allMessages.length}`);

    // Deduplication - remove exact ID matches
    const uniqueMessages = [];
    const seenIds = new Set();
    
    for (const message of allMessages) {
      if (!seenIds.has(message.id)) {
        seenIds.add(message.id);
        uniqueMessages.push(message);
      } else {
        console.log('Duplicate message removed:', message.id);
      }
    }

    console.log(`Messages after deduplication: ${uniqueMessages.length}`);

    // Final sort: keep confirmed messages in chronological order, 
    // but ensure mempool messages come after confirmed messages
    const finalMessages = uniqueMessages
      .sort((a, b) => {
        // If one is pending and other is not, pending comes last
        if (a.pending && !b.pending) return 1;
        if (!a.pending && b.pending) return -1;
        
        // Within the same type, sort by timestamp (oldest first for both)
        // This ensures proper chronological order within each group
        return a.timestamp - b.timestamp;
      })
      .slice(-UI_CONFIG.LIMITS.MAX_MESSAGES);

    console.log('Final messages array:', finalMessages);
    return finalMessages;
    
  } catch (err) {
    console.error('Error fetching messages:', err);
    throw new Error(`Failed to load messages: ${err.message}`);
  }
}

export async function fetchMessagesQuietly(selectedChatroom) {
  try {
    console.log('🔄 Quiet fetch for chatroom:', selectedChatroom);
    
    const [confirmedResponse, mempoolMessages] = await Promise.all([
      fetch(`${API_BASE}/boxes/byAddress/${DEMO_CHAT_CONTRACT}?limit=100`),
      fetchMempoolMessages(selectedChatroom)
    ]);

    if (!confirmedResponse.ok) return null;

    const confirmedData = await confirmedResponse.json();
    if (!confirmedData.items) return null;

    const confirmedMessages = [];
    for (const box of confirmedData.items) {
      const message = parseBoxToMessage(box);
      if (message && (!selectedChatroom || message.chatroomId === selectedChatroom)) {
        confirmedMessages.push(message);
      }
    }

    console.log(`Quiet fetch: ${confirmedMessages.length} confirmed, ${mempoolMessages.length} mempool`);

    // ===== SAME FIX FOR QUIET FETCH =====
    
    // Sort both arrays by timestamp
    confirmedMessages.sort((a, b) => a.timestamp - b.timestamp);
    mempoolMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Combine: confirmed first, then mempool
    const allMessages = [...confirmedMessages, ...mempoolMessages];
    
    // Deduplicate
    const uniqueMessages = [];
    const seenIds = new Set();
    
    for (const message of allMessages) {
      if (!seenIds.has(message.id)) {
        seenIds.add(message.id);
        uniqueMessages.push(message);
      }
    }

    // Final sort: pending messages at bottom
    const newMessages = uniqueMessages
      .sort((a, b) => {
        // If one is pending and other is not, pending comes last
        if (a.pending && !b.pending) return 1;
        if (!a.pending && b.pending) return -1;
        
        // Within the same type, sort by timestamp (oldest first for both)
        // This ensures proper chronological order within each group
        return a.timestamp - b.timestamp;
      })
      .slice(-UI_CONFIG.LIMITS.MAX_MESSAGES);

    return newMessages;
    
  } catch (err) {
    console.warn('Background message refresh failed:', err);
    return null;
  }
}

// ============= MESSAGE SENDING =============

export async function sendMessageWithExternalWallet(
  messageContent, 
  shouldEncrypt, 
  selectedChatroom, 
  stealthMode, 
  selectedWalletErgo, 
  connectedWalletAddress
) {
  // Get wallet information
  const walletInfo = await getWalletInfo(selectedWalletErgo, connectedWalletAddress);
  const { myAddress, height, utxos } = walletInfo;

  // Validate balance
  const balanceValidation = validateWalletBalance(utxos);
  if (!balanceValidation.valid) {
    throw new Error(balanceValidation.error);
  }

  // Clean address for display
  const cleanedAddress = myAddress.startsWith('3') ? myAddress.substring(1) : myAddress;

  // Use stealth mode sender name if active, otherwise use cleaned address
  const senderName = stealthMode.active ? stealthMode.displayName : cleanedAddress;

  // Use simple encryption for external wallet
  const finalMessage = shouldEncrypt ? simpleEncrypt(messageContent) : messageContent;

  // Create transaction
  const tx = createMessageTx({
    chatContract: DEMO_CHAT_CONTRACT,
    userAddress: myAddress,
    userUtxos: utxos,
    height: height,
    message: finalMessage,
    chatroomId: selectedChatroom,
    parentId: null,
    customSender: senderName,
    chatrooms: []
  });

  if (selectedWalletErgo !== 'ergopay') {
    // Sign and submit transaction
    const result = await signAndSubmitTransaction(tx, selectedWalletErgo);
    const { txId, signed } = result;

    createToastMessage(`📤 Message sent! TX: ${txId.substring(0, 8)}...`, 'success');

    // Create optimistic message with proper timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const optimisticMessage = {
      id: txId,
      sender: stealthMode.active ? stealthMode.displayName : truncateAddress(cleanedAddress),
      content: messageContent,
      timestamp: currentTimestamp,
      chatroomId: selectedChatroom,
      parentId: null,
      pending: true,
      isMempool: true,
      source: 'optimistic'
    };

    console.log('Created optimistic message with timestamp:', currentTimestamp, new Date(currentTimestamp * 1000));

    // Update UTXO cache
    const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
    const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
    await updateUTXOCache(myAddress, usedBoxIds, newOutputs);

    return optimisticMessage;
  } else {
    throw new Error('ErgoPay not supported in this version');
  }
}

export async function sendMessageWithMnemonic(
  messageContent, 
  shouldEncrypt, 
  selectedChatroom, 
  stealthMode, 
  transactionQueue,
  mnemonicWallet
) {
  const messageData = {
    messageContent,
    shouldEncrypt,
    chatroomId: selectedChatroom,
    stealthMode
  };

  const result = await transactionQueue.add(messageData);
  
  createToastMessage(`📤 Message sent! TX: ${result.txId.substring(0, 8)}...`, 'success');

  // Create optimistic message with proper timestamp
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const optimisticMessage = {
    id: result.txId,
    sender: stealthMode.active ? stealthMode.displayName : truncateAddress(result.walletAddress),
    content: result.messageContent,
    timestamp: currentTimestamp,
    chatroomId: result.chatroomId,
    parentId: null,
    pending: true,
    isMempool: true,
    source: 'mnemonic'
  };

  console.log('Created mnemonic optimistic message with timestamp:', currentTimestamp, new Date(currentTimestamp * 1000));

  return optimisticMessage;
}

export async function processSingleMessage(messageData, mnemonicWallet) {
  const { messageContent, shouldEncrypt, chatroomId, stealthMode } = messageData;
  
  try {
    const height = await getCurrentHeight();
    const requiredAmount = CUSTOM_MIN_BOX_VALUE + TRANSACTION_FEE;

    await mnemonicWallet.refreshUTXOState();
    const selectedBoxes = await mnemonicWallet.selectBoxesWithChaining(requiredAmount);

    const timestamp = Math.floor(Date.now() / 1000);
    const finalMessage = shouldEncrypt ? encryptMessage(messageContent) : messageContent;
    const walletAddress = mnemonicWallet.getAddressSync();
    
    // Use stealth mode sender name if active, otherwise use wallet address
    const senderName = stealthMode?.active ? stealthMode.displayName : walletAddress;
    
    const messageBytes = stringToBytes('utf8', finalMessage);
    const senderBytes = stringToBytes('utf8', senderName);
    const chatroomBytes = stringToBytes('utf8', chatroomId);
    const parentIdBytes = new Uint8Array(0);

    const chatBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, DEMO_CHAT_CONTRACT)
      .setAdditionalRegisters({
        R4: SColl(SByte, senderBytes).toHex(),
        R5: SColl(SByte, messageBytes).toHex(),
        R6: SLong(timestamp).toHex(),
        R7: SColl(SByte, chatroomBytes).toHex(),
        R8: SColl(SByte, parentIdBytes).toHex()
      });

    const unsignedTx = await mnemonicWallet.buildTransaction(
      height,
      selectedBoxes,
      [chatBox],
      TRANSACTION_FEE
    );

    const signedTx = await mnemonicWallet.signTransaction(unsignedTx);
    mnemonicWallet.addLocalOutputs(signedTx, walletAddress);
    const txId = await mnemonicWallet.submitTransaction(signedTx);

    return {
      txId,
      messageContent: messageContent,
      timestamp,
      chatroomId,
      walletAddress
    };
    
  } catch (error) {
    mnemonicWallet.cleanupFailedTransaction();
    throw error;
  }
}

// ============= SIMPLE ENCRYPTION =============

export function simpleEncrypt(text, secretKey = "ergochat") {
  if (!text || typeof text !== 'string') return text;
  
  let encrypted = "";
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    const keyChar = secretKey.charCodeAt((i + (i % 5)) % secretKey.length);
    const encryptedChar = char ^ keyChar;
    encrypted += encryptedChar.toString(16).padStart(2, '0');
  }
  return "enc-" + encrypted;
}

// ============= MESSAGE REFRESH UTILITIES =============

export function createMessageRefreshManager() {
  let refreshInterval = null;
  
  return {
    start(callback, intervalMs = 3000) {
      this.stop();
      refreshInterval = setInterval(callback, intervalMs);
      console.log('Started message refresh interval');
    },
    
    stop() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('Stopped message refresh interval');
      }
    },
    
    isActive() {
      return refreshInterval !== null;
    }
  };
}

// ============= MESSAGE SORTING UTILITIES =====

/**
 * Sort messages with proper ordering: confirmed messages by timestamp, then pending messages
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Properly sorted messages
 */
export function sortMessagesWithPendingAtBottom(messages) {
  if (!Array.isArray(messages)) return [];
  
  return messages.sort((a, b) => {
    // Pending messages always come after confirmed messages
    if (a.pending && !b.pending) return 1;
    if (!a.pending && b.pending) return -1;
    
    // Within the same type, sort by timestamp (oldest first for both)
    // This ensures proper chronological order: older messages appear higher
    return a.timestamp - b.timestamp;
  });
}

/**
 * Enhanced message update checker that considers pending status
 * @param {Array} newMessages - New messages array
 * @param {Array} currentMessages - Current messages array
 * @returns {boolean} - True if update is needed
 */
export function shouldUpdateMessages(newMessages, currentMessages) {
  if (!Array.isArray(newMessages) || !Array.isArray(currentMessages)) {
    return true;
  }
  
  if (newMessages.length !== currentMessages.length) return true;
  
  return newMessages.some((msg, i) => {
    const currentMsg = currentMessages[i];
    return !currentMsg || 
           currentMsg.id !== msg.id || 
           currentMsg.pending !== msg.pending ||
           currentMsg.isMempool !== msg.isMempool ||
           currentMsg.content !== msg.content ||
           currentMsg.sender !== msg.sender;
  });
}

/**
 * Separate messages into confirmed and pending arrays
 * @param {Array} messages - Mixed messages array
 * @returns {Object} - Object with confirmed and pending arrays
 */
export function separateMessagesByStatus(messages) {
  if (!Array.isArray(messages)) {
    return { confirmed: [], pending: [] };
  }
  
  const confirmed = messages.filter(msg => !msg.pending && !msg.isMempool);
  const pending = messages.filter(msg => msg.pending || msg.isMempool);
  
  // Sort each group by timestamp
  confirmed.sort((a, b) => a.timestamp - b.timestamp);
  pending.sort((a, b) => a.timestamp - b.timestamp);
  
  return { confirmed, pending };
}

/**
 * Merge confirmed and pending messages with proper ordering
 * @param {Array} confirmed - Confirmed messages
 * @param {Array} pending - Pending messages
 * @returns {Array} - Merged and sorted messages
 */
export function mergeMessages(confirmed, pending) {
  const confirmedSorted = confirmed.sort((a, b) => a.timestamp - b.timestamp);
  const pendingSorted = pending.sort((a, b) => a.timestamp - b.timestamp);
  
  // Return confirmed first, then pending
  return [...confirmedSorted, ...pendingSorted];
}

/**
 * Add optimistic message to existing messages array
 * @param {Array} existingMessages - Current messages
 * @param {Object} optimisticMessage - New optimistic message
 * @returns {Array} - Updated messages array
 */
export function addOptimisticMessage(existingMessages, optimisticMessage) {
  if (!optimisticMessage) return existingMessages;
  
  // Check if message already exists
  const exists = existingMessages.some(msg => msg.id === optimisticMessage.id);
  if (exists) return existingMessages;
  
  // Add the optimistic message and sort properly
  const updatedMessages = [...existingMessages, optimisticMessage];
  return sortMessagesWithPendingAtBottom(updatedMessages);
}

/**
 * Remove optimistic message when confirmed version arrives
 * @param {Array} messages - Current messages
 * @param {string} messageId - ID of message to remove
 * @returns {Array} - Updated messages array
 */
export function removeOptimisticMessage(messages, messageId) {
  return messages.filter(msg => msg.id !== messageId);
}

/**
 * Update message status from pending to confirmed
 * @param {Array} messages - Current messages
 * @param {string} messageId - ID of message to update
 * @returns {Array} - Updated messages array
 */
export function updateMessageStatus(messages, messageId) {
  const updatedMessages = messages.map(msg => {
    if (msg.id === messageId) {
      return {
        ...msg,
        pending: false,
        isMempool: false
      };
    }
    return msg;
  });
  
  return sortMessagesWithPendingAtBottom(updatedMessages);
}

// ============= SCROLL UTILITIES =============

export function scrollToBottom(chatContainer, autoScroll) {
  if (chatContainer && autoScroll) {
    setTimeout(() => {
      // Scroll to the very bottom where pending messages are
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  }
}

export function checkAutoScroll(chatContainer) {
  if (!chatContainer) return true;
  const { scrollTop, scrollHeight, clientHeight } = chatContainer;
  // Consider user to be at bottom if within 100px of bottom
  return scrollHeight - scrollTop - clientHeight < 100;
}

/**
 * Scroll to bottom with animation
 * @param {Element} chatContainer - Chat container element
 * @param {boolean} smooth - Whether to use smooth scrolling
 */
export function scrollToBottomSmooth(chatContainer, smooth = true) {
  if (!chatContainer) return;
  
  if (smooth && chatContainer.scrollTo) {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// ============= DEBUG UTILITIES =============

/**
 * Debug function to log message ordering
 * @param {Array} messages - Messages to debug
 * @param {string} context - Context description
 */
export function debugMessageOrder(messages, context = 'Messages') {
  console.group(`🐛 Debug ${context} (${messages.length} total)`);
  
  const { confirmed, pending } = separateMessagesByStatus(messages);
  console.log(`Confirmed: ${confirmed.length}, Pending: ${pending.length}`);
  
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. [${msg.pending ? 'PENDING' : 'CONFIRMED'}] ${msg.sender}: ${msg.content.substring(0, 30)}... (${new Date(msg.timestamp * 1000).toLocaleTimeString()})`);
  });
  
  console.groupEnd();
}

/**
 * Validate message structure
 * @param {Object} message - Message to validate
 * @returns {boolean} - True if valid
 */
export function isValidMessage(message) {
  return message &&
         typeof message === 'object' &&
         typeof message.id === 'string' &&
         typeof message.sender === 'string' &&
         typeof message.content === 'string' &&
         typeof message.timestamp === 'number' &&
         typeof message.chatroomId === 'string';
}

/**
 * Clean up messages array by removing invalid messages
 * @param {Array} messages - Messages to clean
 * @returns {Array} - Cleaned messages
 */
export function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  
  return messages.filter(msg => {
    const valid = isValidMessage(msg);
    if (!valid) {
      console.warn('Invalid message removed:', msg);
    }
    return valid;
  });
}

// ============= EXPORTS =============

export default {
  // Core functions
  fetchMessages,
  fetchMessagesQuietly,
  sendMessageWithExternalWallet,
  sendMessageWithMnemonic,
  processSingleMessage,
  
  // Encryption
  simpleEncrypt,
  
  // Message management
  createMessageRefreshManager,
  sortMessagesWithPendingAtBottom,
  shouldUpdateMessages,
  separateMessagesByStatus,
  mergeMessages,
  addOptimisticMessage,
  removeOptimisticMessage,
  updateMessageStatus,
  
  // Scroll utilities
  scrollToBottom,
  checkAutoScroll,
  scrollToBottomSmooth,
  
  // Debug utilities
  debugMessageOrder,
  isValidMessage,
  cleanMessages
};