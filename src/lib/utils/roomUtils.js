// roomUtils.js - Fixed version without require() error
import { DEFAULT_CHATROOMS } from './chatConstants.js';
import { 
  discoverChatrooms, 
  getCachedDiscoveredRooms,
  clearRoomCache,
  getRoomStatistics,
  searchRooms,
  sortRoomsByActivity 
} from './roomDiscovery.js';

// Import the new encryption functions
import {
  createEncryptedPrivateRoom,
  joinEncryptedPrivateRoom,
  processDiscoveredPrivateRooms,
  createRoomInvitation,
  validateRoomCode,
  getDisplayRoomId,
  getBlockchainRoomId,
  isEncryptedPrivateRoom
} from './privateRoomEncryption.js';

/**
 * Create initial room state with encryption support
 */
export function createRoomState() {
  return {
    showRoomModal: false,
    modalMode: 'list', // 'list', 'create', 'join', 'private', 'manage', 'info'
    newRoomName: '',
    newRoomDescription: '',
    privateRoomCode: '',
    joinPrivateRoomCode: '',
    currentModalRoom: null,
    showHiddenRooms: false,
    discoveredRooms: [], // Discovered rooms from blockchain
    lastDiscoveryUpdate: 0,
    isDiscovering: false,
    // New encryption-related state
    showInviteModal: false,
    currentInvitation: null
  };
}

/**
 * Get all rooms including discovered ones with encryption processing
 * @param {Array} discoveredRooms - Discovered rooms from blockchain
 * @returns {Array} - Combined array of all rooms
 */
export function getAllRooms(discoveredRooms = []) {
  const allRooms = [...DEFAULT_CHATROOMS];
  
  // Process discovered rooms to handle encrypted private rooms
  const processedDiscovered = processDiscoveredPrivateRooms(discoveredRooms);
  
  // Add discovered rooms that aren't already in defaults
  for (const discoveredRoom of processedDiscovered) {
    if (!allRooms.some(room => room.id === discoveredRoom.id)) {
      allRooms.push(discoveredRoom);
    }
  }
  
  return sortRoomsByActivity(allRooms);
}

/**
 * Update discovered rooms with encryption processing
 * @param {Object} roomState - Current room state
 * @param {boolean} forceRefresh - Force refresh
 * @returns {Object} - Updated room state
 */
export async function updateDiscoveredRooms(roomState, forceRefresh = false) {
  if (roomState.isDiscovering && !forceRefresh) {
    console.log('Room discovery already in progress...');
    return roomState;
  }

  try {
    console.log('🔍 Starting room discovery with encryption support...');
    const updatedState = { ...roomState, isDiscovering: true };
    
    const { getCachedDiscoveredRooms } = await import('$lib/utils/roomDiscovery.js');
    const rawDiscoveredRooms = await getCachedDiscoveredRooms(forceRefresh);
    
    // Process discovered rooms to handle encrypted private rooms
    const discoveredRooms = processDiscoveredPrivateRooms(rawDiscoveredRooms);
    
    console.log(`✅ Processed ${discoveredRooms.length} discovered rooms (${rawDiscoveredRooms.length} raw)`);
    
    return {
      ...updatedState,
      discoveredRooms,
      lastDiscoveryUpdate: Date.now(),
      isDiscovering: false
    };
  } catch (error) {
    console.error('Error updating discovered rooms:', error);
    return {
      ...roomState,
      isDiscovering: false
    };
  }
}

/**
 * Enhanced private room creation with encryption
 * @param {Object} roomState - Current room state
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object with newRoom and updatedRooms
 */
export function addPrivateRoom(roomState, allRooms) {
  const roomName = roomState.newRoomName.trim();
  let roomCode = roomState.privateRoomCode.trim();
  
  if (!roomName) {
    throw new Error('Room name is required');
  }
  
  // Validate room code if provided
  if (roomCode) {
    const validation = validateRoomCode(roomCode);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }
  
  // Create encrypted private room
  const encryptedRoom = createEncryptedPrivateRoom(roomName, roomCode);
  
  // Check if room already exists (by display ID)
  if (allRooms.some(room => room.id === encryptedRoom.displayId)) {
    throw new Error('A room with this code already exists');
  }
  
  // Convert to UI room format
  const newRoom = {
    id: encryptedRoom.displayId, // Use display ID for UI
    blockchainId: encryptedRoom.blockchainId, // Store blockchain ID for transactions
    name: encryptedRoom.name,
    description: encryptedRoom.description,
    isPrivate: true,
    isEncrypted: true,
    code: encryptedRoom.code
  };
  
  console.log('Created encrypted private room:', {
    display: newRoom.id,
    blockchain: newRoom.blockchainId,
    code: newRoom.code
  });
  
  return {
    newRoom,
    updatedRooms: [...allRooms, newRoom],
    invitation: createRoomInvitation(encryptedRoom.code, encryptedRoom.name)
  };
}

