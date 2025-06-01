// Updated roomUtils.js with blockchain discovery integration

import { DEFAULT_CHATROOMS, createToastMessage } from './chatConstants.js';
import { 
  discoverRoomsFromBlockchain, 
  getAllRooms as getDiscoveredRooms,
  createPublicRoom,
  createPrivateRoom,
  joinPrivateRoomByCode,
  clearRoomDiscoveryCache,
  isPrivateRoom,
  extractPrivateRoomCode
} from './roomDiscovery.js';

// ============= ROOM STATE MANAGEMENT =============

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
    discoveredRooms: [], // Rooms discovered from blockchain
    isDiscovering: false,
    lastDiscoveryUpdate: 0
  };
}

// ============= ROOM DISCOVERY FUNCTIONS =============

/**
 * Discover and update rooms from blockchain
 * @param {Object} roomState - Current room state
 * @param {string} currentUserAddress - Current user's wallet address
 * @returns {Promise<Object>} - Updated room state
 */
export async function discoverAndUpdateRooms(roomState, currentUserAddress) {
  if (!currentUserAddress) {
    return roomState;
  }

  try {
    roomState.isDiscovering = true;
    console.log('🔍 Starting room discovery...');

    const discoveredRooms = await discoverRoomsFromBlockchain(currentUserAddress);
    
    const updatedState = {
      ...roomState,
      discoveredRooms,
      isDiscovering: false,
      lastDiscoveryUpdate: Date.now()
    };

    console.log(`✅ Discovered ${discoveredRooms.length} rooms`);
    
    if (discoveredRooms.length > 0) {
      createToastMessage(
        `🌍 Discovered ${discoveredRooms.length} new room${discoveredRooms.length === 1 ? '' : 's'}!`, 
        'info'
      );
    }

    return updatedState;

  } catch (error) {
    console.error('Room discovery failed:', error);
    return {
      ...roomState,
      isDiscovering: false
    };
  }
}

/**
 * Get all rooms (default + discovered)
 * @param {Array} discoveredRooms - Rooms discovered from blockchain
 * @returns {Array} - Combined array of all rooms
 */
export function getAllRooms(discoveredRooms = []) {
  const allRooms = [
    ...DEFAULT_CHATROOMS,
    ...discoveredRooms
  ];

  // Remove duplicates based on room ID
  const uniqueRooms = allRooms.filter((room, index, self) => 
    index === self.findIndex(r => r.id === room.id)
  );

  return uniqueRooms;
}

/**
 * Get visible rooms based on hidden rooms filter
 * @param {Array} allRooms - All available rooms
 * @param {Array} hiddenRooms - Array of hidden room IDs
 * @param {boolean} showHiddenRooms - Whether to show hidden rooms
 * @returns {Array} - Filtered rooms array
 */
export function getVisibleRooms(allRooms, hiddenRooms = [], showHiddenRooms = false) {
  if (showHiddenRooms) {
    return allRooms;
  }
  
  return allRooms.filter(room => {
    // Always show 'general' room
    if (room.id === 'general') return true;
    
    // Filter out hidden rooms
    return !hiddenRooms.includes(room.id);
  });
}

/**
 * Categorize rooms for display
 * @param {Array} visibleRooms - Visible rooms array
 * @returns {Array} - Array of room categories
 */
export function getRoomCategories(visibleRooms) {
  const categories = [
    {
      name: 'Default Rooms',
      rooms: visibleRooms.filter(room => DEFAULT_CHATROOMS.some(dr => dr.id === room.id))
    },
    {
      name: 'Public Rooms',
      rooms: visibleRooms.filter(room => 
        !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && 
        !room.isPrivate && 
        room.isDiscovered
      )
    },
    {
      name: 'Private Rooms',
      rooms: visibleRooms.filter(room => room.isPrivate)
    },
    {
      name: 'Custom Rooms',
      rooms: visibleRooms.filter(room => 
        !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && 
        !room.isPrivate && 
        !room.isDiscovered
      )
    }
  ];

  // Only return categories that have rooms
  return categories.filter(category => category.rooms.length > 0);
}

// ============= ROOM CREATION FUNCTIONS =============

/**
 * Add a custom public room
 * @param {Object} roomState - Current room state
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object containing newRoom and updatedRooms
 */
