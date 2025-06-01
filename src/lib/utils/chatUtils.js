// chatUtils.js - Complete chat functionality and wallet management with Node API support
import { 
  TransactionBuilder,
  OutputBuilder,
  RECOMMENDED_MIN_FEE_VALUE,
  ErgoAddress,
  BoxSelector
} from '@fleet-sdk/core';
import { 
  ErgoHDKey, 
  Prover
} from '@fleet-sdk/wallet';
import { SColl, SByte, SLong } from '@fleet-sdk/serializer';
import { stringToBytes } from '@scure/base';

import {
  DEMO_CHAT_CONTRACT,
  API_BASE,
  PULSE_ERGOTREE,
  NODE_API_BASE,
  CUSTOM_MIN_BOX_VALUE,
  TRANSACTION_FEE,
  NETWORK_TYPE,
  TRANSACTION_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ENCRYPTION_CONFIG,
  WALLET_CONFIG
} from './chatConstants.js';

// ============= NODE ENDPOINTS CONFIGURATION =============

export const NODE_ENDPOINTS = [
  {
    url: "http://213.239.193.208:9053",
    name: "Primary Node",
    corsProxy: false
  },
  {
    url: "https://node.ergo.casa:9053",
    name: "Ergo Casa Node",
    corsProxy: false
  },
  {
    url: "https://ergnode.io:9053",
    name: "ErgNode.io",
    corsProxy: false
  },
  {
    url: "https://cors-anywhere.herokuapp.com/http://213.239.193.208:9053",
    name: "CORS Proxy",
    corsProxy: true
  }
];

// ============= CORS HANDLING UTILITIES =============

/**
 * Fetch with automatic CORS fallback
 * @param {string} endpoint - Endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithCORSFallback(endpoint, options = {}) {
  const errors = [];
  
  for (const nodeConfig of NODE_ENDPOINTS) {
    try {
      console.log(`Trying ${nodeConfig.name}: ${nodeConfig.url}${endpoint}`);
      
      const fetchOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(nodeConfig.corsProxy && {
            'X-Requested-With': 'XMLHttpRequest'
          })
        },
        ...options
      };
      
      const response = await fetch(`${nodeConfig.url}${endpoint}`, fetchOptions);
      
      if (response.ok) {
        console.log(`✅ Success with ${nodeConfig.name}`);
        return response;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.warn(`❌ Failed with ${nodeConfig.name}:`, error.message);
      errors.push({ node: nodeConfig.name, error: error.message });
      continue;
    }
  }
  
  const errorMsg = `All node endpoints failed:\n${errors.map(e => `${e.node}: ${e.error}`).join('\n')}`;
  throw new Error(errorMsg);
}

// ============= ENCRYPTION UTILITIES =============

/**
 * Encrypt a message using simple XOR encryption
 * @param {string} text - The plain text to encrypt
 * @param {string} secretKey - The encryption key (default: "ergochat")
 * @returns {string} - The encrypted message with "enc-" prefix
 */
export function encryptMessage(text, secretKey = ENCRYPTION_CONFIG.DEFAULT_KEY) {
  if (!text || typeof text !== 'string') return text;
  
  let encrypted = "";
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    const keyChar = secretKey.charCodeAt((i + (i % 5)) % secretKey.length);
    const encryptedChar = char ^ keyChar;
    encrypted += encryptedChar.toString(16).padStart(2, '0');
  }
  return ENCRYPTION_CONFIG.ENCRYPTION_PREFIX + encrypted;
}

/**
 * Decrypt an encrypted message
 * @param {string} encrypted - The encrypted string (must start with "enc-")
 * @param {string} secretKey - The decryption key (default: "ergochat")
 * @returns {string} - The decrypted message or original if decryption fails
 */
export function decryptMessage(encrypted, secretKey = ENCRYPTION_CONFIG.DEFAULT_KEY) {
  if (!encrypted || typeof encrypted !== 'string') return encrypted;
  
  if (!encrypted.startsWith(ENCRYPTION_CONFIG.ENCRYPTION_PREFIX)) return encrypted;
  
  try {
    const hexStr = encrypted.substring(4);
    if (!/^[0-9a-fA-F]+$/.test(hexStr)) return encrypted;
    
    let decrypted = "";
    for (let i = 0; i < hexStr.length; i += 2) {
      if (i + 1 >= hexStr.length) break;
      
      const hexPair = hexStr.substring(i, i + 2);
      const encryptedChar = parseInt(hexPair, 16);
      const position = i/2;
      const keyChar = secretKey.charCodeAt((position + (position % 5)) % secretKey.length);
      const decryptedChar = encryptedChar ^ keyChar;
      decrypted += String.fromCharCode(decryptedChar);
    }
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return encrypted;
  }
}

/**
 * Process message content that may contain encrypted parts
 * @param {string} content - The message content to process
 * @param {string} secretKey - The decryption key (default: "ergochat")
 * @returns {string} - The processed content with encrypted parts decrypted
 */
