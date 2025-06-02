
<script>
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade } from 'svelte/transition';

  // Store imports
  import {
    selected_wallet_ergo,
    connected_wallet_address,
    wallet_init
  } from '$lib/store/store';

  // Component imports
  import WalletButton from '$lib/components/nav/WalletButton.svelte';
  import StealthAddressUI from '$lib/components/main/StealthAddressUI.svelte';
  import KYA from '$lib/components/common/KYA.svelte'; 
  

  // Utility imports
  import { DEFAULT_CHATROOMS, formatTime, truncateAddress } from '$lib/utils/chatConstants.js';
  import {
    fetchMessages,
    fetchMessagesQuietly,
    sendMessageWithExternalWallet,
    sendMessageWithMnemonic,
    processSingleMessage,
    createMessageRefreshManager,
    shouldUpdateMessages,
    scrollToBottom,
    checkAutoScroll
  } from '$lib/utils/landingUtils.js';
  import {
    createWalletState,
    connectWithMnemonic,
    disconnectWallet,
    loadExistingStealthAddress,
    handleStealthModeChanged,
    loadSavedPreferences,
    toggleTheme,
    toggleAnimations,
    toggleCompactMode,
    createEventHandlers,
    getWalletConnectionState,
    getCurrentWalletAddress,
    getThemeClass,
    processEncryptionCommand
  } from '$lib/utils/walletUtils.js';
 import {
  createRoomState,
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
  getRoomStats,
  loadHiddenRoomsFromStorage,
  updateDiscoveredRooms,
  getBlockchainRoomIdFromDisplay,
  filterMessagesForSelectedRoom,
    createRoomInvitationData,
  showInvitationModal,      
  hideInvitationModal      
} from '$lib/utils/roomUtils.js';

import {
  initializeUnreadTracking,
  updateUnreadCounts,
  handleRoomChange,
  processOptimisticMessage,
  formatUnreadCount,
  getUnreadCountForRoom,
  hasUnreadMessages,
  getUnreadBadgeClass
} from '$lib/utils/unreadMessageTracker.js';


  // ============= STATE VARIABLES =============
  let messages = [];
  let inputMessage = "";
  let loading = false;
  let error = "";
  let selectedChatroom = "general";
  let autoScroll = true;
  let chatContainer;
  let isTyping = false;
  let showRoomList = false;
  let unreadState = {
  unreadCounts: new Map(),
  totalUnread: 0,
  tracker: null
};

  // Create state objects using utilities
  const walletState = createWalletState();
  const messageRefresh = createMessageRefreshManager();

  // Theme and UI state
  let { isDarkMode, isAnimationsEnabled, compactMode } = loadSavedPreferences();

  // Stealth address state
  let stealthMode = { active: false, address: '', displayName: '' };

  // Modal state
  let showMnemonicModal = false;

  // Room management state
  let roomState = createRoomState();
  let allRooms = DEFAULT_CHATROOMS;
  let visibleRooms = DEFAULT_CHATROOMS;
  let roomCategories = [];
  let hiddenRooms = [];

  // ============= KYA STATE =============
  let showKYA = false;
  let kyaAccepted = false;
  let kyaVersion = "1.0"; // Current KYA version

  // ============= REACTIVE STATEMENTS =============
  $: {
  if (messages && messages.length > 0 && unreadState.tracker) {
    const newUnreadState = updateUnreadCounts(messages, selectedChatroom);
    unreadState = { ...unreadState, ...newUnreadState };
  }
}

