// privateRoomEncryption.js - Enhanced private room encryption system

import { encryptMessage, decryptMessage } from './mainUtils.js';

// Private room encryption configuration
export const PRIVATE_ROOM_CONFIG = {
  ENCRYPTION_KEY: "privateroom2024", // Dedicated key for room IDs
  ROOM_PREFIX: "private-",
  ENCRYPTED_PREFIX: "prv-enc-"
};

/**
 * Encrypt a room code using XOR encryption
 * @param {string} code - The room code to encrypt
 * @param {string} secretKey - Optional secret key
 * @returns {string} - Encrypted room code with prefix
 */
export function encryptRoomCode(code, secretKey = PRIVATE_ROOM_CONFIG.ENCRYPTION_KEY) {
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
  
  return "enc-" + encrypted;
}

/**
 * Decrypt a room code using XOR encryption
 * @param {string} encrypted - The encrypted room code
 * @param {string} secretKey - Optional secret key
 * @returns {string} - Decrypted room code
 */
function decryptRoomCode(encrypted, secretKey = PRIVATE_ROOM_CONFIG.ENCRYPTION_KEY) {
  if (!encrypted || !encrypted.startsWith("enc-")) return "";
  
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
 * Encrypt a private room code for blockchain storage
 * @param {string} roomCode - The 10-digit room code
 * @returns {string} - Encrypted room ID for blockchain
 */
export function encryptPrivateRoomId(roomCode) {
  if (!roomCode || !/^\d{10}$/.test(roomCode)) {
    throw new Error('Invalid room code format');
  }
  
  // Encrypt the room code
  const encrypted = encryptRoomCode(roomCode, PRIVATE_ROOM_CONFIG.ENCRYPTION_KEY);
  
  // Return with special prefix for blockchain
  return PRIVATE_ROOM_CONFIG.ENCRYPTED_PREFIX + encrypted.substring(4); // Remove "enc-" prefix
}

/**
 * Decrypt a private room ID from blockchain
 * @param {string} encryptedRoomId - Encrypted room ID from blockchain
 * @returns {string} - Decrypted 10-digit room code
 */
export function decryptPrivateRoomId(encryptedRoomId) {
  if (!encryptedRoomId || !encryptedRoomId.startsWith(PRIVATE_ROOM_CONFIG.ENCRYPTED_PREFIX)) {
    return null;
  }
  
  // Extract encrypted part and add back "enc-" prefix for decryption
  const encryptedPart = "enc-" + encryptedRoomId.substring(PRIVATE_ROOM_CONFIG.ENCRYPTED_PREFIX.length);
  
  // Decrypt using room encryption key
  const decrypted = decryptRoomCode(encryptedPart, PRIVATE_ROOM_CONFIG.ENCRYPTION_KEY);
  
  // Validate result is 10-digit code
  if (!/^\d{10}$/.test(decrypted)) {
    return null;
  }
  
  return decrypted;
}

/**
 * Check if a room ID is an encrypted private room
 * @param {string} roomId - Room ID to check
 * @returns {boolean} - True if encrypted private room
 */
export function isEncryptedPrivateRoom(roomId) {
  return roomId && roomId.startsWith(PRIVATE_ROOM_CONFIG.ENCRYPTED_PREFIX);
}

/**
 * Get the display room ID (for UI) from any room format
 * @param {string} roomId - Room ID (encrypted or plain)
 * @returns {string} - Display-friendly room ID
 */
export function getDisplayRoomId(roomId) {
  if (isEncryptedPrivateRoom(roomId)) {
    const decryptedCode = decryptPrivateRoomId(roomId);
    return decryptedCode ? `private-${decryptedCode}` : roomId;
  }
  return roomId;
}

/**
 * Get the blockchain room ID (encrypted) from display room ID
 * @param {string} displayRoomId - Display room ID (private-1234567890)
 * @returns {string} - Blockchain room ID (encrypted if private)
 */
export function getBlockchainRoomId(displayRoomId) {
  if (displayRoomId.startsWith(PRIVATE_ROOM_CONFIG.ROOM_PREFIX)) {
    const roomCode = displayRoomId.replace(PRIVATE_ROOM_CONFIG.ROOM_PREFIX, '');
    if (/^\d{10}$/.test(roomCode)) {
      return encryptPrivateRoomId(roomCode);
    }
  }
  return displayRoomId;
}

/**
 * Enhanced room creation with encryption
 * @param {string} roomName - Room name
 * @param {string} roomCode - 10-digit room code (optional)
 * @returns {Object} - Room object with both display and blockchain IDs
 */
export function createEncryptedPrivateRoom(roomName, roomCode = null) {
  if (!roomName || !roomName.trim()) {
    throw new Error('Room name is required');
  }
  
  // Generate random 10-digit code if not provided
  if (!roomCode) {
    roomCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  } else {
    // Validate provided code
    if (!/^\d{10}$/.test(roomCode)) {
      throw new Error('Room code must be exactly 10 digits');
    }
  }
  
  const displayRoomId = `${PRIVATE_ROOM_CONFIG.ROOM_PREFIX}${roomCode}`;
  const blockchainRoomId = encryptPrivateRoomId(roomCode);
  
  return {
    // For UI display and local storage
    displayId: displayRoomId,
    // For blockchain transactions
    blockchainId: blockchainRoomId,
    // User-friendly data
    name: roomName.trim(),
    code: roomCode,
    description: `Private room (Code: ${roomCode})`,
    isPrivate: true,
    isEncrypted: true,
    createdAt: Date.now()
  };
}

/**
 * Enhanced room joining with encryption
 * @param {string} roomCode - 10-digit room code to join
 * @returns {Object} - Room object for joining
 */
export function joinEncryptedPrivateRoom(roomCode) {
  if (!roomCode || !/^\d{10}$/.test(roomCode)) {
    throw new Error('Please enter a valid 10-digit room code');
  }
  
  const displayRoomId = `${PRIVATE_ROOM_CONFIG.ROOM_PREFIX}${roomCode}`;
  const blockchainRoomId = encryptPrivateRoomId(roomCode);
  
  return {
    displayId: displayRoomId,
    blockchainId: blockchainRoomId,
    name: `Private Room ${roomCode}`,
    code: roomCode,
    description: 'Private room',
    isPrivate: true,
    isEncrypted: true,
    joinedAt: Date.now()
  };
}

/**
 * Process discovered rooms to handle encrypted private rooms
 * @param {Array} discoveredRooms - Raw discovered rooms from blockchain
 * @returns {Array} - Processed rooms with decrypted private rooms
 */
export function processDiscoveredPrivateRooms(discoveredRooms) {
  return discoveredRooms.map(room => {
    if (isEncryptedPrivateRoom(room.id)) {
      const decryptedCode = decryptPrivateRoomId(room.id);
      
      if (decryptedCode) {
        return {
          ...room,
          id: `${PRIVATE_ROOM_CONFIG.ROOM_PREFIX}${decryptedCode}`, // Display ID
          blockchainId: room.id, // Keep original encrypted ID
          name: `Private Room ${decryptedCode}`,
          code: decryptedCode,
          description: `Private room (Code: ${decryptedCode})`,
          isPrivate: true,
          isEncrypted: true,
          isDiscovered: true
        };
      }
    }
    
    return room;
  });
}

/**
 * Enhanced message sending that handles room ID encryption
 * @param {string} displayRoomId - Display room ID from UI
 * @param {string} messageContent - Message content
 * @param {Object} walletOrQueue - Wallet or transaction queue
 * @returns {string} - Blockchain room ID to use in transaction
 */
export function prepareMessageForPrivateRoom(displayRoomId, messageContent, walletOrQueue) {
  // Get the blockchain room ID (encrypted for private rooms)
  const blockchainRoomId = getBlockchainRoomId(displayRoomId);
  
  console.log('Room ID transformation:', {
    display: displayRoomId,
    blockchain: blockchainRoomId,
    isPrivate: displayRoomId.startsWith(PRIVATE_ROOM_CONFIG.ROOM_PREFIX),
    isEncrypted: isEncryptedPrivateRoom(blockchainRoomId)
  });
  
  return blockchainRoomId;
}

/**
 * Enhanced message parsing that handles encrypted room IDs
 * @param {Object} message - Parsed message from blockchain
 * @returns {Object} - Message with display-friendly room ID
 */
export function processMessageFromPrivateRoom(message) {
  if (!message || !message.chatroomId) {
    return message;
  }
  
  const displayRoomId = getDisplayRoomId(message.chatroomId);
  
  return {
    ...message,
    chatroomId: displayRoomId, // Use display ID in UI
    blockchainRoomId: message.chatroomId, // Keep original for reference
    isFromEncryptedRoom: isEncryptedPrivateRoom(message.chatroomId)
  };
}

/**
 * Get room invitation data
 * @param {string} roomCode - 10-digit room code
 * @param {string} roomName - Room name
 * @returns {Object} - Invitation data for sharing
 */
export function createRoomInvitation(roomCode, roomName) {
  if (!roomCode || !/^\d{10}$/.test(roomCode)) {
    throw new Error('Invalid room code');
  }
  
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  
  return {
    code: roomCode,
    name: roomName,
    url: inviteUrl,
    shareText: `🏠 Join "${roomName}" on Pulse!\n\nRoom Code: ${roomCode}\nDirect Link: ${inviteUrl}`,
    qrData: inviteUrl // For QR code generation
  };
}

/**
 * Validate room code format
 * @param {string} code - Room code to validate
 * @returns {Object} - Validation result
 */
export function validateRoomCode(code) {
  if (!code) {
    return { valid: false, error: 'Room code is required' };
  }
  
  if (typeof code !== 'string') {
    return { valid: false, error: 'Room code must be a string' };
  }
  
  if (code.length !== 10) {
    return { valid: false, error: 'Room code must be exactly 10 digits' };
  }
  
  if (!/^\d+$/.test(code)) {
    return { valid: false, error: 'Room code must contain only numbers' };
  }
  
  return { valid: true };
}

/**
 * Enhanced room filtering for UI
 * @param {Array} allRooms - All rooms
 * @param {string} selectedRoomId - Currently selected room ID (display format)
 * @returns {Array} - Messages filtered for the selected room
 */
export function filterMessagesForRoom(messages, selectedRoomId) {
  if (!selectedRoomId || selectedRoomId === 'general') {
    return messages.filter(msg => msg.chatroomId === 'general');
  }
  
  // Handle both display and blockchain room IDs
  const blockchainRoomId = getBlockchainRoomId(selectedRoomId);
  
  return messages.filter(msg => {
    // Check both display and blockchain room IDs
    return msg.chatroomId === selectedRoomId || 
           msg.chatroomId === blockchainRoomId ||
           msg.blockchainRoomId === blockchainRoomId;
  });
}

// Export all functions
export default {
  encryptPrivateRoomId,
  decryptPrivateRoomId,
  isEncryptedPrivateRoom,
  getDisplayRoomId,
  getBlockchainRoomId,
  createEncryptedPrivateRoom,
  joinEncryptedPrivateRoom,
  processDiscoveredPrivateRooms,
  prepareMessageForPrivateRoom,
  processMessageFromPrivateRoom,
  createRoomInvitation,
  validateRoomCode,
  filterMessagesForRoom,
  
  // Export the helper functions too
  encryptRoomCode,
  decryptRoomCode,
  
  // Configuration
  PRIVATE_ROOM_CONFIG
};