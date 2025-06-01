// urlUtils.js - Utilities for deep linking and URL management
import { get } from 'svelte/store';
import { selectedChatroomId } from '$lib/components/main/chatstore';
import { showCustomToast } from '$lib/utils/utils';

/**
 * Parse URL parameters for room and message navigation
 * @returns {Object} Parsed parameters
 */
export function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.substring(1); // Remove #
  
  return {
    room: urlParams.get('room'),
    message: urlParams.get('msg') || hash, // Support both ?msg= and #msgId
    highlight: urlParams.get('highlight') === 'true'
  };
}

/**
 * Generate shareable URL for a message
 * @param {string} messageId - Message ID to link to
 * @param {string} roomId - Room ID (optional, uses current room if not provided)
 * @returns {string} Shareable URL
 */
export function generateMessageUrl(messageId, roomId = null) {
  const currentRoom = roomId || get(selectedChatroomId);
  const baseUrl = window.location.origin + window.location.pathname;
  
  if (currentRoom && currentRoom !== 'general') {
    return `${baseUrl}?room=${encodeURIComponent(currentRoom)}&msg=${encodeURIComponent(messageId)}&highlight=true`;
  } else {
    return `${baseUrl}?msg=${encodeURIComponent(messageId)}&highlight=true`;
  }
}

/**
 * Generate shareable URL for a room
 * @param {string} roomId - Room ID to link to
 * @returns {string} Shareable URL
 */
export function generateRoomUrl(roomId) {
  const baseUrl = window.location.origin + window.location.pathname;
  
  if (roomId === 'general') {
    return baseUrl; // Default room doesn't need parameter
  }
  
  return `${baseUrl}?room=${encodeURIComponent(roomId)}`;
}

/**
 * Copy message link to clipboard
 * @param {string} messageId - Message ID
 * @param {string} roomId - Room ID (optional)
 */
export async function copyMessageLink(messageId, roomId = null) {
  try {
    const url = generateMessageUrl(messageId, roomId);
    await navigator.clipboard.writeText(url);
    showCustomToast('Message link copied to clipboard!', 3000, 'success');
    return true;
  } catch (error) {
    console.error('Failed to copy message link:', error);
    showCustomToast('Failed to copy link', 3000, 'error');
    return false;
  }
}

/**
 * Copy room link to clipboard
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room display name (optional)
 */
export async function copyRoomLink(roomId, roomName = null) {
  try {
    const url = generateRoomUrl(roomId);
    const displayName = roomName || roomId;
    await navigator.clipboard.writeText(url);
    showCustomToast(`Link to "${displayName}" copied!`, 3000, 'success');
    return true;
  } catch (error) {
    console.error('Failed to copy room link:', error);
    showCustomToast('Failed to copy room link', 3000, 'error');
    return false;
  }
}

/**
 * Share message with native share API or fallback to clipboard
 * @param {Object} message - Message object
 * @param {string} roomName - Room display name
 */
export async function shareMessage(message, roomName = 'Ergo Chat') {
  const url = generateMessageUrl(message.id, message.chatroomId);
  const shareData = {
    title: `Message in ${roomName}`,
    text: `Check out this message: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`,
    url: url
  };
  
  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      // Fallback to clipboard
      const shareText = `${shareData.text}\n\n${url}`;
      await navigator.clipboard.writeText(shareText);
      showCustomToast('Message details copied to clipboard!', 3000, 'success');
      return true;
    }
  } catch (error) {
    console.error('Failed to share message:', error);
    // Final fallback - just copy URL
    return await copyMessageLink(message.id, message.chatroomId);
  }
}

/**
 * Share room with native share API or fallback to clipboard
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room display name
 * @param {string} description - Room description (optional)
 */
export async function shareRoom(roomId, roomName, description = null) {
  const url = generateRoomUrl(roomId);
  const shareData = {
    title: `Join ${roomName} on Ergo Chat`,
    text: `Join the conversation in ${roomName}${description ? `: ${description}` : ''}`,
    url: url
  };
  
  try {
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      // Fallback to clipboard
      const shareText = `${shareData.text}\n\n${url}`;
      await navigator.clipboard.writeText(shareText);
      showCustomToast(`Invite to "${roomName}" copied!`, 3000, 'success');
      return true;
    }
  } catch (error) {
    console.error('Failed to share room:', error);
    return await copyRoomLink(roomId, roomName);
  }
}