// Add reactive statement to update page title with unread count
$: {
  if (typeof document !== 'undefined') {
    const baseTitle = 'Pulse - Decentralized Messaging';
    if (unreadState.totalUnread > 0) {
      document.title = `(${formatUnreadCount(unreadState.totalUnread)}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }
}
  $: walletConnected = getWalletConnectionState($connected_wallet_address, $selected_wallet_ergo, walletState.usingMnemonicWallet);
  $: currentWalletAddress = getCurrentWalletAddress(walletState.usingMnemonicWallet, walletState.mnemonicWallet, $connected_wallet_address);
  $: themeClass = getThemeClass(isDarkMode);
  $: currentRoom = allRooms.find(room => room.id === selectedChatroom) || allRooms[0];

  // Update room-related reactive statements
  $: {
    allRooms = getAllRooms(roomState.discoveredRooms);
    visibleRooms = getVisibleRooms(allRooms, hiddenRooms, roomState.showHiddenRooms);
    roomCategories = getRoomCategories(visibleRooms);
  }
  $: {
  if (messages && messages.length > 0 && selectedChatroom) {
    // Filter messages using the enhanced filtering function
    const filteredMessages = filterMessagesForSelectedRoom(messages, selectedChatroom, allRooms);
    
    // Only update if the filtered result is different
    if (filteredMessages.length !== messages.length) {
      console.log(`Filtered ${messages.length} messages to ${filteredMessages.length} for room ${selectedChatroom}`);
      messages = filteredMessages;
    }
  }
}
$: {
  // Sort messages to ensure proper ordering: confirmed first, then pending
  if (messages && messages.length > 0) {
    messages = messages.sort((a, b) => {
      // Pending messages always come after confirmed messages
      if (a.pending && !b.pending) return 1;
      if (!a.pending && b.pending) return -1;
      
      // Within the same type, sort by timestamp (chronological order)
      return a.timestamp - b.timestamp;
    });
  }
}
  // Watch for external wallet connection changes (with KYA check)
  $: if (walletConnected && kyaAccepted && !walletState.usingMnemonicWallet && !messageRefresh.isActive()) {
    handleFetchMessages().then(() => {
      messageRefresh.start(handleFetchMessagesQuietly);
    });
  } else if (!walletConnected && messageRefresh.isActive()) {
    messageRefresh.stop();
  }

  // ============= KYA FUNCTIONS =============
  function checkKYAStatus() {
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
          kyaAccepted = true;
          console.log('KYA already accepted and valid');
          return;
        } else {
          console.log('KYA expired or version changed, showing again');
        }
      }
      
      // Show KYA if not accepted, expired, or version changed
      showKYA = true;
      kyaAccepted = false;
    } catch (error) {
      console.error('Error checking KYA status:', error);
      // If there's an error, show KYA to be safe
      showKYA = true;
      kyaAccepted = false;
    }
  }

  function handleKYAAccept() {
    try {
      kyaAccepted = true;
      showKYA = false;
      
      // Store acceptance in localStorage
      localStorage.setItem('pulse-kya-accepted', 'true');
      localStorage.setItem('pulse-kya-timestamp', Date.now().toString());
      localStorage.setItem('pulse-kya-version', kyaVersion);
      
      console.log('KYA accepted by user');
      
      // Create a toast notification
      createToastMessage('✅ Terms accepted! Welcome to Pulse.', 'success');
      
      // If user was trying to connect wallet, allow them to proceed
      if (walletState.mnemonicInput && showMnemonicModal) {
        handleConnectWithMnemonic();
      }
      
    } catch (error) {
      console.error('Error saving KYA acceptance:', error);
      createToastMessage('❌ Error saving preferences. Please try again.', 'error');
    }
  }

  function handleKYADecline() {
    // Give user options when declining
    const message = 'You must accept the terms to use Pulse. Would you like to:\n\n' +
                   '• Review the terms again (OK)\n' +
                   '• Visit Ergo Platform website (Cancel)';
    
    if (confirm(message)) {
      // Keep the modal open for review
      return;
    }
    
    // Redirect to Ergo Platform
    window.location.href = 'https://ergoplatform.org/';
  }

  function handleKYAClose() {
    // Only allow closing if already accepted
    if (kyaAccepted) {
      showKYA = false;
    }
  }

  function showKYAModal() {
    showKYA = true;
  }
function getUnreadCount(roomId) {
  return getUnreadCountForRoom(roomId);
}

// Add helper function to check if room has unread messages
function roomHasUnread(roomId) {
  return hasUnreadMessages(roomId);
}
  // Helper function to create toast messages
  function createToastMessage(message, type = 'info') {
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
          }
          .toast.toast-success { background: #4CAF50; }
          .toast.toast-error { background: #f44336; }
          .toast.toast-info { background: #2196F3; }
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
async function handleFetchMessages() {
  if (!walletConnected || !kyaAccepted) return;

  try {
    loading = true;
    error = "";
    // Pass allRooms to support encrypted room handling
    const fetchedMessages = await fetchMessages(selectedChatroom, allRooms);
    messages = [...fetchedMessages];
    scrollToBottom(chatContainer, autoScroll);
  } catch (err) {
    error = err.message;
    createToastMessage(`❌ Error loading messages: ${err.message}`, 'error');
  } finally {
    loading = false;
  }
}

async function handleFetchMessagesQuietly() {
  if (!walletConnected || !kyaAccepted) return;

  try {
    // Pass allRooms to support encrypted room handling
    const newMessages = await fetchMessagesQuietly(selectedChatroom, allRooms);
    if (newMessages && shouldUpdateMessages(newMessages, messages)) {
      console.log('Updating messages in quiet fetch');
      messages = [...newMessages];
      scrollToBottom(chatContainer, autoScroll);
    }
  } catch (err) {
    console.warn('Quiet message fetch failed:', err);
  }
}

// Update the sendMessage function for external wallet
async function handleSendMessage() {
  if (!walletConnected || !kyaAccepted || !inputMessage.trim()) return;

  let messageContent = inputMessage.trim();
  let shouldEncrypt = false;
  
  if (messageContent.startsWith('/encrypt ')) {
    shouldEncrypt = true;
    messageContent = messageContent.substring(9);
  }

  const originalMessage = inputMessage;
  inputMessage = "";
  isTyping = false;

  try {
    loading = true;
    error = "";

    let optimisticMessage;

    if (walletState.usingMnemonicWallet) {
      optimisticMessage = await sendMessageWithMnemonic(
        messageContent, 
        shouldEncrypt, 
        selectedChatroom, 
        stealthMode, 
        walletState.transactionQueue,
        walletState.mnemonicWallet,
        allRooms
      );
    } else {
      optimisticMessage = await sendMessageWithExternalWallet(
        messageContent, 
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
    error = `Failed to send message: ${err.message}`;
    createToastMessage(`❌ Send error: ${err.message}`, 'error');
    inputMessage = originalMessage;
  } finally {
    loading = false;
  }
}


  async function handleConnectWithMnemonic() {
    // Check KYA first
    if (!kyaAccepted) {
      showKYA = true;
      createToastMessage('📋 Please accept the terms first', 'info');
      return;
    }

    if (!walletState.mnemonicInput.trim()) {
      error = "Please enter your mnemonic phrase";
      createToastMessage('❌ Please enter your mnemonic phrase', 'error');
      return;
    }

    try {
      loading = true;
      error = "";

      // Set up processor function
      const processor = (messageData) => processSingleMessage(messageData, walletState.mnemonicWallet);

      await connectWithMnemonic(walletState.mnemonicInput, walletState, processor);
      showMnemonicModal = false;
      walletState.mnemonicInput = "";

      createToastMessage('🔗 Wallet connected successfully!', 'success');

      await handleFetchMessages();
      messageRefresh.start(handleFetchMessagesQuietly);

    } catch (err) {
      error = err.message;
      createToastMessage(`❌ Connection failed: ${err.message}`, 'error');
    } finally {
      loading = false;
    }
  }

  async function handleDisconnectWallet() {
    try {
      stealthMode = await disconnectWallet(
        walletState,
        $selected_wallet_ergo,
        (val) => selected_wallet_ergo.set(val),
        (val) => connected_wallet_address.set(val),
        () => messageRefresh.stop()
      );
      messages = [];
      createToastMessage('👋 Wallet disconnected', 'info');
    } catch (err) {
      console.error('Disconnect error:', err);
      createToastMessage('❌ Disconnect failed', 'error');
    }
  }

  function handleStealthModeChange(event) {
    if (!kyaAccepted) {
      showKYA = true;
      return;
    }
    stealthMode = handleStealthModeChanged(event, messages, handleFetchMessages, walletConnected);
  }

  // ============= ROOM MANAGEMENT FUNCTIONS =============

function selectChatroom(roomId) {
  if (!kyaAccepted) {
    showKYA = true;
    return;
  }

  const oldRoom = selectedChatroom;
  selectedChatroom = roomId;
  messages = [];
  showRoomList = false;
  roomState = closeRoomModal(roomState);

  // Handle unread tracking
  if (unreadState.tracker) {
    handleRoomChange(roomId, oldRoom);
    // Update unread state immediately
    const newUnreadState = updateUnreadCounts(messages, selectedChatroom);
    unreadState = { ...unreadState, ...newUnreadState };
  }

  if (walletConnected) {
    handleFetchMessages();
  }
}

  function handleCreateRoom() {
    if (!kyaAccepted) {
      showKYA = true;
      return;
    }

    try {
      const { newRoom, updatedRooms } = addCustomRoom(roomState, allRooms);
      allRooms = updatedRooms;
      selectChatroom(newRoom.id);
      roomState = closeRoomModal(roomState);
      createToastMessage(`🏠 Room "${newRoom.name}" created!`, 'success');
    } catch (err) {
      error = err.message;
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }

// Update the private room creation handler
function handleCreatePrivateRoom() {
  if (!kyaAccepted) {
    showKYA = true;
    return;
  }

  try {
    const result = addPrivateRoom(roomState, allRooms);
    allRooms = result.updatedRooms;
    selectChatroom(result.newRoom.id);
    roomState = closeRoomModal(roomState);
    
    // Show invitation modal with the room code
    if (result.invitation) {
      createToastMessage(`🔒 Private room "${result.newRoom.name}" created! Code: ${result.invitation.code}`, 'success');
      
      // Optional: Automatically copy the code to clipboard
      navigator.clipboard.writeText(result.invitation.code).then(() => {
        createToastMessage(`📋 Room code ${result.invitation.code} copied to clipboard!`, 'info');
      });
    }
  } catch (err) {
    error = err.message;
    createToastMessage(`❌ ${err.message}`, 'error');
  }
}

function handleCopyRoomCode(roomId, event) {
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
// Add function to show full invitation
function handleShowInvitation(roomId, event) {
  if (event) event.stopPropagation();
  
  const room = allRooms.find(r => r.id === roomId);
  if (room && room.isPrivate && room.code) {
    try {
      const invitation = createRoomInvitationData(room);
      roomState = showInvitationModal(roomState, invitation);
    } catch (err) {
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }
}
  function handleJoinPrivateRoom() {
    if (!kyaAccepted) {
      showKYA = true;
      return;
    }

    try {
      const { newRoom, existingRoom, updatedRooms } = joinPrivateRoom(roomState.joinPrivateRoomCode, allRooms);
      allRooms = updatedRooms;
      selectChatroom((newRoom || existingRoom).id);
      roomState = closeRoomModal(roomState);
      createToastMessage(`🎯 Joined private room successfully!`, 'success');
    } catch (err) {
      error = err.message;
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }

  function handleRemoveRoom(roomId, event) {
    if (event) event.stopPropagation();
    try {
      allRooms = removeRoom(roomId, allRooms, selectedChatroom, selectChatroom);
      createToastMessage('🗑️ Room removed', 'info');
    } catch (err) {
      error = err.message;
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }

  function handleToggleRoomVisibility(roomId, event) {
    if (event) event.stopPropagation();
    try {
      hiddenRooms = toggleRoomVisibility(roomId, hiddenRooms, selectedChatroom, selectChatroom);
      const isHidden = hiddenRooms.includes(roomId);
      createToastMessage(`👁️ Room ${isHidden ? 'hidden' : 'shown'}`, 'info');
    } catch (err) {
      error = err.message;
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }

  function handleRenameRoom(roomId, event) {
    if (event) event.stopPropagation();
    try {
      allRooms = renameRoom(roomId, allRooms);
      createToastMessage('✏️ Room renamed', 'success');
    } catch (err) {
      error = err.message;
      createToastMessage(`❌ ${err.message}`, 'error');
    }
  }

function handleShowRoomInfo(room, event) {
  if (event) event.stopPropagation();
  
  if (room.isPrivate && room.code) {
    // For private rooms, show enhanced info with invitation option
    roomState = setModalRoom(roomState, {
      ...room,
      invitation: room.code ? createRoomInvitationData(room) : null
    });
  } else {
    roomState = setModalRoom(roomState, room);
  }
}

function showRoomInvitation(room) {
  if (!room.isPrivate) return;
  
  try {
    const invitation = createRoomInvitationData(room);
    roomState = showInvitationModal(roomState, invitation);
  } catch (err) {
    createToastMessage(`❌ ${err.message}`, 'error');
  }
}

function hideRoomInvitation() {
  roomState = hideInvitationModal(roomState);
}

  function handleCopyRoomLink(roomId, event) {
    if (event) event.stopPropagation();
    const room = allRooms.find(r => r.id === roomId);
    if (room) {
      copyRoomLink(roomId, room.name);
      createToastMessage('🔗 Room link copied!', 'success');
    }
  }

  function handleShareRoom(roomId, event) {
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


  // ============= EVENT HANDLERS =============
  const eventHandlers = createEventHandlers(handleSendMessage, handleConnectWithMnemonic);

  function handleKeyPress(event) {
    eventHandlers.handleKeyPress(event, showMnemonicModal);
  }

  function handleInputChange() {
    isTyping = inputMessage.trim().length > 0;
  }

  function handleScroll() {
    autoScroll = checkAutoScroll(chatContainer);
  }

  // ============= THEME FUNCTIONS =============
  function handleToggleTheme() {
    isDarkMode = toggleTheme(isDarkMode);
  }

  function handleToggleAnimations() {
    isAnimationsEnabled = toggleAnimations(isAnimationsEnabled);
  }

  function handleToggleCompactMode() {
    compactMode = toggleCompactMode(compactMode);
  }

  // ============= MODAL FUNCTIONS =============
  function openMnemonicModal() {
    if (!kyaAccepted) {
      showKYA = true;
      return;
    }
    showMnemonicModal = true;
    walletState.mnemonicInput = "";
    error = "";
  }

  function closeMnemonicModal() {
    showMnemonicModal = false;
    walletState.mnemonicInput = "";
    error = "";
  }

  function openRoomManagementModal(mode) {
    if (!kyaAccepted) {
      showKYA = true;
      return;
    }
    roomState = openRoomModal(roomState, mode);
  }

  function closeRoomManagementModal() {
    roomState = closeRoomModal(roomState);
  }

onMount(async () => {
  console.log('Landing component mounted');
  
  wallet_init.set(true);

  // Check KYA status first
  checkKYAStatus();

  // Initialize unread tracking
  unreadState = initializeUnreadTracking(selectedChatroom);

  // Load room management data
  hiddenRooms = loadHiddenRoomsFromStorage();

  // Load existing stealth address
  stealthMode = await loadExistingStealthAddress();

  // Room discovery
  try {
    console.log('🔍 Starting room discovery...');
    roomState.isDiscovering = true;
    
    const discoveredRooms = await updateDiscoveredRooms(roomState, true);
    roomState = discoveredRooms;
    
    console.log('✅ Room discovery completed:', roomState.discoveredRooms.length, 'rooms found');
  } catch (error) {
    console.error('❌ Room discovery failed:', error);
    roomState.isDiscovering = false;
  }

  // Initialize wallet connection if KYA accepted
  if (kyaAccepted && $connected_wallet_address && $selected_wallet_ergo) {
    console.log('KYA accepted, initializing wallet connection');
    await handleFetchMessages();
    messageRefresh.start(handleFetchMessagesQuietly);
  } else {
    console.log('KYA not accepted or wallet not connected');
  }

  // Click outside handler (existing code)
  const handleClickOutside = (event) => {
    // ... existing click outside logic
  };

  document.addEventListener('click', handleClickOutside);

  return () => {
    messageRefresh.stop();
    document.removeEventListener('click', handleClickOutside);
  };
});

// ===== ADD ROOM REFRESH FUNCTION =====
async function refreshRoomDiscovery() {
  try {
    console.log('🔄 Refreshing room discovery...');
    roomState.isDiscovering = true;
    
    const updatedRoomState = await updateDiscoveredRooms(roomState, true);
    roomState = updatedRoomState;
    
    createToastMessage(`🏠 Found ${roomState.discoveredRooms.length} rooms from blockchain`, 'success');
  } catch (error) {
    console.error('Room refresh failed:', error);
    createToastMessage('❌ Failed to refresh rooms', 'error');
    roomState.isDiscovering = false;
  }
}

// ===== ADD DEBUG FUNCTION FOR DEVELOPMENT =====
function debugRoomSystem() {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log('🔧 Room Debug Info:');
    console.log('Room State:', roomState);
    console.log('All Rooms:', allRooms);
    console.log('Visible Rooms:', visibleRooms);
    console.log('Room Categories:', roomCategories);
    console.log('Hidden Rooms:', hiddenRooms);
    
    // Test room discovery
    if (window.debugRoomDiscovery) {
      window.debugRoomDiscovery();
    }
  }
}

// Expose debug function in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  window.debugRoomSystem = debugRoomSystem;
  window.refreshRoomDiscovery = refreshRoomDiscovery;
  console.log('🔧 Room debug functions available:');
  console.log('- window.debugRoomSystem()');
  console.log('- window.refreshRoomDiscovery()');
}

  onDestroy(() => {
    messageRefresh.stop();
  });

  // ============= DEBUG FUNCTIONS (Development only) =============
  function resetKYA() {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      localStorage.removeItem('pulse-kya-accepted');
      localStorage.removeItem('pulse-kya-timestamp');
      localStorage.removeItem('pulse-kya-version');
      kyaAccepted = false;
      showKYA = true;
      console.log('KYA reset for development');
    }
  }

  // Expose reset function for development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.resetKYA = resetKYA;
  }
</script>

<!-- Complete HTML Template with Room Management -->
<div class="ergochat {themeClass} {compactMode ? 'compact' : ''} {isAnimationsEnabled ? 'animations-enabled' : ''}">
  
  <!-- Mnemonic Import Modal -->
  {#if showMnemonicModal}
    <div class="modal-overlay" on:click={closeMnemonicModal}>
      <div class="modal-container" on:click|stopPropagation>
        <div class="modal-header">
          <h2>🔑 Import Wallet</h2>
          <p>Enter your seed phrase to connect</p>
          <button class="close-btn" on:click={closeMnemonicModal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="modal-content">
          <div class="input-group">
            <label for="mnemonic">Mnemonic Phrase</label>
            <textarea
              id="mnemonic"
              bind:value={walletState.mnemonicInput}
              placeholder="Enter your 12, 15, or 24 word seed phrase..."
              on:keydown={handleKeyPress}
              disabled={loading}
              rows="4"
              class="mnemonic-input"
            ></textarea>
          </div>
          
          <div class="modal-actions">
            <button 
              class="btn btn-primary" 
              on:click={handleConnectWithMnemonic} 
              disabled={!walletState.mnemonicInput.trim() || loading}
            >
              {#if loading}
                <div class="spinner"></div>
                Connecting...
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Import Wallet
              {/if}
            </button>
          </div>
          
          {#if error}
            <div class="error-message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              {error}
            </div>
          {/if}
          
          <div class="security-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <strong>Demo Only:</strong> Use test wallets only. Never enter your main wallet's seed phrase on websites.
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Room Management Modal -->
  {#if roomState.showRoomModal}
    <div class="modal-backdrop" on:click|self={closeRoomManagementModal} transition:fade={{ duration: 150 }}>
      <div class="room-modal" transition:slide={{ duration: 200, y: -20 }}>
        <!-- Modal Header -->
        <div class="modal-header">
          <h3>
            {#if roomState.modalMode === 'list'}
              Room Management
            {:else if roomState.modalMode === 'create'}
              Create Public Room
            {:else if roomState.modalMode === 'join'}
              Join Private Room
            {:else if roomState.modalMode === 'private'}
              Create Private Room
            {:else if roomState.modalMode === 'manage'}
              Manage Rooms
            {:else if roomState.modalMode === 'info'}
              Room Information
            {/if}
          </h3>
          <button class="close-btn" on:click={closeRoomManagementModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          {#if roomState.modalMode === 'list'}
            <div class="modal-actions">
              <button class="modal-action-btn" on:click={() => roomState.modalMode = 'create'}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Public Room
              </button>
              <button class="modal-action-btn" on:click={() => roomState.modalMode = 'private'}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Create Private Room
              </button>
              <button class="modal-action-btn" on:click={() => roomState.modalMode = 'join'}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10,17 15,12 10,7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                Join Private Room
              </button>
              <button class="modal-action-btn" on:click={() => roomState.modalMode = 'manage'}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Manage Rooms
              </button>
            </div>

          {:else if roomState.modalMode === 'create'}
            <div class="modal-form">
              <div class="form-group">
                <label for="room-name">Room Name</label>
                <input 
                  type="text" 
                  id="room-name"
                  bind:value={roomState.newRoomName} 
                  placeholder="Enter room name" 
                  class="room-input"
                />
              </div>
              <div class="form-group">
                <label for="room-desc">Description (Optional)</label>
                <input 
                  type="text" 
                  id="room-desc"
                  bind:value={roomState.newRoomDescription} 
                  placeholder="Enter room description" 
                  class="room-input"
                />
              </div>
              <div class="form-actions">
                <button class="cancel-btn" on:click={() => roomState.modalMode = 'list'}>Back</button>
                <button 
                  class="confirm-btn" 
                  on:click={handleCreateRoom} 
                  disabled={!roomState.newRoomName.trim()}
                >
                  Create Room
                </button>
              </div>
            </div>

          {:else if roomState.modalMode === 'private'}
            <div class="modal-form">
              <div class="form-group">
                <label for="private-name">Room Name</label>
                <input 
                  type="text" 
                  id="private-name"
                  bind:value={roomState.newRoomName} 
                  placeholder="Enter room name" 
                  class="room-input"
                />
              </div>
              <div class="form-group">
                <label for="private-code">10-digit Code (Optional)</label>
                <input 
                  type="text" 
                  id="private-code"
                  bind:value={roomState.privateRoomCode} 
                  placeholder="Auto-generated if empty" 
                  class="room-input"
                  maxlength="10"
                  pattern="\d{10}"
                />
                <small class="form-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                  </svg>
                  Share this code with others to let them join your private room
                </small>
              </div>
              <div class="form-actions">
                <button class="cancel-btn" on:click={() => roomState.modalMode = 'list'}>Back</button>
                <button 
                  class="confirm-btn" 
                  on:click={handleCreatePrivateRoom} 
                  disabled={!roomState.newRoomName.trim()}
                >
                  Create Private Room
                </button>
              </div>
            </div>

          {:else if roomState.modalMode === 'join'}
            <div class="modal-form">
              <div class="form-group">
                <label for="join-code">Private Room Code</label>
                <input 
                  type="text" 
                  id="join-code"
                  bind:value={roomState.joinPrivateRoomCode} 
                  placeholder="Enter 10-digit room code" 
                  class="room-input"
                  maxlength="10"
                  pattern="\d{10}"
                />
                <small class="form-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                  </svg>
                  Enter the 10-digit code shared by the room creator
                </small>
              </div>
              <div class="form-actions">
                <button class="cancel-btn" on:click={() => roomState.modalMode = 'list'}>Back</button>
                <button 
                  class="confirm-btn" 
                  on:click={handleJoinPrivateRoom} 
                  disabled={!roomState.joinPrivateRoomCode.trim() || roomState.joinPrivateRoomCode.length !== 10 || !/^\d+$/.test(roomState.joinPrivateRoomCode)}
                >
                  Join Room
                </button>
              </div>
            </div>

          {:else if roomState.modalMode === 'manage'}
  <div class="manage-rooms">
    <div class="manage-actions">
      <!-- Add room refresh button -->
      <button 
        class="manage-btn refresh-btn {roomState.isDiscovering ? 'loading' : ''}" 
        on:click={refreshRoomDiscovery}
        disabled={roomState.isDiscovering}
        title="Refresh rooms from blockchain"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={roomState.isDiscovering ? 'spinning' : ''}>
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
        </svg>
        {roomState.isDiscovering ? 'Discovering...' : 'Refresh Rooms'}
      </button>
      
      <button 
        class="manage-btn toggle-btn {roomState.showHiddenRooms ? 'active' : ''}" 
        on:click={() => roomState.showHiddenRooms = !roomState.showHiddenRooms}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        {roomState.showHiddenRooms ? 'Hide Hidden Rooms' : 'Show Hidden Rooms'}
      </button>
    </div>
    
    <!-- Show discovery status -->
    {#if roomState.isDiscovering}
      <div class="discovery-status">
        <div class="spinner small"></div>
        <span>Discovering rooms from blockchain...</span>
      </div>
    {/if}
    
    <div class="room-stats">
      {#each Object.entries(getRoomStats(allRooms, hiddenRooms)) as [key, value]}
        <div class="stat-row">
          <span class="stat-label">{key.charAt(0).toUpperCase() + key.slice(1)} Rooms:</span>
          <span class="stat-value">{value}</span>
        </div>
      {/each}
      
      <!-- Show last discovery time -->
      {#if roomState.lastDiscoveryUpdate > 0}
        <div class="stat-row">
          <span class="stat-label">Last Discovery:</span>
          <span class="stat-value">{new Date(roomState.lastDiscoveryUpdate).toLocaleTimeString()}</span>
        </div>
      {/if}
    </div>
    
    <div class="form-actions">
      <button class="cancel-btn" on:click={() => roomState.modalMode = 'list'}>Back</button>
    </div>
  </div>
{/if}
        </div>
      </div>
    </div>
  {/if}
{#if roomState.modalMode === 'info' && roomState.currentModalRoom}
  <div class="room-info-display">
    <h4>{roomState.currentModalRoom.name}</h4>
    <p>{roomState.currentModalRoom.description}</p>
    
    <div class="room-metadata">
      <div class="metadata-row">
        <span class="metadata-label">Type:</span>
        <span class="metadata-value">
          {#if roomState.currentModalRoom.isPrivate}
            🔒 Private Room
            {#if roomState.currentModalRoom.isEncrypted}
              <span class="encryption-badge">🔐 Encrypted</span>
            {/if}
          {:else if roomState.currentModalRoom.isDiscovered}
            🌎 Discovered Room
          {:else}
            📁 Custom Room
          {/if}
        </span>
      </div>
      
      {#if roomState.currentModalRoom.code}
        <div class="metadata-row">
          <span class="metadata-label">Code:</span>
          <span class="metadata-value">{roomState.currentModalRoom.code}</span>
          <button 
            class="metadata-action" 
            on:click={() => showRoomInvitation(roomState.currentModalRoom)}
          >
            Share
          </button>
        </div>
      {/if}
      
      {#if roomState.currentModalRoom.messageCount}
        <div class="metadata-row">
          <span class="metadata-label">Messages:</span>
          <span class="metadata-value">{roomState.currentModalRoom.messageCount}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
  <!-- Main Chat Interface -->
  <header class="chat-header">
    <div class="header-left">
      <div class="logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <div>
          <h1>Pulse</h1>
          <span class="subtitle">Decentralized Messaging</span>
        </div>
      </div>
      
      <!-- Compact Room Selector -->
      <div class="chatroom-selector">
        <div class="current-room" on:click|stopPropagation={() => showRoomList = !showRoomList}>
          <span class="room-indicator">{currentRoom?.isPrivate ? '🔒' : '#'}</span>
          <span class="room-name">{currentRoom?.name || 'General'}</span>
          <div class="room-actions">
            <button class="room-btn" on:click|stopPropagation={() => openRoomManagementModal('create')} title="Create Public Room">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="room-btn" on:click|stopPropagation={() => openRoomManagementModal('private')} title="Create Private Room">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <circle cx="12" cy="16" r="1"></circle>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
            <button class="room-btn" on:click|stopPropagation={() => openRoomManagementModal('join')} title="Join Private Room">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10,17 15,12 10,7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
            </button>
            <button class="room-btn" on:click|stopPropagation={() => openRoomManagementModal('manage')} title="Manage Rooms">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button class="toggle-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                {#if showRoomList}
                  <polyline points="18,15 12,9 6,15"></polyline>
                {:else}
                  <polyline points="6,9 12,15 18,9"></polyline>
                {/if}
              </svg>
            </button>
          </div>
        </div>


{#if showRoomList}
  <div class="room-dropdown" transition:slide={{ duration: 150 }}>
    <div class="compact-room-list">
      {#each roomCategories as category}
        <div class="room-category">
          <div class="category-header">{category.name}</div>
          {#each category.rooms as room}
            <div 
              class="room-item {room.id === selectedChatroom ? 'active' : ''} {roomHasUnread(room.id) ? 'has-unread' : ''}" 
              on:click={() => selectChatroom(room.id)}
            >
              <div class="room-item-content">
                <span class="room-indicator">
                  {#if room.isPrivate}
                    🔒
                    {#if room.isEncrypted}
                      <span class="encryption-badge">🔐</span>
                    {/if}
                  {:else if room.isDiscovered}
                    🌎
                  {:else}
                    #
                  {/if}
                </span>
                <span class="room-item-name">{room.name}</span>
                {#if room.isPrivate && room.code}
                  <span class="room-code-display">({room.code})</span>
                {/if}
                
                <!-- UNREAD MESSAGE BADGE -->
                {#if getUnreadCount(room.id) > 0 && room.id !== selectedChatroom}
                  <span class="{getUnreadBadgeClass(getUnreadCount(room.id))}">
                    {formatUnreadCount(getUnreadCount(room.id))}
                  </span>
                {/if}
              </div>
              
              <div class="room-item-actions">
                <!-- Copy Room Code Button - Most Important for Private Rooms -->
                {#if room.isPrivate && room.code}
                  <button 
                    class="action-btn primary-action" 
                    on:click|stopPropagation={(e) => handleCopyRoomCode(room.id, e)}
                    title="Copy 10-digit room code"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                {/if}
                
                <!-- Room Info Button -->
                <button 
                  class="action-btn" 
                  on:click|stopPropagation={(e) => handleShowRoomInfo(room, e)}
                  title="Room info"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9,9h6v6H9V9z M12,17h.01"></path>
                  </svg>
                </button>
                
                <!-- Copy Room Link Button -->
                <button 
                  class="action-btn" 
                  on:click|stopPropagation={(e) => handleCopyRoomLink(room.id, e)}
                  title="Copy room link"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </button>
                
                <!-- Share Room Button -->
                <button 
                  class="action-btn" 
                  on:click|stopPropagation={(e) => handleShareRoom(room.id, e)}
                  title="Share room"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </button>
                
                <!-- Show Full Invitation Button (for private rooms) -->
                {#if room.isPrivate && room.code}
                  <button 
                    class="action-btn" 
                    on:click|stopPropagation={(e) => handleShowInvitation(room.id, e)}
                    title="Show full invitation"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7,10 12,15 17,10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                {/if}
                
                <!-- Rename Room Button (for custom rooms only) -->
                {#if !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && !room.isDiscovered}
                  <button 
                    class="action-btn" 
                    on:click|stopPropagation={(e) => handleRenameRoom(room.id, e)}
                    title="Rename room"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                  </button>
                {/if}
                
                <!-- Hide/Show Room Button -->
                {#if room.id !== 'general'}
                  <button 
                    class="action-btn" 
                    on:click|stopPropagation={(e) => handleToggleRoomVisibility(room.id, e)}
                    title={hiddenRooms.includes(room.id) ? "Unhide room" : "Hide room"}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      {#if hiddenRooms.includes(room.id)}
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      {:else}
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      {/if}
                    </svg>
                  </button>
                {/if}
                
                <!-- Remove Room Button (for custom rooms only) -->
                {#if !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && !room.isDiscovered}
                  <button 
                    class="action-btn danger" 
                    on:click|stopPropagation={(e) => handleRemoveRoom(room.id, e)}
                    title="Remove room"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}

      </div>
    </div>
    
    <div class="header-right">
      <div class="header-controls">
        <!-- Stealth Address UI -->
        {#if walletConnected}
          <StealthAddressUI 
            {walletConnected} 
            currentAddress={currentWalletAddress}
            on:stealthModeChanged={handleStealthModeChange}
          />
        {/if}

        <!-- Theme Toggle -->
        <button class="control-btn" on:click={handleToggleTheme} title="Toggle theme">
          {#if isDarkMode}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          {/if}
        </button>

        <!-- Compact Mode Toggle -->
        <button class="control-btn" on:click={handleToggleCompactMode} title="Toggle compact mode">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
      
      {#if walletConnected}
        <div class="wallet-status connected">
          <div class="wallet-info">
            <div class="wallet-avatar">
              {#if walletState.usingMnemonicWallet}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                  <line x1="8" y1="7" x2="16" y2="7"/>
                </svg>
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 11.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                </svg>
              {/if}
            </div>
            <div class="wallet-details">
              <span class="wallet-address">{truncateAddress(currentWalletAddress)}</span>
              <span class="wallet-type">
                {#if stealthMode.active}
                  <span class="stealth-indicator">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
                      <path d="M12 1v6"/>
                      <path d="M12 19v4"/>
                      <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Anonymous as {stealthMode.displayName}
                  </span>
                {:else}
                  {walletState.usingMnemonicWallet ? 'Imported' : 'Extension'}
                {/if}
              </span>
            </div>
          </div>
          <button class="btn btn-outline" on:click={handleDisconnectWallet}>
            Disconnect
          </button>
        </div>
    
      {/if}
    </div>
  </header>
{#if roomState.showInviteModal && roomState.currentInvitation}
  <div class="modal-backdrop" on:click|self={hideRoomInvitation} transition:fade={{ duration: 150 }}>
    <div class="room-invitation-modal" transition:slide={{ duration: 200, y: -20 }}>
      <div class="modal-header">
        <h3>🔒 Private Room Invitation</h3>
        <button class="close-btn" on:click={hideRoomInvitation}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="invitation-details">
          <div class="room-info">
            <h4>{roomState.currentInvitation.name}</h4>
            <p>Share this code with others to invite them to your private room.</p>
          </div>
          
          <div class="room-code-display">
            <label>Room Code:</label>
            <div class="code-container">
              <span class="room-code">{roomState.currentInvitation.code}</span>
              <button 
                class="copy-code-btn" 
                on:click={() => {
                  navigator.clipboard.writeText(roomState.currentInvitation.code);
                  createToastMessage('📋 Code copied!', 'success');
                }}
                title="Copy room code"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="share-options">
            <button 
              class="share-btn primary" 
              on:click={() => {
                navigator.clipboard.writeText(roomState.currentInvitation.shareText);
                createToastMessage('📋 Full invitation copied!', 'success');
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy Full Invitation
            </button>
            
            {#if navigator.share}
              <button 
                class="share-btn" 
                on:click={() => {
                  navigator.share({
                    title: `Join "${roomState.currentInvitation.name}" on Pulse`,
                    text: roomState.currentInvitation.shareText,
                    url: roomState.currentInvitation.url
                  });
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Share Invitation
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
  <!-- Error Bar -->
  {#if error}
    <div class="error-bar">
      <div class="error-content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>{error}</span>
      </div>
      <button class="error-close" on:click={() => { error = ""; }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Main Chat Area -->
  <main class="chat-main">
    <!-- Messages Container -->
    <div class="messages-container" bind:this={chatContainer} on:scroll={handleScroll}>
      {#if loading && messages.length === 0}
        <!-- Loading State -->
        <div class="state-container">
          <div class="loading-state">
            <div class="spinner large"></div>
            <h3>Loading messages...</h3>
            <p>Please wait while we fetch the latest messages...</p>
          </div>
        </div>
      {:else if messages.length === 0}
        <!-- Empty State -->
        <div class="state-container">
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>Welcome to Pulse</h3>
            <p>
              {#if !walletConnected}
                Connect your wallet or import a seed phrase to start chatting with the Ergo community!
              {:else}
                Be the first to send a message in #{selectedChatroom}!
              {/if}
            </p>
            
            {#if !walletConnected}
              <div class="empty-actions">
                <WalletButton />
                <span class="divider">or</span>
                <button class="btn btn-primary" on:click={openMnemonicModal}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                    <line x1="8" y1="7" x2="16" y2="7"/>
                  </svg>
                  Import Wallet
                </button>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- Messages List -->
        <div class="messages-list">
          {#each messages as message, index (message.id)}
           <div class="message {message.pending ? 'pending' : ''} {message.isMempool ? 'mempool' : ''} {compactMode ? 'compact' : ''} {message.sender === (stealthMode.active ? stealthMode.displayName : (walletState.usingMnemonicWallet ? truncateAddress(walletState.mnemonicWallet?.getAddressSync() || '') : truncateAddress($connected_wallet_address || ''))) ? 'own-message' : ''}">
              <!-- Message Avatar -->
              <div class="message-avatar">
                <div class="avatar {message.sender === (stealthMode.active ? stealthMode.displayName : (walletState.usingMnemonicWallet ? truncateAddress(walletState.mnemonicWallet?.getAddressSync() || '') : truncateAddress($connected_wallet_address || ''))) ? 'own-avatar' : ''}">
                  {#if message.sender.includes('stealth') || message.sender.match(/^(Silent|Hidden|Shadow|Ghost|Phantom|Invisible|Secret|Anonymous|Stealth|Masked)/)}
                    <!-- Stealth/Anonymous Avatar -->
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
                      <path d="M12 1v6"/>
                      <path d="M12 19v4"/>
                      <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  {:else}
                    <!-- Regular Avatar with First Letter -->
                    {message.sender.charAt(0).toUpperCase()}
                  {/if}
                </div>
                {#if message.pending}
                  <div class="pending-indicator">
                    <div class="pulse"></div>
                  </div>
                {/if}
              </div>
              
              <!-- Message Content -->
              <div class="message-content">
                <div class="message-header">
                  <span class="sender {message.sender.includes('stealth') || message.sender.match(/^(Silent|Hidden|Shadow|Ghost|Phantom|Invisible|Secret|Anonymous|Stealth|Masked)/) ? 'stealth-sender' : ''}">{message.sender}</span>
                  <span class="timestamp">{formatTime(message.timestamp)}</span>
                  {#if message.pending}
                    <span class="status pending">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12,6 12,12 16,14"></polyline>
                      </svg>
                      Pending...
                    </span>
                  {:else}
                    <span class="status sent">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20,6 9,17 4,12"></polyline>
                      </svg>
                    </span>
                  {/if}
                </div>
                
                <div class="message-body">
                  {message.content}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  <KYA 
    isVisible={showKYA}
    {isDarkMode}
    on:accept={handleKYAAccept}
    on:decline={handleKYADecline}
    on:close={handleKYAClose}
  />
    <!-- Input Area -->
    <div class="input-area">
      {#if walletConnected}
        <!-- Connected - Show Input -->
        <div class="input-help">
          <div class="help-content">
            <span class="help-text">
              💡 Use <code>/encrypt</code> for encrypted messages
              {#if stealthMode.active}
                | 🎭 Anonymous mode: <strong>{stealthMode.displayName}</strong>
              {/if}
            </span>
            {#if walletState.usingMnemonicWallet && walletState.transactionQueue.length > 0}
              <span class="queue-status">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6"></path>
                </svg>
                Queue: {walletState.transactionQueue.length}
              </span>
            {/if}
          </div>
        </div>
        
        <div class="input-container">
          <div class="input-wrapper">
            <textarea
              bind:value={inputMessage}
              placeholder={stealthMode.active ? `Anonymous message as ${stealthMode.displayName}...` : "Type your message... (use /encrypt for encryption)"}
              on:keydown={handleKeyPress}
              on:input={handleInputChange}
              disabled={loading}
              rows="1"
              class="message-input"
              style="resize: none; overflow: hidden;"
            ></textarea>
            
            <button 
              class="send-btn {isTyping ? 'typing' : ''}"
              on:click={handleSendMessage}
              disabled={!inputMessage.trim() || loading}
            >
              {#if loading}
                <div class="spinner small"></div>
                Sending...
              {:else if isTyping}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                </svg>
                Send
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                </svg>
                Send
              {/if}
            </button>
          </div>
        </div>
     
       
      {/if}
    </div>
  </main>
</div>
<style>
/* ============= ROOM DROPDOWN STYLING - WIDE VERSION ============= */
/* Add this to your Landing.svelte <style> section */

/* Chatroom selector container */
.chatroom-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 300px; /* Ensure minimum width */
}

/* Current room display */
.current-room {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface-color, #262626);
  border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
  user-select: none;
}

.current-room:hover {
  background: var(--background-color, #1a1a1a);
  border-color: var(--primary-color, #FF5500);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.current-room .room-indicator {
  font-size: 16px;
  flex-shrink: 0;
}

.current-room .room-name {
  font-weight: 600;
  color: var(--text-color, #ffffff);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Room actions in header */
.room-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.room-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
  border-radius: 8px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  cursor: pointer;
  transition: all 0.2s ease;
}

.room-btn:hover {
  background: var(--primary-color, #FF5500);
  color: white;
  border-color: var(--primary-color, #FF5500);
  transform: scale(1.05);
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
  border-radius: 8px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 8px;
}

.toggle-btn:hover {
  background: var(--background-color, #1a1a1a);
  color: var(--text-color, #ffffff);
  border-color: var(--primary-color, #FF5500);
}

/* Main dropdown container - WIDE VERSION */
.room-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: -200px; /* Extend beyond the container */
  min-width: 600px; /* Much wider dropdown */
  max-width: 800px; /* Maximum width */
  width: max-content; /* Adjust to content */
  background: var(--surface-color, #262626);
  border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
  border-radius: 16px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  z-index: 1000;
  max-height: 500px;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

/* Dropdown content container */
.compact-room-list {
  padding: 16px;
  max-height: 450px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--primary-color, #FF5500) transparent;
}

.compact-room-list::-webkit-scrollbar {
  width: 6px;
}

.compact-room-list::-webkit-scrollbar-track {
  background: transparent;
}

.compact-room-list::-webkit-scrollbar-thumb {
  background: var(--primary-color, #FF5500);
  border-radius: 3px;
}

/* Room category styling */
.room-category {
  margin-bottom: 20px;
}

.room-category:last-child {
  margin-bottom: 0;
}

.category-header {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  padding: 8px 16px;
  background: var(--background-color, #1a1a1a);
  border-radius: 8px;
  border-left: 3px solid var(--primary-color, #FF5500);
  position: sticky;
  top: 0;
  z-index: 10;
}

/* Individual room item - ENHANCED FOR WIDTH */
.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 4px;
  min-height: 48px;
  border: 1px solid transparent;
  position: relative;
  overflow: hidden;
}

.room-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 85, 0, 0.1), transparent);
  transition: left 0.5s ease;
}

.room-item:hover::before {
  left: 100%;
}

.room-item:hover {
  background: var(--background-color, #1a1a1a);
  border-color: var(--primary-color, #FF5500);
  transform: translateX(4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.room-item.active {
  background: linear-gradient(135deg, var(--primary-color, #FF5500) 0%, #ff7733 100%);
  color: white;
  border-color: var(--primary-color, #FF5500);
  box-shadow: 0 4px 16px rgba(255, 85, 0, 0.3);
}

.room-item.active .room-item-name,
.room-item.active .room-code-display {
  color: white;
}

/* Room item content - ENHANCED LAYOUT */
.room-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  margin-right: 16px;
}

.room-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 16px;
  flex-shrink: 0;
  width: 24px;
  justify-content: center;
}

.room-item-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-color, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 120px; /* Ensure minimum width for readability */
  flex: 1;
}

.room-code-display {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  background: var(--background-color, #1a1a1a);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color, rgba(255, 85, 0, 0.1));
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.room-item.active .room-code-display {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.9);
}

/* Room item actions - ENHANCED FOR WIDTH */
.room-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s ease;
  flex-shrink: 0;
  margin-left: auto;
}

.room-item:hover .room-item-actions {
  opacity: 1;
  transform: translateX(0);
}

.room-item.active .room-item-actions {
  opacity: 0.7;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.action-btn:hover {
  background: var(--background-color, #1a1a1a);
  color: var(--text-color, #ffffff);
  border-color: var(--primary-color, #FF5500);
  transform: scale(1.1);
}

.action-btn.primary-action {
  background: var(--primary-color, #FF5500);
  color: white;
  border-color: var(--primary-color, #FF5500);
}

.action-btn.primary-action:hover {
  background: #ff7733;
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(255, 85, 0, 0.4);
}

.action-btn.danger:hover {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

/* Encryption badge in dropdown */
.encryption-badge {
  background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 4px;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

/* Room with unread messages styling */
.room-item.has-unread {
  background: rgba(255, 68, 68, 0.08);
  border-left: 4px solid #ff4444;
  padding-left: 12px;
}

.room-item.has-unread:hover {
  background: rgba(255, 68, 68, 0.15);
}

.room-item.has-unread .room-item-name {
  font-weight: 700;
  color: var(--text-color, #ffffff);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .room-dropdown {
    right: -100px;
    min-width: 500px;
    max-width: 600px;
  }
}

@media (max-width: 768px) {
  .room-dropdown {
    right: 0;
    left: 0;
    min-width: auto;
    max-width: none;
    width: 100%;
  }
  
  .room-item-content {
    margin-right: 8px;
  }
  
  .room-item-actions {
    gap: 4px;
  }
  
  .action-btn {
    width: 24px;
    height: 24px;
  }
  
  .room-item-name {
    min-width: 80px;
  }
}

@media (max-width: 600px) {
  .chatroom-selector {
    min-width: auto;
    flex: 1;
  }
  
  .current-room {
    min-width: auto;
    flex: 1;
  }
  
  .room-dropdown {
    max-height: 400px;
  }
  
  .compact-room-list {
    max-height: 350px;
    padding: 12px;
  }
}

/* Dark theme enhancements */
.dark-theme .room-dropdown {
  background: #1a1a1a;
  border-color: rgba(255, 85, 0, 0.3);
}

.dark-theme .category-header {
  background: #0d0d0d;
}

.dark-theme .room-item:hover {
  background: #262626;
}

.dark-theme .room-code-display {
  background: #0d0d0d;
}

.dark-theme .action-btn:hover {
  background: #333333;
}

/* Light theme */
.light-theme .room-dropdown {
  background: #ffffff;
  border-color: rgba(255, 85, 0, 0.2);
}

.light-theme .category-header {
  background: #f8f9fa;
  color: #666666;
}

.light-theme .room-item {
  color: #333333;
}

.light-theme .room-item:hover {
  background: #f8f9fa;
}

.light-theme .room-item-name {
  color: #333333;
}

.light-theme .room-code-display {
  background: #f8f9fa;
  color: #666666;
}

.light-theme .action-btn {
  color: #666666;
}

.light-theme .action-btn:hover {
  background: #e9ecef;
  color: #333333;
}

/* Animation enhancements */
@keyframes dropdownSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.room-dropdown {
  animation: dropdownSlideIn 0.3s ease-out;
}

/* Room item staggered animation */
@keyframes roomItemFadeIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.room-item {
  animation: roomItemFadeIn 0.3s ease-out;
  animation-fill-mode: both;
}

.room-item:nth-child(1) { animation-delay: 0.05s; }
.room-item:nth-child(2) { animation-delay: 0.1s; }
.room-item:nth-child(3) { animation-delay: 0.15s; }
.room-item:nth-child(4) { animation-delay: 0.2s; }
.room-item:nth-child(5) { animation-delay: 0.25s; }

/* Focus states for accessibility */
.room-item:focus,
.action-btn:focus {
  outline: 2px solid var(--primary-color, #FF5500);
  outline-offset: 2px;
}

/* Loading state for room discovery */
.room-dropdown.loading .compact-room-list::after {
  content: 'Discovering rooms...';
  display: block;
  text-align: center;
  padding: 20px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-style: italic;
}
</style>