export function processMessageContent(content, secretKey = ENCRYPTION_CONFIG.DEFAULT_KEY) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  if (!content.includes(ENCRYPTION_CONFIG.ENCRYPTION_PREFIX)) {
    return content;
  }

  // Case 1: Entire content is a single encrypted string
  if (content.startsWith(ENCRYPTION_CONFIG.ENCRYPTION_PREFIX) && 
      new RegExp(`^${ENCRYPTION_CONFIG.ENCRYPTION_PREFIX}[0-9a-fA-F]+$`).test(content)) {
    return decryptMessage(content, secretKey);
  }

  // Case 2: Content contains one or more encrypted sections mixed with plain text
  const encryptedPattern = new RegExp(`${ENCRYPTION_CONFIG.ENCRYPTION_PREFIX}[0-9a-fA-F]+`, 'g');
  return content.replace(encryptedPattern, (match) => {
    return decryptMessage(match, secretKey);
  });
}

/**
 * Check if a message contains encrypted content
 * @param {string} content - The message content to check
 * @returns {boolean} - True if content contains encrypted parts
 */
export function hasEncryptedContent(content) {
  return typeof content === 'string' && content.includes(ENCRYPTION_CONFIG.ENCRYPTION_PREFIX);
}

/**
 * Extract all encrypted parts from a message
 * @param {string} content - The message content
 * @returns {string[]} - Array of encrypted strings found in the content
 */
export function extractEncryptedParts(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }
  
  const encryptedPattern = new RegExp(`${ENCRYPTION_CONFIG.ENCRYPTION_PREFIX}[0-9a-fA-F]+`, 'g');
  return content.match(encryptedPattern) || [];
}

/**
 * Validate if a string is a properly formatted encrypted message
 * @param {string} encrypted - The string to validate
 * @returns {boolean} - True if valid encrypted format
 */
export function isValidEncryptedMessage(encrypted) {
  return typeof encrypted === 'string' && 
         encrypted.startsWith(ENCRYPTION_CONFIG.ENCRYPTION_PREFIX) && 
         new RegExp(`^${ENCRYPTION_CONFIG.ENCRYPTION_PREFIX}[0-9a-fA-F]+$`).test(encrypted) &&
         encrypted.length > 4;
}

// ============= BLOCKCHAIN UTILITIES =============

/**
 * Get current blockchain height with retry mechanism
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<number>} - Current blockchain height
 */
