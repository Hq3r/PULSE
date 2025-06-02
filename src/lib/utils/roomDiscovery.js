// roomDiscovery.js - Updated with encrypted private room support
import {
  DEMO_CHAT_CONTRACT,
  API_BASE,
  DEFAULT_CHATROOMS
} from './chatConstants.js';
import { parseBoxToMessage } from './chatUtils.js';
import { 
  decryptPrivateRoomId, 
  isEncryptedPrivateRoom,
  PRIVATE_ROOM_CONFIG 
} from './privateRoomEncryption.js';

/**
 * Enhanced function to extract register value with better error handling
 * @param {*} register - Register data
 * @returns {string} - Extracted value
 */
function extractRegisterValue(register) {
  if (!register) return '';
  
  try {
    // Handle different register formats
    let value = register.renderedValue || register.serializedValue || register.value || String(register);
    
    console.log('Raw register value:', value);
    
    // Handle pure hex strings (no 0e prefix) - this is what we're getting
    if (typeof value === 'string' && /^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0) {
      // Convert hex directly to string
      const bytes = [];
      for (let i = 0; i < value.length; i += 2) {
        const byte = parseInt(value.substring(i, i + 2), 16);
        if (byte > 0) { // Skip null bytes
          bytes.push(byte);
        }
      }
      const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
      console.log('Decoded hex register value:', decoded);
      return decoded.trim();
    }
    
    // Handle Ergo hex encoding (0e prefix)
    if (typeof value === 'string' && value.startsWith('0e')) {
      // Remove '0e' prefix and length bytes
      let hexStr = value.substring(2);
      
      // Remove length prefix (first 2 characters usually indicate length)
      if (hexStr.length > 2) {
        hexStr = hexStr.substring(2);
      }
      
      // Convert hex to string
      if (/^[0-9A-Fa-f]+$/.test(hexStr) && hexStr.length % 2 === 0) {
        const bytes = [];
        for (let i = 0; i < hexStr.length; i += 2) {
          const byte = parseInt(hexStr.substring(i, i + 2), 16);
          if (byte > 0) { // Skip null bytes
            bytes.push(byte);
          }
        }
        const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        console.log('Decoded 0e register value:', decoded);
        return decoded.trim();
      }
    }
    
    // Return as string if not hex encoded
    return String(value).trim();
  } catch (error) {
    console.warn('Error extracting register value:', error);
    return '';
  }
}

/**
 * Parse a box specifically for room discovery with encryption support
 * @param {Object} box - The blockchain box object
 * @returns {Object|null} - Extracted room info or null
 */
function parseBoxForRoomDiscovery(box) {
  try {
    console.log('Parsing box for room discovery:', box.boxId);
    
    if (!box || !box.additionalRegisters) {
      console.log('Box missing additionalRegisters');
      return null;
    }

    const registers = box.additionalRegisters;
    console.log('Available registers:', Object.keys(registers));
    
    // R7 contains the chatroom ID (might be encrypted)
    if (!registers.R7) {
      console.log('Missing R7 register (chatroom ID)');
      return null;
    }
    
    let chatroomId = extractRegisterValue(registers.R7);
    if (!chatroomId) {
      console.log('Empty chatroom ID from R7');
      return null;
    }
    
    console.log('Found raw chatroom ID:', chatroomId);
    
    // Check if this is an encrypted private room ID
    let isEncrypted = false;
    let decryptedCode = null;
    
    if (isEncryptedPrivateRoom(chatroomId)) {
      console.log('Detected encrypted private room ID:', chatroomId);
      decryptedCode = decryptPrivateRoomId(chatroomId);
      
      if (decryptedCode) {
        console.log('Successfully decrypted room code:', decryptedCode);
        isEncrypted = true;
        // Convert to display format for consistency
        chatroomId = `${PRIVATE_ROOM_CONFIG.ROOM_PREFIX}${decryptedCode}`;
      } else {
        console.warn('Failed to decrypt private room ID:', chatroomId);
        // Keep the encrypted ID but mark it as undecryptable
        isEncrypted = true;
      }
    }
    
    console.log('Final processed chatroom ID:', chatroomId);
    
    // Optional: Extract other data for context
    const sender = registers.R4 ? extractRegisterValue(registers.R4) : '';
    const content = registers.R5 ? extractRegisterValue(registers.R5) : '';
    const timestamp = registers.R6 ? parseInt(extractRegisterValue(registers.R6)) : 0;
    
    return {
      chatroomId,
      sender,
      content,
      timestamp,
      boxId: box.boxId,
      isEncrypted,
      decryptedCode,
      originalRoomId: isEncrypted ? extractRegisterValue(registers.R7) : chatroomId
    };
    
  } catch (error) {
    console.error('Error parsing box for room discovery:', error);
    return null;
  }
}

