// streamTransactionUtils.js - Stream-specific transaction utilities

import { createLogger } from './mainUtils.js';

const logger = createLogger('StreamTransactionUtils');

/**
 * Enhanced createMessageTx that supports stream metadata
 * Add this to your existing transactionUtils.js file
 */
export function createMessageTx({
  chatContract,
  userAddress,
  userUtxos,
  height,
  message,
  chatroomId = 'general',
  parentId = null,
  customSender = null,
  chatrooms = [],
  metadata = null // New parameter for stream metadata
}) {
  try {
    logger.debug('Creating message transaction with stream support:', {
      userAddress,
      message: message.substring(0, 50) + '...',
      chatroomId,
      parentId,
      hasMetadata: !!metadata
    });

    // Validate inputs
    if (!chatContract || !userAddress || !userUtxos || !message) {
      throw new Error('Missing required parameters for message transaction');
    }

    if (userUtxos.length === 0) {
      throw new Error('No UTXOs available for transaction');
    }

    // Calculate fees
    const minFee = 1100000n; // 0.0011 ERG minimum fee
    const messageFee = 1000000n; // 0.001 ERG for message
    const totalFee = minFee + messageFee;

    // Select UTXOs for transaction
    let selectedUtxos = [];
    let totalValue = 0n;

    // Sort UTXOs by value (largest first for efficiency)
    const sortedUtxos = [...userUtxos].sort((a, b) => 
      BigInt(b.value) - BigInt(a.value)
    );

    // Select enough UTXOs to cover fees
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalValue += BigInt(utxo.value);
      
      if (totalValue >= totalFee) {
        break;
      }
    }

    if (totalValue < totalFee) {
      throw new Error(`Insufficient balance. Need ${totalFee} nanoERG, have ${totalValue} nanoERG`);
    }

    // Prepare message content with encryption if needed
    let finalMessage = message;
    
    // Encrypt message if it contains sensitive info and user wants encryption
    if (shouldEncryptMessage(message)) {
      finalMessage = encryptMessage(message);
      logger.debug('Message encrypted for privacy');
    }

    // Encode message and metadata to hex
    const messageHex = stringToHex(finalMessage);
    const senderHex = stringToHex(customSender || userAddress);
    const timestampHex = numberToHex(Math.floor(Date.now() / 1000));
    const chatroomHex = stringToHex(chatroomId);
    const parentIdHex = parentId ? stringToHex(parentId) : null;

    // Encode stream metadata if present
    let metadataHex = null;
    if (metadata) {
      const metadataString = JSON.stringify(metadata);
      metadataHex = stringToHex(metadataString);
      logger.debug('Stream metadata encoded:', metadata.type);
    }

    // Build transaction inputs
    const inputs = selectedUtxos.map(utxo => ({
      boxId: utxo.boxId,
      transactionId: utxo.transactionId,
      index: utxo.index,
      value: utxo.value,
      ergoTree: utxo.ergoTree,
      assets: utxo.assets || [],
      additionalRegisters: utxo.additionalRegisters || {},
      creationHeight: utxo.creationHeight
    }));

    // Calculate change
    const changeValue = totalValue - totalFee;

    // Build transaction outputs
    const outputs = [
      // Chat contract output (message)
      {
        value: messageFee.toString(),
        ergoTree: getChatContractErgoTree(chatContract),
        assets: [],
        additionalRegisters: {
          R4: { serializedValue: `0e${messageHex}`, sigmaType: 'Coll[SByte]' }, // Message content
          R5: { serializedValue: `0e${senderHex}`, sigmaType: 'Coll[SByte]' },   // Sender
          R6: { serializedValue: `0e${timestampHex}`, sigmaType: 'Coll[SByte]' }, // Timestamp
          R7: { serializedValue: `0e${chatroomHex}`, sigmaType: 'Coll[SByte]' },  // Chatroom
          ...(parentIdHex && { R8: { serializedValue: `0e${parentIdHex}`, sigmaType: 'Coll[SByte]' } }), // Parent ID
          ...(metadataHex && { R9: { serializedValue: `0e${metadataHex}`, sigmaType: 'Coll[SByte]' } }) // Stream metadata
        },
        creationHeight: height
      }
    ];

    // Add change output if needed
    if (changeValue > 0n) {
      outputs.push({
        value: changeValue.toString(),
        ergoTree: selectedUtxos[0].ergoTree, // Send change back to user
        assets: [],
        additionalRegisters: {},
        creationHeight: height
      });
    }

    // Build transaction
    const transaction = {
      inputs,
      outputs,
      fee: minFee.toString(),
      creationHeight: height
    };

    logger.debug('Stream-enabled message transaction created successfully:', {
      inputsCount: inputs.length,
      outputsCount: outputs.length,
      totalFee: totalFee.toString(),
      changeValue: changeValue.toString(),
      hasMetadata: !!metadata
    });

    return transaction;

  } catch (error) {
    logger.error('Error creating stream message transaction:', error);
    throw new Error(`Failed to create message transaction: ${error.message}`);
  }
}

/**
 * Helper function to determine if message should be encrypted
 */
