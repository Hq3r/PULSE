// streamUtils.js - Complete stream management functions

import { 
  createLogger, 
  getUserFriendlyError,
  cleanAddress,
  setToStorage,
  getFromStorage 
} from './mainUtils.js';

import {
  getWalletInfo,
  validateWalletBalance,
  signAndSubmitTransaction,
  processTransactionResult,
  updateUTXOCache,
  getCommonBoxIds
} from './transactionUtils.js';

import { showCustomToast } from './utils.js';

const logger = createLogger('StreamUtils');

/**
 * Create a transaction to end a stream on the blockchain
 */
export function createStreamEndTx({
  chatContract,
  userAddress,
  userUtxos,
  height,
  streamRoomId,
  streamTitle,
  streamUrl,
  platform,
  chatroomId = 'general'
}) {
  try {
    logger.debug('Creating stream end transaction:', {
      streamRoomId,
      streamTitle,
      userAddress,
      chatroomId
    });

    // Create the stream end message
    const endMessage = `🎬 Stream "${streamTitle}" has ended. Thanks for watching!`;
    
    // Use the existing message transaction structure but mark it as a stream end
    const streamEndData = {
      type: 'stream_end',
      streamRoomId,
      streamTitle,
      streamUrl,
      platform,
      endTime: Math.floor(Date.now() / 1000)
    };

    // Create a standard message transaction with stream end metadata
    const tx = createMessageTx({
      chatContract,
      userAddress,
      userUtxos,
      height,
      message: endMessage,
      chatroomId: streamRoomId || chatroomId,
      parentId: null,
      customSender: cleanAddress(userAddress),
      metadata: streamEndData
    });

    logger.debug('Stream end transaction created successfully');
    return tx;

  } catch (error) {
    logger.error('Error creating stream end transaction:', error);
    throw new Error(`Failed to create stream end transaction: ${error.message}`);
  }
}

/**
 * Create a transaction to start a stream on the blockchain
 */
export function createStreamStartTx({
  chatContract,
  userAddress,
  userUtxos,
  height,
  streamTitle,
  streamUrl,
  platform,
  description = '',
  chatroomId = 'general'
}) {
  try {
    logger.debug('Creating stream start transaction:', {
      streamTitle,
      streamUrl,
      platform,
      userAddress,
      chatroomId
    });

    // Generate unique stream room ID
    const timestamp = Math.floor(Date.now() / 1000);
    const streamRoomId = `stream-${timestamp}-${cleanAddress(userAddress)}`;

    // Create the stream announcement message
    const streamMessage = `🔴 LIVE: ${streamTitle}\n\n${description}\n\n🎥 Platform: ${platform}\n🔗 ${streamUrl}\n\n#LiveStream #${platform}`;
    
    // Stream start metadata
    const streamStartData = {
      type: 'stream_start',
      streamRoomId,
      streamTitle,
      streamUrl,
      platform,
      description,
      startTime: timestamp,
      streamerAddress: cleanAddress(userAddress)
    };

    // Create message transaction with stream metadata
    const tx = createMessageTx({
      chatContract,
      userAddress,
      userUtxos,
      height,
      message: streamMessage,
      chatroomId: streamRoomId,
      parentId: null,
      customSender: cleanAddress(userAddress),
      metadata: streamStartData
    });

    logger.debug('Stream start transaction created successfully');
    return { tx, streamRoomId, streamStartData };

  } catch (error) {
    logger.error('Error creating stream start transaction:', error);
    throw new Error(`Failed to create stream start transaction: ${error.message}`);
  }
}

/**
 * Handle stream closure on the blockchain
 */
