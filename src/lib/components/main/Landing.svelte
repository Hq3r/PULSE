<!-- Landing.svelte - Complete Refactored Main Chat Application -->
<script>
  import { onMount, onDestroy } from 'svelte';

  // Store imports
  import {
    selected_wallet_ergo,
    connected_wallet_address,
    wallet_init
  } from '$lib/store/store';

  // Component imports
  import ChatHeader from './ChatHeader.svelte';
  import ChatHistory from './ChatHistory.svelte';
  import InputArea from './InputArea.svelte';
  import MessageList from '$lib/components/main/MessageList.svelte';
  import MnemonicModal from '$lib/components/modals/MnemonicModal.svelte';
  import RoomManagementModal from '$lib/components/modals/RoomManagementModal.svelte';
  import RoomInvitationModal from '$lib/components/modals/RoomInvitationModal.svelte';
  import ErrorBar from '$lib/components/common/ErrorBar.svelte';
  import KYA from '$lib/components/common/KYA.svelte';
  import StealthAddressUI from '$lib/components/main/StealthAddressUI.svelte';

  // Utility imports
  import { DEFAULT_CHATROOMS } from '$lib/utils/chatConstants.js';
  import { createMessageRefreshManager } from '$lib/utils/landingUtils.js';
  import {
    createWalletState,
    loadSavedPreferences,
    toggleTheme,
    toggleAnimations,
    toggleCompactMode,
    createEventHandlers,
    getWalletConnectionState,
    getCurrentWalletAddress,
    getThemeClass
  } from '$lib/utils/walletUtils.js';
  import {
    createRoomState,
    getAllRooms,
    getVisibleRooms,
    getRoomCategories,
    loadHiddenRoomsFromStorage,
    updateDiscoveredRooms,
    filterMessagesForSelectedRoom,
    hideInvitationModal
  } from '$lib/utils/roomUtils.js';
  import {
    initializeUnreadTracking,
    updateUnreadCounts,
    formatUnreadCount
  } from '$lib/utils/unreadMessageTracker.js';

  // Import extracted functions
  import {
    checkKYAStatus,
    handleKYAAccept,
    handleKYADecline,
    createToastMessage,
    handleFetchMessages,
    handleFetchMessagesQuietly,
    handleSendMessage,
    handleConnectWithMnemonic,
    handleDisconnectWallet,
    handleStealthModeChange,
    selectChatroom,
    handleCreateRoom,
    handleCreatePrivateRoom,
    handleJoinPrivateRoom,
    handleCopyRoomCode,
    handleShowInvitation,
    handleRemoveRoom,
    handleToggleRoomVisibility,
    handleRenameRoom,
    handleShowRoomInfo,
    handleCopyRoomLink,
    handleShareRoom,
    refreshRoomDiscovery,
    getUnreadCount,
    roomHasUnread,
    resetKYA
  } from '$lib/utils/landingFunctions.js';

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
  let kyaVersion = "1.0";

  // ============= REACTIVE STATEMENTS =============
  $: {
    if (messages && messages.length > 0 && unreadState.tracker) {
      const newUnreadState = updateUnreadCounts(messages, selectedChatroom);
      unreadState = { ...unreadState, ...newUnreadState };
    }
  }

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

  $: {
    allRooms = getAllRooms(roomState.discoveredRooms);
    visibleRooms = getVisibleRooms(allRooms, hiddenRooms, roomState.showHiddenRooms);
    roomCategories = getRoomCategories(visibleRooms);
  }

  $: {
    if (messages && messages.length > 0 && selectedChatroom) {
      const filteredMessages = filterMessagesForSelectedRoom(messages, selectedChatroom, allRooms);
      if (filteredMessages.length !== messages.length) {
        console.log(`Filtered ${messages.length} messages to ${filteredMessages.length} for room ${selectedChatroom}`);
        messages = filteredMessages;
      }
    }
  }

  $: {
    if (messages && messages.length > 0) {
      messages = messages.sort((a, b) => {
        // Pending messages always come after confirmed messages
        if (a.pending && !b.pending) return 1;
        if (!a.pending && b.pending) return -1;
        
        // Within the same type, sort by timestamp (chronological order)
        // If timestamps are very close (within 1 second) and both are pending,
        // maintain the order they were added to avoid reordering optimistic updates
        if (a.pending && b.pending && Math.abs(a.timestamp - b.timestamp) < 1) {
          // Maintain insertion order for pending messages sent close together
          return 0; // Stable sort will maintain original order
        }
        
        return a.timestamp - b.timestamp;
      });
    }
  }

  $: if (walletConnected && kyaAccepted && !walletState.usingMnemonicWallet && !messageRefresh.isActive()) {
    wrappedHandleFetchMessages().then(() => {
      messageRefresh.start(wrappedHandleFetchMessagesQuietly);
    });
  } else if (!walletConnected && messageRefresh.isActive()) {
    messageRefresh.stop();
  }

  // ============= WRAPPER FUNCTIONS =============
  // These functions wrap the imported functions with local state

  async function wrappedHandleFetchMessages() {
    await handleFetchMessages(
      walletConnected,
      kyaAccepted,
      selectedChatroom,
      allRooms,
      chatContainer,
      autoScroll,
      (msgs) => messages = msgs,
      (load) => loading = load,
      (err) => error = err,
      createToastMessage
    );
  }

  async function wrappedHandleFetchMessagesQuietly() {
    await handleFetchMessagesQuietly(
      walletConnected,
      kyaAccepted,
      selectedChatroom,
      allRooms,
      messages,
      chatContainer,
      autoScroll,
      (msgs) => messages = msgs
    );
  }

  async function wrappedHandleSendMessage() {
    await handleSendMessage(
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
      (msg) => inputMessage = msg,
      (typing) => isTyping = typing,
      (load) => loading = load,
      (err) => error = err,
      createToastMessage
    );
  }

  async function wrappedHandleConnectWithMnemonic() {
    const result = await handleConnectWithMnemonic(
      kyaAccepted,
      walletState,
      (load) => loading = load,
      (err) => error = err,
      (show) => showMnemonicModal = show,
      wrappedHandleFetchMessages,
      messageRefresh,
      wrappedHandleFetchMessagesQuietly,
      createToastMessage
    );
    
    if (result.showKYA) {
      showKYA = true;
    }
  }

  async function wrappedHandleDisconnectWallet() {
    stealthMode = await handleDisconnectWallet(
      walletState,
      $selected_wallet_ergo,
      (val) => selected_wallet_ergo.set(val),
      (val) => connected_wallet_address.set(val),
      messageRefresh,
      (msgs) => messages = msgs,
      createToastMessage
    );
  }

  function wrappedHandleStealthModeChange(event) {
    const result = handleStealthModeChange(
      event,
      messages,
      wrappedHandleFetchMessages,
      walletConnected,
      kyaAccepted,
      createToastMessage
    );
    
    if (result.showKYA) {
      showKYA = true;
    } else {
      stealthMode = result.stealthMode;
    }
  }

  function wrappedSelectChatroom(roomId) {
    const result = selectChatroom(
      roomId,
      kyaAccepted,
      selectedChatroom,
      roomState,
      unreadState,
      (id) => selectedChatroom = id,
      (msgs) => messages = msgs,
      (show) => showRoomList = show,
      (state) => roomState = state,
      null, // handleRoomChange - will be imported from unread tracker
      updateUnreadCounts,
      walletConnected,
      wrappedHandleFetchMessages,
      createToastMessage
    );

    if (result.showKYA) {
      showKYA = true;
    }
    if (result.unreadState) {
      unreadState = result.unreadState;
    }
  }

  function wrappedHandleCreateRoom() {
    const result = handleCreateRoom(
      kyaAccepted,
      roomState,
      allRooms,
      (rooms) => allRooms = rooms,
      wrappedSelectChatroom,
      (state) => roomState = state,
      (err) => error = err,
      createToastMessage
    );

    if (result.showKYA) {
      showKYA = true;
    }
  }

  function wrappedHandleCreatePrivateRoom() {
    const result = handleCreatePrivateRoom(
      kyaAccepted,
      roomState,
      allRooms,
      (rooms) => allRooms = rooms,
      wrappedSelectChatroom,
      (state) => roomState = state,
      (err) => error = err,
      createToastMessage
    );

    if (result.showKYA) {
      showKYA = true;
    }
  }

  function wrappedHandleJoinPrivateRoom() {
    const result = handleJoinPrivateRoom(
      kyaAccepted,
      roomState,
      allRooms,
      (rooms) => allRooms = rooms,
      wrappedSelectChatroom,
      (state) => roomState = state,
      (err) => error = err,
      createToastMessage
    );

    if (result.showKYA) {
      showKYA = true;
    }
  }

  function wrappedRefreshRoomDiscovery() {
    refreshRoomDiscovery(
      roomState,
      (state) => roomState = state,
      createToastMessage
    );
  }

  // ============= KYA FUNCTIONS =============
  function wrappedCheckKYAStatus() {
    const result = checkKYAStatus(kyaVersion);
    kyaAccepted = result.accepted;
    showKYA = result.showModal;
  }

  function wrappedHandleKYAAccept() {
    const success = handleKYAAccept(kyaVersion, createToastMessage);
    if (success) {
      kyaAccepted = true;
      showKYA = false;
      
      // If user was trying to connect wallet, allow them to proceed
      if (walletState.mnemonicInput && showMnemonicModal) {
        wrappedHandleConnectWithMnemonic();
      }
    }
  }

  function wrappedHandleKYADecline() {
    const shouldRedirect = handleKYADecline();
    if (!shouldRedirect) {
      // Keep the modal open for review
      return;
    }
  }

  function wrappedHandleKYAClose() {
    // Only allow closing if already accepted
    if (kyaAccepted) {
      showKYA = false;
    }
  }

  // ============= EVENT HANDLERS =============
  const eventHandlers = createEventHandlers(wrappedHandleSendMessage, wrappedHandleConnectWithMnemonic);

  function handleKeyPress(event) {
    eventHandlers.handleKeyPress(event, showMnemonicModal);
  }

  function handleInputChange() {
    isTyping = inputMessage.trim().length > 0;
  }

  function handleScroll() {
    if (!chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    autoScroll = scrollHeight - scrollTop - clientHeight < 100;
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
    roomState = { ...roomState, showRoomModal: true, modalMode: mode };
  }

  function closeRoomManagementModal() {
    roomState = { ...roomState, showRoomModal: false };
  }

  // ============= ROOM ACTION HANDLERS =============
  function handleRoomCopyCode(event) {
    handleCopyRoomCode(event.detail.roomId, event.detail.event, allRooms, createToastMessage);
  }

  function handleRoomShowInvitation(event) {
    handleShowInvitation(
      event.detail.roomId, 
      event.detail.event, 
      allRooms, 
      (state) => roomState = state, 
      roomState, 
      createToastMessage
    );
  }

  function handleRoomRemove(event) {
    handleRemoveRoom(
      event.detail.roomId,
      event.detail.event,
      allRooms,
      selectedChatroom,
      wrappedSelectChatroom,
      (rooms) => allRooms = rooms,
      (err) => error = err,
      createToastMessage
    );
  }

  function handleRoomToggleVisibility(event) {
    handleToggleRoomVisibility(
      event.detail.roomId,
      event.detail.event,
      hiddenRooms,
      selectedChatroom,
      wrappedSelectChatroom,
      (hidden) => hiddenRooms = hidden,
      (err) => error = err,
      createToastMessage
    );
  }

  function handleRoomRename(event) {
    handleRenameRoom(
      event.detail.roomId,
      event.detail.event,
      allRooms,
      (rooms) => allRooms = rooms,
      (err) => error = err,
      createToastMessage
    );
  }

  function handleRoomShowInfo(event) {
    handleShowRoomInfo(
      event.detail.room,
      event.detail.event,
      (state) => roomState = state,
      roomState
    );
  }

  function handleRoomCopyLink(event) {
    handleCopyRoomLink(event.detail.roomId, event.detail.event, allRooms, createToastMessage);
  }

  function handleRoomShare(event) {
    handleShareRoom(event.detail.roomId, event.detail.event, allRooms, createToastMessage);
  }

  // ============= LIFECYCLE =============
  onMount(async () => {
    console.log('Landing component mounted');
    
    wallet_init.set(true);

    // Check KYA status first
    wrappedCheckKYAStatus();

    // Initialize unread tracking
    unreadState = initializeUnreadTracking(selectedChatroom);

    // Load room management data
    hiddenRooms = loadHiddenRoomsFromStorage();

    // Load existing stealth address
    try {
      const { loadExistingStealthAddress } = await import('$lib/utils/walletUtils.js');
      stealthMode = await loadExistingStealthAddress();
    } catch (error) {
      console.error('Failed to load stealth address:', error);
    }

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
      await wrappedHandleFetchMessages();
      messageRefresh.start(wrappedHandleFetchMessagesQuietly);
    } else {
      console.log('KYA not accepted or wallet not connected');
    }

    // Click outside handler
    const handleClickOutside = (event) => {
      const header = event.target.closest('.chat-header');
      if (!header) {
        showRoomList = false;
      }
    };

    document.addEventListener('click', handleClickOutside);

    // Expose debug functions in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      window.resetKYA = () => {
        if (resetKYA()) {
          wrappedCheckKYAStatus();
          console.log('KYA reset for development');
        }
      };
      window.refreshRoomDiscovery = wrappedRefreshRoomDiscovery;
      console.log('🔧 Debug functions available:');
      console.log('- window.resetKYA()');
      console.log('- window.refreshRoomDiscovery()');
    }

    return () => {
      messageRefresh.stop();
      document.removeEventListener('click', handleClickOutside);
    };
  });

  onDestroy(() => {
    messageRefresh.stop();
  });
