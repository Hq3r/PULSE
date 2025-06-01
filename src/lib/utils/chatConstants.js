// chatConstants.js - All configuration and constants for ErgoChat
import { Network } from '@fleet-sdk/core';

// ============= BLOCKCHAIN CONFIGURATION =============
export const DEMO_CHAT_CONTRACT = "BhRz5Qd2jtgTdaNsjKZySZzVsL3zxJpXPZfMqxQpeJe4vyXqpwSJCGtnKtdBuPPcZQb7vR3tHCNJGfSZo8VR";
export const API_BASE = "https://api.ergoplatform.com/api/v1";
export const CUSTOM_MIN_BOX_VALUE = BigInt(400000); // 0.0004 ERG
export const TRANSACTION_FEE = BigInt(1500000); // 0.0015 ERG
export const NETWORK_TYPE = Network.Mainnet;

// ============= CHATROOM CONFIGURATION =============
export const DEFAULT_CHATROOMS = [
  { id: "general", name: "General", description: "Main discussion channel" },
  { id: "trading", name: "Trading", description: "Market discussion" },
  { id: "development", name: "Development", description: "Technical discussions" },
  { id: "governance", name: "Governance", description: "DAO and governance topics" }
];

// ============= ENCRYPTION CONFIGURATION =============
export const ENCRYPTION_CONFIG = {
  DEFAULT_KEY: "ergochat",
  ENCRYPTION_PREFIX: "enc-",
  ENCRYPT_COMMAND: "/encrypt "
};

// ============= UI CONFIGURATION =============
export const UI_CONFIG = {
  COLORS: {
    PRIMARY: "#FF5500", // Ergo Orange
    SECONDARY: "#000000", // Black
    BACKGROUND: "#1a1a1a", // Dark background
    SURFACE: "#262626", // Card background
    TEXT: "#ffffff", // White text
    TEXT_SECONDARY: "rgba(255, 255, 255, 0.7)", // Muted text
    SUCCESS: "#4CAF50",
    ERROR: "#f44336",
    WARNING: "#ffc107",
    BORDER: "rgba(255, 85, 0, 0.2)" // Orange border with opacity
  },
  TIMING: {
    TOAST_DURATION: 3000,
    MESSAGE_POLL_INTERVAL: 10000,
    TRANSACTION_DELAY: 800,
    RETRY_DELAY_BASE: 1000,
    CLEANUP_INTERVAL: 60000
  },
  LIMITS: {
    MAX_MESSAGES: 50,
    MAX_RETRIES: 3,
    QUEUE_TIMEOUT: 120000
  }
};

// ============= TRANSACTION CONFIGURATION =============
export const TRANSACTION_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff
  BLOCKCHAIN_PROPAGATION_DELAY: 800,
  CLEANUP_TIMEOUT: 120000, // 2 minutes
  HEIGHT_FETCH_RETRIES: 3,
  HEIGHT_FETCH_DELAY: 500
};

// ============= MESSAGE TEMPLATES =============
export const MESSAGE_TEMPLATES = {
  WELCOME: (botName) => `Hello! I'm ${botName}. How can I help you today?`,
  CONNECTION_SUCCESS: (address) => `Wallet connected: ${address}`,
  DISCONNECTION: "Wallet disconnected",
  TRANSACTION_SUCCESS: (txId) => `Message sent! TX: ${txId.substring(0, 8)}...`,
  TRANSACTION_ERROR: (error) => `Send error: ${error}`,
  ENCRYPTION_NOTICE: "🔒 Encrypted message",
  INSUFFICIENT_BALANCE: "Insufficient balance for transaction",
  NO_UTXOS: "No UTXOs available",
  DOUBLE_SPEND: "Double spend detected - retrying with fresh UTXOs"
};

// ============= ERROR MESSAGES =============
export const ERROR_MESSAGES = {
  MNEMONIC_REQUIRED: "Please enter your mnemonic phrase",
  INVALID_MNEMONIC: "Invalid mnemonic. Please enter 12, 15, or 24 words.",
  WALLET_NOT_CONNECTED: "Wallet not connected",
  CONNECTION_FAILED: (error) => `Failed to connect with mnemonic: ${error}`,
  UTXO_FETCH_FAILED: (status) => `Failed to fetch UTXOs: ${status}`,
  INSUFFICIENT_BALANCE: "Insufficient balance for transaction",
  NO_UTXOS: "No UTXOs available",
  TRANSACTION_BUILD_FAILED: "Failed to build transaction",
  TRANSACTION_SIGN_FAILED: "Failed to sign transaction",
  TRANSACTION_SUBMIT_FAILED: (status, text) => `Transaction submission failed: ${status} - ${text}`,
  HEIGHT_FETCH_FAILED: "Failed to get current blockchain height",
  INVALID_SIGNED_TX: "Invalid signed transaction",
  NO_INPUTS: "Transaction has no inputs",
  NO_OUTPUTS: "Transaction has no outputs",
  NO_TX_ID: "No transaction ID in response"
};

// ============= SUCCESS MESSAGES =============
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: (address) => `🔗 Wallet connected: ${address}`,
  WALLET_DISCONNECTED: "👋 Wallet disconnected",
  MESSAGE_SENT: (txId) => `📤 Message sent! TX: ${txId.substring(0, 8)}...`,
  ENCRYPTION_READY: "🔐 Encryption ready!",
  QUEUE_PROCESSING: "⏳ Processing message queue...",
  TRANSACTION_RETRY: (attempt, max) => `🔄 Retrying transaction (${attempt}/${max})...`
};

// ============= VALIDATION RULES =============
export const VALIDATION = {
  MNEMONIC_WORD_COUNTS: [12, 15, 24],
  MAX_MESSAGE_LENGTH: 1000,
  MIN_MESSAGE_LENGTH: 1,
  ADDRESS_MIN_LENGTH: 20,
  TX_ID_LENGTH: 64
};

// ============= HD WALLET CONFIGURATION =============
export const WALLET_CONFIG = {
  DERIVATION_PATH: (index = 0) => `m/44'/429'/0'/0/${index}`,
  COIN_TYPE: 429, // Ergo's coin type
  DEFAULT_WALLET_INDEX: 0
};

// ============= UTILITY FUNCTIONS =============
export function truncateAddress(address) {
  if (!address || address.length < 12) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function validateMnemonic(mnemonic) {
  if (!mnemonic || typeof mnemonic !== 'string') return false;
  const words = mnemonic.trim().split(/\s+/);
  return VALIDATION.MNEMONIC_WORD_COUNTS.includes(words.length);
}

export function isEncryptCommand(message) {
  return message.startsWith(ENCRYPTION_CONFIG.ENCRYPT_COMMAND);
}

export function extractEncryptedMessage(message) {
  return message.substring(ENCRYPTION_CONFIG.ENCRYPT_COMMAND.length);
}

export function createToastMessage(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, UI_CONFIG.TIMING.TOAST_DURATION);
}