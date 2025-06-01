// walletUtils.js - Wallet connection and management utilities
import { MnemonicWallet, TransactionQueue } from './chatUtils.js';
import { stealthAddressManager } from './SimpleStealthAddress.js';
import { truncateAddress, validateMnemonic, createToastMessage } from './chatConstants.js';

// ============= WALLET CONNECTION STATE =============

export function createWalletState() {
  return {
    // Mnemonic wallet state
    showMnemonicModal: false,
    mnemonicInput: "",
    mnemonicWallet: null,
    usingMnemonicWallet: false,
    
    // Transaction queue
    transactionQueue: new TransactionQueue(),
    
    // Loading states
    loading: false,
    error: ""
  };
}

// ============= MNEMONIC WALLET FUNCTIONS =============

export async function connectWithMnemonic(mnemonicInput, walletState, processSingleMessage) {
  if (!mnemonicInput.trim()) {
    throw new Error("Please enter your mnemonic phrase");
  }

  if (!validateMnemonic(mnemonicInput)) {
    throw new Error("Invalid mnemonic. Please enter 12, 15, or 24 words.");
  }

  try {
    walletState.mnemonicWallet = new MnemonicWallet(mnemonicInput.trim());
    await walletState.mnemonicWallet.init();
    
    walletState.usingMnemonicWallet = true;

    // Set up transaction queue processor
    walletState.transactionQueue.processSingleMessage = processSingleMessage;

    const address = walletState.mnemonicWallet.getAddressSync();
    createToastMessage(`🔑 Mnemonic wallet connected: ${truncateAddress(address)}`, 'success');

    return address;
  } catch (err) {
    console.error('Mnemonic connection error:', err);
    throw new Error(`Failed to connect with mnemonic: ${err.message}`);
  }
}

export async function disconnectWallet(
  walletState, 
  selectedWalletErgo, 
  setSelectedWalletErgo, 
  setConnectedWalletAddress,
  stopMessageRefresh
) {
  // Stop message refresh
  stopMessageRefresh();
  
  // Disconnect external wallet if connected
  if (selectedWalletErgo === 'nautilus' && window.ergo) {
    try {
      if (typeof window.ergo.disconnect === 'function') {
        await window.ergo.disconnect();
      }
    } catch (err) {
      console.error('External wallet disconnect error:', err);
    }
  }
  
  // Reset external wallet state
  setSelectedWalletErgo(null);
  setConnectedWalletAddress(null);
  
  // Reset mnemonic wallet state
  walletState.mnemonicWallet = null;
  walletState.usingMnemonicWallet = false;
  walletState.mnemonicInput = "";
  walletState.transactionQueue.clear();
  
  // Reset stealth mode
  stealthAddressManager.deactivateStealthAddress();
  
  createToastMessage('👋 Wallet disconnected', 'info');
  
  return { active: false, address: '', displayName: '' }; // Reset stealth mode
}

// ============= STEALTH ADDRESS FUNCTIONS =============

export async function loadExistingStealthAddress() {
  try {
    const existing = stealthAddressManager.loadStealthAddress();
    if (existing && existing.isActive) {
      const stealthMode = {
        active: true,
        address: existing.address,
        displayName: existing.displayName
      };
      console.log('Loaded existing stealth address:', stealthMode);
      return stealthMode;
    }
  } catch (error) {
    console.error('Error loading stealth address:', error);
  }
  return { active: false, address: '', displayName: '' };
}

export function handleStealthModeChanged(event, currentMessages, fetchMessages, walletConnected) {
  const stealthMode = event.detail;
  console.log('Stealth mode changed:', stealthMode);
  
  // Force refresh messages when stealth mode changes to update display
  if (walletConnected) {
    fetchMessages();
  }
  
  return stealthMode;
}

// ============= THEME AND PREFERENCES =============

export function createThemeState() {
  return {
    isDarkMode: true,
    isAnimationsEnabled: true,
    compactMode: false
  };
}

export function loadSavedPreferences() {
  const savedTheme = localStorage.getItem('ergochat-theme');
  const savedAnimations = localStorage.getItem('ergochat-animations');
  const savedCompact = localStorage.getItem('ergochat-compact');
  
  return {
    isDarkMode: savedTheme ? savedTheme === 'dark' : true,
    isAnimationsEnabled: savedAnimations ? savedAnimations === 'true' : true,
    compactMode: savedCompact ? savedCompact === 'true' : false
  };
}

export function toggleTheme(isDarkMode) {
  const newTheme = !isDarkMode;
  localStorage.setItem('ergochat-theme', newTheme ? 'dark' : 'light');
  
  // Add smooth transition for theme change
  document.documentElement.style.transition = 'all 0.3s ease';
  setTimeout(() => {
    document.documentElement.style.transition = '';
  }, 300);
  
  return newTheme;
}

export function toggleAnimations(isAnimationsEnabled) {
  const newAnimations = !isAnimationsEnabled;
  localStorage.setItem('ergochat-animations', newAnimations ? 'true' : 'false');
  return newAnimations;
}

export function toggleCompactMode(compactMode) {
  const newCompactMode = !compactMode;
  localStorage.setItem('ergochat-compact', newCompactMode ? 'true' : 'false');
  return newCompactMode;
}

// ============= EVENT HANDLERS =============

export function createEventHandlers(sendMessage, connectWithMnemonic) {
  return {
    handleKeyPress(event, showMnemonicModal) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (showMnemonicModal) {
          connectWithMnemonic();
        } else {
          sendMessage();
        }
      }
    },
    
    handleInputChange(inputMessage) {
      return inputMessage.trim().length > 0;
    },
    
    handleScroll(chatContainer) {
      if (!chatContainer) return true;
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      return scrollHeight - scrollTop - clientHeight < 100;
    }
  };
}

// ============= REACTIVE GETTERS =============

export function getWalletConnectionState(connectedWalletAddress, selectedWalletErgo, usingMnemonicWallet) {
  return (!!connectedWalletAddress && selectedWalletErgo) || usingMnemonicWallet;
}

export function getCurrentWalletAddress(usingMnemonicWallet, mnemonicWallet, connectedWalletAddress) {
  return usingMnemonicWallet ? (mnemonicWallet?.getAddressSync() || '') : connectedWalletAddress;
}

export function getThemeClass(isDarkMode) {
  return isDarkMode ? 'dark-theme' : 'light-theme';
}

// ============= MESSAGE PROCESSING =============

export function processEncryptionCommand(messageContent) {
  let shouldEncrypt = false;
  let processedContent = messageContent;
  
  // Check for encryption command
  if (messageContent.startsWith('/encrypt ')) {
    shouldEncrypt = true;
    processedContent = messageContent.substring(9);
  }
  
  return { shouldEncrypt, processedContent };
}

// ============= MODAL MANAGEMENT =============

export function createModalState() {
  return {
    showMnemonicModal: false,
    mnemonicInput: "",
    error: ""
  };
}

export function openMnemonicModal(modalState) {
  return {
    ...modalState,
    showMnemonicModal: true,
    mnemonicInput: "",
    error: ""
  };
}

export function closeMnemonicModal(modalState) {
  return {
    ...modalState,
    showMnemonicModal: false,
    mnemonicInput: "",
    error: ""
  };
}