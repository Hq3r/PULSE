
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
    loadHiddenRoomsFromStorage
  } from '$lib/utils/roomUtils.js';

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
      const fetchedMessages = await fetchMessages(selectedChatroom);
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
      const newMessages = await fetchMessagesQuietly(selectedChatroom);
      if (newMessages && shouldUpdateMessages(newMessages, messages)) {
        console.log('Updating messages in quiet fetch');
        messages = [...newMessages];
        scrollToBottom(chatContainer, autoScroll);
      }
    } catch (err) {
      console.warn('Quiet message fetch failed:', err);
    }
  }

  async function handleSendMessage() {
    if (!walletConnected || !kyaAccepted || !inputMessage.trim()) return;

    let messageContent = inputMessage.trim();
    let shouldEncrypt = false;
    
    // Check for encryption command
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

      if (walletState.usingMnemonicWallet) {
        await sendMessageWithMnemonic(
          messageContent, 
          shouldEncrypt, 
          selectedChatroom, 
          stealthMode, 
          walletState.transactionQueue,
          walletState.mnemonicWallet
        );
      } else {
        await sendMessageWithExternalWallet(
          messageContent, 
          shouldEncrypt, 
          selectedChatroom, 
          stealthMode, 
          $selected_wallet_ergo, 
          $connected_wallet_address
        );
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

    selectedChatroom = roomId;
    messages = [];
    showRoomList = false;
    roomState = closeRoomModal(roomState);

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

  function handleCreatePrivateRoom() {
    if (!kyaAccepted) {
      showKYA = true;
      return;
    }

    try {
      const { newRoom, updatedRooms } = addPrivateRoom(roomState, allRooms);
      allRooms = updatedRooms;
      selectChatroom(newRoom.id);
      roomState = closeRoomModal(roomState);
      createToastMessage(`🔒 Private room "${newRoom.name}" created!`, 'success');
    } catch (err) {
      error = err.message;
      createToastMessage(`❌ ${err.message}`, 'error');
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
    roomState = setModalRoom(roomState, room);
  }

  function handleCopyRoomCode(roomId, event) {
    if (event) event.stopPropagation();
    copyRoomCode(roomId);
    createToastMessage('📋 Room code copied!', 'success');
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
      shareRoom(roomId, room.name, room.description);
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

  // ============= LIFECYCLE =============
  onMount(async () => {
    console.log('Landing component mounted');
    
    wallet_init.set(true);

    // Check KYA status first - this is critical
    checkKYAStatus();

    // Load room management data
    hiddenRooms = loadHiddenRoomsFromStorage();

    // Load existing stealth address
    stealthMode = await loadExistingStealthAddress();

    // Only proceed with wallet connection if KYA is accepted
    if (kyaAccepted && $connected_wallet_address && $selected_wallet_ergo) {
      console.log('KYA accepted, initializing wallet connection');
      await handleFetchMessages();
      messageRefresh.start(handleFetchMessagesQuietly);
    } else {
      console.log('KYA not accepted or wallet not connected');
    }

    // Handle click outside for room dropdown
    const handleClickOutside = (event) => {
      const dropdown = document.querySelector('.room-dropdown');
      const selector = document.querySelector('.chatroom-selector');
      const modal = document.querySelector('.room-modal');
      const kyaModal = document.querySelector('.kya-overlay');

      if (dropdown && !dropdown.contains(event.target) && 
          selector && !selector.contains(event.target)) {
        showRoomList = false;
      }

      if (modal && !modal.contains(event.target) && 
          selector && !selector.contains(event.target)) {
        roomState = closeRoomModal(roomState);
      }

      // Don't close KYA modal on outside click unless accepted
      if (kyaModal && !kyaModal.querySelector('.kya-container').contains(event.target) && kyaAccepted) {
        showKYA = false;
      }
    };

    document.addEventListener('click', handleClickOutside);

    // Cleanup function
    return () => {
      messageRefresh.stop();
      document.removeEventListener('click', handleClickOutside);
    };
  });

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
              
              <div class="room-stats">
                {#each Object.entries(getRoomStats(allRooms, hiddenRooms)) as [key, value]}
                  <div class="stat-row">
                    <span class="stat-label">{key.charAt(0).toUpperCase() + key.slice(1)} Rooms:</span>
                    <span class="stat-value">{value}</span>
                  </div>
                {/each}
              </div>
              
              <div class="form-actions">
                <button class="cancel-btn" on:click={() => roomState.modalMode = 'list'}>Back</button>
              </div>
            </div>

          {:else if roomState.modalMode === 'info'}
            <div class="room-info-content">
              {#if roomState.currentModalRoom}
                <div class="room-detail">
                  <span class="detail-label">Room Name:</span>
                  <span class="detail-value">{roomState.currentModalRoom.name}</span>
                  {#if !roomState.currentModalRoom.isDiscovered && !DEFAULT_CHATROOMS.some(r => r.id === roomState.currentModalRoom.id)}
                    <button class="action-icon-btn" on:click={() => handleRenameRoom(roomState.currentModalRoom.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
                    </button>
                  {/if}
                </div>
                
                <div class="room-detail">
                  <span class="detail-label">Room Type:</span>
                  <span class="detail-value">
                    {#if roomState.currentModalRoom.isPrivate}
                      Private Room 🔒
                    {:else if roomState.currentModalRoom.isDiscovered}
                      Discovered Room 🌎
                    {:else if DEFAULT_CHATROOMS.some(r => r.id === roomState.currentModalRoom.id)}
                      Default Room #
                    {:else}
                      Custom Room #
                    {/if}
                  </span>
                </div>
                
                {#if roomState.currentModalRoom.description}
                  <div class="room-detail">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">{roomState.currentModalRoom.description}</span>
                  </div>
                {/if}
                
                {#if roomState.currentModalRoom.isPrivate}
                  <div class="room-detail code-detail">
                    <span class="detail-label">Room Code:</span>
                    <div class="code-container">
                      <span class="code-value">{roomState.currentModalRoom.id.replace('private-', '')}</span>
                      <button class="action-icon-btn" on:click={() => handleCopyRoomCode(roomState.currentModalRoom.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                {/if}
                
                <div class="modal-actions-row">
                  <button class="share-room-btn" on:click={() => handleCopyRoomLink(roomState.currentModalRoom.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Copy Link
                  </button>
                  
                  <button class="share-room-btn" on:click={() => handleShareRoom(roomState.currentModalRoom.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share Room
                  </button>
                  
                  {#if !DEFAULT_CHATROOMS.some(dr => dr.id === roomState.currentModalRoom.id) && !roomState.currentModalRoom.isDiscovered}
                    <button class="danger-action-btn" on:click={() => {
                      if (confirm(`Are you sure you want to remove the room "${roomState.currentModalRoom.name}"?`)) {
                        handleRemoveRoom(roomState.currentModalRoom.id);
                        closeRoomManagementModal();
                      }
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      Remove Room
                    </button>
                  {/if}
                  
                  {#if roomState.currentModalRoom.id !== 'general'}
                    <button 
                      class="visibility-btn" 
                      on:click={() => {
                        handleToggleRoomVisibility(roomState.currentModalRoom.id);
                        setTimeout(closeRoomManagementModal, 500);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        {#if hiddenRooms.includes(roomState.currentModalRoom.id)}
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        {:else}
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        {/if}
                      </svg>
                      {hiddenRooms.includes(roomState.currentModalRoom.id) ? 'Show Room' : 'Hide Room'}
                    </button>
                  {/if}
                </div>
              {/if}
              
              <div class="form-actions">
                <button class="cancel-btn" on:click={() => roomState.modalMode = 'list'}>Back</button>
              </div>
            </div>
          {/if}
        </div>
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

        <!-- Room List Dropdown -->
        {#if showRoomList}
          <div class="room-dropdown" transition:slide={{ duration: 150 }}>
            <div class="compact-room-list">
              {#each roomCategories as category}
                <div class="room-category">
                  <div class="category-header">{category.name}</div>
                  {#each category.rooms as room}
                    <div 
                      class="room-item {room.id === selectedChatroom ? 'active' : ''}" 
                      on:click={() => selectChatroom(room.id)}
                    >
                      <div class="room-item-content">
                        <span class="room-indicator">
                          {#if room.isPrivate}
                            🔒
                          {:else if room.isDiscovered}
                            🌎
                          {:else}
                            #
                          {/if}
                        </span>
                        <span class="room-item-name">{room.name}</span>
                      </div>
                      
                      <div class="room-item-actions">
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
                        
                        {#if room.isPrivate}
                          <button 
                            class="action-btn" 
                            on:click|stopPropagation={(e) => handleCopyRoomCode(room.id, e)}
                            title="Copy room code"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        {/if}
                        
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

</style>