/**
 * Discover all available chatrooms from the blockchain with encryption support
 * @returns {Promise<Array>} - Array of discovered room objects
 */
export async function discoverChatrooms() {
  try {
    console.log('🔍 Discovering chatrooms from blockchain with encryption support...');
    console.log('Using chat contract:', DEMO_CHAT_CONTRACT);
    console.log('API endpoint:', `${API_BASE}/boxes/unspent/byAddress/${DEMO_CHAT_CONTRACT}`);
    
    // Fetch all unspent boxes from the chat contract
    const response = await fetch(`${API_BASE}/boxes/unspent/byAddress/${DEMO_CHAT_CONTRACT}?limit=500`);
    
    if (!response.ok) {
      console.warn('Failed to fetch boxes for room discovery:', response.status, response.statusText);
      
      // Try the alternative endpoint (spent + unspent)
      console.log('Trying alternative endpoint...');
      const altResponse = await fetch(`${API_BASE}/boxes/byAddress/${DEMO_CHAT_CONTRACT}?limit=500`);
      
      if (!altResponse.ok) {
        console.error('Both endpoints failed, returning default rooms');
        return [];
      }
      
      const altData = await altResponse.json();
      console.log('Alternative endpoint returned:', altData.items?.length || 0, 'boxes');
      return processBoxesForRoomDiscovery(altData.items || []);
    }

    const data = await response.json();
    console.log('API Response structure:', {
      hasItems: !!data.items,
      itemCount: data.items?.length || 0,
      sampleItem: data.items?.[0] ? {
        boxId: data.items[0].boxId,
        hasAdditionalRegisters: !!data.items[0].additionalRegisters,
        registerKeys: data.items[0].additionalRegisters ? Object.keys(data.items[0].additionalRegisters) : []
      } : null
    });
    
    const boxes = data.items || [];
    return processBoxesForRoomDiscovery(boxes);
    
  } catch (error) {
    console.error('Error discovering chatrooms:', error);
    return [];
  }
}

/**
 * Process boxes to extract room information with encryption support
 * @param {Array} boxes - Array of blockchain boxes
 * @returns {Array} - Array of discovered room objects
 */