export function addCustomRoom(roomState, allRooms) {
  const roomName = roomState.newRoomName.trim();
  const description = roomState.newRoomDescription.trim();

  if (!roomName) {
    throw new Error('Room name is required');
  }

  // Create the room object
  const newRoom = createPublicRoom(roomName, description);

  // Check if room already exists
  if (allRooms.some(room => room.id === newRoom.id)) {
    throw new Error('A room with this name already exists');
  }

  const updatedRooms = [...allRooms, newRoom];
  
  createToastMessage(`🏠 Created public room: ${newRoom.name}`, 'success');
  
  return { newRoom, updatedRooms };
}

/**
 * Add a private room
 * @param {Object} roomState - Current room state
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object containing newRoom and updatedRooms
 */
export function addPrivateRoom(roomState, allRooms) {
  const roomName = roomState.newRoomName.trim();
  const customCode = roomState.privateRoomCode.trim();

  if (!roomName) {
    throw new Error('Room name is required');
  }

  try {
    const newRoom = createPrivateRoom(roomName, customCode || null);

    // Check if room already exists
    if (allRooms.some(room => room.id === newRoom.id)) {
      throw new Error('A room with this code already exists');
    }

    const updatedRooms = [...allRooms, newRoom];
    
    createToastMessage(
      `🔒 Created private room: ${newRoom.name} (Code: ${newRoom.code})`, 
      'success'
    );
    
    return { newRoom, updatedRooms };

  } catch (error) {
    throw new Error(`Failed to create private room: ${error.message}`);
  }
}

/**
 * Join a private room using a code
 * @param {string} roomCode - The room code to join
 * @param {Array} allRooms - Current rooms array
 * @returns {Object} - Object containing newRoom/existingRoom and updatedRooms
 */
export function joinPrivateRoom(roomCode, allRooms) {
  if (!roomCode || roomCode.length !== 10) {
    throw new Error('Room code must be exactly 10 digits');
  }

  try {
    const roomToJoin = joinPrivateRoomByCode(roomCode, allRooms);
    
    // Check if we already have this room
    const existingRoom = allRooms.find(room => room.id === roomToJoin.id);
    if (existingRoom) {
      createToastMessage(`🔓 Already in room: ${existingRoom.name}`, 'info');
      return { existingRoom, updatedRooms: allRooms };
    }

    const updatedRooms = [...allRooms, roomToJoin];
    
    createToastMessage(`🔓 Joined private room: ${roomToJoin.name}`, 'success');
    
    return { newRoom: roomToJoin, updatedRooms };

  } catch (error) {
    throw new Error(`Failed to join room: ${error.message}`);
  }
}

// ============= ROOM MANAGEMENT FUNCTIONS =============

/**
 * Remove a room from the list
 * @param {string} roomId - Room ID to remove
 * @param {Array} allRooms - Current rooms array
 * @param {string} selectedChatroom - Currently selected chatroom
 * @param {Function} selectChatroom - Function to select a new chatroom
 * @returns {Array} - Updated rooms array
 */
export function removeRoom(roomId, allRooms, selectedChatroom, selectChatroom) {
  // Don't allow removing default rooms
  if (DEFAULT_CHATROOMS.some(room => room.id === roomId)) {
    throw new Error('Cannot remove default rooms');
  }

  const roomToRemove = allRooms.find(room => room.id === roomId);
  if (!roomToRemove) {
    throw new Error('Room not found');
  }

  const updatedRooms = allRooms.filter(room => room.id !== roomId);
  
  // If the removed room was selected, switch to general
  if (selectedChatroom === roomId) {
    selectChatroom('general');
  }

  createToastMessage(`🗑️ Removed room: ${roomToRemove.name}`, 'info');
  
  return updatedRooms;
}

/**
 * Toggle room visibility (hide/show)
 * @param {string} roomId - Room ID to toggle
 * @param {Array} hiddenRooms - Current hidden rooms array
 * @param {string} selectedChatroom - Currently selected chatroom
 * @param {Function} selectChatroom - Function to select a new chatroom
 * @returns {Array} - Updated hidden rooms array
 */