export async function getCurrentHeight(maxRetries = TRANSACTION_CONFIG.HEIGHT_FETCH_RETRIES) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try node first, then fallback to explorer
      let response;
      try {
        response = await fetchWithCORSFallback('/info');
        if (response.ok) {
          const data = await response.json();
          const height = data.fullHeight || data.headersHeight || data.height;
          if (height) {
            console.log(`Got height from node: ${height}`);
            return height;
          }
        }
      } catch (nodeError) {
        console.warn(`Node height fetch failed (attempt ${i + 1}):`, nodeError.message);
      }
      
      // Fallback to explorer API
      response = await fetch(`${API_BASE}/blocks?limit=1`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const height = data.items[0]?.height;
      if (!height) {
        throw new Error('No height in response');
      }
      console.log(`Got height from explorer: ${height}`);
      return height;
    } catch (error) {
      console.warn(`Height fetch attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) {
        console.log('Using fallback height');
        return 1000000; // fallback height
      }
      await new Promise(resolve => setTimeout(resolve, TRANSACTION_CONFIG.HEIGHT_FETCH_DELAY));
    }
  }
}

/**
 * Parse a blockchain box into a message object
 * @param {Object} box - The blockchain box object
 * @returns {Object|null} - Parsed message object or null if parsing fails
 */
export function parseBoxToMessage(box) {
  try {
    if (!box || !box.additionalRegisters) return null;

    const registers = box.additionalRegisters;
    if (!registers.R4 || !registers.R5 || !registers.R6) return null;

    function extractAndDecode(register) {
      if (!register) return '';
      
      let value = register.renderedValue || register.serializedValue || String(register);
      
      if (value.startsWith('0e')) {
        value = value.substring(4);
      }
      
      if (/^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0) {
        try {
          const bytes = [];
          for (let i = 0; i < value.length; i += 2) {
            bytes.push(parseInt(value.substring(i, i + 2), 16));
          }
          return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        } catch (e) {
          return value;
        }
      }
      return value;
    }

    const sender = extractAndDecode(registers.R4);
    let content = extractAndDecode(registers.R5);
    const timestamp = parseInt(registers.R6?.renderedValue || registers.R6?.serializedValue) || Math.floor(Date.now() / 1000);
    const chatroomId = registers.R7 ? extractAndDecode(registers.R7) : 'general';
    const parentId = registers.R8 ? extractAndDecode(registers.R8) : null;

    // Process encrypted content
    content = processMessageContent(content);

    return {
      id: box.boxId || box.transactionId,
      sender: sender.length > 12 ? `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}` : sender,
      content,
      timestamp,
      chatroomId,
      parentId,
      pending: false
    };
  } catch (error) {
    console.error('Error parsing box to message:', error);
    return null;
  }
}

// ============= NODE MEMPOOL UTILITIES =============

/**
 * Extract register value from node API format
 * @param {*} register - Register data from node
 * @returns {string} - Extracted value
 */
function extractNodeRegisterValue(register) {
  if (!register) return '';
  
  // Node API might return registers in different formats
  let value = register;
  
  // If it's an object, try different properties
  if (typeof register === 'object') {
    value = register.serializedValue || 
            register.renderedValue || 
            register.value || 
            register;
  }
  
  // Convert to string
  value = String(value);
  
  // Handle Ergo encoding (remove 0e prefix and decode hex)
  if (value.startsWith('0e')) {
    try {
      let hexStr = value.substring(2); // Remove '0e'
      
      // Remove length prefix if present (first 2 characters)
      if (hexStr.length > 2) {
        hexStr = hexStr.substring(2);
      }
      
      // Convert hex to string
      if (/^[0-9A-Fa-f]+$/.test(hexStr) && hexStr.length % 2 === 0) {
        const bytes = [];
        for (let i = 0; i < hexStr.length; i += 2) {
          bytes.push(parseInt(hexStr.substring(i, i + 2), 16));
        }
        const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        return decoded;
      }
    } catch (e) {
      console.warn('Failed to decode hex value:', value, e);
    }
  }
  
  return value;
}

/**
 * Parse a mempool transaction from node API into a message
 * @param {Object} tx - Transaction object from node
 * @returns {Object|null} - Parsed message or null
 */
export function parseNodeMempoolTxToMessage(tx) {
  try {
    console.log('Parsing node mempool tx:', tx.id);
    
    // Find the output that goes to the chat contract
    const chatOutput = tx.outputs?.find(output => {
     return output.ergoTree === PULSE_ERGOTREE;
    });
    
    if (!chatOutput) {
      console.log('No chat output found in transaction');
      return null;
    }
    
    console.log('Chat output found:', chatOutput);
    
    // Node API might have different register structure
    const registers = chatOutput.additionalRegisters || chatOutput.registers || {};
    console.log('Registers found:', registers);
    
    // Check if we have the required registers
    if (!registers.R4 || !registers.R5 || !registers.R6) {
      console.log('Missing required registers R4, R5, or R6');
      return null;
    }
    
    // Extract data using node-specific parsing
    const sender = extractNodeRegisterValue(registers.R4);
    let content = extractNodeRegisterValue(registers.R5);
    const timestamp = parseInt(extractNodeRegisterValue(registers.R6)) || Math.floor(Date.now() / 1000);
    const chatroomId = registers.R7 ? extractNodeRegisterValue(registers.R7) : 'general';
    const parentId = registers.R8 ? extractNodeRegisterValue(registers.R8) : null;
    
    console.log('Parsed node values:', { sender, content, timestamp, chatroomId, parentId });
    
    // Process encrypted content
    content = processMessageContent(content);
    
    // Validate that we have essential data
    if (!sender || !content) {
      console.log('Missing sender or content after parsing');
      return null;
    }
    
    return {
      id: tx.id,
      sender: sender.length > 12 ? `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}` : sender,
      content,
      timestamp,
      chatroomId,
      parentId,
      pending: true,
      isMempool: true,
      source: 'node' // Mark as coming from node
    };
    
  } catch (err) {
    console.warn('Failed to parse node mempool transaction:', err);
    return null;
  }
}

/**
 * Parse mempool transaction from explorer API (fallback)
 * @param {Object} tx - Transaction from explorer API
 * @returns {Object|null} - Parsed message or null
 */
export function parseMempoolTxToMessage(tx) {
  try {
    console.log('Parsing explorer mempool tx:', tx);
    
    // Find the output that goes to the chat contract
    const chatOutput = tx.outputs?.find(output => output.address === DEMO_CHAT_CONTRACT);
    console.log('Chat output found:', chatOutput);
    
    if (!chatOutput || !chatOutput.additionalRegisters) {
      console.log('No chat output or additionalRegisters found');
      return null;
    }

    const registers = chatOutput.additionalRegisters;
    console.log('Registers found:', registers);
    
    // Check if we have the required registers (same as parseBoxToMessage)
    if (!registers.R4 || !registers.R5 || !registers.R6) {
      console.log('Missing required registers R4, R5, or R6');
      return null;
    }

    // Use the same extractAndDecode function as parseBoxToMessage
    function extractAndDecode(register) {
      if (!register) return '';
     
      let value = register.renderedValue || register.serializedValue || String(register);
     
      if (value.startsWith('0e')) {
        value = value.substring(4);
      }
     
      if (/^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0) {
        try {
          const bytes = [];
          for (let i = 0; i < value.length; i += 2) {
            bytes.push(parseInt(value.substring(i, i + 2), 16));
          }
          return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        } catch (e) {
          return value;
        }
      }
      return value;
    }

    // Parse using the same logic as parseBoxToMessage
    const sender = extractAndDecode(registers.R4);
    let content = extractAndDecode(registers.R5);
    const timestamp = parseInt(registers.R6?.renderedValue || registers.R6?.serializedValue) || Math.floor(Date.now() / 1000);
    const chatroomId = registers.R7 ? extractAndDecode(registers.R7) : 'general';
    const parentId = registers.R8 ? extractAndDecode(registers.R8) : null;

    console.log('Parsed explorer mempool values:', { sender, content, timestamp, chatroomId, parentId });

    // Process encrypted content (same as parseBoxToMessage)
    content = processMessageContent(content);

    // Validate that we have essential data
    if (!sender || !content) {
      console.log('Missing sender or content after parsing');
      return null;
    }

    return {
      id: tx.id || tx.transactionId,
      sender: sender.length > 12 ? `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}` : sender,
      content,
      timestamp,
      chatroomId,
      parentId,
      pending: true,
      isMempool: true,
      source: 'explorer'
    };
  } catch (err) {
    console.warn('Failed to parse explorer mempool transaction:', err);
    return null;
  }
}

/**
 * Fallback to explorer API if node fails
 * @param {string} currentChatroom - Current chatroom
 * @returns {Promise<Array>} - Fallback mempool messages
 */
async function fetchMempoolMessagesExplorerFallback(currentChatroom) {
  try {
    console.log('Using explorer API fallback for mempool messages...');
    
    const response = await fetch(`${API_BASE}/mempool/transactions/byAddress/${DEMO_CHAT_CONTRACT}`);
    
    if (!response.ok) {
      console.warn('Explorer fallback also failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items) {
      return [];
    }
    
    const mempoolMessages = [];
    for (const tx of data.items) {
      const message = parseMempoolTxToMessage(tx); // Use explorer parsing
      
      if (message && (!currentChatroom || message.chatroomId === currentChatroom)) {
        message.source = 'explorer'; // Mark as coming from explorer
        mempoolMessages.push(message);
      }
    }
    
    return mempoolMessages;
    
  } catch (err) {
    console.error('Explorer fallback also failed:', err);
    return [];
  }
}

/**
 * Fetch mempool messages directly from Ergo node with explorer fallback
 * @param {string} currentChatroom - Current chatroom filter
 * @returns {Promise<Array>} - Array of mempool messages
 */
export async function fetchMempoolMessages(currentChatroom = 'general') {
  try {
    console.log('🔍 Fetching mempool messages from node for chatroom:', currentChatroom);
    
    // Try different node endpoints for mempool
    const possibleEndpoints = [
      '/transactions/unconfirmed',
      '/transactions/pool',
      '/mempool/transactions',
      '/api/v1/mempool/transactions'
    ];
    
    let mempoolTxs = [];
    let successfulEndpoint = null;
    
    // Try node endpoints first
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying node endpoint: ${endpoint}`);
        const response = await fetchWithCORSFallback(endpoint);
        const data = await response.json();
        
        mempoolTxs = Array.isArray(data) ? data : (data.transactions || data.items || []);
        
        if (mempoolTxs.length >= 0) { // Even empty array is success
          successfulEndpoint = endpoint;
          console.log(`✅ Successfully used node endpoint: ${endpoint}`);
          break;
        }
        
      } catch (error) {
        console.warn(`Node endpoint ${endpoint} failed:`, error.message);
        continue;
      }
    }
    
    // If node failed, try explorer fallback
    if (!successfulEndpoint) {
      console.log('All node endpoints failed, falling back to explorer API...');
      return await fetchMempoolMessagesExplorerFallback(currentChatroom);
    }
    
    console.log(`Found ${mempoolTxs.length} total mempool transactions from node`);
    
    // Filter transactions that interact with our chat contract
    const chatTransactions = mempoolTxs.filter(tx => {
      if (!tx.outputs || !Array.isArray(tx.outputs)) return false;
      
      return tx.outputs.some(output => {
        return output.ergoTree === PULSE_ERGOTREE; 
      });
    });
    
    console.log(`Found ${chatTransactions.length} chat-related mempool transactions`);
    
    // Parse transactions into messages
    const mempoolMessages = [];
    for (const tx of chatTransactions) {
      try {
        const message = parseNodeMempoolTxToMessage(tx);
        
        if (message && (!currentChatroom || message.chatroomId === currentChatroom)) {
          console.log('✅ Parsed mempool message:', message.id, message.content.substring(0, 50));
          mempoolMessages.push(message);
        }
      } catch (parseError) {
        console.warn('Failed to parse mempool transaction:', tx.id, parseError);
      }
    }
    
    console.log(`Returning ${mempoolMessages.length} mempool messages for chatroom: ${currentChatroom}`);
    return mempoolMessages;
    
  } catch (err) {
    console.error('Node mempool fetch failed completely:', err);
    
    // Final fallback to explorer API
    console.log('Final fallback to explorer API...');
    return await fetchMempoolMessagesExplorerFallback(currentChatroom);
  }
}

