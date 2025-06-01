// landingHooks.js - Custom hooks for Landing component
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
  getThemeClass
} from './walletUtils.js';

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
  loadHiddenRoomsFromStorage,
  autoDiscoverRooms,
  forceRefreshRoomDiscovery,
  handleRoomUrlParameter,
  saveCustomRoomsToStorage,
  loadCustomRoomsFromStorage,
  validateRoomName
} from './roomUtils.js';

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
} from './landingUtils.js';

import { DEFAULT_CHATROOMS, createToastMessage } from './chatConstants.js';

// ============= CHAT MANAGEMENT HOOK =============
export function createChatManager() {
  const state = {
    messages: [],
    inputMessage: "",
    loading: false,
    error: "",
    selectedChatroom: "general",
    autoScroll: true,
    chatContainer: null,
    isTyping: false
  };

  const messageRefresh = createMessageRefreshManager();

  const actions = {
    async fetchMessages(selectedChatroom, walletConnected) {
      if (!walletConnected) return;
      
      try {
        state.loading = true;
        state.error = "";
        const fetchedMessages = await fetchMessages(selectedChatroom);
        state.messages = [...fetchedMessages];
        scrollToBottom(state.chatContainer, state.autoScroll);
      } catch (err) {
        state.error = err.message;
      } finally {
        state.loading = false;
      }
    },

    async fetchMessagesQuietly(selectedChatroom, walletConnected) {
      if (!walletConnected) return;
      
      const newMessages = await fetchMessagesQuietly(selectedChatroom);
      if (newMessages && shouldUpdateMessages(newMessages, state.messages)) {
        state.messages = [...newMessages];
        scrollToBottom(state.chatContainer, state.autoScroll);
      }
    },

    async sendMessage(walletState, stealthMode, $selected_wallet_ergo, $connected_wallet_address, selectedChatroom) {
      if (!state.inputMessage.trim()) return;

      let messageContent = state.inputMessage.trim();
      let shouldEncrypt = false;
      
      if (messageContent.startsWith('/encrypt ')) {
        shouldEncrypt = true;
        messageContent = messageContent.substring(9);
      }

      const originalMessage = state.inputMessage;
      state.inputMessage = "";
      state.isTyping = false;

      try {
        state.loading = true;
        state.error = "";

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
      } catch (err) {
        state.error = `Failed to send message: ${err.message}`;
        createToastMessage(`❌ Send error: ${err.message}`, 'error');
        state.inputMessage = originalMessage;
      } finally {
        state.loading = false;
      }
    },

    handleInputChange() {
      state.isTyping = state.inputMessage.trim().length > 0;
    },

    handleScroll() {
      state.autoScroll = checkAutoScroll(state.chatContainer);
    },

    startRefresh(handler) {
      messageRefresh.start(handler);
    },

    stopRefresh() {
      messageRefresh.stop();
    },

    isRefreshActive() {
      return messageRefresh.isActive();
    }
  };

  return { state, actions };
}

// ============= WALLET MANAGEMENT HOOK =============
export function createWalletManager() {
  const walletState = createWalletState();
  let stealthMode = { active: false, address: '', displayName: '' };
  let showMnemonicModal = false;

  const actions = {
    async connectWithMnemonic() {
      if (!walletState.mnemonicInput.trim()) {
        throw new Error("Please enter your mnemonic phrase");
      }

      const processor = (messageData) => processSingleMessage(messageData, walletState.mnemonicWallet);
      await connectWithMnemonic(walletState.mnemonicInput, walletState, processor);
      
      showMnemonicModal = false;
      walletState.mnemonicInput = "";
    },

    async disconnect($selected_wallet_ergo, setSelectedWallet, setConnectedAddress, stopRefresh) {
      stealthMode = await disconnectWallet(
        walletState,
        $selected_wallet_ergo,
        setSelectedWallet,
        setConnectedAddress,
        stopRefresh
      );
      return stealthMode;
    },

    handleStealthModeChange(event, messages, fetchMessages, walletConnected) {
      stealthMode = handleStealthModeChanged(event, messages, fetchMessages, walletConnected);
      return stealthMode;
    },

    async loadExistingStealth() {
      stealthMode = await loadExistingStealthAddress();
      return stealthMode;
    },

    openMnemonicModal() {
      showMnemonicModal = true;
      walletState.mnemonicInput = "";
    },

    closeMnemonicModal() {
      showMnemonicModal = false;
      walletState.mnemonicInput = "";
    }
  };

  return { walletState, stealthMode, showMnemonicModal, actions };
}