/**
 * Enhanced private room joining with encryption
 * @param {string} roomCode - 10-digit room code
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object with newRoom, existingRoom, and updatedRooms
 */
export function joinPrivateRoom(roomCode, allRooms) {
  const validation = validateRoomCode(roomCode);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Create encrypted room data
  const encryptedRoom = joinEncryptedPrivateRoom(roomCode);
  
  // Check if already joined (by display ID)
  const existingRoom = allRooms.find(room => room.id === encryptedRoom.displayId);
  if (existingRoom) {
    return {
      newRoom: null,
      existingRoom,
      updatedRooms: allRooms
    };
  }
  
  // Convert to UI room format
  const newRoom = {
    id: encryptedRoom.displayId, // Use display ID for UI
    blockchainId: encryptedRoom.blockchainId, // Store blockchain ID for transactions
    name: encryptedRoom.name,
    description: encryptedRoom.description,
    isPrivate: true,
    isEncrypted: true,
    code: encryptedRoom.code
  };
  
  console.log('Joined encrypted private room:', {
    display: newRoom.id,
    blockchain: newRoom.blockchainId,
    code: newRoom.code
  });
  
  return {
    newRoom,
    existingRoom: null,
    updatedRooms: [...allRooms, newRoom]
  };
}

/**
 * Enhanced room code copying with better UX
 * @param {string} roomId - Room ID (display format)
 * @param {Object} room - Room object (optional, for better UX)
 * @returns {Promise<boolean>} - Success status
 */
export async function copyRoomCode(roomId, room = null) {
  try {
    let code = null;
    
    if (roomId.startsWith('private-')) {
      code = roomId.replace('private-', '');
    } else if (room && room.code) {
      code = room.code;
    }
    
    if (!code) {
      throw new Error('No room code available to copy');
    }
    
    await navigator.clipboard.writeText(code);
    console.log('Room code copied to clipboard:', code);
    return true;
  } catch (error) {
    console.error('Failed to copy room code:', error);
    return false;
  }
}

/**
 * Enhanced room invitation creation
 * @param {Object} room - Room object
 * @returns {Object} - Invitation data
 */
export function createRoomInvitationData(room) {
  if (!room.isPrivate || !room.code) {
    throw new Error('Only private rooms can have invitations');
  }
  
  return createRoomInvitation(room.code, room.name);
}

/**
 * Enhanced room sharing with invitation data
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room name
 * @param {Object} room - Full room object
 */