export function toggleRoomVisibility(roomId, hiddenRooms, selectedChatroom, selectChatroom) {
  if (roomId === 'general') {
    throw new Error('Cannot hide the general room');
  }

  const isCurrentlyHidden = hiddenRooms.includes(roomId);
  let updatedHiddenRooms;

  if (isCurrentlyHidden) {
    // Show the room
    updatedHiddenRooms = hiddenRooms.filter(id => id !== roomId);
    createToastMessage('👁️ Room is now visible', 'info');
  } else {
    // Hide the room
    updatedHiddenRooms = [...hiddenRooms, roomId];
    createToastMessage('🙈 Room is now hidden', 'info');
    
    // If hiding the currently selected room, switch to general
    if (selectedChatroom === roomId) {
      selectChatroom('general');
    }
  }

  // Save to localStorage
  localStorage.setItem('ergochat-hidden-rooms', JSON.stringify(updatedHiddenRooms));
  
  return updatedHiddenRooms;
}

/**
 * Rename a room
 * @param {string} roomId - Room ID to rename
 * @param {Array} allRooms - Current rooms array
 * @returns {Array} - Updated rooms array
 */
export function renameRoom(roomId, allRooms) {
  // Don't allow renaming default rooms or discovered rooms
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
  if (!newName || newName.trim() === '') {
    return allRooms;
  }

  const updatedRooms = allRooms.map(r => 
    r.id === roomId ? { ...r, name: newName.trim() } : r
  );

  createToastMessage(`✏️ Renamed room to: ${newName.trim()}`, 'success');
  
  return updatedRooms;
}

// ============= ROOM SHARING FUNCTIONS =============

/**
 * Copy room code to clipboard
 * @param {string} roomId - Room ID
 */
export function copyRoomCode(roomId) {
  const code = extractPrivateRoomCode(roomId);
  if (!code) {
    createToastMessage('❌ This room does not have a code', 'error');
    return;
  }

  navigator.clipboard.writeText(code).then(() => {
    createToastMessage(`📋 Room code copied: ${code}`, 'success');
  }).catch(() => {
    createToastMessage('❌ Failed to copy room code', 'error');
  });
}

/**
 * Copy room link to clipboard
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room name
 */
export function copyRoomLink(roomId, roomName) {
  const baseUrl = window.location.origin + window.location.pathname;
  const roomLink = `${baseUrl}?room=${encodeURIComponent(roomId)}`;
  
  navigator.clipboard.writeText(roomLink).then(() => {
    createToastMessage(`🔗 Room link copied for: ${roomName}`, 'success');
  }).catch(() => {
    createToastMessage('❌ Failed to copy room link', 'error');
  });
}

/**
 * Share room using Web Share API or fallback to clipboard
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room name
 * @param {string} roomDescription - Room description
 */
export function shareRoom(roomId, roomName, roomDescription = '') {
  const baseUrl = window.location.origin + window.location.pathname;
  const roomLink = `${baseUrl}?room=${encodeURIComponent(roomId)}`;
  
  const shareData = {
    title: `Join ${roomName} on ErgoChat`,
    text: roomDescription || `Join the "${roomName}" room on ErgoChat`,
    url: roomLink
  };

  if (navigator.share) {
    navigator.share(shareData).then(() => {
      createToastMessage(`📤 Shared room: ${roomName}`, 'success');
    }).catch(() => {
      // Fallback to clipboard
      copyRoomLink(roomId, roomName);
    });
  } else {
    // Fallback to clipboard
    copyRoomLink(roomId, roomName);
  }
}

// ============= MODAL FUNCTIONS =============

/**
 * Open room management modal
 * @param {Object} roomState - Current room state
 * @param {string} mode - Modal mode
 * @returns {Object} - Updated room state
 */
