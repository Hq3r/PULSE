// landingFunctions.js - All extracted functions from Landing.svelte

import { DEFAULT_CHATROOMS, formatTime, truncateAddress } from '$lib/utils/chatConstants.js';
import {
  fetchMessages,
  fetchMessagesQuietly,
  sendMessageWithExternalWallet,
  sendMessageWithMnemonic,
  processSingleMessage,
  shouldUpdateMessages,
  scrollToBottom,
  checkAutoScroll
} from '$lib/utils/landingUtils.js';
import { sanitizeBeforeSend, isContentSafe } from '$lib/utils/securityUtils.js';
import {
  connectWithMnemonic,
  disconnectWallet,
  loadExistingStealthAddress,
  handleStealthModeChanged
} from '$lib/utils/walletUtils.js';
import {
  getAllRooms,
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
  loadHiddenRoomsFromStorage,
  updateDiscoveredRooms,
  filterMessagesForSelectedRoom,
  createRoomInvitationData,
  showInvitationModal,
  hideInvitationModal
} from '$lib/utils/roomUtils.js';
import {
  updateUnreadCounts,
  handleRoomChange,
  processOptimisticMessage,
  formatUnreadCount,
  getUnreadCountForRoom,
  hasUnreadMessages
} from '$lib/utils/unreadMessageTracker.js';

// ============= KYA FUNCTIONS =============

export function checkKYAStatus(kyaVersion) {
  try {
    const kyaStatus = localStorage.getItem('pulse-kya-accepted');
    const kyaTimestamp = localStorage.getItem('pulse-kya-timestamp');
    const savedKyaVersion = localStorage.getItem('pulse-kya-version');
    const oneMonth = 30 * 24 * 60 * 60 * 1000; // One month in milliseconds
    
    console.log('Checking KYA status:', { kyaStatus, kyaTimestamp, savedKyaVersion, currentVersion: kyaVersion });
    
    if (kyaStatus === 'true' && kyaTimestamp && savedKyaVersion) {
      const acceptedTime = parseInt(kyaTimestamp);
      const now = Date.now();
      
      // Check if KYA is still valid (within one month and same version)
      if (now - acceptedTime < oneMonth && savedKyaVersion === kyaVersion) {
        console.log('KYA already accepted and valid');
        return { accepted: true, showModal: false };
      } else {
        console.log('KYA expired or version changed, showing again');
      }
    }
    
    // Show KYA if not accepted, expired, or version changed
    return { accepted: false, showModal: true };
  } catch (error) {
    console.error('Error checking KYA status:', error);
    // If there's an error, show KYA to be safe
    return { accepted: false, showModal: true };
  }
}

export function handleKYAAccept(kyaVersion, createToastMessage) {
  try {
    // Store acceptance in localStorage
    localStorage.setItem('pulse-kya-accepted', 'true');
    localStorage.setItem('pulse-kya-timestamp', Date.now().toString());
    localStorage.setItem('pulse-kya-version', kyaVersion);
    
    console.log('KYA accepted by user');
    
    // Create a toast notification
    createToastMessage('✅ Terms accepted! Welcome to Pulse.', 'success');
    
    return true;
  } catch (error) {
    console.error('Error saving KYA acceptance:', error);
    createToastMessage('❌ Error saving preferences. Please try again.', 'error');
    return false;
  }
}

export function handleKYADecline() {
  // Give user options when declining
  const message = 'You must accept the terms to use Pulse. Would you like to:\n\n' +
                 '• Review the terms again (OK)\n' +
                 '• Visit Ergo Platform website (Cancel)';
  
  if (confirm(message)) {
    // Keep the modal open for review
    return false;
  }
  
  // Redirect to Ergo Platform
  window.location.href = 'https://ergoplatform.org/';
  return true;
}

// ============= TOAST FUNCTIONS =============