function processBoxesForRoomDiscovery(boxes) {
  console.log(`📦 Processing ${boxes.length} boxes for room discovery with encryption support...`);

  // Extract unique room IDs and sample data
  const discoveredRoomData = new Map(); // roomId -> { count, latestBox, sampleMessage }
  const encryptedRoomStats = {
    total: 0,
    decrypted: 0,
    failed: 0
  };
  
  for (const box of boxes) {
    try {
      const roomInfo = parseBoxForRoomDiscovery(box);
      
      if (roomInfo && roomInfo.chatroomId) {
        const roomId = roomInfo.chatroomId;
        
        // Track encryption statistics
        if (roomInfo.isEncrypted) {
          encryptedRoomStats.total++;
          if (roomInfo.decryptedCode) {
            encryptedRoomStats.decrypted++;
          } else {
            encryptedRoomStats.failed++;
          }
        }
        
        if (!discoveredRoomData.has(roomId)) {
          discoveredRoomData.set(roomId, {
            roomId,
            count: 1,
            latestBox: box,
            sampleMessage: roomInfo,
            firstSeen: roomInfo.timestamp,
            isEncrypted: roomInfo.isEncrypted,
            decryptedCode: roomInfo.decryptedCode,
            originalRoomId: roomInfo.originalRoomId
          });
        } else {
          const existing = discoveredRoomData.get(roomId);
          existing.count++;
          
          // Keep the latest message as sample
          if (roomInfo.timestamp > existing.sampleMessage.timestamp) {
            existing.latestBox = box;
            existing.sampleMessage = roomInfo;
          }
        }
      }
    } catch (error) {
      console.warn('Error processing box for room discovery:', box.boxId, error);
      continue;
    }
  }

  console.log('Discovered room data:', Array.from(discoveredRoomData.keys()));
  console.log('Encryption statistics:', encryptedRoomStats);

  // Convert to room objects
  const discoveredRooms = [];
  
  for (const [roomId, roomData] of discoveredRoomData) {
    try {
      // Skip if it's already a default room
      if (DEFAULT_CHATROOMS.some(room => room.id === roomId)) {
        console.log(`Skipping default room: ${roomId}`);
        continue;
      }

      // Create room object with encryption support
      const room = createRoomFromId(roomId, roomData.sampleMessage, roomData.count, roomData);
      if (room) {
        console.log(`✅ Created room object for: ${roomId}`, room);
        discoveredRooms.push(room);
      }
    } catch (error) {
      console.warn(`Error creating room object for ${roomId}:`, error);
    }
  }

  console.log(`✅ Discovered ${discoveredRooms.length} new rooms:`, 
    discoveredRooms.map(r => `${r.name} (${r.id}) ${r.isEncrypted ? '[ENCRYPTED]' : ''}`));
  
  return discoveredRooms;
}

/**
 * Create a room object from a room ID with enhanced data and encryption support
 * @param {string} roomId - The room identifier (display format)
 * @param {Object} sampleMessage - Sample message from the room (optional)
 * @param {number} messageCount - Number of messages in the room
 * @param {Object} roomData - Additional room data from discovery
 * @returns {Object|null} - Room object or null if invalid
 */
function createRoomFromId(roomId, sampleMessage = null, messageCount = 0, roomData = null) {
  if (!roomId || typeof roomId !== 'string') {
    return null;
  }

  console.log(`Creating room object for: ${roomId}`);

  // Handle encrypted private rooms (format: private-1234567890)
  if (roomId.startsWith(PRIVATE_ROOM_CONFIG.ROOM_PREFIX)) {
    const code = roomId.replace(PRIVATE_ROOM_CONFIG.ROOM_PREFIX, '');
    if (code.length === 10 && /^\d+$/.test(code)) {
      return {
        id: roomId, // Display ID (private-1234567890)
        blockchainId: roomData?.originalRoomId || roomId, // Encrypted blockchain ID
        name: `Private Room ${code}`,
        description: `Private chat room (${messageCount} messages)`,
        isPrivate: true,
        isDiscovered: true,
        isEncrypted: roomData?.isEncrypted || false,
        code: code,
        messageCount: messageCount
      };
    }
  }

  // Handle undecryptable encrypted rooms
  if (roomData?.isEncrypted && !roomData?.decryptedCode) {
    return {
      id: roomId,
      blockchainId: roomData.originalRoomId || roomId,
      name: `🔒 Encrypted Room`,
      description: `Encrypted private room (${messageCount} messages) - Unable to decrypt`,
      isPrivate: true,
      isDiscovered: true,
      isEncrypted: true,
      isUndecryptable: true,
      messageCount: messageCount
    };
  }

  // Handle custom public rooms
  const roomName = formatRoomName(roomId);
  const description = generateRoomDescription(roomId, sampleMessage, messageCount);

  return {
    id: roomId,
    blockchainId: roomData?.originalRoomId || roomId,
    name: roomName,
    description: description,
    isPrivate: false,
    isDiscovered: true,
    isEncrypted: roomData?.isEncrypted || false,
    messageCount: messageCount
  };
}

/**
 * Format room ID into a human-readable name
 * @param {string} roomId - The room identifier
 * @returns {string} - Formatted room name
 */