function shouldEncryptMessage(message) {
  // Encrypt private messages, DMs, or messages with sensitive keywords
  const sensitiveKeywords = ['private', 'secret', 'password', 'key', 'dm:', '@'];
  const lowerMessage = message.toLowerCase();
  
  return sensitiveKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Simple message encryption function
 */
function encryptMessage(message, secretKey = "ergochat") {
  try {
    let encrypted = "enc-";
    
    for (let i = 0; i < message.length; i++) {
      const messageChar = message.charCodeAt(i);
      const keyChar = secretKey.charCodeAt((i + (i % 5)) % secretKey.length);
      const encryptedChar = messageChar ^ keyChar;
      
      // Convert to hex and pad to 2 digits
      const hexChar = encryptedChar.toString(16).padStart(2, '0');
      encrypted += hexChar;
    }
    
    return encrypted;
  } catch (error) {
    logger.warn('Encryption failed, using plain text:', error);
    return message;
  }
}

/**
 * Convert string to hex
 */
function stringToHex(str) {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    logger.error('Error converting string to hex:', error);
    throw new Error(`Failed to encode string: ${str}`);
  }
}

/**
 * Convert number to hex
 */
function numberToHex(num) {
  try {
    return num.toString(16).padStart(16, '0'); // 64-bit number
  } catch (error) {
    logger.error('Error converting number to hex:', error);
    throw new Error(`Failed to encode number: ${num}`);
  }
}

/**
 * Get chat contract ErgoTree
 */
function getChatContractErgoTree(contractAddress) {
  // This is a simplified version - you'll need the actual contract ErgoTree
  // For now, return a placeholder that should be replaced with actual contract tree
  return "100204a00b08cd0336100ef59ced80ba5f89c4178ebd57b6c1dd0f3d135ee1db9f62fc634d637041ea02d192a39a8cc7a70173007301";
}

/**
 * Enhanced processTransactionResult for streams
 */
export function processStreamTransactionResult(txId, transactionData) {
  try {
    const { type, streamData, senderAddress, chatroomId } = transactionData;
    
    logger.debug('Processing stream transaction result:', { txId, type, chatroomId });
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    if (type === 'stream_start') {
      return {
        message: {
          id: txId,
          sender: senderAddress,
          content: `🔴 LIVE: ${streamData.streamTitle}\n\n${streamData.description}\n\n🎥 Platform: ${streamData.platform}\n🔗 ${streamData.streamUrl}\n\n#LiveStream #${streamData.platform}`,
          timestamp,
          pending: true,
          chatroomId: streamData.streamRoomId,
          parentId: null,
          isStreamAnnouncement: true,
          streamData: streamData
        },
        streamRoom: {
          id: streamData.streamRoomId,
          name: `🔴 ${streamData.streamTitle}`,
          description: `Live stream: ${streamData.streamTitle}`,
          isStream: true,
          streamData: streamData,
          isActive: true,
          createdAt: timestamp,
          txId: txId
        }
      };
    } 
    
    else if (type === 'stream_end') {
      return {
        message: {
          id: txId,
          sender: senderAddress,
          content: `🎬 Stream "${streamData.title}" has ended. Thanks for watching!`,
          timestamp,
          pending: true,
          chatroomId: chatroomId,
          parentId: null,
          isSystemMessage: true,
          isStreamEnd: true,
          streamData: streamData
        }
      };
    }
    
    else {
      // Regular message
      return processTransactionResult(txId, transactionData);
    }
    
  } catch (error) {
    logger.error('Error processing stream transaction result:', error);
    throw new Error(`Failed to process transaction result: ${error.message}`);
  }
}

/**
 * Validate stream transaction data
 */
export function validateStreamTransaction(transactionData) {
  try {
    const { type, streamData } = transactionData;
    
    if (type === 'stream_start') {
      if (!streamData) {
        throw new Error('Stream data is required for stream start transaction');
      }
      
      if (!streamData.streamTitle || !streamData.streamTitle.trim()) {
        throw new Error('Stream title is required');
      }
      
      if (!streamData.streamUrl || !streamData.streamUrl.trim()) {
        throw new Error('Stream URL is required');
      }
      
      if (!streamData.platform || !streamData.platform.trim()) {
        throw new Error('Stream platform is required');
      }
      
      if (!streamData.streamRoomId) {
        throw new Error('Stream room ID is required');
      }
      
      // Validate URL format
      try {
        new URL(streamData.streamUrl);
      } catch (error) {
        throw new Error('Invalid stream URL format');
      }
    }
    
    else if (type === 'stream_end') {
      if (!streamData) {
        throw new Error('Stream data is required for stream end transaction');
      }
      
      if (!streamData.roomId && !streamData.streamRoomId) {
        throw new Error('Stream room ID is required for ending stream');
      }
    }
    
    return { valid: true };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Extract stream metadata from transaction registers
 */
export function extractStreamMetadata(registers) {
  try {
    if (!registers || !registers.R9) {
      return null;
    }
    
    // Decode R9 register (stream metadata)
    const metadataHex = registers.R9.renderedValue || registers.R9.serializedValue;
    if (!metadataHex) {
      return null;
    }
    
    // Remove '0e' prefix if present
    const cleanHex = metadataHex.startsWith('0e') ? metadataHex.substring(2) : metadataHex;
    
    // Convert hex to string
    const metadataString = hexToString(cleanHex);
    
    // Parse JSON
    const metadata = JSON.parse(metadataString);
    
    logger.debug('Extracted stream metadata:', metadata);
    return metadata;
    
  } catch (error) {
    logger.warn('Error extracting stream metadata:', error);
    return null;
  }
}

/**
 * Convert hex to string
 */
function hexToString(hex) {
  try {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch (error) {
    logger.error('Error converting hex to string:', error);
    throw new Error(`Failed to decode hex: ${hex}`);
  }
}