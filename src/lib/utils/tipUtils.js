// tipUtils.js - ERG Tip Transaction Utilities

/**
 * Send ERG tip using external wallet (like Nautilus)
 * @param {Object} tipData - Tip transaction data
 * @param {Object} selectedWallet - Selected wallet object
 * @returns {Promise<string>} - Transaction ID
 */
export async function sendTipWithExternalWallet(tipData, selectedWallet) {
  if (!selectedWallet || !selectedWallet.enable) {
    throw new Error('No wallet available. Please connect your wallet first.');
  }

  try {
    // Enable wallet if not already enabled
    if (!selectedWallet.isEnabled) {
      await selectedWallet.enable();
    }

    // Get wallet API
    const walletApi = await selectedWallet.enable();
    
    // Convert ERG amount to nanoERGs (1 ERG = 1,000,000,000 nanoERGs)
    const nanoErgs = Math.floor(tipData.amount * 1_000_000_000);
    
    // Get current height for transaction
    const currentHeight = await getCurrentHeight();
    
    // Create transaction request
    const transactionRequest = {
      requests: [{
        address: tipData.recipientAddress,
        value: nanoErgs.toString(),
        assets: [] // Empty for ERG-only transactions
      }],
      fee: 1_000_000, // 0.001 ERG fee in nanoERGs
      sendChangeTo: await walletApi.get_change_address(),
      dataInputs: []
    };

    // Sign and submit transaction
    const unsignedTx = await walletApi.sign_tx(transactionRequest);
    const txId = await walletApi.submit_tx(unsignedTx);

    return txId;

  } catch (error) {
    console.error('External wallet tip error:', error);
    
    // Handle specific wallet errors
    if (error.message?.includes('insufficient')) {
      throw new Error('Insufficient ERG balance to send this tip');
    } else if (error.message?.includes('rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error.message?.includes('network')) {
      throw new Error('Network error. Please try again.');
    }
    
    throw new Error(`Failed to send tip: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Send ERG tip using mnemonic wallet
 * @param {Object} tipData - Tip transaction data
 * @param {Object} mnemonicWallet - Mnemonic wallet instance
 * @returns {Promise<string>} - Transaction ID
 */
export async function sendTipWithMnemonicWallet(tipData, mnemonicWallet) {
  if (!mnemonicWallet) {
    throw new Error('No mnemonic wallet available');
  }

  try {
    // Convert ERG amount to nanoERGs
    const nanoErgs = Math.floor(tipData.amount * 1_000_000_000);
    
    // Get current height
    const currentHeight = await getCurrentHeight();
    
    // Get wallet address and balance
    const senderAddress = mnemonicWallet.getAddressSync();
    const balance = await getAddressBalance(senderAddress);
    
    // Check if we have enough balance
    const totalCost = nanoErgs + 1_000_000; // amount + fee
    if (balance < totalCost) {
      throw new Error(`Insufficient balance. Need ${totalCost / 1_000_000_000} ERG, have ${balance / 1_000_000_000} ERG`);
    }

    // Create and sign transaction
    const txRequest = {
      recipient: tipData.recipientAddress,
      amount: nanoErgs,
      fee: 1_000_000,
      message: tipData.message || `Tip from ${tipData.senderAddress}`
    };

    // Build transaction using the mnemonic wallet
    const signedTx = await mnemonicWallet.buildAndSignTransaction(txRequest);
    
    // Submit to blockchain
    const txId = await submitTransaction(signedTx);
    
    return txId;

  } catch (error) {
    console.error('Mnemonic wallet tip error:', error);
    
    if (error.message?.includes('Insufficient')) {
      throw error; // Re-throw balance errors as-is
    }
    
    throw new Error(`Failed to send tip: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get current blockchain height
 * @returns {Promise<number>} - Current height
 */
export async function getCurrentHeight() {
  try {
    const response = await fetch('https://api.ergoplatform.com/api/v1/info');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.height;
  } catch (error) {
    console.error('Error getting current height:', error);
    // Return a reasonable default if API fails
    return 1000000;
  }
}

/**
 * Get address balance in nanoERGs
 * @param {string} address - ERG address
 * @returns {Promise<number>} - Balance in nanoERGs
 */
export async function getAddressBalance(address) {
  try {
    const response = await fetch(`https://api.ergoplatform.com/api/v1/addresses/${address}/balance/total`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return parseInt(data.balance) || 0;
  } catch (error) {
    console.error('Error getting address balance:', error);
    return 0;
  }
}

/**
 * Submit signed transaction to blockchain
 * @param {Object} signedTx - Signed transaction
 * @returns {Promise<string>} - Transaction ID
 */
export async function submitTransaction(signedTx) {
  try {
    const response = await fetch('https://api.ergoplatform.com/api/v1/mempool/transactions/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signedTx)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.id || result.txId;
    
  } catch (error) {
    console.error('Error submitting transaction:', error);
    throw new Error(`Failed to submit transaction: ${error.message}`);
  }
}

/**
 * Validate ERG address format
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid
 */
export function isValidErgoAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Clean up any "3" prefix if present
  const cleanAddress = address.startsWith('3') && address.length > 50 
    ? address.substring(1) 
    : address;

  // Basic validation - ERG addresses are typically 51-52 characters
  // and start with specific prefixes
  const ergoAddressRegex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{51,52}$/;
  return ergoAddressRegex.test(cleanAddress);
}

/**
 * Format ERG amount for display
 * @param {number} nanoErgs - Amount in nanoERGs
 * @returns {string} - Formatted amount
 */
export function formatErgAmount(nanoErgs) {
  const ergs = nanoErgs / 1_000_000_000;
  return ergs.toFixed(9).replace(/\.?0+$/, '');
}

/**
 * Parse ERG amount from string
 * @param {string} amount - Amount string
 * @returns {number} - Amount in nanoERGs
 */
export function parseErgAmount(amount) {
  const ergs = parseFloat(amount);
  if (isNaN(ergs) || ergs < 0) {
    throw new Error('Invalid amount');
  }
  return Math.floor(ergs * 1_000_000_000);
}

/**
 * Create optimistic tip record for UI
 * @param {Object} tipData - Tip data
 * @returns {Object} - Tip record
 */
export function createOptimisticTip(tipData) {
  return {
    id: `tip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'tip',
    sender: tipData.senderAddress,
    recipient: tipData.recipientAddress,
    amount: tipData.amount,
    token: tipData.token,
    message: tipData.message,
    timestamp: Math.floor(Date.now() / 1000),
    pending: true,
    txId: null
  };
}

/**
 * Check if user can afford tip (including fees)
 * @param {number} tipAmount - Tip amount in ERG
 * @param {number} currentBalance - Current balance in nanoERGs
 * @returns {Object} - { canAfford: boolean, needed: number, have: number }
 */
export function checkTipAffordability(tipAmount, currentBalance) {
  const tipInNanoErgs = parseErgAmount(tipAmount.toString());
  const feeInNanoErgs = 1_000_000; // 0.001 ERG
  const totalNeeded = tipInNanoErgs + feeInNanoErgs;
  
  return {
    canAfford: currentBalance >= totalNeeded,
    needed: totalNeeded / 1_000_000_000,
    have: currentBalance / 1_000_000_000,
    missing: Math.max(0, (totalNeeded - currentBalance) / 1_000_000_000)
  };
}

/**
 * Get transaction explorer URL
 * @param {string} txId - Transaction ID
 * @returns {string} - Explorer URL
 */
export function getTransactionUrl(txId) {
  return `https://explorer.ergoplatform.com/en/transactions/${txId}`;
}