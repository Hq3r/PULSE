// landingUtils.js - Main chat functionality utilities
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

    // Combine confirmed and mempool messages
    const allMessages = [...confirmedMessages, ...mempoolMessages];
    console.log(`Total messages before dedup: ${allMessages.length}`);

    // Simplified deduplication - just remove exact ID matches
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

    // Sort and limit
    const finalMessages = uniqueMessages
      .sort((a, b) => a.timestamp - b.timestamp)
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

    // Combine and deduplicate
    const allMessages = [...confirmedMessages, ...mempoolMessages];
    const uniqueMessages = [];
    const seenIds = new Set();
    
    for (const message of allMessages) {
      if (!seenIds.has(message.id)) {
        seenIds.add(message.id);
        uniqueMessages.push(message);
      }
    }

    const newMessages = uniqueMessages
      .sort((a, b) => a.timestamp - b.timestamp)
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

    // Create optimistic message
    const optimisticMessage = {
      id: txId,
      sender: stealthMode.active ? stealthMode.displayName : truncateAddress(cleanedAddress),
      content: messageContent,
      timestamp: Math.floor(Date.now() / 1000),
      chatroomId: selectedChatroom,
      parentId: null,
      pending: true
    };

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
  transactionQueue
) {
  const messageData = {
    messageContent,
    shouldEncrypt,
    chatroomId: selectedChatroom,
    stealthMode
  };

  const result = await transactionQueue.add(messageData);
  
  createToastMessage(`📤 Message sent! TX: ${result.txId.substring(0, 8)}...`, 'success');

  const optimisticMessage = {
    id: result.txId,
    sender: stealthMode.active ? stealthMode.displayName : truncateAddress(result.walletAddress),
    content: result.messageContent,
    timestamp: result.timestamp,
    chatroomId: result.chatroomId,
    parentId: null,
    pending: true
  };

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

// ============= UTILITY FUNCTIONS =============

export function shouldUpdateMessages(newMessages, currentMessages) {
  if (newMessages.length !== currentMessages.length) return true;
  
  return newMessages.some((msg, i) => 
    currentMessages[i]?.id !== msg.id || 
    currentMessages[i]?.pending !== msg.pending
  );
}

export function scrollToBottom(chatContainer, autoScroll) {
  if (chatContainer && autoScroll) {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  }
}

export function checkAutoScroll(chatContainer) {
  if (!chatContainer) return true;
  const { scrollTop, scrollHeight, clientHeight } = chatContainer;
  return scrollHeight - scrollTop - clientHeight < 100;
}