// ============= MNEMONIC WALLET CLASS =============

/**
 * MnemonicWallet class for direct blockchain interaction using seed phrases
 */
export class MnemonicWallet {
  constructor(mnemonic, password = "") {
    this.mnemonic = mnemonic;
    this.password = password;
    this.prover = new Prover();
    this.pendingUTXOs = new Set();
    this.localOutputs = [];
  }

  /**
   * Get HD key for specific wallet index
   * @param {number} walletIndex - Wallet derivation index
   * @returns {Promise<ErgoHDKey>} - HD key object
   */
  async getRootKey(walletIndex = WALLET_CONFIG.DEFAULT_WALLET_INDEX) {
    return await ErgoHDKey.fromMnemonic(this.mnemonic, {
      passphrase: this.password,
      path: WALLET_CONFIG.DERIVATION_PATH(walletIndex)
    });
  }

  /**
   * Get wallet address for specific index
   * @param {number} walletIndex - Wallet derivation index
   * @returns {Promise<string>} - Wallet address
   */
  async getAddress(walletIndex = WALLET_CONFIG.DEFAULT_WALLET_INDEX) {
    const rootKey = await this.getRootKey(walletIndex);
    return rootKey.address.encode(NETWORK_TYPE);
  }

  /**
   * Initialize wallet and set main address
   */
  async init() {
    this.address = await this.getAddress(0);
    console.log("Wallet initialized with address:", this.address);
  }