export async function handleCloseStreamOnBlockchain({
  streamData,
  walletType,
  connectedAddress,
  chatContract,
  onTxSubmitted,
  showErgopayModal,
  setUnsignedTx
}) {
  try {
    logger.debug('Handling stream closure on blockchain:', streamData);

    // Validate required data
    if (!streamData || !streamData.roomId) {
      throw new Error('Invalid stream data - missing room ID');
    }

    if (!connectedAddress) {
      throw new Error('No wallet connected');
    }

    // Verify user is the stream owner
    const streamOwner = cleanAddress(streamData.streamerAddress || streamData.announcer);
    const currentUser = cleanAddress(connectedAddress);
    
    if (streamOwner !== currentUser) {
      throw new Error('Only the stream owner can end the stream');
    }

    // Get wallet information
    const walletInfo = await getWalletInfo(walletType, connectedAddress);
    const { myAddress, height, utxos } = walletInfo;

    // Validate balance
    const balanceValidation = validateWalletBalance(utxos);
    if (!balanceValidation.valid) {
      throw new Error(balanceValidation.error);
    }

    // Create stream end transaction
    const tx = createStreamEndTx({
      chatContract,
      userAddress: myAddress,
      userUtxos: utxos,
      height,
      streamRoomId: streamData.roomId,
      streamTitle: streamData.title,
      streamUrl: streamData.url,
      platform: streamData.platform,
      chatroomId: streamData.roomId
    });

    logger.debug('Stream end transaction created, submitting...');

    if (walletType !== 'ergopay') {
      // Sign and submit with Nautilus/other wallets
      const result = await signAndSubmitTransaction(tx, walletType);
      const { txId, signed } = result;

      logger.debug('Stream end transaction submitted:', txId);

      // Process the transaction result
      const processed = processTransactionResult(txId, {
        type: 'stream_end',
        streamData,
        senderAddress: myAddress,
        chatroomId: streamData.roomId
      });

      // Call the submission callback
      if (onTxSubmitted) {
        onTxSubmitted(txId, 'stream_end', streamData);
      }

      // Update UTXO cache
      const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
      const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
      await updateUTXOCache(myAddress, usedBoxIds, newOutputs);

      // Update local stream storage
      updateLocalStreamStorage(streamData.roomId, { 
        isActive: false, 
        endedAt: Math.floor(Date.now() / 1000),
        endTxId: txId 
      });

      showCustomToast(
        `Stream ended successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId.substring(0, 8)}...</a>`,
        5000,
        'success'
      );

      return { success: true, txId, processed };

    } else {
      // Use ErgoPay
      setUnsignedTx(tx);
      showErgopayModal(true);
      
      return { success: true, method: 'ergopay' };
    }

  } catch (error) {
    logger.error('Error handling stream closure on blockchain:', error);
    const friendlyError = getUserFriendlyError(error);
    showCustomToast(`Failed to end stream: ${friendlyError}`, 5000, 'error');
    throw error;
  }
}

/**
 * Handle stream creation on the blockchain
 */
export async function handleCreateStreamOnBlockchain({
  streamTitle,
  streamUrl,
  platform,
  description,
  walletType,
  connectedAddress,
  chatContract,
  onTxSubmitted,
  showErgopayModal,
  setUnsignedTx,
  chatroomId = 'general'
}) {
  try {
    logger.debug('Creating stream on blockchain:', {
      streamTitle,
      streamUrl,
      platform,
      connectedAddress
    });

    if (!connectedAddress) {
      throw new Error('No wallet connected');
    }

    // Validate stream data
    if (!streamTitle?.trim()) {
      throw new Error('Stream title is required');
    }

    if (!streamUrl?.trim()) {
      throw new Error('Stream URL is required');
    }

    if (!platform?.trim()) {
      throw new Error('Platform is required');
    }

    // Get wallet information
    const walletInfo = await getWalletInfo(walletType, connectedAddress);
    const { myAddress, height, utxos } = walletInfo;

    // Validate balance
    const balanceValidation = validateWalletBalance(utxos);
    if (!balanceValidation.valid) {
      throw new Error(balanceValidation.error);
    }

    // Create stream start transaction
    const { tx, streamRoomId, streamStartData } = createStreamStartTx({
      chatContract,
      userAddress: myAddress,
      userUtxos: utxos,
      height,
      streamTitle: streamTitle.trim(),
      streamUrl: streamUrl.trim(),
      platform: platform.trim(),
      description: description?.trim() || '',
      chatroomId
    });

    logger.debug('Stream start transaction created, submitting...');

    if (walletType !== 'ergopay') {
      // Sign and submit with Nautilus/other wallets
      const result = await signAndSubmitTransaction(tx, walletType);
      const { txId, signed } = result;

      logger.debug('Stream start transaction submitted:', txId);

      // Process the transaction result
      const processed = processTransactionResult(txId, {
        type: 'stream_start',
        streamData: streamStartData,
        senderAddress: myAddress,
        chatroomId: streamRoomId
      });

      // Save stream to local storage
      saveStreamToLocalStorage({
        ...streamStartData,
        txId,
        isActive: true,
        createdAt: Math.floor(Date.now() / 1000)
      });

      // Call the submission callback
      if (onTxSubmitted) {
        onTxSubmitted(txId, 'stream_start', streamStartData);
      }

      // Update UTXO cache
      const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
      const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
      await updateUTXOCache(myAddress, usedBoxIds, newOutputs);

      showCustomToast(
        `Stream created successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId.substring(0, 8)}...</a>`,
        5000,
        'success'
      );

      return { 
        success: true, 
        txId, 
        streamRoomId, 
        streamData: streamStartData,
        processed 
      };

    } else {
      // Use ErgoPay
      setUnsignedTx(tx);
      showErgopayModal(true);
      
      // Store stream data for ErgoPay completion
      window.ergoStreamPendingData = {
        streamRoomId,
        streamData: streamStartData
      };
      
      return { 
        success: true, 
        method: 'ergopay', 
        streamRoomId, 
        streamData: streamStartData 
      };
    }

  } catch (error) {
    logger.error('Error creating stream on blockchain:', error);
    const friendlyError = getUserFriendlyError(error);
    showCustomToast(`Failed to create stream: ${friendlyError}`, 5000, 'error');
    throw error;
  }
}

