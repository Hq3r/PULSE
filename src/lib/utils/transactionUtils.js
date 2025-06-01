// transactionUtils.js - Transaction building and wallet utilities

import { 
    ErgoAddress, 
    OutputBuilder, 
    RECOMMENDED_MIN_FEE_VALUE, 
    TransactionBuilder
  } from '@fleet-sdk/core';
  import { SLong, SColl, SByte } from '@fleet-sdk/serializer';
  import { stringToBytes } from '@scure/base';
  
  import { 
    CUSTOM_MIN_BOX_VALUE, 
    MIN_ERG_VALUE, 
    CHAT_CONTRACT,
    STEALTH_CONTRACT,
    ENCRYPTION_CONFIG,
    SUPPORTED_TOKENS  // Add this import here instead of using require
  } from '$lib/common/mainConsts.js';
  
  import { 
    cleanAddress, 
    encryptMessage, 
    encryptRoomCode, 
    truncateAddress,
    createLogger
  } from './mainUtils.js';
  
  const logger = createLogger('TransactionUtils');
  
  // ============= Wallet Utilities =============
  
  /**
   * Get wallet information with error handling
   * @param {string} selectedWallet - Selected wallet type
   * @param {string} connectedAddress - Connected wallet address
   * @returns {Promise<Object>} - Wallet information
   */
  export async function getWalletInfo(selectedWallet, connectedAddress) {
    let myAddress, height, utxos;
    
    if (selectedWallet !== 'ergopay') {
      try {
        // Get address
        if (typeof window.ergo.get_change_address === 'function') {
          myAddress = await window.ergo.get_change_address();
        } else if (typeof window.ergo.getChangeAddress === 'function') {
          myAddress = await window.ergo.getChangeAddress();
        } else {
          myAddress = connectedAddress;
        }
        
        // Get height
        if (typeof window.ergo.get_current_height === 'function') {
          height = await window.ergo.get_current_height();
        } else if (typeof window.ergo.getCurrentHeight === 'function') {
          height = await window.ergo.getCurrentHeight();
        } else {
          const { getBlockHeight } = await import('$lib/api-explorer/explorer');
          height = await getBlockHeight();
        }
        
        // Get UTXOs
        try {
          if (typeof window.ergo.get_utxos === 'function') {
            utxos = await window.ergo.get_utxos();
            logger.debug("Got UTXOs from wallet API:", utxos?.length);
          } else {
            throw new Error("Wallet get_utxos not available");
          }
        } catch (utxoError) {
          logger.debug("Falling back to explorer for UTXOs:", utxoError.message);
          const { fetchBoxes } = await import('$lib/api-explorer/explorer');
          utxos = await fetchBoxes(connectedAddress);
        }
        
      } catch (error) {
        logger.error("Error accessing wallet API:", error);
        throw new Error("Error accessing wallet: " + error.message);
      }
    } else {
      // Ergopay wallet
      myAddress = connectedAddress;
      const { fetchBoxes, getBlockHeight } = await import('$lib/api-explorer/explorer');
      utxos = await fetchBoxes(connectedAddress);
      height = await getBlockHeight();
    }
    
    return { myAddress, height, utxos };
  }
  
  /**
   * Validate wallet balance
   * @param {Array} utxos - Available UTXOs
   * @param {bigint} minimumRequired - Minimum required balance
   * @returns {Object} - Validation result
   */
  export function validateWalletBalance(utxos, minimumRequired = BigInt(2000000)) {
    if (!utxos || utxos.length === 0) {
      return {
        valid: false,
        error: "No UTXOs found in wallet. Please ensure you have ERG in your wallet and try reconnecting."
      };
    }
    
    const totalValue = utxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
    
    if (totalValue < minimumRequired) {
      return {
        valid: false,
        error: `Insufficient balance. You need at least ${Number(minimumRequired) / 1000000000} ERG but have ${Number(totalValue) / 1000000000} ERG`
      };
    }
    
    return { valid: true, totalValue };
  }
  
  /**
   * Sign and submit transaction
   * @param {Object} tx - Transaction to sign
   * @param {string} selectedWallet - Wallet type
   * @returns {Promise<string>} - Transaction ID
   */
  export async function signAndSubmitTransaction(tx, selectedWallet) {
    if (selectedWallet === 'ergopay') {
      throw new Error('ErgoPay transactions should be handled separately');
    }
    
    let signed, txId;
    
    try {
      logger.debug("Signing transaction...");
      if (typeof window.ergo.sign_tx === 'function') {
        signed = await window.ergo.sign_tx(tx);
      } else if (typeof window.ergo.signTx === 'function') {
        signed = await window.ergo.signTx(tx);
      } else {
        throw new Error("No sign_tx method found in wallet");
      }
      
      logger.debug("Submitting transaction...");
      if (typeof window.ergo.submit_tx === 'function') {
        txId = await window.ergo.submit_tx(signed);
      } else if (typeof window.ergo.submitTx === 'function') {
        txId = await window.ergo.submitTx(signed);
      } else {
        throw new Error("No submit_tx method found in wallet");
      }
      
      logger.debug("Transaction submitted successfully:", txId);
      return { txId, signed };
      
    } catch (error) {
      logger.error("Error signing/submitting transaction:", error);
      throw error;
    }
  }
  
  /**
   * Get common box IDs between UTXOs and inputs
   * @param {Array} utxos - Available UTXOs
   * @param {Array} inputs - Transaction inputs
   * @returns {Array} - Common box IDs
   */
  export function getCommonBoxIds(utxos, inputs) {
    const usedBoxIds = [];
    
    for (const input of inputs) {
      for (const utxo of utxos) {
        if (input.boxId === utxo.boxId) {
          usedBoxIds.push(utxo.boxId);
          break;
        }
      }
    }
    
    return usedBoxIds;
  }
  
  // ============= Message Transaction Building =============
  
  /**
   * Create a message transaction
   * @param {Object} params - Transaction parameters
   * @returns {Object} - Transaction object
   */
  export function createMessageTx(params) {
    const {
      chatContract,
      userAddress,
      userUtxos,
      height,
      message,
      chatroomId = 'general',
      parentId = null,
      customSender = null,
      chatrooms = []
    } = params;
    
    const timestamp = Math.floor(Date.now() / 1000);
    const cleanedAddress = cleanAddress(userAddress);
    
    // Handle private rooms
    let blockchainChatroomId = chatroomId;
    
    if (chatroomId.startsWith('private-')) {
      const room = chatrooms.find(r => r.id === chatroomId);
      if (room && room.blockchainRoomId) {
        blockchainChatroomId = room.blockchainRoomId;
      } else {
        const originalCode = chatroomId.replace('private-', '');
        const encryptedCode = encryptRoomCode(originalCode);
        blockchainChatroomId = 'private-' + encryptedCode;
      }
    }
    
    // Encrypt message content
    const encryptedMessage = encryptMessage(message);
    
    // Convert values to bytes
    const messageBytes = stringToBytes('utf8', encryptedMessage);
    const senderForR4 = customSender || cleanedAddress;
    const addressBytes = stringToBytes('utf8', senderForR4);
    const chatroomBytes = stringToBytes('utf8', blockchainChatroomId);
    const parentIdBytes = parentId ? stringToBytes('utf8', parentId) : new Uint8Array(0);
    
    // Create output box with message data
    const chatBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContract)
      .setAdditionalRegisters({
        R4: SColl(SByte, addressBytes).toHex(),
        R5: SColl(SByte, messageBytes).toHex(),
        R6: SLong(timestamp).toHex(),
        R7: SColl(SByte, chatroomBytes).toHex(),
        R8: SColl(SByte, parentIdBytes).toHex()
      });
    
    // Build transaction
    const messageTx = new TransactionBuilder(height)
      .from(userUtxos)
      .to([chatBox])
      .sendChangeTo(ErgoAddress.fromBase58(userAddress))
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();
    
    return messageTx;
  }
  
  // ============= Tip Transaction Building =============
  
  /**
   * Create a tip transaction
   * @param {Object} params - Tip parameters
   * @returns {Object} - Transaction object
   */
  export function createTipTx(params) {
    const {
      recipientAddress,
      senderAddress,
      chatContractAddress,
      senderUtxos,
      height,
      tokenId,
      amount,
      tokenName,
      chatroomId = 'general'
    } = params;
    
    logger.debug(`Creating tip transaction: ${amount} ${tokenName} (${tokenId}) to ${recipientAddress} in chatroom ${chatroomId}`);
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Format the token display
    const tokenDisplay = !tokenId || tokenId === '' ? 'ERG' : tokenName;
    
    // Calculate display amount from raw amount
    let displayAmount;
    if (!tokenId || tokenId === '') {
      displayAmount = Number(amount) / 1000000000;
    } else {
      // FIXED: Use imported SUPPORTED_TOKENS instead of require
      const decimals = SUPPORTED_TOKENS[tokenName.toUpperCase()]?.[1] || 0;
      displayAmount = Number(amount) / Math.pow(10, decimals);
    }
    
    // Format the tip message
    const tipMessage = `💸 ${truncateAddress(senderAddress)} tipped ${displayAmount} ${tokenDisplay} to ${truncateAddress(recipientAddress)}`;
    
    // Convert data to bytes
    const cleanedAddress = cleanAddress(senderAddress);
    const messageBytes = stringToBytes('utf8', tipMessage);
    const addressBytes = stringToBytes('utf8', cleanedAddress);
    const chatroomBytes = stringToBytes('utf8', chatroomId);
    const emptyBytes = new Uint8Array(0);
    
    const outputs = [];
    
    // 1. Create recipient box for tip
    let tipBox;
    if (!tokenId || tokenId === '') {
      // ERG tip
      logger.debug(`Creating ERG tip box: ${amount} nanoERG`);
      tipBox = new OutputBuilder(amount, recipientAddress);
    } else {
      // Token tip
      logger.debug(`Creating token tip box: ${amount} of token ${tokenId}`);
      tipBox = new OutputBuilder(MIN_ERG_VALUE, recipientAddress)
        .addTokens([{
          tokenId: tokenId,
          amount: amount
        }]);
    }
    outputs.push(tipBox);
    
    // 2. Create chat message box
    logger.debug(`Creating chat message box to ${chatContractAddress}`);
    const chatBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContractAddress)
      .setAdditionalRegisters({
        R4: SColl(SByte, addressBytes).toHex(),
        R5: SColl(SByte, messageBytes).toHex(),
        R6: SLong(timestamp).toHex(),
        R7: SColl(SByte, chatroomBytes).toHex(),
        R8: SColl(SByte, emptyBytes).toHex()
      });
    outputs.push(chatBox);
    
    // Build transaction
    logger.debug(`Building transaction with ${outputs.length} outputs`);
    try {
      const tipTx = new TransactionBuilder(height)
        .from(senderUtxos)
        .to(outputs)
        .sendChangeTo(ErgoAddress.fromBase58(senderAddress))
        .payFee(RECOMMENDED_MIN_FEE_VALUE)
        .build()
        .toEIP12Object();
      
      logger.debug("Transaction built successfully");
      return tipTx;
    } catch (error) {
      logger.error("Error building transaction:", error);
      if (error.message.includes("Insufficient inputs") && tokenId !== '') {
        throw new Error(`Insufficient tokens: Not enough ${tokenName} in your wallet.`);
      }
      throw error;
    }
  }
  
  // ============= Stream Transaction Building =============
  
  /**
   * Create a stream room transaction
   * @param {Object} params - Stream parameters
   * @returns {Object} - Transaction object
   */
  export function createStreamRoomTx(params) {
    const {
      chatContract,
      userAddress,
      userUtxos,
      height,
      streamData
    } = params;
    
    const timestamp = Math.floor(Date.now() / 1000);
    const cleanedAddress = cleanAddress(userAddress);
    
    // Create the stream room data structure
    const streamRoomData = {
      type: 'STREAM_ROOM',
      title: streamData.title,
      url: streamData.url,
      platform: streamData.platform,
      roomId: streamData.roomId,
      streamerAddress: cleanedAddress,
      startTime: timestamp,
      isActive: true
    };
    
    // Convert to JSON and then to bytes
    const streamDataJson = JSON.stringify(streamRoomData);
    const streamDataBytes = stringToBytes('utf8', streamDataJson);
    
    // Create sender and chatroom bytes
    const addressBytes = stringToBytes('utf8', cleanedAddress);
    const chatroomBytes = stringToBytes('utf8', streamData.roomId);
    
    // Create the stream announcement message
    const announcementMessage = `🎥 Live Stream Started: "${streamData.title}" on ${streamData.platform}! Join: ${streamData.url}`;
    const messageBytes = stringToBytes('utf8', announcementMessage);
    
    // Create output box for the stream room registration
    const streamRoomBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContract)
      .setAdditionalRegisters({
        R4: SColl(SByte, addressBytes).toHex(),
        R5: SColl(SByte, messageBytes).toHex(),
        R6: SLong(timestamp).toHex(),
        R7: SColl(SByte, chatroomBytes).toHex(),
        R8: SColl(SByte, streamDataBytes).toHex()
      });
    
    // Build transaction
    const streamTx = new TransactionBuilder(height)
      .from(userUtxos)
      .to([streamRoomBox])
      .sendChangeTo(ErgoAddress.fromBase58(userAddress))
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();
    
    return streamTx;
  }