  /**
   * Get address synchronously (after init)
   * @returns {string} - Wallet address
   */
  getAddressSync() {
    return this.address;
  }

  /**
   * Get available UTXOs excluding pending ones
   * @returns {Promise<Array>} - Array of available UTXO boxes
   */
  async getAvailableUtxos() {
    try {
      const response = await fetch(`${API_BASE}/boxes/unspent/byAddress/${this.address}?limit=100`);
      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.UTXO_FETCH_FAILED(response.status));
      }
      
      const data = await response.json();
      const blockchainUtxos = data.items || [];
      
      // Filter out UTXOs that are already being used in pending transactions
      const availableUtxos = blockchainUtxos.filter(utxo => !this.pendingUTXOs.has(utxo.boxId));
      
      // Add any local outputs from our pending transactions
      const allUtxos = [...availableUtxos, ...this.localOutputs];
      
      console.log(`Available UTXOs: ${availableUtxos.length} from blockchain + ${this.localOutputs.length} local = ${allUtxos.length} total`);
      
      return allUtxos;
    } catch (error) {
      console.error('Error fetching UTXOs:', error);
      throw error;
    }
  }

  /**
   * Select boxes for transaction with UTXO chaining support
   * @param {bigint} requiredAmount - Required amount in nanoERG
   * @param {Array} tokens - Required tokens (optional)
   * @returns {Promise<Array>} - Selected boxes
   */
  async selectBoxesWithChaining(requiredAmount, tokens = []) {
    const utxos = await this.getAvailableUtxos();
    
    if (utxos.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_UTXOS);
    }

    // Convert UTXOs to proper format for BoxSelector
    const boxes = utxos.map(utxo => ({
      ...utxo,
      value: BigInt(utxo.value),
      assets: (utxo.assets || []).map(asset => ({
        tokenId: asset.tokenId,
        amount: BigInt(asset.amount)
      }))
    }));

    const selector = new BoxSelector(boxes);
    
    try {
      const selectedBoxes = selector.select({
        nanoErgs: requiredAmount,
        tokens: tokens
      });
      
      // Mark these UTXOs as pending to prevent double spending
      selectedBoxes.forEach(box => {
        if (box.boxId) {
          this.pendingUTXOs.add(box.boxId);
        }
      });
      
      return selectedBoxes;
    } catch (error) {
      throw new Error(ERROR_MESSAGES.INSUFFICIENT_BALANCE);
    }
  }

  /**
   * Build an unsigned transaction
   * @param {number} blockHeight - Current blockchain height
   * @param {Array} inputs - Input boxes
   * @param {Array} outputs - Output boxes
   * @param {bigint} fee - Transaction fee
   * @param {number} walletIndex - Wallet index for change address
   * @returns {Promise<Object>} - Unsigned transaction in EIP12 format
   */
  async buildTransaction(blockHeight, inputs, outputs, fee = TRANSACTION_FEE, walletIndex = 0) {
    if (!blockHeight) {
      throw new Error(ERROR_MESSAGES.HEIGHT_FETCH_FAILED);
    }

    const changeAddress = await this.getAddress(walletIndex);
    
    return new TransactionBuilder(blockHeight)
      .from(inputs)
      .to(outputs)
      .sendChangeTo(changeAddress)
      .payFee(fee)
      .build()
      .toEIP12Object();
  }

  /**
   * Sign an unsigned transaction
   * @param {Object} unsignedTransaction - Unsigned transaction in EIP12 format
   * @param {number} walletIndex - Wallet index for signing
   * @returns {Promise<Object>} - Signed transaction
   */
  async signTransaction(unsignedTransaction, walletIndex = 0) {
    console.log('Signing transaction with proper EIP12 format...');
    
    const rootKey = await this.getRootKey(walletIndex);
    const signedTx = this.prover.signTransaction(unsignedTransaction, [rootKey]);
    
    console.log('Transaction signed successfully');
    return signedTx;
  }

  /**
   * Submit a signed transaction to the blockchain
   * @param {Object} signedTx - Signed transaction
   * @returns {Promise<string>} - Transaction ID
   */
  async submitTransaction(signedTx) {
    try {
      console.log('Submitting transaction...');
      
      // Validate transaction before submission
      if (!signedTx || !signedTx.id) {
        throw new Error(ERROR_MESSAGES.INVALID_SIGNED_TX);
      }

      if (!signedTx.inputs || signedTx.inputs.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_INPUTS);
      }

      if (!signedTx.outputs || signedTx.outputs.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_OUTPUTS);
      }
      
      // Try node first, then fallback to explorer
      let response;
      let txId;
      
      try {
        // Try submitting to node first
        response = await fetchWithCORSFallback('/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signedTx)
        });

        if (response.ok) {
          const responseText = await response.text();
          let result;
          try {
            result = JSON.parse(responseText);
          } catch (e) {
            result = { id: responseText.trim() };
          }
          
          txId = result.id || result.transactionId || result;
          console.log('Transaction submitted successfully to node:', txId);
          return txId;
        } else {
          throw new Error(`Node submission failed: ${response.status}`);
        }
        
      } catch (nodeError) {
        console.warn('Node submission failed, trying explorer:', nodeError.message);
        
        // Fallback to explorer API
        response = await fetch(`${API_BASE}/mempool/transactions/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signedTx)
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          console.error('Explorer API Error Response:', responseText);
          
          // Parse specific error types for better handling
          if (responseText.includes('double spend')) {
            throw new Error(ERROR_MESSAGES.DOUBLE_SPEND);
          } else {
            throw new Error(ERROR_MESSAGES.TRANSACTION_SUBMIT_FAILED(response.status, responseText));
          }
        }

        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          result = { id: responseText.trim() };
        }

        txId = result.id || result.transactionId || result;
      }
      
      if (!txId) {
        throw new Error(ERROR_MESSAGES.NO_TX_ID);
      }

      console.log('Transaction submitted successfully:', txId);
      return txId;
      
    } catch (error) {
      console.error('Error submitting transaction:', error);
      throw error;
    }
  }

  /**
   * Add local outputs for UTXO chaining
   * @param {Object} signedTx - Signed transaction
   * @param {string} changeAddress - Change address
   */
  addLocalOutputs(signedTx, changeAddress) {
    try {
      if (signedTx.outputs) {
        signedTx.outputs.forEach((output, index) => {
          // Check if this output goes back to our wallet (change output)
          if (output.ergoTree && this.isOurAddress(output.ergoTree, changeAddress)) {
            const localOutput = {
              boxId: `${signedTx.id}-${index}`,
              transactionId: signedTx.id,
              index: index,
              value: output.value,
              ergoTree: output.ergoTree,
              assets: output.assets || [],
              creationHeight: output.creationHeight,
              additionalRegisters: output.additionalRegisters || {},
              isLocal: true,
              timestamp: Date.now()
            };
            
            this.localOutputs.push(localOutput);
            console.log('Added local output for chaining:', localOutput.boxId);
          }
        });
      }
    } catch (error) {
      console.error('Error tracking local outputs:', error);
    }
  }

  /**
   * Check if an ergoTree belongs to our address (simplified)
   * @param {string} ergoTree - ErgoTree to check
   * @param {string} address - Our address
   * @returns {boolean} - True if it's our address
   */
  isOurAddress(ergoTree, address) {
    // Simplified check - in practice you'd need proper address/ergoTree conversion
    return true;
  }

  /**
   * Refresh UTXO state by cleaning up old local outputs
   */
  refreshUTXOState() {
    // Clean up old local outputs (older than 2 minutes)
    const twoMinutesAgo = Date.now() - TRANSACTION_CONFIG.CLEANUP_TIMEOUT;
    this.localOutputs = this.localOutputs.filter(output => {
      const outputAge = Date.now() - (output.timestamp || 0);
      return outputAge < TRANSACTION_CONFIG.CLEANUP_TIMEOUT;
    });

    // Clear very old pending UTXOs
    if (this.pendingUTXOs.size > 10) {
      console.log('Clearing old pending UTXOs...');
      this.pendingUTXOs.clear();
    }
  }

  /**
   * Clean up failed transaction state
   */
  cleanupFailedTransaction() {
    console.log('Cleaning up failed transaction state...');
    const pendingArray = Array.from(this.pendingUTXOs);
    if (pendingArray.length > 0) {
      const lastUtxo = pendingArray[pendingArray.length - 1];
      this.pendingUTXOs.delete(lastUtxo);
      console.log('Removed last pending UTXO:', lastUtxo);
    }
  }
}

// ============= TRANSACTION QUEUE SYSTEM =============

/**
 * TransactionQueue class for managing sequential transaction processing
 */
export class TransactionQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Add a message to the transaction queue
   * @param {Object} messageData - Message data to process
   * @returns {Promise<Object>} - Promise that resolves with transaction result
   */
  async add(messageData) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: Date.now() + Math.random(),
        messageData,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
        maxRetries: TRANSACTION_CONFIG.MAX_RETRIES
      };
      
      this.queue.push(queueItem);
      console.log(`Added message to queue. Queue length: ${this.queue.length}`);
      
      if (!this.isProcessing) {
        this.process();
      }
    });
  }

  /**
   * Process the transaction queue
   */
  async process() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    console.log('Starting transaction queue processing...');
    
    while (this.queue.length > 0) {
      const queueItem = this.queue.shift();
      
      try {
        console.log(`Processing queued transaction ${queueItem.id} (attempt ${queueItem.retries + 1})...`);
        
        // Add exponential backoff for retries
        if (queueItem.retries > 0) {
          const delay = Math.min(
            TRANSACTION_CONFIG.RETRY_DELAYS[queueItem.retries - 1] || 
            TRANSACTION_CONFIG.RETRY_DELAYS[TRANSACTION_CONFIG.RETRY_DELAYS.length - 1], 
            5000
          );
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await this.processSingleMessage(queueItem.messageData);
        queueItem.resolve(result);
        
        // Success - add delay for blockchain propagation
        if (this.queue.length > 0) {
          console.log(`Transaction successful, waiting ${TRANSACTION_CONFIG.BLOCKCHAIN_PROPAGATION_DELAY}ms for blockchain propagation...`);
          await new Promise(resolve => setTimeout(resolve, TRANSACTION_CONFIG.BLOCKCHAIN_PROPAGATION_DELAY));
        }
        
      } catch (error) {
        console.error(`Error processing queued transaction ${queueItem.id}:`, error);
        
        // Retry logic
        if (queueItem.retries < queueItem.maxRetries) {
          queueItem.retries++;
          console.log(`Retrying transaction ${queueItem.id} (${queueItem.retries}/${queueItem.maxRetries})...`);
          
          // Put back in queue for retry
          this.queue.unshift(queueItem);
        } else {
          console.error(`Transaction ${queueItem.id} failed after ${queueItem.maxRetries} retries`);
          queueItem.reject(error);
        }
      }
    }
    
    this.isProcessing = false;
    console.log('Transaction queue processing completed');
  }

  /**
   * Process a single message (to be implemented by queue user)
   * @param {Object} messageData - Message data to process
   * @throws {Error} - Must be implemented by queue user
   */
  async processSingleMessage(messageData) {
    throw new Error('processSingleMessage must be implemented by the queue user');
  }

  /**
   * Get current queue length
   * @returns {number} - Queue length
   */
  get length() {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.isProcessing = false;
  }
}

// ============= UTILITY FUNCTIONS =============

/**
 * Create a delay promise
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Result of function or throws last error
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) {
        throw lastError;
      }
      
      const delayTime = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1} failed, waiting ${delayTime}ms...`);
      await delay(delayTime);
    }
  }
  
  throw lastError;
}