</script>

<!-- HTML Template -->
<div class="ergochat {themeClass} {compactMode ? 'compact' : ''} {isAnimationsEnabled ? 'animations-enabled' : ''}">
  
  <!-- Modals -->
  {#if showMnemonicModal}
    <MnemonicModal
      bind:visible={showMnemonicModal}
      bind:mnemonicInput={walletState.mnemonicInput}
      {loading}
      {error}
      on:connect={wrappedHandleConnectWithMnemonic}
      on:close={closeMnemonicModal}
      on:keyPress={handleKeyPress}
    />
  {/if}

  {#if roomState.showRoomModal}
    <RoomManagementModal
      bind:roomState
      {allRooms}
      {hiddenRooms}
      on:createRoom={wrappedHandleCreateRoom}
      on:createPrivateRoom={wrappedHandleCreatePrivateRoom}
      on:joinPrivateRoom={wrappedHandleJoinPrivateRoom}
      on:close={closeRoomManagementModal}
      on:refreshRooms={wrappedRefreshRoomDiscovery}
    />
  {/if}

  {#if roomState.showInviteModal && roomState.currentInvitation}
    <RoomInvitationModal
      invitation={roomState.currentInvitation}
      on:close={() => roomState = hideInvitationModal(roomState)}
      on:toast={(e) => createToastMessage(e.detail.message, e.detail.type)}
    />
  {/if}

  <!-- Main Chat Interface -->
  <ChatHeader
    {currentRoom}
    {messages}
    {showRoomList}
    {roomCategories}
    {selectedChatroom}
    {walletConnected}
    {walletState}
    {currentWalletAddress}
    {isDarkMode}
    {loading}
    {stealthMode}
    {kyaAccepted}
    {getUnreadCount}
    {roomHasUnread}
    on:selectChatroom={(e) => wrappedSelectChatroom(e.detail.roomId)}
    on:showRoomInfo={handleRoomShowInfo}
    on:toggleRoomVisibility={handleRoomToggleVisibility}
    on:renameRoom={handleRoomRename}
    on:removeRoom={handleRoomRemove}
    on:copyRoomCode={handleRoomCopyCode}
    on:openRoomModal={(e) => openRoomManagementModal(e.detail.mode)}
    on:forceRefreshRooms={wrappedRefreshRoomDiscovery}
    on:toggleTheme={handleToggleTheme}
    on:toggleCompactMode={handleToggleCompactMode}
    on:openMnemonicModal={openMnemonicModal}
    on:disconnectWallet={wrappedHandleDisconnectWallet}
    on:toggleRoomList={(e) => showRoomList = e.detail.showRoomList}
    on:showKYA={() => showKYA = true}
  />

  <!-- Error Bar -->
  {#if error}
    <ErrorBar 
      {error} 
      on:close={() => error = ""} 
    />
  {/if}

  <!-- Main Chat Area -->
  <main class="chat-main">
    <!-- Messages Container -->
    <div class="messages-container" bind:this={chatContainer} on:scroll={handleScroll}>
      <MessageList
        {messages}
        {loading}
        {walletConnected}
        {selectedChatroom}
        {currentWalletAddress}
        {stealthMode}
        {compactMode}
        on:openMnemonicModal={openMnemonicModal}
      />
    </div>

    <!-- Input Area -->
    <InputArea
      {walletConnected}
      bind:inputMessage
      {loading}
      {isTyping}
      {walletState}
      on:keyPress={handleKeyPress}
      on:inputChange={handleInputChange}
      on:sendMessage={wrappedHandleSendMessage}
      on:openMnemonicModal={openMnemonicModal}
    />
  </main>

  <!-- KYA Modal -->
  <KYA 
    isVisible={showKYA}
    {isDarkMode}
    on:accept={wrappedHandleKYAAccept}
    on:decline={wrappedHandleKYADecline}
    on:close={wrappedHandleKYAClose}
  />
</div>

<style>

</style>