function formatRoomName(roomId) {
  if (!roomId) return 'Unknown Room';

  // Handle special formatting patterns
  if (roomId.includes('-')) {
    // Convert kebab-case to title case: "custom-testing-room" -> "Custom Testing Room"
    return roomId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Handle camelCase: "testingRoom" -> "Testing Room"
  if (/[a-z][A-Z]/.test(roomId)) {
    return roomId
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, str => str.toUpperCase());
  }

  // Handle single words: "testing" -> "Testing"
  return roomId.charAt(0).toUpperCase() + roomId.slice(1);
}

/**
 * Generate a description for a discovered room
 * @param {string} roomId - The room identifier
 * @param {Object} sampleMessage - Sample message from the room (optional)
 * @param {number} messageCount - Number of messages in the room
 * @returns {string} - Room description
 */
function generateRoomDescription(roomId, sampleMessage = null, messageCount = 0) {
  let baseDescription = '';
  
  // Try to infer purpose from room name
  const lowerRoomId = roomId.toLowerCase();
  
  if (lowerRoomId.includes('test')) {
    baseDescription = 'Testing and development discussions';
  } else if (lowerRoomId.includes('trade') || lowerRoomId.includes('trading') || lowerRoomId.includes('market')) {
    baseDescription = 'Trading and market discussions';
  } else if (lowerRoomId.includes('dev') || lowerRoomId.includes('development')) {
    baseDescription = 'Development and technical discussions';
  } else if (lowerRoomId.includes('game') || lowerRoomId.includes('gaming')) {
    baseDescription = 'Gaming related discussions';
  } else if (lowerRoomId.includes('nft') || lowerRoomId.includes('art')) {
    baseDescription = 'NFT and art discussions';
  } else if (lowerRoomId.includes('defi') || lowerRoomId.includes('finance')) {
    baseDescription = 'DeFi and finance discussions';
  } else if (lowerRoomId.includes('custom')) {
    baseDescription = 'Custom community room';
  } else {
    baseDescription = 'Community discussion room';
  }
  
  // Add message count if available
  if (messageCount > 0) {
    baseDescription += ` (${messageCount} messages)`;
  }
  
  return baseDescription;
}

/**
 * Debug function to test room discovery with encryption support
 */
export async function debugRoomDiscovery() {
  console.log('🧪 Starting room discovery debug with encryption support...');
  
  try {
    // Test with the specific hex values you're seeing
    const hexRoomIds = [
      '74726164696e67', // should be "trading"
      '66616b7533',     // should be "faku3"
      '66616b7532',     // should be "faku2"
      '66616b7531',     // should be "faku1"
      '67656e6572616c', // should be "general"
      '74657374696e67', // should be "testing"
      '637573746f6d2d74657374696e672d7075626c69632d726f6f6d', // should be "custom-testing-public-room"
      'prv-enc-1a2b3c4d5e6f7890abcdef1234567890' // mock encrypted private room
    ];
    
    console.log('Testing hex to string conversion:');
    hexRoomIds.forEach(hex => {
      try {
        if (hex.startsWith('prv-enc-')) {
          console.log(`${hex} → [ENCRYPTED PRIVATE ROOM]`);
          
          // Test decryption (will fail with mock data, but shows the flow)
          const decrypted = decryptPrivateRoomId(hex);
          console.log(`Decryption result: ${decrypted || 'FAILED'}`);
        } else {
          const bytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            const byte = parseInt(hex.substring(i, i + 2), 16);
            if (byte > 0) bytes.push(byte);
          }
          const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
          console.log(`${hex} → "${decoded}"`);
          
          // Test room creation
          const room = createRoomFromId(decoded, null, 1);
          console.log(`Room object:`, room);
        }
      } catch (error) {
        console.error(`Failed to process ${hex}:`, error);
      }
    });
    
    // Test with mock encrypted private room data
    const testBoxes = [
      {
        boxId: 'test-trading',
        additionalRegisters: {
          R4: { renderedValue: '9hrYUM2MoBu8pFeV6Xvzxg4jLnQooUCWtLq2KwTU9N2VSjmhuZZ' },
          R5: { renderedValue: 'enc-03' },
          R6: { renderedValue: '1748832477' },
          R7: { renderedValue: '74726164696e67' }, // hex for "trading"
          R8: { renderedValue: '' }
        }
      },
      {
        boxId: 'test-private-encrypted',
        additionalRegisters: {
          R4: { renderedValue: '9hrYUM2MoBu8pFeV6Xvzxg4jLnQooUCWtLq2KwTU9N2VSjmhuZZ' },
          R5: { renderedValue: 'Private room message' },
          R6: { renderedValue: '1748829370' },
          R7: { renderedValue: 'prv-enc-1a2b3c4d5e6f7890abcdef1234567890' }, // mock encrypted room ID
          R8: { renderedValue: '' }
        }
      }
    ];
    
    console.log('\nTesting with sample boxes including encrypted rooms...');
    const discoveredRooms = processBoxesForRoomDiscovery(testBoxes);
    
    console.log('Debug results:');
    discoveredRooms.forEach(room => {
      console.log(`- ${room.name} (${room.id}): ${room.description} ${room.isEncrypted ? '[ENCRYPTED]' : ''}`);
      if (room.code) {
        console.log(`  Code: ${room.code}`);
      }
      if (room.blockchainId && room.blockchainId !== room.id) {
        console.log(`  Blockchain ID: ${room.blockchainId}`);
      }
    });
    
    return discoveredRooms;
    
  } catch (error) {
    console.error('Debug room discovery failed:', error);
    return [];
  }
}