/**
 * Update URL without reloading page
 * @param {string} roomId - Room ID (optional)
 * @param {string} messageId - Message ID (optional)
 * @param {boolean} highlight - Whether to highlight message (optional)
 */
export function updateUrl(roomId = null, messageId = null, highlight = false) {
  const url = new URL(window.location);
  
  // Clear existing params
  url.searchParams.delete('room');
  url.searchParams.delete('msg');
  url.searchParams.delete('highlight');
  url.hash = '';
  
  // Set new params
  if (roomId && roomId !== 'general') {
    url.searchParams.set('room', roomId);
  }
  
  if (messageId) {
    url.searchParams.set('msg', messageId);
    if (highlight) {
      url.searchParams.set('highlight', 'true');
    }
  }
  
  // Update URL without reload
  window.history.replaceState({}, '', url.toString());
}

/**
 * Navigate to a specific message (scroll and highlight)
 * @param {string} messageId - Message ID to navigate to
 * @param {Function} scrollToMessage - Function to scroll to message
 */
export function navigateToMessage(messageId, scrollToMessage) {
  if (!messageId) return false;
  
  try {
    // Find message element
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    
    if (messageElement) {
      // Scroll to message
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Highlight message
      messageElement.classList.add('message-highlighted');
      
      // Remove highlight after animation
      setTimeout(() => {
        messageElement.classList.remove('message-highlighted');
      }, 3000);
      
      showCustomToast('Message found!', 2000, 'success');
      return true;
    } else {
      showCustomToast('Message not found in current view', 3000, 'warning');
      return false;
    }
  } catch (error) {
    console.error('Error navigating to message:', error);
    return false;
  }
}

/**
 * Check if a room ID is valid and accessible
 * @param {string} roomId - Room ID to validate
 * @param {Array} availableRooms - Array of available room objects
 * @returns {Object|null} Room object if valid, null if not
 */
export function validateRoomAccess(roomId, availableRooms) {
  if (!roomId) return null;
  
  // Check if room exists in available rooms
  const room = availableRooms.find(r => r.id === roomId);
  
  if (!room) {
    // Check if it's a private room we might not have access to
    if (roomId.startsWith('private-')) {
      showCustomToast('Private room not accessible or not joined', 3000, 'warning');
    } else {
      showCustomToast(`Room "${roomId}" not found`, 3000, 'warning');
    }
    return null;
  }
  
  return room;
}

/**
 * Initialize URL-based navigation on page load
 * @param {Array} availableRooms - Array of available room objects
 * @param {Function} selectChatroom - Function to select a chatroom
 * @param {Function} scrollToMessage - Function to scroll to a message
 */
export function initializeUrlNavigation(availableRooms, selectChatroom, scrollToMessage) {
  const params = parseUrlParams();
  
  // Handle room navigation
  if (params.room) {
    const room = validateRoomAccess(params.room, availableRooms);
    if (room) {
      selectChatroom(params.room);
    }
  }
  
  // Handle message navigation (after room is loaded)
  if (params.message) {
    // Delay message navigation to allow room to load
    setTimeout(() => {
      navigateToMessage(params.message, scrollToMessage);
    }, 1000);
  }
}

/**
 * Generate QR code URL for sharing (using a free QR service)
 * @param {string} url - URL to encode in QR code
 * @returns {string} QR code image URL
 */
export function generateQRCodeUrl(url) {
  const encodedUrl = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
}

/**
 * Create a formatted invite message for rooms
 * @param {string} roomId - Room ID
 * @param {string} roomName - Room display name
 * @param {string} description - Room description (optional)
 * @returns {string} Formatted invite message
 */
export function createRoomInviteMessage(roomId, roomName, description = null) {
  const url = generateRoomUrl(roomId);
  const isPrivate = roomId.startsWith('private-');
  
  let message = `🚀 Join me on Ergo Chat!\n\n`;
  message += `Room: ${roomName}\n`;
  
  if (description) {
    message += `About: ${description}\n`;
  }
  
  if (isPrivate) {
    const code = roomId.replace('private-', '');
    message += `Type: Private Room\n`;
    message += `Code: ${code}\n\n`;
    message += `Enter this code in "Join Private Room" or use the direct link:\n`;
  } else {
    message += `Type: Public Room\n\n`;
    message += `Click the link to join:\n`;
  }
  
  message += url;
  
  return message;
}