/**
 * Save stream data to local storage
 */
function saveStreamToLocalStorage(streamData) {
  try {
    const existingStreams = getFromStorage('ergochat_streams', []);
    const updatedStreams = [...existingStreams, streamData];
    setToStorage('ergochat_streams', updatedStreams);
    logger.debug('Stream saved to local storage:', streamData.streamRoomId);
  } catch (error) {
    logger.warn('Error saving stream to local storage:', error);
  }
}

/**
 * Update stream data in local storage
 */
function updateLocalStreamStorage(streamRoomId, updates) {
  try {
    const existingStreams = getFromStorage('ergochat_streams', []);
    const updatedStreams = existingStreams.map(stream => 
      stream.streamRoomId === streamRoomId 
        ? { ...stream, ...updates }
        : stream
    );
    setToStorage('ergochat_streams', updatedStreams);
    logger.debug('Stream updated in local storage:', streamRoomId, updates);
  } catch (error) {
    logger.warn('Error updating stream in local storage:', error);
  }
}

/**
 * Get all streams from local storage
 */
export function getLocalStreams() {
  try {
    return getFromStorage('ergochat_streams', []);
  } catch (error) {
    logger.warn('Error getting streams from local storage:', error);
    return [];
  }
}

/**
 * Get active streams from local storage
 */
export function getActiveStreams() {
  try {
    const allStreams = getLocalStreams();
    return allStreams.filter(stream => stream.isActive && !stream.endedAt);
  } catch (error) {
    logger.warn('Error getting active streams:', error);
    return [];
  }
}

/**
 * Find stream by room ID
 */
export function findStreamByRoomId(roomId) {
  try {
    const allStreams = getLocalStreams();
    return allStreams.find(stream => stream.streamRoomId === roomId);
  } catch (error) {
    logger.warn('Error finding stream by room ID:', error);
    return null;
  }
}

/**
 * Clean up old/ended streams from local storage
 */
export function cleanupOldStreams(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
  try {
    const allStreams = getLocalStreams();
    const now = Date.now();
    
    const cleanedStreams = allStreams.filter(stream => {
      const streamTime = (stream.endedAt || stream.createdAt || stream.startTime) * 1000;
      return (now - streamTime) < maxAge;
    });
    
    if (cleanedStreams.length !== allStreams.length) {
      setToStorage('ergochat_streams', cleanedStreams);
      logger.debug(`Cleaned up ${allStreams.length - cleanedStreams.length} old streams`);
    }
    
    return cleanedStreams;
  } catch (error) {
    logger.warn('Error cleaning up old streams:', error);
    return getLocalStreams();
  }
}

/**
 * Validate stream URL format
 */
export function validateStreamUrl(url, platform) {
  try {
    const urlObj = new URL(url);
    
    switch (platform?.toLowerCase()) {
      case 'twitch':
        return urlObj.hostname.includes('twitch.tv');
      case 'youtube':
        return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
      case 'discord':
        return urlObj.hostname.includes('discord.gg') || urlObj.hostname.includes('discord.com');
      case 'custom':
        return true; // Allow any valid URL for custom platforms
      default:
        return true; // Allow any valid URL if platform not specified
    }
  } catch (error) {
    return false;
  }
}

/**
 * Extract stream info from message content
 */
export function extractStreamInfoFromMessage(content) {
  try {
    // Look for stream announcement patterns
    const streamPatterns = {
      title: /🔴 LIVE: (.+?)(?:\n|$)/,
      platform: /🎥 Platform: (.+?)(?:\n|$)/,
      url: /🔗 (https?:\/\/[^\s]+)/
    };
    
    const result = {};
    
    for (const [key, pattern] of Object.entries(streamPatterns)) {
      const match = content.match(pattern);
      if (match) {
        result[key] = match[1].trim();
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    logger.warn('Error extracting stream info from message:', error);
    return null;
  }
}

/**
 * Check if a message is a stream announcement
 */
export function isStreamAnnouncement(message) {
  if (!message || !message.content) return false;
  
  const content = message.content.toLowerCase();
  return (
    content.includes('🔴 live:') ||
    content.includes('#livestream') ||
    (content.includes('🎥 platform:') && content.includes('🔗 http'))
  );
}

/**
 * Check if a message is a stream end announcement
 */
export function isStreamEndAnnouncement(message) {
  if (!message || !message.content) return false;
  
  const content = message.content.toLowerCase();
  return (
    content.includes('🎬 stream') &&
    content.includes('has ended') &&
    content.includes('thanks for watching')
  );
}