/**
 * Test hex conversion specifically
 */
export function testHexConversion(hexString) {
  console.log(`Testing hex conversion for: ${hexString}`);
  
  try {
    // Check if it's an encrypted private room first
    if (isEncryptedPrivateRoom(hexString)) {
      console.log('Detected encrypted private room ID');
      const decrypted = decryptPrivateRoomId(hexString);
      console.log(`Decryption result: ${decrypted || 'FAILED'}`);
      return decrypted || hexString;
    }
    
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
      const byte = parseInt(hexString.substring(i, i + 2), 16);
      if (byte > 0) bytes.push(byte);
    }
    const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    console.log(`Result: "${decoded}"`);
    return decoded;
  } catch (error) {
    console.error('Conversion failed:', error);
    return hexString;
  }
}

/**
 * Get room statistics from discovered rooms with encryption info
 * @param {Array} allRooms - All available rooms
 * @returns {Object} - Statistics object
 */
export function getRoomStatistics(allRooms) {
  const stats = {
    total: allRooms.length,
    default: 0,
    custom: 0,
    private: 0,
    discovered: 0,
    encrypted: 0,
    undecryptable: 0
  };

  for (const room of allRooms) {
    if (DEFAULT_CHATROOMS.some(dr => dr.id === room.id)) {
      stats.default++;
    } else if (room.isPrivate) {
      stats.private++;
      if (room.isEncrypted) {
        stats.encrypted++;
      }
      if (room.isUndecryptable) {
        stats.undecryptable++;
      }
    } else if (room.isDiscovered) {
      stats.discovered++;
    } else {
      stats.custom++;
    }
  }

  return stats;
}

/**
 * Check if a room ID is valid for creation
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} - True if valid
 */
export function isValidRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return false;
  }

  // Check length (reasonable limits)
  if (roomId.length < 3 || roomId.length > 50) {
    return false;
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9\-_]+$/.test(roomId)) {
    return false;
  }

  // Check that it doesn't start or end with special characters
  if (/^[-_]|[-_]$/.test(roomId)) {
    return false;
  }

  return true;
}

/**
 * Search for rooms by name or description with encryption awareness
 * @param {Array} rooms - Array of room objects
 * @param {string} query - Search query
 * @returns {Array} - Filtered rooms
 */