// ============= COMPLETE createGiftTx FUNCTION =============
// Add this to your transactionUtils.js file

export function createGiftTx({
    recipientAddress,
    senderAddress,
    chatContractAddress,
    senderUtxos,
    height,
    amount,
    giftData,
    chatroomId
  }) {
    try {
      // Input validation
      if (!recipientAddress || !senderAddress || !senderUtxos || !amount || !giftData) {
        throw new Error('Missing required parameters');
      }
  
      if (senderUtxos.length === 0) {
        throw new Error('No UTXOs available');
      }
  
      // Select UTXOs for transaction
      const inputs = senderUtxos.slice(0, 2);
      const totalInput = inputs.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n);
      
      // Calculate amounts
      const fee = 1000000n; // 0.001 ERG
      const minBoxValue = 1000000n; // 0.001 ERG minimum for boxes
      const chatMessageValue = minBoxValue; // For chat contract message
      const totalRequired = amount + fee + chatMessageValue + minBoxValue;
  
      if (totalInput < totalRequired) {
        throw new Error(`Insufficient balance. Required: ${Number(totalRequired) / 1000000000} ERG`);
      }
  
      // Helper functions
      function stringToHex(str) {
        if (!str) return '0e00';
        const bytes = new TextEncoder().encode(str);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const length = bytes.length.toString(16).padStart(2, '0');
        return `0e${length}${hex}`;
      }
  
      function intToHex(num) {
        const hex = num.toString(16).padStart(16, '0');
        return `05${hex}`;
      }
  
      // Create gift metadata
      const giftMetadata = {
        type: 'stream_gift',
        giftId: giftData.giftId,
        giftName: giftData.giftName,
        giftEmoji: giftData.giftEmoji,
        count: giftData.count,
        rarity: giftData.rarity,
        totalAmount: giftData.amount,
        timestamp: giftData.timestamp,
        roomId: giftData.roomId
      };
  
      // Create outputs
      const outputs = [];
  
      // 1. Gift payment to streamer
      outputs.push({
        value: amount.toString(),
        ergoTree: recipientAddress,
        assets: [],
        additionalRegisters: {
          R4: {
            serializedValue: stringToHex(senderAddress),
            renderedValue: senderAddress
          },
          R5: {
            serializedValue: stringToHex(`GIFT: ${giftData.giftEmoji} ${giftData.giftName}`),
            renderedValue: `GIFT: ${giftData.giftEmoji} ${giftData.giftName}`
          },
          R6: {
            serializedValue: intToHex(giftData.timestamp),
            renderedValue: giftData.timestamp.toString()
          },
          R7: {
            serializedValue: stringToHex(chatroomId),
            renderedValue: chatroomId
          },
          R8: {
            serializedValue: stringToHex(JSON.stringify(giftMetadata)),
            renderedValue: JSON.stringify(giftMetadata)
          }
        },
        creationHeight: height
      });
  
      // 2. Gift announcement to chat contract
      const giftMessage = `🎁 ${giftData.giftEmoji} ${giftData.giftName} x${giftData.count} (${giftData.amount} ERG) sent to streamer!`;
      
      outputs.push({
        value: chatMessageValue.toString(),
        ergoTree: chatContractAddress,
        assets: [],
        additionalRegisters: {
          R4: {
            serializedValue: stringToHex(senderAddress),
            renderedValue: senderAddress
          },
          R5: {
            serializedValue: stringToHex(giftMessage),
            renderedValue: giftMessage
          },
          R6: {
            serializedValue: intToHex(giftData.timestamp),
            renderedValue: giftData.timestamp.toString()
          },
          R7: {
            serializedValue: stringToHex(chatroomId),
            renderedValue: chatroomId
          },
          R8: {
            serializedValue: stringToHex(`gift:${giftData.giftId}:${giftData.count}`),
            renderedValue: `gift:${giftData.giftId}:${giftData.count}`
          }
        },
        creationHeight: height
      });
  
      // 3. Change back to sender
      const changeAmount = totalInput - amount - fee - chatMessageValue;
      if (changeAmount > 0n) {
        outputs.push({
          value: changeAmount.toString(),
          ergoTree: senderUtxos[0].ergoTree,
          assets: [],
          additionalRegisters: {},
          creationHeight: height
        });
      }
  
      // Return transaction
      return {
        inputs: inputs.map(utxo => ({
          boxId: utxo.boxId,
          transactionId: utxo.transactionId,
          index: utxo.index
        })),
        outputs,
        fee: fee.toString(),
        dataInputs: []
      };
  
    } catch (error) {
      throw new Error(`Gift transaction creation failed: ${error.message}`);
    }
  }
  
  /**
   * Helper function to get ErgoTree from address
   * (You may already have this in your utils)
   */
  function getErgoTreeFromAddress(address) {
    try {
      // This is a simplified version - you might need to use your existing address conversion logic
      // or import from ergo-lib if available
      
      // For now, return the address as is - you'll need to implement proper ErgoTree conversion
      // based on your existing codebase
      return address;
      
    } catch (error) {
      console.error('Error converting address to ErgoTree:', error);
      throw new Error(`Invalid address: ${address}`);
    }
  }
  
  /**
   * Parse gift data from blockchain box
   * Add this to your existing parseBoxToMessage function or create a separate parser
   */
  export function parseGiftFromBox(box) {
    try {
      if (!box || !box.additionalRegisters) {
        return null;
      }
  
      const registers = box.additionalRegisters;
      
      // Check if this is a gift transaction
      if (!registers.R8 || !registers.R8.renderedValue) {
        return null;
      }
  
      const r8Value = registers.R8.renderedValue;
      
      // Check if R8 contains gift metadata
      if (r8Value.startsWith('gift:') || r8Value.includes('stream_gift')) {
        try {
          let giftMetadata;
          
          if (r8Value.startsWith('gift:')) {
            // Simple gift ID format
            const giftId = r8Value.replace('gift:', '');
            giftMetadata = {
              type: 'stream_gift',
              giftId: giftId,
              isSimpleGift: true
            };
          } else {
            // Full JSON metadata
            giftMetadata = JSON.parse(r8Value);
          }
          
          // Extract other data from registers
          const sender = registers.R4?.renderedValue || 'Unknown';
          const content = registers.R5?.renderedValue || '';
          const timestamp = parseInt(registers.R6?.renderedValue) || Math.floor(Date.now() / 1000);
          const chatroomId = registers.R7?.renderedValue || 'general';
          
          return {
            id: box.boxId || box.transactionId,
            sender: sender,
            content: content,
            timestamp: timestamp,
            chatroomId: chatroomId,
            pending: false,
            isGiftMessage: true,
            giftMetadata: giftMetadata,
            value: box.value
          };
          
        } catch (parseError) {
          console.warn('Error parsing gift metadata:', parseError);
          return null;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Error parsing gift from box:', error);
      return null;
    }
  }
  
  /**
   * Calculate gift statistics for a user or stream
   */
  export function calculateGiftStats(messages, userAddress = null, roomId = null) {
    try {
      const giftMessages = messages.filter(msg => 
        msg.isGiftMessage && 
        msg.giftMetadata &&
        (!userAddress || msg.sender === userAddress) &&
        (!roomId || msg.chatroomId === roomId)
      );
      
      const stats = {
        totalGifts: giftMessages.length,
        totalValue: 0,
        giftsByType: {},
        giftsByRarity: {},
        topSenders: {},
        recentGifts: giftMessages.slice(-10).reverse()
      };
      
      for (const msg of giftMessages) {
        const gift = msg.giftMetadata;
        const value = gift.totalAmount || 0;
        
        // Total value
        stats.totalValue += value;
        
        // By type
        const giftType = gift.giftName || gift.giftId;
        if (!stats.giftsByType[giftType]) {
          stats.giftsByType[giftType] = { count: 0, value: 0 };
        }
        stats.giftsByType[giftType].count += gift.count || 1;
        stats.giftsByType[giftType].value += value;
        
        // By rarity
        const rarity = gift.rarity || 'common';
        if (!stats.giftsByRarity[rarity]) {
          stats.giftsByRarity[rarity] = { count: 0, value: 0 };
        }
        stats.giftsByRarity[rarity].count += gift.count || 1;
        stats.giftsByRarity[rarity].value += value;
        
        // Top senders
        const sender = msg.sender;
        if (!stats.topSenders[sender]) {
          stats.topSenders[sender] = { count: 0, value: 0 };
        }
        stats.topSenders[sender].count += 1;
        stats.topSenders[sender].value += value;
      }
      
      return stats;
      
    } catch (error) {
      console.error('Error calculating gift stats:', error);
      return {
        totalGifts: 0,
        totalValue: 0,
        giftsByType: {},
        giftsByRarity: {},
        topSenders: {},
        recentGifts: []
      };
    }
  }
  /**
   * Create a stream end transaction
   * @param {Object} params - Stream end parameters
   * @returns {Object} - Transaction object
   */
  export function createStreamEndTx(params) {
    const {
      chatContract,
      userAddress,
      userUtxos,
      height,
      streamData
    } = params;
    
    const timestamp = Math.floor(Date.now() / 1000);
    const cleanedAddress = cleanAddress(userAddress);
    
    // Create UPDATED stream data with isActive: false
    const updatedStreamData = {
      type: 'STREAM_ROOM',
      title: streamData.title,
      url: streamData.url,
      platform: streamData.platform,
      roomId: streamData.roomId,
      streamerAddress: cleanedAddress,
      startTime: streamData.startTime || streamData.timestamp,
      isActive: false,
      endTime: timestamp,
      endedBy: cleanedAddress
    };
    
    const streamDataJson = JSON.stringify(updatedStreamData);
    const streamDataBytes = stringToBytes('utf8', streamDataJson);
    
    // Create the stream end announcement message
    const endMessage = `🎬 Stream "${streamData.title}" has ended. Thanks for watching!`;
    const messageBytes = stringToBytes('utf8', endMessage);
    
    const addressBytes = stringToBytes('utf8', cleanedAddress);
    const chatroomBytes = stringToBytes('utf8', streamData.roomId);
    
    // Create output box for the stream end
    const streamEndBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContract)
      .setAdditionalRegisters({
        R4: SColl(SByte, addressBytes).toHex(),
        R5: SColl(SByte, messageBytes).toHex(),
        R6: SLong(timestamp).toHex(),
        R7: SColl(SByte, chatroomBytes).toHex(),
        R8: SColl(SByte, streamDataBytes).toHex()
      });
    
    // Build transaction
    const endTx = new TransactionBuilder(height)
      .from(userUtxos)
      .to([streamEndBox])
      .sendChangeTo(ErgoAddress.fromBase58(userAddress))
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();
    
    return endTx;
  }
  
  // ============= Stealth Identity Transaction Building =============
  
  /**
   * Create a stealth identity registration transaction
   * @param {Object} params - Stealth identity parameters
   * @returns {Object} - Transaction object
   */
  export function createStealthIdentityTx(params) {
    const {
      displayName,
      userAddress,
      userUtxos,
      height
    } = params;
    
    const timestamp = Math.floor(Date.now() / 1000);
    const cleanedAddress = cleanAddress(userAddress);
    
    // Convert values to bytes
    const displayNameBytes = stringToBytes('utf8', displayName);
    const addressBytes = stringToBytes('utf8', cleanedAddress);
    const timestampBytes = stringToBytes('utf8', timestamp.toString());
    
    // Create output box for stealth identity registration
    const stealthBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, STEALTH_CONTRACT)
      .setAdditionalRegisters({
        R4: SColl(SByte, displayNameBytes).toHex(),
        R5: SColl(SByte, addressBytes).toHex(),
        R6: SLong(timestamp).toHex(),
        R7: SColl(SByte, stringToBytes('utf8', ENCRYPTION_CONFIG.STEALTH_IDENTITY_TYPE)).toHex()
      });
    
    // Build transaction
    const stealthTx = new TransactionBuilder(height)
      .from(userUtxos)
      .to([stealthBox])
      .sendChangeTo(ErgoAddress.fromBase58(userAddress))
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();
    
    return stealthTx;
  }
  
  // ============= Transaction Processing Utilities =============
  
  /**
   * Process transaction submission result
   * @param {string} txId - Transaction ID
   * @param {Object} params - Processing parameters
   * @returns {Object} - Processing result
   */
  export function processTransactionResult(txId, params) {
    const {
      type,
      messageContent = '',
      senderAddress = '',
      recipientAddress = '',
      amount = '',
      tokenName = 'ERG',
      chatroomId = 'general',
      parentId = null,
      isStealthMode = false,
      stealthSenderInfo = null
    } = params;
    
    const timestamp = Math.floor(Date.now() / 1000);
    let content = messageContent;
    let sender = cleanAddress(senderAddress);
    
    // Handle stealth mode
    if (isStealthMode && stealthSenderInfo) {
      sender = stealthSenderInfo.displayName;
    }
    
    // Handle tip messages
    if (type === 'tip') {
      content = `💸 ${truncateAddress(senderAddress)} tipped ${amount} ${tokenName} to ${truncateAddress(recipientAddress)}`;
    }
    
    // Create message object
    const message = {
      id: txId,
      sender: sender,
      content: content,
      timestamp: timestamp,
      pending: true,
      chatroomId: chatroomId,
      parentId: parentId,
      replyTo: parentId ? null : undefined, // Will be populated later
      isStealthMessage: isStealthMode,
      stealthDisplayName: isStealthMode ? stealthSenderInfo?.displayName : undefined
    };
    
    return {
      message,
      txId,
      type
    };
  }
  
  /**
   * Update UTXO cache after transaction
   * @param {string} userAddress - User address
   * @param {Array} usedBoxIds - Used box IDs
   * @param {Array} newOutputs - New outputs
   */
  export async function updateUTXOCache(userAddress, usedBoxIds, newOutputs) {
    try {
      const { updateTempBoxes } = await import('$lib/api-explorer/explorer');
      updateTempBoxes(userAddress, usedBoxIds, newOutputs);
    } catch (cacheError) {
      logger.warn("Error updating UTXO cache:", cacheError);
    }
  }
  
  // ============= Transaction Validation =============
  
  /**
   * Validate transaction parameters
   * @param {Object} params - Transaction parameters
   * @returns {Object} - Validation result
   */
  export function validateTransactionParams(params) {
    const { userAddress, userUtxos, height, message } = params;
    const errors = [];
    
    if (!userAddress) {
      errors.push('User address is required');
    }
    
    if (!userUtxos || !Array.isArray(userUtxos) || userUtxos.length === 0) {
      errors.push('Valid UTXOs are required');
    }
    
    if (!height || typeof height !== 'number' || height <= 0) {
      errors.push('Valid blockchain height is required');
    }
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      errors.push('Message content is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate tip transaction parameters
   * @param {Object} params - Tip parameters
   * @returns {Object} - Validation result
   */
  export function validateTipParams(params) {
    const { recipientAddress, amount, tokenId, tokenName } = params;
    const errors = [];
    
    if (!recipientAddress) {
      errors.push('Recipient address is required');
    }
    
    if (!amount || (typeof amount !== 'bigint' && typeof amount !== 'number')) {
      errors.push('Valid amount is required');
    }
    
    if (typeof amount === 'number' && amount <= 0) {
      errors.push('Amount must be positive');
    }
    
    if (typeof amount === 'bigint' && amount <= 0n) {
      errors.push('Amount must be positive');
    }
    
    if (!tokenName) {
      errors.push('Token name is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // ============= Export Functions =============
  
  export default {
    // Wallet utilities
    getWalletInfo,
    validateWalletBalance,
    signAndSubmitTransaction,
    getCommonBoxIds,
    
    // Transaction builders
    createMessageTx,
    createTipTx,
    createStreamRoomTx,
    createStreamEndTx,
    createStealthIdentityTx,
    
    // Transaction processing
    processTransactionResult,
    updateUTXOCache,
    
    // Validation
    validateTransactionParams,
    validateTipParams
  };