// ============= ROOM MANAGEMENT HOOK =============
export function createRoomManager() {
  let roomState = createRoomState();
  let allRooms = DEFAULT_CHATROOMS;
  let visibleRooms = DEFAULT_CHATROOMS;
  let roomCategories = [];
  let hiddenRooms = [];
  let showRoomList = false;

  const actions = {
    updateRoomData() {
      allRooms = getAllRooms(roomState.discoveredRooms);
      visibleRooms = getVisibleRooms(allRooms, hiddenRooms, roomState.showHiddenRooms);
      roomCategories = getRoomCategories(visibleRooms);
    },

    async autoDiscover(currentWalletAddress, forceRefresh = false) {
      roomState = await autoDiscoverRooms(roomState, currentWalletAddress, forceRefresh);
      this.updateRoomData();
    },

    async createRoom() {
      const validation = validateRoomName(roomState.newRoomName, allRooms);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { newRoom, updatedRooms } = addCustomRoom(roomState, allRooms);
      allRooms = updatedRooms;
      saveCustomRoomsToStorage(allRooms);
      roomState = closeRoomModal(roomState);
      return newRoom.id;
    },

    async createPrivateRoom() {
      const validation = validateRoomName(roomState.newRoomName, allRooms);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { newRoom, updatedRooms } = addPrivateRoom(roomState, allRooms);
      allRooms = updatedRooms;
      saveCustomRoomsToStorage(allRooms);
      roomState = closeRoomModal(roomState);
      return newRoom.id;
    },

    async joinPrivateRoom() {
      const { newRoom, existingRoom, updatedRooms } = joinPrivateRoom(roomState.joinPrivateRoomCode, allRooms);
      allRooms = updatedRooms;
      
      if (newRoom) {
        saveCustomRoomsToStorage(allRooms);
      }
      
      roomState = closeRoomModal(roomState);
      return (newRoom || existingRoom).id;
    },

    removeRoom(roomId, selectedChatroom, selectChatroom) {
      const room = allRooms.find(r => r.id === roomId);
      if (!room) return;
      
      if (!confirm(`Are you sure you want to remove the room "${room.name}"?`)) {
        return;
      }
      
      allRooms = removeRoom(roomId, allRooms, selectedChatroom, selectChatroom);
      saveCustomRoomsToStorage(allRooms);
    },

    toggleRoomVisibility(roomId, selectedChatroom, selectChatroom) {
      hiddenRooms = toggleRoomVisibility(roomId, hiddenRooms, selectedChatroom, selectChatroom);
    },

    renameRoom(roomId) {
      allRooms = renameRoom(roomId, allRooms);
      saveCustomRoomsToStorage(allRooms);
    },

    showRoomInfo(room) {
      roomState = setModalRoom(roomState, room);
    },

    copyRoomCode(roomId) {
      copyRoomCode(roomId);
    },

    openModal(mode) {
      roomState = openRoomModal(roomState, mode);
    },

    closeModal() {
      roomState = closeRoomModal(roomState);
    },

    async forceRefresh(currentWalletAddress) {
      if (!currentWalletAddress) {
        throw new Error("Wallet must be connected to discover rooms");
      }
      
      roomState = await forceRefreshRoomDiscovery(roomState, currentWalletAddress);
      saveCustomRoomsToStorage(allRooms);
    },

    loadFromStorage() {
      hiddenRooms = loadHiddenRoomsFromStorage();
      const customRooms = loadCustomRoomsFromStorage();
      if (customRooms.length > 0) {
        roomState.discoveredRooms = [...roomState.discoveredRooms, ...customRooms];
      }
    },

    handleUrlParameter(selectChatroom) {
      const selectedRoomId = handleRoomUrlParameter(allRooms, selectChatroom);
      return selectedRoomId;
    },

    canManageRoom(room) {
      return !DEFAULT_CHATROOMS.some(dr => dr.id === room.id) && !room.isDiscovered;
    },

    saveRooms() {
      saveCustomRoomsToStorage(allRooms);
    }
  };

  return { 
    roomState, 
    allRooms, 
    visibleRooms, 
    roomCategories, 
    hiddenRooms, 
    showRoomList,
    actions,
    // Expose setters for reactive updates
    setRoomState: (newState) => { roomState = newState; },
    setAllRooms: (rooms) => { allRooms = rooms; },
    setShowRoomList: (show) => { showRoomList = show; }
  };
}

// ============= THEME MANAGEMENT HOOK =============
export function createThemeManager() {
  let { isDarkMode, isAnimationsEnabled, compactMode } = loadSavedPreferences();

  const actions = {
    toggleTheme() {
      isDarkMode = toggleTheme(isDarkMode);
      return isDarkMode;
    },

    toggleAnimations() {
      isAnimationsEnabled = toggleAnimations(isAnimationsEnabled);
      return isAnimationsEnabled;
    },

    toggleCompactMode() {
      compactMode = toggleCompactMode(compactMode);
      return compactMode;
    }
  };

  return { isDarkMode, isAnimationsEnabled, compactMode, actions };
}

// ============= MAIN LANDING HOOK =============
export function createLandingState() {
  const chatManager = createChatManager();
  const walletManager = createWalletManager();
  const roomManager = createRoomManager();
  const themeManager = createThemeManager();

  return {
    chat: chatManager,
    wallet: walletManager,
    rooms: roomManager,
    theme: themeManager
  };
}