export function searchRooms(rooms, query) {
  if (!query || !query.trim()) {
    return rooms;
  }

  const searchTerm = query.toLowerCase().trim();
  
  return rooms.filter(room => {
    const nameMatch = room.name.toLowerCase().includes(searchTerm);
    const descMatch = room.description?.toLowerCase().includes(searchTerm);
    const idMatch = room.id.toLowerCase().includes(searchTerm);
    
    // Also search by room code for private rooms
    const codeMatch = room.code?.includes(searchTerm);
    
    return nameMatch || descMatch || idMatch || codeMatch;
  });
}

/**
 * Sort rooms by activity level with encryption considerations
 * @param {Array} rooms - Array of room objects
 * @returns {Array} - Sorted rooms
 */
export function sortRoomsByActivity(rooms) {
  return [...rooms].sort((a, b) => {
    // Default rooms first
    const aIsDefault = DEFAULT_CHATROOMS.some(dr => dr.id === a.id);
    const bIsDefault = DEFAULT_CHATROOMS.some(dr => dr.id === b.id);
    
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    
    // Then accessible rooms before undecryptable ones
    if (a.isUndecryptable && !b.isUndecryptable) return 1;
    if (!a.isUndecryptable && b.isUndecryptable) return -1;
    
    // Then by message count (if available)
    if (a.messageCount && b.messageCount) {
      return b.messageCount - a.messageCount; // Higher activity first
    }
    
    // Finally by room name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Cache for discovered rooms (in-memory) with encryption support
 */
const roomCache = {
  rooms: [],
  lastUpdate: 0,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  encryptionStats: {
    total: 0,
    decrypted: 0,
    failed: 0
  }
};

/**
 * Get rooms with caching and encryption support
 * @param {boolean} forceRefresh - Force refresh of cache
 * @returns {Promise<Array>} - Cached or fresh room data
 */
export async function getCachedDiscoveredRooms(forceRefresh = false) {
  const now = Date.now();
  
  // Check if cache is valid
  if (!forceRefresh && 
      roomCache.rooms.length > 0 && 
      (now - roomCache.lastUpdate) < roomCache.cacheTimeout) {
    console.log('📦 Using cached room data (with encryption support)');
    return roomCache.rooms;
  }

  // Refresh cache
  console.log('🔄 Refreshing room cache with encryption support...');
  try {
    const discoveredRooms = await discoverChatrooms();
    roomCache.rooms = discoveredRooms;
    roomCache.lastUpdate = now;
    
    // Update encryption statistics
    roomCache.encryptionStats = {
      total: discoveredRooms.filter(r => r.isEncrypted).length,
      decrypted: discoveredRooms.filter(r => r.isEncrypted && r.code).length,
      failed: discoveredRooms.filter(r => r.isUndecryptable).length
    };
    
    console.log('🔐 Encryption statistics:', roomCache.encryptionStats);
    
    return discoveredRooms;
  } catch (error) {
    console.error('Error refreshing room cache:', error);
    // Return cached data even if refresh failed
    return roomCache.rooms;
  }
}

/**
 * Clear room cache
 */
export function clearRoomCache() {
  roomCache.rooms = [];
  roomCache.lastUpdate = 0;
  roomCache.encryptionStats = { total: 0, decrypted: 0, failed: 0 };
}

/**
 * Get encryption statistics from cache
 * @returns {Object} - Encryption statistics
 */
export function getEncryptionStatistics() {
  return { ...roomCache.encryptionStats };
}

// Expose debug function in development
if (typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname.includes('dev'))) {
  window.debugRoomDiscovery = debugRoomDiscovery;
  window.testHexConversion = testHexConversion;
  window.getEncryptionStatistics = getEncryptionStatistics;
  console.log('🔧 Room discovery debug available:');
  console.log('- window.debugRoomDiscovery() - Full room discovery test');
  console.log('- window.testHexConversion("74726164696e67") - Test hex conversion');
  console.log('- window.getEncryptionStatistics() - Get encryption stats');
}

export default {
  discoverChatrooms,
  createRoomFromId,
  formatRoomName,
  generateRoomDescription,
  getRoomStatistics,
  isValidRoomId,
  searchRooms,
  sortRoomsByActivity,
  getCachedDiscoveredRooms,
  clearRoomCache,
  debugRoomDiscovery,
  getEncryptionStatistics
};