export function createToastMessage(message, type = 'info') {
  try {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Add toast styles if not already present
    if (!document.querySelector('#toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          color: white;
          font-weight: 500;
          z-index: 10000;
          opacity: 0;
          transform: translateX(100%);
          transition: all 0.3s ease;
          max-width: 400px;
          word-wrap: break-word;
        }
        .toast.toast-success { background: #4CAF50; }
        .toast.toast-error { background: #f44336; }
        .toast.toast-info { background: #2196F3; }
        .toast.toast-warning { background: #ff9800; }
        .toast.show {
          opacity: 1;
          transform: translateX(0);
        }
        .toast-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .toast-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          margin-left: auto;
          min-width: 20px;
        }
        @media (max-width: 768px) {
          .toast {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
    
  } catch (error) {
    console.error('Error creating toast:', error);
  }
}

// ============= MAIN FUNCTIONS =============

export async function handleFetchMessages(
  walletConnected, 
  kyaAccepted, 
  selectedChatroom, 
  allRooms, 
  chatContainer, 
  autoScroll,
  setMessages,
  setLoading,
  setError,
  createToastMessage
) {
  if (!walletConnected || !kyaAccepted) return;

  try {
    setLoading(true);
    setError("");
    // Pass allRooms to support encrypted room handling
    const fetchedMessages = await fetchMessages(selectedChatroom, allRooms);
    setMessages([...fetchedMessages]);
    scrollToBottom(chatContainer, autoScroll);
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ Error loading messages: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

export async function handleFetchMessagesQuietly(
  walletConnected,
  kyaAccepted,
  selectedChatroom,
  allRooms,
  messages,
  chatContainer,
  autoScroll,
  setMessages
) {
  if (!walletConnected || !kyaAccepted) return;

  try {
    // Pass allRooms to support encrypted room handling
    const newMessages = await fetchMessagesQuietly(selectedChatroom, allRooms);
    if (newMessages && shouldUpdateMessages(newMessages, messages)) {
      console.log('Updating messages in quiet fetch');
      setMessages([...newMessages]);
      scrollToBottom(chatContainer, autoScroll);
    }
  } catch (err) {
    console.warn('Quiet message fetch failed:', err);
  }
}


// ============= UPDATED SEND MESSAGE FUNCTION =============

export async function handleSendMessage(
  walletConnected,
  kyaAccepted,
  inputMessage,
  selectedChatroom,
  stealthMode,
  walletState,
  $selected_wallet_ergo,
  $connected_wallet_address,
  allRooms,
  unreadState,
  setInputMessage,
  setIsTyping,
  setLoading,
  setError,
  createToastMessage
) {
  if (!walletConnected || !kyaAccepted || !inputMessage.trim()) return;

  // SECURITY: Sanitize the input message before processing
  let messageContent = sanitizeBeforeSend(inputMessage.trim());
  let shouldEncrypt = false;
  
  // Check for encryption command AFTER sanitization
  if (messageContent.startsWith('/encrypt ')) {
    shouldEncrypt = true;
    messageContent = sanitizeBeforeSend(messageContent.substring(9));
  }

  // Additional check - don't send if message becomes empty after sanitization
  if (!messageContent.trim()) {
    createToastMessage('❌ Message contains invalid content and cannot be sent', 'error');
    return;
  }

  const originalMessage = inputMessage;
  setInputMessage("");
  setIsTyping(false);

  try {
    setLoading(true);
    setError("");

    let optimisticMessage;

    if (walletState.usingMnemonicWallet) {
      optimisticMessage = await sendMessageWithMnemonic(
        messageContent, // Use sanitized content
        shouldEncrypt, 
        selectedChatroom, 
        stealthMode, 
        walletState.transactionQueue,
        walletState.mnemonicWallet,
        allRooms
      );
    } else {
      optimisticMessage = await sendMessageWithExternalWallet(
        messageContent, // Use sanitized content
        shouldEncrypt, 
        selectedChatroom, 
        stealthMode, 
        $selected_wallet_ergo, 
        $connected_wallet_address,
        allRooms
      );
    }

    // Process optimistic message for unread tracking
    if (optimisticMessage && unreadState.tracker) {
      processOptimisticMessage(optimisticMessage, selectedChatroom);
    }

    createToastMessage('📤 Message sent successfully!', 'success');

  } catch (err) {
    console.error('Send message error:', err);
    setError(`Failed to send message: ${err.message}`);
    createToastMessage(`❌ Send error: ${err.message}`, 'error');
    setInputMessage(originalMessage);
  } finally {
    setLoading(false);
  }
}

export async function handleConnectWithMnemonic(
  kyaAccepted,
  walletState,
  setLoading,
  setError,
  setShowMnemonicModal,
  handleFetchMessages,
  messageRefresh,
  handleFetchMessagesQuietly,
  createToastMessage
) {
  // Check KYA first
  if (!kyaAccepted) {
    createToastMessage('📋 Please accept the terms first', 'info');
    return { success: false, showKYA: true };
  }

  if (!walletState.mnemonicInput.trim()) {
    setError("Please enter your mnemonic phrase");
    createToastMessage('❌ Please enter your mnemonic phrase', 'error');
    return { success: false, showKYA: false };
  }

  try {
    setLoading(true);
    setError("");

    // Set up processor function
    const processor = (messageData) => processSingleMessage(messageData, walletState.mnemonicWallet);

    await connectWithMnemonic(walletState.mnemonicInput, walletState, processor);
    setShowMnemonicModal(false);
    walletState.mnemonicInput = "";

    createToastMessage('🔗 Wallet connected successfully!', 'success');

    await handleFetchMessages();
    messageRefresh.start(handleFetchMessagesQuietly);

    return { success: true, showKYA: false };
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ Connection failed: ${err.message}`, 'error');
    return { success: false, showKYA: false };
  } finally {
    setLoading(false);
  }
}

export async function handleDisconnectWallet(
  walletState,
  $selected_wallet_ergo,
  setSelectedWalletErgo,
  setConnectedWalletAddress,
  messageRefresh,
  setMessages,
  createToastMessage
) {
  try {
    const newStealthMode = await disconnectWallet(
      walletState,
      $selected_wallet_ergo,
      setSelectedWalletErgo,
      setConnectedWalletAddress,
      () => messageRefresh.stop()
    );
    setMessages([]);
    createToastMessage('👋 Wallet disconnected', 'info');
    return newStealthMode;
  } catch (err) {
    console.error('Disconnect error:', err);
    createToastMessage('❌ Disconnect failed', 'error');
    return { active: false, address: '', displayName: '' };
  }
}

export function handleStealthModeChange(
  event,
  messages,
  handleFetchMessages,
  walletConnected,
  kyaAccepted,
  createToastMessage
) {
  if (!kyaAccepted) {
    createToastMessage('📋 Please accept the terms first', 'info');
    return { showKYA: true, stealthMode: { active: false, address: '', displayName: '' } };
  }
  
  const newStealthMode = handleStealthModeChanged(event, messages, handleFetchMessages, walletConnected);
  return { showKYA: false, stealthMode: newStealthMode };
}

// ============= ROOM MANAGEMENT FUNCTIONS =============

export function selectChatroom(
  roomId,
  kyaAccepted,
  selectedChatroom,
  roomState,
  unreadState,
  setSelectedChatroom,
  setMessages,
  setShowRoomList,
  setRoomState,
  handleRoomChange,
  updateUnreadCounts,
  walletConnected,
  handleFetchMessages,
  createToastMessage
) {
  if (!kyaAccepted) {
    createToastMessage('📋 Please accept the terms first', 'info');
    return { showKYA: true };
  }

  const oldRoom = selectedChatroom;
  setSelectedChatroom(roomId);
  setMessages([]);
  setShowRoomList(false);
  setRoomState(closeRoomModal(roomState));

  // Handle unread tracking
  if (unreadState.tracker) {
    handleRoomChange(roomId, oldRoom);
    // Update unread state immediately
    const newUnreadState = updateUnreadCounts([], roomId);
    return { showKYA: false, unreadState: { ...unreadState, ...newUnreadState } };
  }

  if (walletConnected) {
    handleFetchMessages();
  }

  return { showKYA: false };
}

export function handleCreateRoom(
  kyaAccepted,
  roomState,
  allRooms,
  setAllRooms,
  selectChatroom,
  setRoomState,
  setError,
  createToastMessage
) {
  if (!kyaAccepted) {
    createToastMessage('📋 Please accept the terms first', 'info');
    return { showKYA: true };
  }

  try {
    const { newRoom, updatedRooms } = addCustomRoom(roomState, allRooms);
    setAllRooms(updatedRooms);
    selectChatroom(newRoom.id);
    setRoomState(closeRoomModal(roomState));
    createToastMessage(`🏠 Room "${newRoom.name}" created!`, 'success');
    return { showKYA: false };
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ ${err.message}`, 'error');
    return { showKYA: false };
  }
}

export function handleCreatePrivateRoom(
  kyaAccepted,
  roomState,
  allRooms,
  setAllRooms,
  selectChatroom,
  setRoomState,
  setError,
  createToastMessage
) {
  if (!kyaAccepted) {
    createToastMessage('📋 Please accept the terms first', 'info');
    return { showKYA: true };
  }

  try {
    const result = addPrivateRoom(roomState, allRooms);
    setAllRooms(result.updatedRooms);
    selectChatroom(result.newRoom.id);
    setRoomState(closeRoomModal(roomState));
    
    // Show invitation modal with the room code
    if (result.invitation) {
      createToastMessage(`🔒 Private room "${result.newRoom.name}" created! Code: ${result.invitation.code}`, 'success');
      
      // Optional: Automatically copy the code to clipboard
      navigator.clipboard.writeText(result.invitation.code).then(() => {
        createToastMessage(`📋 Room code ${result.invitation.code} copied to clipboard!`, 'info');
      });
    }
    return { showKYA: false };
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ ${err.message}`, 'error');
    return { showKYA: false };
  }
}

export function handleJoinPrivateRoom(
  kyaAccepted,
  roomState,
  allRooms,
  setAllRooms,
  selectChatroom,
  setRoomState,
  setError,
  createToastMessage
) {
  if (!kyaAccepted) {
    createToastMessage('📋 Please accept the terms first', 'info');
    return { showKYA: true };
  }

  try {
    const { newRoom, existingRoom, updatedRooms } = joinPrivateRoom(roomState.joinPrivateRoomCode, allRooms);
    setAllRooms(updatedRooms);
    selectChatroom((newRoom || existingRoom).id);
    setRoomState(closeRoomModal(roomState));
    createToastMessage(`🎯 Joined private room successfully!`, 'success');
    return { showKYA: false };
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ ${err.message}`, 'error');
    return { showKYA: false };
  }
}

// ============= ROOM ACTION FUNCTIONS =============

export function handleCopyRoomCode(roomId, event, allRooms, createToastMessage) {
  if (event) event.stopPropagation();
  
  // Find the room object for better code extraction
  const room = allRooms.find(r => r.id === roomId);
  
  // Extract the 10-digit code
  let code = null;
  if (room && room.code) {
    code = room.code;
  } else if (roomId.startsWith('private-')) {
    code = roomId.replace('private-', '');
  }
  
  if (code && /^\d{10}$/.test(code)) {
    navigator.clipboard.writeText(code).then(() => {
      createToastMessage(`📋 Room code ${code} copied to clipboard!`, 'success');
    }).catch(() => {
      createToastMessage('❌ Failed to copy room code', 'error');
    });
  } else {
    createToastMessage('❌ No valid room code found', 'error');
  }
}

export function handleShowInvitation(roomId, event, allRooms, setRoomState, roomState, createToastMessage) {
  if (event) event.stopPropagation();
  
  const room = allRooms.find(r => r.id === roomId);
  if (room && room.isPrivate && room.code) {
    try {
      const invitation = createRoomInvitationData(room);
      setRoomState(showInvitationModal(roomState, invitation));
    } catch (err) {
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }
}

export function handleRemoveRoom(roomId, event, allRooms, selectedChatroom, selectChatroom, setAllRooms, setError, createToastMessage) {
  if (event) event.stopPropagation();
  try {
    const updatedRooms = removeRoom(roomId, allRooms, selectedChatroom, selectChatroom);
    setAllRooms(updatedRooms);
    createToastMessage('🗑️ Room removed', 'info');
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ ${err.message}`, 'error');
  }
}

export function handleToggleRoomVisibility(roomId, event, hiddenRooms, selectedChatroom, selectChatroom, setHiddenRooms, setError, createToastMessage) {
  if (event) event.stopPropagation();
  try {
    const updatedHiddenRooms = toggleRoomVisibility(roomId, hiddenRooms, selectedChatroom, selectChatroom);
    setHiddenRooms(updatedHiddenRooms);
    const isHidden = updatedHiddenRooms.includes(roomId);
    createToastMessage(`👁️ Room ${isHidden ? 'hidden' : 'shown'}`, 'info');
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ ${err.message}`, 'error');
  }
}

export function handleRenameRoom(roomId, event, allRooms, setAllRooms, setError, createToastMessage) {
  if (event) event.stopPropagation();
  try {
    const updatedRooms = renameRoom(roomId, allRooms);
    setAllRooms(updatedRooms);
    createToastMessage('✏️ Room renamed', 'success');
  } catch (err) {
    setError(err.message);
    createToastMessage(`❌ ${err.message}`, 'error');
  }
}

export function handleShowRoomInfo(room, event, setRoomState, roomState) {
  if (event) event.stopPropagation();
  
  if (room.isPrivate && room.code) {
    // For private rooms, show enhanced info with invitation option
    setRoomState(setModalRoom(roomState, {
      ...room,
      invitation: room.code ? createRoomInvitationData(room) : null
    }));
  } else {
    setRoomState(setModalRoom(roomState, room));
  }
}

export function handleCopyRoomLink(roomId, event, allRooms, createToastMessage) {
  if (event) event.stopPropagation();
  const room = allRooms.find(r => r.id === roomId);
  if (room) {
    copyRoomLink(roomId, room.name);
    createToastMessage('🔗 Room link copied!', 'success');
  }
}

export function handleShareRoom(roomId, event, allRooms, createToastMessage) {
  if (event) event.stopPropagation();
  
  const room = allRooms.find(r => r.id === roomId);
  if (room) {
    shareRoom(roomId, room.name, room).then(success => {
      if (success) {
        if (room.isPrivate) {
          createToastMessage('🔗 Private room invitation copied!', 'success');
        } else {
          createToastMessage('🔗 Room link shared!', 'success');
        }
      } else {
        createToastMessage('❌ Failed to share room', 'error');
      }
    });
  }
}

// ============= ROOM REFRESH FUNCTION =============

export async function refreshRoomDiscovery(roomState, setRoomState, createToastMessage) {
  try {
    console.log('🔄 Refreshing room discovery...');
    setRoomState({ ...roomState, isDiscovering: true });
    
    const updatedRoomState = await updateDiscoveredRooms(roomState, true);
    setRoomState(updatedRoomState);
    
    createToastMessage(`🏠 Found ${updatedRoomState.discoveredRooms.length} rooms from blockchain`, 'success');
  } catch (error) {
    console.error('Room refresh failed:', error);
    createToastMessage('❌ Failed to refresh rooms', 'error');
    setRoomState({ ...roomState, isDiscovering: false });
  }
}

// ============= UTILITY FUNCTIONS =============

export function getUnreadCount(roomId) {
  return getUnreadCountForRoom(roomId);
}

export function roomHasUnread(roomId) {
  return hasUnreadMessages(roomId);
}

// ============= DEBUG FUNCTIONS (Development only) =============

export function resetKYA() {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    localStorage.removeItem('pulse-kya-accepted');
    localStorage.removeItem('pulse-kya-timestamp');
    localStorage.removeItem('pulse-kya-version');
    console.log('KYA reset for development');
    return true;
  }
  return false;
}