/**
 * Validate an Ergo address
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid address
 */
export function isValidErgoAddress(address) {
  try {
    ErgoAddress.fromBase58(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Convert nanoERG to ERG
 * @param {bigint|string|number} nanoErg - Amount in nanoERG
 * @returns {string} - Amount in ERG
 */
export function nanoErgToErg(nanoErg) {
  const amount = BigInt(nanoErg);
  const erg = Number(amount) / 1000000000;
  return erg.toFixed(9).replace(/\.?0+$/, '');
}

/**
 * Convert ERG to nanoERG
 * @param {string|number} erg - Amount in ERG
 * @returns {bigint} - Amount in nanoERG
 */
export function ergToNanoErg(erg) {
  const amount = parseFloat(erg);
  return BigInt(Math.floor(amount * 1000000000));
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted time string
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * Convert hex string to UTF-8 string
 */
export function hexToString(hex) {
  if (!hex) return '';
  
  console.log('Converting hex to string:', hex);
  
  // Remove '0e' prefix if present (Ergo encoding)
  let cleanHex = hex.startsWith('0e') ? hex.substring(2) : hex;
  
  // Remove length prefix (first 2 chars usually indicate length)
  if (cleanHex.length > 2) {
    cleanHex = cleanHex.substring(2);
  }
  
  try {
    let result = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const hexPair = cleanHex.substr(i, 2);
      const charCode = parseInt(hexPair, 16);
      if (charCode > 0) {
        result += String.fromCharCode(charCode);
      }
    }
    console.log('Hex conversion result:', result);
    return result;
  } catch (err) {
    console.warn('Failed to convert hex to string:', hex, err);
    return '';
  }
}

/**
 * Truncate address for display
 * @param {string} address - Full address
 * @param {number} prefixLength - Length of prefix to show
 * @param {number} suffixLength - Length of suffix to show
 * @returns {string} - Truncated address
 */
export function truncateAddress(address, prefixLength = 6, suffixLength = 4) {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address;
  }
  return `${address.substring(0, prefixLength)}...${address.substring(address.length - suffixLength)}`;
}

// ============= DEBUG AND TEST FUNCTIONS =============

/**
 * Test node connectivity and mempool access
 */
export async function testNodeConnection() {
  console.log('🧪 Testing node connection...');
  
  const tests = [
    {
      name: 'Node Info',
      endpoint: '/info',
      description: 'Basic node information'
    },
    {
      name: 'Mempool Size',
      endpoint: '/transactions/unconfirmed',
      description: 'Get mempool transactions'
    },
    {
      name: 'Alternative Mempool',
      endpoint: '/transactions/pool',
      description: 'Alternative mempool endpoint'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n--- Testing: ${test.name} ---`);
      console.log(`Endpoint: ${NODE_ENDPOINTS[0].url}${test.endpoint}`);
      
      const response = await fetchWithCORSFallback(test.endpoint);
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${test.name} - Success!`);
        
        if (test.endpoint.includes('transactions')) {
          const txs = Array.isArray(data) ? data : (data.transactions || data.items || []);
          console.log(`Found ${txs.length} transactions in mempool`);
          
          // Check for chat transactions
          const chatTxs = txs.filter(tx => 
          tx.outputs?.some(output => output.ergoTree === PULSE_ERGOTREE)
          );
          console.log(`Found ${chatTxs.length} chat-related transactions`);
          
          if (chatTxs.length > 0) {
            console.log('Sample chat transaction:', chatTxs[0]);
          }
        } else {
          console.log('Response sample:', JSON.stringify(data, null, 2).substring(0, 500));
        }
      } else {
        console.log(`❌ ${test.name} - Failed: ${response.status}`);
        const text = await response.text();
        console.log('Error response:', text.substring(0, 200));
      }
      
    } catch (error) {
      console.log(`❌ ${test.name} - Error:`, error.message);
    }
  }
  
  console.log('\n🏁 Node connection test completed');
}