export function openRoomModal(roomState, mode = 'list') {
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

/**
 * Close room management modal
 * @param {Object} roomState - Current room state
 * @returns {Object} - Updated room state
 */
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

/**
 * Set the current modal room for info display
 * @param {Object} roomState - Current room state
 * @param {Object} room - Room object
 * @returns {Object} - Updated room state
 */
export function setModalRoom(roomState, room) {
  return {
    ...roomState,
    showRoomModal: true,
    modalMode: 'info',
    currentModalRoom: room
  };
}

// ============= UTILITY FUNCTIONS =============

/**
 * Get room statistics
 * @param {Array} allRooms - All rooms array
 * @param {Array} hiddenRooms - Hidden rooms array
 * @returns {Object} - Room statistics
 */
export function getRoomStats(allRooms, hiddenRooms) {
  const stats = {
    total: allRooms.length,
    default: allRooms.filter(room => DEFAULT_CHATROOMS.some(dr => dr.id === room.id)).length,
    public: allRooms.filter(room => !room.isPrivate && room.isDiscovered).length,
    private: allRooms.filter(room => room.isPrivate).length,
    custom: allRooms.filter(room => 
      !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && 
      !room.isPrivate && 
      !room.isDiscovered
    ).length,
    hidden: hiddenRooms.length,
    visible: allRooms.length - hiddenRooms.length
  };

  return stats;
}

/**
 * Load hidden rooms from localStorage
 * @returns {Array} - Array of hidden room IDs
 */
export function loadHiddenRoomsFromStorage() {
  try {
    const stored = localStorage.getItem('ergochat-hidden-rooms');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load hidden rooms from storage:', error);
    return [];
  }
}

/**
 * Force refresh room discovery
 * @param {Object} roomState - Current room state
 * @param {string} currentUserAddress - Current user's wallet address
 * @returns {Promise<Object>} - Updated room state
 */
export async function forceRefreshRoomDiscovery(roomState, currentUserAddress) {
  // Clear cache to force fresh discovery
  clearRoomDiscoveryCache();
  
  // Perform discovery
  return await discoverAndUpdateRooms(roomState, currentUserAddress);
}

/**
 * Check if room discovery should be performed
 * @param {Object} roomState - Current room state
 * @param {number} maxAge - Maximum age in milliseconds before refresh
 * @returns {boolean} - True if discovery should be performed
 */
export function shouldPerformRoomDiscovery(roomState, maxAge = 5 * 60 * 1000) {
  const now = Date.now();
  return (now - roomState.lastDiscoveryUpdate) > maxAge;
}

/**
 * Auto-discover rooms when wallet connects
 * @param {Object} roomState - Current room state
 * @param {string} currentUserAddress - Current user's wallet address
 * @param {boolean} force - Force discovery even if recently updated
 * @returns {Promise<Object>} - Updated room state
 */
export async function autoDiscoverRooms(roomState, currentUserAddress, force = false) {
  if (!currentUserAddress) {
    return roomState;
  }

  if (!force && !shouldPerformRoomDiscovery(roomState)) {
    console.log('Room discovery skipped - recently updated');
    return roomState;
  }

  console.log('🔄 Auto-discovering rooms...');
  return await discoverAndUpdateRooms(roomState, currentUserAddress);
}

/**
 * Handle room URL parameter on page load
 * @param {Array} allRooms - All available rooms
 * @param {Function} selectChatroom - Function to select chatroom
 * @returns {string|null} - Selected room ID or null
 */
export function handleRoomUrlParameter(allRooms, selectChatroom) {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  
  if (!roomParam) {
    return null;
  }

  // Find the room in available rooms
  const targetRoom = allRooms.find(room => room.id === roomParam);
  
  if (targetRoom) {
    console.log(`🔗 Joining room from URL: ${targetRoom.name}`);
    selectChatroom(targetRoom.id);
    
    // Clean up URL
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    createToastMessage(`🔗 Joined room: ${targetRoom.name}`, 'success');
    return targetRoom.id;
  } else {
    console.warn(`Room not found from URL parameter: ${roomParam}`);
    createToastMessage(`❌ Room not found: ${roomParam}`, 'error');
    return null;
  }
}

/**
 * Get room by ID
 * @param {string} roomId - Room ID to find
 * @param {Array} allRooms - All available rooms
 * @returns {Object|null} - Room object or null if not found
 */
export function getRoomById(roomId, allRooms) {
  return allRooms.find(room => room.id === roomId) || null;
}

/**
 * Check if user can manage a room (rename, delete)
 * @param {Object} room - Room object
 * @param {string} currentUserAddress - Current user's address
 * @returns {boolean} - True if user can manage the room
 */
export function canManageRoom(room, currentUserAddress) {
  // Can't manage default rooms
  if (DEFAULT_CHATROOMS.some(dr => dr.id === room.id)) {
    return false;
  }
  
  // Can't manage discovered rooms (they exist on blockchain)
  if (room.isDiscovered) {
    return false;
  }
  
  // Can manage custom rooms and private rooms created by user
  return true;
}

/**
 * Get room display info for UI
 * @param {Object} room - Room object
 * @returns {Object} - Display info object
 */
export function getRoomDisplayInfo(room) {
  let icon = '#';
  let typeLabel = 'Public';
  let description = room.description || '';
  
  if (room.isPrivate) {
    icon = '🔒';
    typeLabel = 'Private';
  } else if (room.isDiscovered) {
    icon = '🌎';
    typeLabel = 'Discovered';
  } else if (DEFAULT_CHATROOMS.some(dr => dr.id === room.id)) {
    icon = '#';
    typeLabel = 'Default';
  } else {
    icon = '#';
    typeLabel = 'Custom';
  }
  
  return {
    icon,
    typeLabel,
    description,
    canShare: true,
    canHide: room.id !== 'general',
    canRename: canManageRoom(room),
    canDelete: canManageRoom(room)
  };
}

/**
 * Sort rooms for display
 * @param {Array} rooms - Rooms to sort
 * @returns {Array} - Sorted rooms array
 */
export function sortRoomsForDisplay(rooms) {
  return rooms.sort((a, b) => {
    // General room always first
    if (a.id === 'general') return -1;
    if (b.id === 'general') return 1;
    
    // Then other default rooms
    const aIsDefault = DEFAULT_CHATROOMS.some(dr => dr.id === a.id);
    const bIsDefault = DEFAULT_CHATROOMS.some(dr => dr.id === b.id);
    
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    
    // Then by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Validate room name
 * @param {string} roomName - Room name to validate
 * @param {Array} existingRooms - Existing rooms to check against
 * @returns {Object} - Validation result { valid: boolean, error?: string }
 */
export function validateRoomName(roomName, existingRooms = []) {
  if (!roomName || !roomName.trim()) {
    return { valid: false, error: 'Room name is required' };
  }
  
  const trimmedName = roomName.trim();
  
  if (trimmedName.length < 2) {
    return { valid: false, error: 'Room name must be at least 2 characters' };
  }
  
  if (trimmedName.length > 50) {
    return { valid: false, error: 'Room name must be less than 50 characters' };
  }
  
  // Generate room ID to check for conflicts
  const roomId = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (existingRooms.some(room => room.id === roomId)) {
    return { valid: false, error: 'A room with this name already exists' };
  }
  
  return { valid: true };
}

// ============= ROOM PERSISTENCE =============

/**
 * Save custom rooms to localStorage
 * @param {Array} customRooms - Custom rooms to save
 */
export function saveCustomRoomsToStorage(customRooms) {
  try {
    const customRoomsData = customRooms
      .filter(room => !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && !room.isDiscovered)
      .map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        isPrivate: room.isPrivate,
        createdAt: room.createdAt,
        code: room.code
      }));
    
    localStorage.setItem('ergochat-custom-rooms', JSON.stringify(customRoomsData));
  } catch (error) {
    console.error('Failed to save custom rooms to storage:', error);
  }
}

/**
 * Load custom rooms from localStorage
 * @returns {Array} - Array of custom room objects
 */
export function loadCustomRoomsFromStorage() {
  try {
    const stored = localStorage.getItem('ergochat-custom-rooms');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load custom rooms from storage:', error);
    return [];
  }
}

// ============= EXPORT DEFAULT =============

export default {
  // State management
  createRoomState,
  
  // Discovery functions
  discoverAndUpdateRooms,
  forceRefreshRoomDiscovery,
  shouldPerformRoomDiscovery,
  autoDiscoverRooms,
  
  // Room management
  getAllRooms,
  getVisibleRooms,
  getRoomCategories,
  addCustomRoom,
  addPrivateRoom,
  joinPrivateRoom,
  removeRoom,
  toggleRoomVisibility,
  renameRoom,
  
  // Sharing functions
  copyRoomCode,
  copyRoomLink,
  shareRoom,
  
  // Modal functions
  openRoomModal,
  closeRoomModal,
  setModalRoom,
  
  // Utility functions
  getRoomStats,
  loadHiddenRoomsFromStorage,
  handleRoomUrlParameter,
  getRoomById,
  canManageRoom,
  getRoomDisplayInfo,
  sortRoomsForDisplay,
  validateRoomName,
  
  // Persistence
  saveCustomRoomsToStorage,
  loadCustomRoomsFromStorage
};