export async function shareRoom(roomId, roomName, room = null) {
  try {
    if (room && room.isPrivate && room.code) {
      // Handle private room sharing with invitation
      const invitation = createRoomInvitation(room.code, roomName);
      
      if (navigator.share) {
        await navigator.share({
          title: `Join "${roomName}" on Pulse`,
          text: invitation.shareText,
          url: invitation.url
        });
      } else {
        await navigator.clipboard.writeText(invitation.shareText);
        console.log('Private room invitation copied to clipboard');
      }
    } else {
      // Handle public room sharing
      const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
      const text = `Join the "${roomName}" room on Pulse: ${url}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `Join ${roomName} on Pulse`,
          text: room?.description || 'Community discussion room',
          url: url
        });
      } else {
        await navigator.clipboard.writeText(text);
        console.log('Room share text copied to clipboard');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to share room:', error);
    return false;
  }
}

/**
 * Get the blockchain room ID for transaction purposes - FIXED VERSION
 * @param {string} displayRoomId - Display room ID from UI
 * @param {Array} allRooms - All rooms array
 * @returns {string} - Blockchain room ID
 */
export function getBlockchainRoomIdFromDisplay(displayRoomId, allRooms) {
  // Find the room in our local rooms array first
  const room = allRooms.find(r => r.id === displayRoomId);
  
  if (room && room.blockchainId) {
    // Return the blockchain ID if available
    return room.blockchainId;
  }
  
  // Use the imported function directly (no require needed)
  return getBlockchainRoomId(displayRoomId);
}

/**
 * Enhanced message filtering for encrypted rooms
 * @param {Array} messages - All messages
 * @param {string} selectedRoomId - Selected room ID (display format)
 * @param {Array} allRooms - All rooms for context
 * @returns {Array} - Filtered messages
 */
export function filterMessagesForSelectedRoom(messages, selectedRoomId, allRooms) {
  if (!selectedRoomId || selectedRoomId === 'general') {
    return messages.filter(msg => msg.chatroomId === 'general');
  }
  
  // Get the blockchain room ID for this display room ID
  const blockchainRoomId = getBlockchainRoomIdFromDisplay(selectedRoomId, allRooms);
  
  return messages.filter(msg => {
    // Check against both display and blockchain room IDs
    return msg.chatroomId === selectedRoomId || 
           msg.chatroomId === blockchainRoomId ||
           (msg.blockchainRoomId && msg.blockchainRoomId === blockchainRoomId);
  });
}

/**
 * Enhanced room statistics with encryption info
 * @param {Array} allRooms - All rooms
 * @param {Array} hiddenRooms - Hidden rooms
 * @returns {Object} - Statistics object
 */
export function getRoomStats(allRooms, hiddenRooms) {
  const stats = getRoomStatistics(allRooms);
  
  // Add encryption statistics
  const encryptedRooms = allRooms.filter(room => room.isEncrypted || isEncryptedPrivateRoom(room.id));
  
  return {
    ...stats,
    visible: allRooms.length - hiddenRooms.length,
    hidden: hiddenRooms.length,
    encrypted: encryptedRooms.length
  };
}

/**
 * Show invitation modal
 * @param {Object} roomState - Current room state
 * @param {Object} invitation - Invitation data
 * @returns {Object} - Updated room state
 */
export function showInvitationModal(roomState, invitation) {
  return {
    ...roomState,
    showInviteModal: true,
    currentInvitation: invitation
  };
}

/**
 * Hide invitation modal
 * @param {Object} roomState - Current room state
 * @returns {Object} - Updated room state
 */
export function hideInvitationModal(roomState) {
  return {
    ...roomState,
    showInviteModal: false,
    currentInvitation: null
  };
}

// Keep all existing functions that don't need changes
export function getVisibleRooms(allRooms, hiddenRooms = [], showHiddenRooms = false) {
  if (showHiddenRooms) {
    return allRooms;
  }
  
  return allRooms.filter(room => !hiddenRooms.includes(room.id));
}

export function getRoomCategories(visibleRooms) {
  const categories = [];
  
  // Default rooms
  const defaultRooms = visibleRooms.filter(room => 
    DEFAULT_CHATROOMS.some(dr => dr.id === room.id)
  );
  if (defaultRooms.length > 0) {
    categories.push({
      name: 'Default Rooms',
      rooms: defaultRooms
    });
  }
  
  // Discovered public rooms
  const discoveredRooms = visibleRooms.filter(room => 
    room.isDiscovered && !room.isPrivate && 
    !DEFAULT_CHATROOMS.some(dr => dr.id === room.id)
  );
  if (discoveredRooms.length > 0) {
    categories.push({
      name: 'Discovered Rooms',
      rooms: discoveredRooms
    });
  }
  
  // Custom rooms (created locally but not discovered)
  const customRooms = visibleRooms.filter(room => 
    !room.isDiscovered && !room.isPrivate && 
    !DEFAULT_CHATROOMS.some(dr => dr.id === room.id)
  );
  if (customRooms.length > 0) {
    categories.push({
      name: 'Custom Rooms',
      rooms: customRooms
    });
  }
  
  // Private rooms (including encrypted ones)
  const privateRooms = visibleRooms.filter(room => room.isPrivate);
  if (privateRooms.length > 0) {
    categories.push({
      name: 'Private Rooms',
      rooms: privateRooms
    });
  }
  
  return categories;
}

export function addCustomRoom(roomState, allRooms) {
  const roomName = roomState.newRoomName.trim();
  const roomDescription = roomState.newRoomDescription.trim();
  
  if (!roomName) {
    throw new Error('Room name is required');
  }
  
  // Create room ID from name (kebab-case)
  const roomId = roomName.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Check if room already exists
  if (allRooms.some(room => room.id === roomId)) {
    throw new Error('A room with this name already exists');
  }
  
  const newRoom = {
    id: roomId,
    name: roomName,
    description: roomDescription || 'Custom public room',
    isPrivate: false,
    isDiscovered: false
  };
  
  return {
    newRoom,
    updatedRooms: [...allRooms, newRoom]
  };
}

export function removeRoom(roomId, allRooms, selectedChatroom, selectChatroom) {
  // Don't allow removing default rooms
  if (DEFAULT_CHATROOMS.some(room => room.id === roomId)) {
    throw new Error('Cannot remove default rooms');
  }
  
  // Don't allow removing discovered rooms (they exist on blockchain)
  const roomToRemove = allRooms.find(room => room.id === roomId);
  if (roomToRemove?.isDiscovered) {
    throw new Error('Cannot remove discovered rooms');
  }
  
  // If removing currently selected room, switch to general
  if (selectedChatroom === roomId) {
    selectChatroom('general');
  }
  
  return allRooms.filter(room => room.id !== roomId);
}

export function toggleRoomVisibility(roomId, hiddenRooms, selectedChatroom, selectChatroom) {
  // Don't allow hiding general room
  if (roomId === 'general') {
    throw new Error('Cannot hide the general room');
  }
  
  const isCurrentlyHidden = hiddenRooms.includes(roomId);
  
  if (isCurrentlyHidden) {
    // Show room
    return hiddenRooms.filter(id => id !== roomId);
  } else {
    // Hide room - if currently selected, switch to general
    if (selectedChatroom === roomId) {
      selectChatroom('general');
    }
    return [...hiddenRooms, roomId];
  }
}

export function renameRoom(roomId, allRooms) {
  // Don't allow renaming default or discovered rooms
  const room = allRooms.find(r => r.id === roomId);
  if (!room) {
    throw new Error('Room not found');
  }
  
  if (DEFAULT_CHATROOMS.some(r => r.id === roomId)) {
    throw new Error('Cannot rename default rooms');
  }
  
  if (room.isDiscovered) {
    throw new Error('Cannot rename discovered rooms');
  }
  
  const newName = prompt('Enter new room name:', room.name);
  if (newName && newName.trim() && newName.trim() !== room.name) {
    return allRooms.map(r => 
      r.id === roomId 
        ? { ...r, name: newName.trim() }
        : r
    );
  }
  
  return allRooms;
}

export function openRoomModal(roomState, mode) {
  return {
    ...roomState,
    showRoomModal: true,
    modalMode: mode,
    newRoomName: '',
    newRoomDescription: '',
    privateRoomCode: '',
    joinPrivateRoomCode: '',
    currentModalRoom: null
  };
}

export function closeRoomModal(roomState) {
  return {
    ...roomState,
    showRoomModal: false,
    modalMode: 'list',
    newRoomName: '',
    newRoomDescription: '',
    privateRoomCode: '',
    joinPrivateRoomCode: '',
    currentModalRoom: null
  };
}

export function setModalRoom(roomState, room) {
  return {
    ...roomState,
    modalMode: 'info',
    currentModalRoom: room
  };
}

export function copyRoomLink(roomId, roomName) {
  const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
  navigator.clipboard.writeText(url).then(() => {
    console.log('Room link copied to clipboard');
  });
}

export function loadHiddenRoomsFromStorage() {
  try {
    const stored = localStorage.getItem('ergochat_hidden_rooms');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading hidden rooms:', error);
    return [];
  }
}

export function saveHiddenRoomsToStorage(hiddenRooms) {
  try {
    localStorage.setItem('ergochat_hidden_rooms', JSON.stringify(hiddenRooms));
  } catch (error) {
    console.error('Error saving hidden rooms:', error);
  }
}

export function searchRoomsWrapper(rooms, query) {
  return searchRooms(rooms, query);
}

export function shouldRefreshDiscovery(roomState, maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  return (now - roomState.lastDiscoveryUpdate) > maxAge;
}

export default {
  createRoomState,
  getAllRooms,
  updateDiscoveredRooms,
  getVisibleRooms,
  getRoomCategories,
  addCustomRoom,
  addPrivateRoom,
  joinPrivateRoom,
  removeRoom,
  toggleRoomVisibility,
  renameRoom,
  openRoomModal,
  closeRoomModal,
  setModalRoom,
  copyRoomCode,
  copyRoomLink,
  shareRoom,
  getRoomStats,
  loadHiddenRoomsFromStorage,
  saveHiddenRoomsToStorage,
  searchRoomsWrapper,
  shouldRefreshDiscovery,
  // New encrypted room functions
  createRoomInvitationData,
  getBlockchainRoomIdFromDisplay,
  filterMessagesForSelectedRoom,
  showInvitationModal,
  hideInvitationModal
};