/**
 * Test specific mempool message parsing
 */
export async function testMempoolParsing() {
  try {
    console.log('🧪 Testing mempool message parsing...');
    const messages = await fetchMempoolMessages('general');
    
    console.log(`Found ${messages.length} mempool messages`);
    
    messages.forEach((msg, i) => {
      console.log(`Message ${i + 1}:`, {
        id: msg.id,
        sender: msg.sender,
        content: msg.content.substring(0, 50) + '...',
        chatroom: msg.chatroomId,
        pending: msg.pending,
        source: msg.source
      });
    });
    
  } catch (error) {
    console.error('Failed to test mempool parsing:', error);
  }
}

// Auto-expose test functions in development
if (typeof window !== 'undefined') {
  // Always expose in development environments
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('dev') ||
      window.location.port) {
    
    window.testNodeConnection = testNodeConnection;
    window.testMempoolParsing = testMempoolParsing;
    
    // Also expose the main fetch function for manual testing
    window.fetchMempoolMessages = fetchMempoolMessages;
    window.fetchWithCORSFallback = fetchWithCORSFallback;
    
    console.log('🔧 Node test functions available:');
    console.log('- window.testNodeConnection()');
    console.log('- window.testMempoolParsing()');
    console.log('- window.fetchMempoolMessages("general")');
    console.log('- window.fetchWithCORSFallback("/info")');
  }
}

// ============= EXPORTS =============

export default {
  // Node utilities
  fetchWithCORSFallback,
  testNodeConnection,
  testMempoolParsing,
  
  // Encryption
  encryptMessage,
  decryptMessage,
  processMessageContent,
  hasEncryptedContent,
  extractEncryptedParts,
  isValidEncryptedMessage,
  
  // Mempool
  fetchMempoolMessages,
  parseNodeMempoolTxToMessage,
  parseMempoolTxToMessage,
  
  // Blockchain
  getCurrentHeight,
  parseBoxToMessage,
  
  // Wallet
  MnemonicWallet,
  TransactionQueue,
  
  // Utilities
  delay,
  retryWithBackoff,
  isValidErgoAddress,
  nanoErgToErg,
  ergToNanoErg,
  formatTimestamp,
  truncateAddress,
  hexToString
};