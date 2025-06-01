// mainConsts.js - Centralized constants and configuration

// Contract Addresses
export const CHAT_CONTRACT = 'BhRz5Qd2jtgTdaKPewYd4EjSquVegcmgxkqumH4GioKABQAGxofYfLiMCzy3EbFYFTBvHgnw94LkPa8NtPsv';


// Transaction Values
export const CUSTOM_MIN_BOX_VALUE = 400000n;
export const RECOMMENDED_MIN_FEE_VALUE = 1000000n;
export const MIN_ERG_VALUE = 1000000n; // 0.001 ERG

// Supported Tokens Configuration
export const SUPPORTED_TOKENS = {
  'ERG': ['', 9],
  'BUNS': ['abe0a3c2f646dcd430aac9c29d80feee865bd8b5231edb545a41105d4c8e4985', 4],
  'COMET': ['0cd8c9f416e5b1ca9f986a7f10a84191dfb85941619e49e53c0dc30ebf83324b', 0],
  'MEW': ['6c35aa395c7c75b0f67f7804d6930f0e11ef93c3387dc1faa86498d54af7962c', 2],
  'FAKU': ['f0cac602d618081f46db086726d3c4da53006b646b50e382989054dcf3c93bd8', 2],
  'PAC': ['9386c9269a697142b6b47e77684a14a121ae493d8a84c6d40d62b12f459e3899', 5],
  'RUGGED': ['19b14267d2d8c4896da958c6eb56aa07d7a55ef5fd71dab87a6534af47cc2a5a', 2]
};

// Default Chatrooms
export const DEFAULT_CHATROOMS = [
  { id: 'general', name: 'General', description: 'Main discussion channel' },
  { id: 'trading', name: 'Trading', description: 'Discuss trading and prices' },
  { id: 'development', name: 'Development', description: 'Ergo platform development' },
  { id: 'governance', name: 'Governance', description: 'Governance and proposals' }
];

// Admin Configuration
export const ADMIN_WALLET_ADDRESS = '9gvDVNy1XvDeFoi4ZHn5v6u3tFRECMXGKbwuHbijJu6Z2hLQTQz';


// Message Pagination
export const MESSAGE_PAGE_SIZE = 500;
export const MAX_MESSAGES_TO_STORE = 1000;
export const MEMPOOL_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
export const STREAM_REFRESH_INTERVAL = 30000; // 30 seconds

// LocalStorage Keys
export const STORAGE_KEYS = {
  MESSAGES: 'ergoChat_messages',
  MEMPOOL: 'ergoChat_mempool',
  ROOMS: 'ergoChat_rooms',
  STREAM_MESSAGES: 'ergoChat_streamMessages',
  STREAM_ROOMS: 'ergoChat_streamRooms',
  STREAM_INTERACTIONS: 'ergoChat_streamInteractions',
  LAST_VIEWED_TIMESTAMPS: 'ergoChat_lastViewedTimestamps',
  STEALTH_IDENTITIES: 'ergoChat_stealthIdentities',
  MESSAGES_ALL: 'ergoChat_messages_all'
};

// API Endpoints
export const API_ENDPOINTS = {
  ERGO_EXPLORER: 'https://api.ergoplatform.com/api/v1',
  BOXES_BY_ADDRESS: (address) => `${API_ENDPOINTS.ERGO_EXPLORER}/boxes/byAddress/${address}`,
  MEMPOOL_TRANSACTIONS: (address) => `${API_ENDPOINTS.ERGO_EXPLORER}/mempool/transactions/byAddress/${address}`,
  TRANSACTION_DETAILS: (txId) => `${API_ENDPOINTS.ERGO_EXPLORER}/transactions/${txId}`,
  EXPLORER_TX_URL: (txId) => `https://explorer.ergoplatform.com/en/transactions/${txId}`
};

// Message Types
export const MESSAGE_TYPES = {
  REGULAR: 'regular',
  TIP: 'tip',
  STREAM_ANNOUNCEMENT: 'stream_announcement',
  STREAM_END: 'stream_end',
  SYSTEM: 'system',
  AI_RESPONSE: 'ai_response'
};

// Stream Platforms
export const STREAM_PLATFORMS = {
  YOUTUBE: 'youtube',
  TWITCH: 'twitch',
  TWITTER: 'twitter',
  KICK: 'kick'
};

// Stream URL Patterns
export const STREAM_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|live\/)/i,
  /(?:https?:\/\/)?youtu\.be\//i,
  /(?:https?:\/\/)?(?:www\.)?twitch\.tv\//i,
  /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/i\/spaces\//i,
  /(?:https?:\/\/)?(?:www\.)?kick\.com\//i
];

// Encryption Configuration
export const ENCRYPTION_CONFIG = {
  SECRET_KEY: 'ergochat',
  ENCRYPTED_PREFIX: 'enc-',
  STEALTH_IDENTITY_TYPE: 'STEALTH_IDENTITY'
};

// UI Configuration
export const UI_CONFIG = {
  MAX_SEARCH_RESULTS: 10,
  TOAST_DURATION: 3000,
  SCROLL_THRESHOLD: 100,
  MAX_MESSAGE_LENGTH: 1000,
  DEBOUNCE_DELAY: 300
};

// Notification Settings
export const NOTIFICATION_CONFIG = {
  SOUND_ENABLED: true,
  BROWSER_NOTIFICATIONS: true,
  NOTIFICATION_TAG: 'dm-notification'
};

// Error Messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet to perform this action',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
  TRANSACTION_FAILED: 'Transaction failed. Please try again',
  INVALID_ADDRESS: 'Invalid Ergo address format',
  NETWORK_ERROR: 'Network error. Please check your connection',
  UTXO_ERROR: 'UTXO error. Please reconnect your wallet',
  UNSUPPORTED_TOKEN: 'Unsupported token. Please use one of the supported tokens'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: 'Message sent successfully!',
  TIP_SENT: 'Tip sent successfully!',
  STREAM_CREATED: 'Live stream created successfully!',
  STREAM_ENDED: 'Stream ended successfully!',
  WALLET_CONNECTED: 'Wallet connected successfully!',
  WALLET_DISCONNECTED: 'Wallet disconnected'
};

// Regular Expressions
export const REGEX_PATTERNS = {
  HEX: /^[0-9a-fA-F]+$/,
  TOKEN_ID: /^[0-9a-fA-F]{64}$/,
  ENCRYPTED_TEXT: /^enc-[0-9a-fA-F]+$/,
  COMMAND: /^\/\w+/,
  TIP_COMMAND: /^\/tip\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(9[a-zA-Z0-9]+)$/
};

// Time Constants
export const TIME_CONSTANTS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800
};

// Feature Flags
export const FEATURE_FLAGS = {
  SMART_AI_ENABLED: true,
  STEALTH_MODE_ENABLED: true,
  ACHIEVEMENTS_ENABLED: true,
  LIVE_STREAMING_ENABLED: true,
  PRICE_DISPLAY_ENABLED: true,
  ADMIN_DASHBOARD_ENABLED: true
};