<script lang="ts">
  import { run, self } from 'svelte/legacy';

  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { setContext } from 'svelte';
  import { slide, fade } from 'svelte/transition';

  // Import wallet and store components
  import {
    selected_wallet_ergo,
    connected_wallet_address,
    connected_wallet_addresses,
    wallet_init
  } from '$lib/store/store';

  // Import utility functions
  import { showCustomToast, truncateAddress } from '$lib/utils/utils';
  import { soundManager } from '$lib/utils/soundManager';
  import notificationSound from './notification.mp3';

  // Import components
  import WalletButton from '$lib/components/nav/WalletButton.svelte';
  import ErgopayModal from '$lib/components/common/ErgopayModal.svelte';
  import SoundToggle from '$lib/components/common/SoundToggle.svelte';
  import ChatroomSelector from './ChatroomSelector.svelte';
  import ThreadedMessage from './ThreadedMessage.svelte';
  import EmojiPicker from '$lib/components/main/EmojiPicker.svelte';
  import TipModal from '$lib/components/main/TipModal.svelte';
  import APIChatRoom from '$lib/components/main/APIChatRoom.svelte';
  import ProfanityFilterToggle from '$lib/components/main/ProfanityFilterToggle.svelte';
  import TokenPriceDisplay from '$lib/components/main/TokenPriceDisplay.svelte';
  import AdminDashboard from '$lib/components/main/AdminDashboard.svelte';
  import InfoModal from '$lib/components/main/InfoModal.svelte';
  import SmartAIFeatures from '$lib/components/main/SmartAIFeatures.svelte';
  import StealthAddressUI from '$lib/components/main/StealthAddressUI.svelte';
  import InboxSystem from '$lib/components/main/InboxSystem.svelte';
  import OnChainAchievements from '$lib/components/main/OnChainAchievements.svelte';
  import LiveStreamingRoom from '$lib/components/main/LiveStreamingRoom.svelte';
  import StreamPopup from '$lib/components/main/StreamPopup.svelte';
 import StreamGiftModal from './StreamGiftModal.svelte';
 import EscrowCreationModal from './EscrowCreationModal.svelte';
 import EscrowTradingWidget from './EscrowTradingWidget.svelte';
  // Import constants and utilities
  import {
    CHAT_CONTRACT,
    DEFAULT_CHATROOMS,
    ADMIN_WALLET_ADDRESS,
    API_CHAT_CONFIG,
    SUPPORTED_TOKENS,
    STORAGE_KEYS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES
  } from '$lib/common/mainConsts.js';

  import {
    cleanAddress,
    parseCommand,
    validateTipCommand,
    createDMRoomId,
    getOtherUserFromDMRoom,
    formatTime,
    isStreamAnnouncement,
    getFromStorage,
    setToStorage,
    createLogger,
    getUserFriendlyError,
    resolveTokenInfo
  } from '$lib/utils/mainUtils.js';

  import {
    getWalletInfo,
    validateWalletBalance,
    signAndSubmitTransaction,
    createMessageTx,
    createTipTx,
    createStreamRoomTx,
    createStreamEndTx,
    processTransactionResult,
    updateUTXOCache,
    getCommonBoxIds
  } from '$lib/utils/transactionUtils.js';

  // Import stores
  import { selectedChatroomId } from '$lib/components/main/chatstore';
  import { filterEnabled } from '$lib/components/main/profanityFilterStore';

  // Create logger
  const logger = createLogger('Landing');

  // Set up context
  setContext('profanityFilterEnabled', filterEnabled);

  // ============= State Variables =============

  // Core message state
  let messages: ChatMessage[] = [];
  let localMempoolMessages: ChatMessage[] = [];
  let allMessages: ChatMessage[] = [];
  let threadedMessages: ChatMessage[] = [];

  // Input and UI state
  let inputMessage = "";
  let sendingMessage = false;
  let loadingMessages = true;
  let errorMessage = "";
  let autoScroll = true;
  let showInfo = false;

  // Transaction state
  let unsignedTx = null;
  let showErgopayModal = false;
  let isAuth = false;

  // Pagination state
  let hasMoreMessages = true;
  let loadingMoreMessages = false;
  let messagePageSize = 1000;

  // Reply state
  let replyingTo = null;

  // Chatroom state
  let chatrooms = [];
  let unreadMessageCounts = {};
  let lastViewedTimestamps = {};

  // Command state
  let commandMode = false;
  let commandPrompt = null;
  let commandData = { amount: '', token: 'ERG', recipient: '' };
  let isValidTipCommand = false;

  // Modal states
  let showApiChat = false;
  let showTipModal = false;
  let showPriceDisplay = false;
  let showAdminDashboard = false;
  let showSmartAI = false;
  let showInbox = false;
  let showAchievements = false;
  let showLiveStream = false;
  let showStreamPopup = false;
  let showCreateStreamModal = false;
  let showGiftModal = false;

  // Gift modal data
  let giftModalData = {
    streamerAddress: '',
    streamerName: ''
  };

  // Tip state
  let tipAmount = '';
  let tipTokenId = 'ERG';
  let tipRecipient = '';

  // Search state
  let searchQuery = '';
  let searchResults = [];
  let showSearchResults = false;
  let searchMode = false;
  let highlightedMessageId = null;

  // Price command state
  let priceCommand = '';

  // Stealth mode state
  let isStealthMode = false;
  let stealthSenderInfo = null;

  // DM state
  let hasNewDMs = false;
  let unreadDMCount = 0;
  let includeAllRooms = false;

  // Achievement state
  let targetUserAddress = '';
  let targetUserName = '';

  // Stream state
  let streamData = null;
  let streamRooms = [];
  let streamMessages = [];
  let currentStreamData = {
  url: '',
  title: '',
  platform: '',
  isLive: true
};

  // Mobile menu state
  let showMobileMenu = false;
  let showUserMenu = false;

  // Intervals
  let intervalId;
  let cleanupIntervalId;
  let chatContainerElement;

  // URL navigation
  let urlNavigationInitialized = false;

  let shareMessageLink;
  let inboxEscrowData;
  let showEscrowFromInbox;





// ============= ALSO UPDATE YOUR mergeMessages FUNCTION =============
/**
 * Organize messages into threaded structure
 */
 function organizeThreadedMessages(messages) {
  try {
    if (!Array.isArray(messages)) {
      console.warn('organizeThreadedMessages: messages is not an array');
      return [];
    }
    
    const rootMessages = [];
    const messageMap = new Map();
    
    console.log(`Threading ${messages.length} messages...`);
    
    // Create a map for fast lookup
    for (const msg of messages) {
      if (!messageMap.has(msg.id)) {
        messageMap.set(msg.id, {...msg, replies: []});
      }
    }
    
    // Organize into parent-child relationships
    for (const msg of messages) {
      const message = messageMap.get(msg.id);
      
      if (msg.parentId && messageMap.has(msg.parentId)) {
        // This is a reply - add to parent's replies
        const parent = messageMap.get(msg.parentId);
        
        // Make sure parent has a replies array
        if (!parent.replies) {
          parent.replies = [];
        }
        
        // Add this message as a reply if not already there
        if (!parent.replies.some(reply => reply.id === message.id)) {
          parent.replies.push(message);
          console.log(`Added reply ${message.id} to parent ${parent.id}`);
        }
      } else {
        // This is a root message
        if (!rootMessages.some(root => root.id === message.id)) {
          rootMessages.push(message);
        }
      }
    }
    
    // Sort all messages by timestamp
    rootMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Sort all replies by timestamp
    for (const msg of rootMessages) {
      if (msg.replies && msg.replies.length > 0) {
        msg.replies.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`Message ${msg.id} has ${msg.replies.length} replies`);
      }
    }
    
    return rootMessages;
    
  } catch (error) {
    console.error('Error organizing threaded messages:', error);
    return [];
  }
}

/**
 * Populate reply information for threaded messages
 */
 function populateReplyInfo(messages, mempoolMessages) {
  const allMessages = [...messages, ...mempoolMessages];
  
  // Go through all messages to find parent-child relationships
  for (const message of allMessages) {
    if (message.parentId && !message.replyTo) {
      // Search for parent message
      const parent = allMessages.find(msg => msg.id === message.parentId);
      
      if (parent) {
        message.replyTo = {
          id: parent.id,
          sender: parent.sender,
          content: parent.content
        };
      }
    }
  }
}

// Simplified mergeMessages function to match Landing3.svelte behavior
function mergeMessages(confirmedMessages, mempoolMessages, chatroomId) {
  try {
    const confirmed = Array.isArray(confirmedMessages) ? confirmedMessages : [];
    const mempool = Array.isArray(mempoolMessages) ? mempoolMessages : [];
    
    console.log(`mergeMessages: confirmed=${confirmed.length}, mempool=${mempool.length}, chatroomId=${chatroomId}`);
    
    // For 'all' or 'inbox' mode, include all messages
    if (chatroomId === 'all' || chatroomId === 'inbox') {
      const allMessages = [...confirmed, ...mempool];
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`mergeMessages (all mode): returning ${allMessages.length} total messages`);
      return allMessages;
    }
    
    // For specific chatroom, filter messages
    const filteredConfirmed = confirmed.filter(msg => 
      !msg.chatroomId || msg.chatroomId === chatroomId || 
      (!msg.chatroomId && chatroomId === 'general')
    );
    
    const filteredMempool = mempool.filter(msg => 
      !msg.chatroomId || msg.chatroomId === chatroomId ||
      (!msg.chatroomId && chatroomId === 'general')
    );
    
    // Combine and sort
    const allMessages = [...filteredConfirmed, ...filteredMempool];
    allMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`mergeMessages: filtered confirmed=${filteredConfirmed.length}, mempool=${filteredMempool.length}, final=${allMessages.length}`);
    
    return allMessages;
    
  } catch (error) {
    console.error('Error merging messages:', error);
    return [];
  }
}

  // ============= Core Functions =============

  /**
   * Send a message to the blockchain
   */  async function sendMessage() {
    if (!walletConnected || !inputMessage.trim() || sendingMessage) {
      return;
    }

    try {
      sendingMessage = true;
      errorMessage = "";

      // Get wallet information
      const walletInfo = await getWalletInfo($selected_wallet_ergo, $connected_wallet_address);
      const { myAddress, height, utxos } = walletInfo;

      // Validate balance
      const balanceValidation = validateWalletBalance(utxos);
      if (!balanceValidation.valid) {
        errorMessage = balanceValidation.error;
        return;
      }

      // Determine sender for message
      let senderForMessage = cleanAddress(myAddress);
      if (isStealthMode && stealthSenderInfo) {
        senderForMessage = stealthSenderInfo.displayName;
        logger.debug("Sending message in stealth mode as:", senderForMessage);
      }

      // Create transaction
      const tx = createMessageTx({
        chatContract: CHAT_CONTRACT,
        userAddress: myAddress,
        userUtxos: utxos,
        height: height,
        message: inputMessage,
        chatroomId: $selectedChatroomId,
        parentId: replyingTo?.id,
        customSender: senderForMessage,
        chatrooms: chatrooms
      });

      if ($selected_wallet_ergo !== 'ergopay') {
        // Sign and submit with Nautilus
        const result = await signAndSubmitTransaction(tx, $selected_wallet_ergo);
        const { txId, signed } = result;

        logger.debug("Transaction submitted successfully:", txId);

        // Show success toast
        showCustomToast(
          `${SUCCESS_MESSAGES.MESSAGE_SENT}<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId.substring(0, 8)}...</a>`,
          3000,
          'success'
        );

        // Process transaction result
        const processed = processTransactionResult(txId, {
          type: 'message',
          messageContent: inputMessage,
          senderAddress: myAddress,
          chatroomId: $selectedChatroomId,
          parentId: replyingTo?.id,
          isStealthMode: isStealthMode,
          stealthSenderInfo: stealthSenderInfo
        });

        // Add to mempool
        localMempoolMessages = [...localMempoolMessages, processed.message];
        saveMempoolMessages(localMempoolMessages);

        // Clear input and reset state
        inputMessage = "";
        replyingTo = null;

        // Update UTXO cache
        const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
        const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
        await updateUTXOCache(myAddress, usedBoxIds, newOutputs);

      } else {
        // Use ErgoPay
        unsignedTx = tx;
        isAuth = false;
        showErgopayModal = true;
      }

    } catch (error) {
      logger.error("Error sending message:", error);
      errorMessage = getUserFriendlyError(error);
    } finally {
      sendingMessage = false;
    }
  }

  /**
   * Fetch messages for current chatroom
   */
  async function fetchMessages(loadMore = false, chatroomIdOrIncludeAll = $selectedChatroomId) {
    try {
      let chatroomId;
      let includeAll = false;

      if (typeof chatroomIdOrIncludeAll === 'boolean') {
        includeAll = chatroomIdOrIncludeAll;
        chatroomId = includeAll ? 'all' : $selectedChatroomId;
      } else {
        chatroomId = chatroomIdOrIncludeAll;
        includeAll = chatroomId === 'all' || chatroomId === 'inbox';
      }

      includeAllRooms = includeAll;

      logger.debug(`fetchMessages: loadMore=${loadMore}, chatroomId=${chatroomId}, includeAll=${includeAll}`);

      const previousMsgCount = messages.length;

      // Fetch confirmed messages - FIXED: Call the function directly
      await fetchConfirmedMessages(loadMore, chatroomId);

      // Fetch mempool messages (only if not loading more)
      if (!loadMore) {
        const mempoolMessages = await fetchMempoolMessages({
          chatroomId,
          chatrooms,
          currentUserAddress: $connected_wallet_address
        });

        localMempoolMessages = mempoolMessages;
      }
      
      // Populate reply information
      populateReplyInfo(messages, localMempoolMessages);

      // Save to storage
      saveMessages(messages, chatroomId, includeAll);
      saveMempoolMessages(localMempoolMessages);

      // Auto-scroll if enabled and not loading more
      if (autoScroll && !loadMore) {
        scrollToBottom();
      }

      logger.debug(`fetchMessages completed: confirmed=${messages.length}, mempool=${localMempoolMessages.length}`);

    } catch (error) {
      logger.error("Error fetching messages:", error);
    } finally {
      loadingMessages = false;
      loadingMoreMessages = false;
    }
  }

  /**
   * Select a chatroom
   */
  function selectChatroom(chatroomId: string) {
    if (chatroomId === $selectedChatroomId) return;

    logger.debug(`Switching to chatroom: ${chatroomId}`);

    // Mark room as viewed
    markRoomAsViewed(chatroomId);

    // Reset message state
    messages = [];
    localMempoolMessages = [];
    allMessages = [];
    threadedMessages = [];
    hasMoreMessages = true;
    loadingMessages = true;

    // Update selected chatroom
    selectedChatroomId.set(chatroomId);

    // Load messages for this chatroom
    fetchMessages(false, chatroomId);

    // Reset reply state
    replyingTo = null;

    // Scroll to bottom when changing rooms
    setTimeout(scrollToBottom, 100);
  }

  /**
   * Handle tip execution
   */
  async function executeTip() {
    try {
      if (sendingMessage) return;

      sendingMessage = true;
      errorMessage = "";

      // Get wallet information
      const walletInfo = await getWalletInfo($selected_wallet_ergo, $connected_wallet_address);
      const { myAddress, height, utxos } = walletInfo;

      // Validate balance
      const balanceValidation = validateWalletBalance(utxos);
      if (!balanceValidation.valid) {
        errorMessage = balanceValidation.error;
        return;
      }

      // Resolve token information
      let tokenInfo;
      try {
        showCustomToast("Fetching token details...", 1000, 'info');
        tokenInfo = await resolveTokenInfo(tipTokenId);
        logger.debug(`Resolved token: ${tokenInfo.name} (${tokenInfo.tokenId}), ${tokenInfo.decimals} decimals`);
      } catch (error) {
        errorMessage = error.message;
        return;
      }

      // Calculate amount with correct decimals
      let tipAmountValue;
      if (tokenInfo.tokenId === '') {
        tipAmountValue = BigInt(Math.floor(parseFloat(tipAmount) * 1000000000));
      } else {
        const multiplier = Math.pow(10, tokenInfo.decimals);
        tipAmountValue = BigInt(Math.floor(parseFloat(tipAmount) * multiplier));
      }

      logger.debug(`Sending ${tipAmount} ${tokenInfo.name} (${tipAmountValue} base units)`);

      // Create tip transaction
      const tx = createTipTx({
        recipientAddress: tipRecipient,
        senderAddress: myAddress,
        chatContractAddress: CHAT_CONTRACT,
        senderUtxos: utxos,
        height: height,
        tokenId: tokenInfo.tokenId,
        amount: tipAmountValue,
        tokenName: tokenInfo.name,
        chatroomId: $selectedChatroomId
      });

      // Set tip info for transaction processing
      window.ergoChatTipInfo = {
        sender: myAddress,
        recipient: tipRecipient,
        amount: tipAmount,
        tokenName: tokenInfo.name
      };

      if ($selected_wallet_ergo !== 'ergopay') {
        // Sign and submit with Nautilus
        const result = await signAndSubmitTransaction(tx, $selected_wallet_ergo);
        const { txId, signed } = result;

        // Process tip result
        onTxSubmitted(txId);

        // Update UTXO cache
        const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
        const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
        await updateUTXOCache(myAddress, usedBoxIds, newOutputs);

      } else {
        // Use ErgoPay
        unsignedTx = tx;
        isAuth = false;
        showErgopayModal = true;
      }

    } catch (error) {
      logger.error("Error sending tip:", error);
      errorMessage = getUserFriendlyError(error);
    } finally {
      sendingMessage = false;
      showTipModal = false;
    }
  }

  /**
   * Handle transaction submission
   */
  function onTxSubmitted(txId: string) {
    if (showTipModal || window.ergoChatTipInfo) {
      // This was a tip transaction
      showCustomToast(
        `${SUCCESS_MESSAGES.TIP_SENT}<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId}</a>`,
        3000,
        'success'
      );

      // Add tip notification to local mempool
      const tipInfo = window.ergoChatTipInfo || {};
      addTipMessageToMempool(
        txId,
        tipInfo.sender || $connected_wallet_address,
        tipInfo.recipient || tipRecipient,
        tipInfo.amount || tipAmount,
        tipInfo.tokenName || 'ERG',
        $selectedChatroomId
      );

      // Reset after use
      window.ergoChatTipInfo = null;
      showTipModal = false;
    } else {
      // This was a regular message
      showCustomToast(
        `${SUCCESS_MESSAGES.MESSAGE_SENT}<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId}</a>`,
        1000,
        'success'
      );

      // Add message to local mempool
      const timestamp = Math.floor(Date.now() / 1000);
      let senderForMessage = cleanAddress($connected_wallet_address);
      if (isStealthMode && stealthSenderInfo) {
        senderForMessage = stealthSenderInfo.displayName;
      }

      const newMessage = {
        id: txId,
        sender: senderForMessage,
        content: inputMessage,
        timestamp: timestamp,
        pending: true,
        chatroomId: $selectedChatroomId,
        parentId: replyingTo?.id,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          sender: replyingTo.sender,
          content: replyingTo.content
        } : null,
        isStealthMessage: isStealthMode,
        stealthDisplayName: isStealthMode ? stealthSenderInfo?.displayName : undefined
      };

      localMempoolMessages = [...localMempoolMessages, newMessage];
      saveMempoolMessages(localMempoolMessages);

      // Reset reply state
      replyingTo = null;
    }

    // Clear message input
    inputMessage = "";
  }

  // ============= Helper Functions =============

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainerElement) {
        chatContainerElement.scrollTop = chatContainerElement.scrollHeight;
      }
    }, 100);
  }

  function handleScroll() {
    if (!chatContainerElement) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerElement;
    autoScroll = scrollHeight - scrollTop - clientHeight < 100;
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (commandMode) {
        if (commandPrompt === '/tip' && isValidTipCommand) {
          executeTipCommand();
        }
        return;
      }

      if (inputMessage.startsWith('/')) {
        const command = parseCommand(inputMessage);
        if (command) {
          handleCommand(command);
          return;
        }
      }

      sendMessage();
    }

    if (event.key === 'Escape' && commandMode) {
      cancelCommand();
    }
  }
function handleShareMessage(event) {
  const { messageId, roomId } = event.detail;
  shareMessageLink(messageId, roomId || $selectedChatroomId);
}
/**
 * IMPROVED fetchConfirmedMessages with better error handling and logging
 */
async function fetchConfirmedMessages(loadMore = false, chatroomId = $selectedChatroomId) {
  try {
    console.log('=== FETCH CONFIRMED MESSAGES START ===');
    console.log('Parameters:', { loadMore, chatroomId, offset: loadMore ? messages.length : 0, limit: messagePageSize });
    console.log('CHAT_CONTRACT:', CHAT_CONTRACT);
    
    // Build API URL - INCREASE LIMIT to match Landing3.svelte
    const apiUrl = `https://api.ergoplatform.com/api/v1/boxes/byAddress/${CHAT_CONTRACT}`;
    const params = new URLSearchParams({
      limit: '500', // Increased from messagePageSize to match working version
      offset: 0
    });
    
    const fullUrl = `${apiUrl}?${params}`;
    console.log('Fetching from URL:', fullUrl);
    
    const response = await fetch(fullUrl, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API returned:', {
      itemsCount: data.items?.length || 0,
      total: data.total || 0,
      hasItems: !!data.items
    });
    
    if (!data.items || !Array.isArray(data.items)) {
      console.warn('API returned invalid data structure:', data);
      return;
    }
    
    // Parse boxes into messages
    const fetchedMessages = [];
    let successfulParses = 0;
    let failedParses = 0;
    
    console.log(`Processing ${data.items.length} boxes...`);
    
    for (let i = 0; i < data.items.length; i++) {
      const box = data.items[i];
      console.log(`Processing box ${i + 1}/${data.items.length}:`, box.transactionId?.substring(0, 8));
      
      try {
        const message = parseBoxToMessage(box);
        if (message) {
          // SIMPLIFIED FILTERING - include more messages like Landing3.svelte
          const shouldInclude = 
            chatroomId === 'all' || 
            chatroomId === 'inbox' || 
            !message.chatroomId || 
            message.chatroomId === chatroomId ||
            message.chatroomId === 'general' || // Always include general
            message.chatroomId.startsWith('dm-'); // Always include DMs for inbox
          
          if (shouldInclude) {
            fetchedMessages.push(message);
            successfulParses++;
            console.log(`✓ Successfully parsed message ${successfulParses}:`, message.content?.substring(0, 50));
          } else {
            console.log(`Filtered out message for chatroom ${message.chatroomId}`);
          }
        } else {
          failedParses++;
          console.log(`✗ Failed to parse box ${i + 1}`);
        }
      } catch (parseError) {
        failedParses++;
        console.error(`Error parsing box ${i + 1}:`, parseError);
        continue;
      }
    }
    
    console.log(`Parsing complete: ${successfulParses} successful, ${failedParses} failed`);
    
    // Sort messages by timestamp (oldest first for display)
    fetchedMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Update messages array DIRECTLY in this function
    if (loadMore) {
      messages = [...messages, ...fetchedMessages];
    } else {
      messages = fetchedMessages;
    }
    
    // Update pagination
    hasMoreMessages = data.total > (loadMore ? messages.length : fetchedMessages.length);
    
    // Save to localStorage like Landing3.svelte
    try {
      const messagesToStore = messages.slice(-1000);
      const storageKey = (chatroomId === 'all' || chatroomId === 'inbox') ? 'ergoChat_messages_all' : `ergoChat_messages_${chatroomId}`;
      localStorage.setItem(storageKey, JSON.stringify(messagesToStore));
    } catch (e) {
      console.warn('Error saving to localStorage:', e);
    }
    
    console.log(`=== FETCH CONFIRMED MESSAGES COMPLETE ===`);
    console.log(`Messages: ${messages.length}, hasMore: ${hasMoreMessages}`);
    
  } catch (error) {
    console.error('=== FETCH CONFIRMED MESSAGES ERROR ===', error);
  } finally {
    loadingMessages = false;
    loadingMoreMessages = false;
  }
}

// Simplified parseBoxToMessage function - match Landing3.svelte exactly
function parseBoxToMessage(box) {
  try {
    if (!box || !box.additionalRegisters) {
      return null;
    }

    const registers = box.additionalRegisters;
    
    if (!registers.R4 || !registers.R5 || !registers.R6) {
      return null;
    }

    // Helper function to extract register value
    function extractRegisterValue(register) {
      if (!register) return '';
      
      if (typeof register === 'string') {
        return register;
      }
      
      if (register.renderedValue) {
        return register.renderedValue;
      }
      
      if (register.serializedValue) {
        return register.serializedValue;
      }
      
      return String(register);
    }

    // Helper function to decode hex to string
    function decodeErgoHex(hex) {
      try {
        if (!hex || typeof hex !== 'string') {
          return String(hex);
        }
        
        // Remove 0e prefix if present
        if (hex.startsWith('0e')) {
          hex = hex.substring(4);
        }
        
        // Convert hex pairs to characters
        if (/^[0-9A-Fa-f]+$/.test(hex) && hex.length % 2 === 0) {
          const bytes = [];
          for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substring(i, i + 2), 16));
          }
          return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        }
        
        return hex;
      } catch (e) {
        return String(hex);
      }
    }

    // Extract and decode data - simplified like Landing3.svelte
    const senderRaw = extractRegisterValue(registers.R4);
    const contentRaw = extractRegisterValue(registers.R5);
    const timestampRaw = extractRegisterValue(registers.R6);
    const chatroomRaw = extractRegisterValue(registers.R7);
    const parentIdRaw = extractRegisterValue(registers.R8);

    const sender = decodeErgoHex(senderRaw);
    let content = decodeErgoHex(contentRaw);
    const timestamp = parseInt(timestampRaw) || Math.floor(Date.now() / 1000);
    const chatroomId = chatroomRaw ? decodeErgoHex(chatroomRaw) : 'general';
    const parentId = parentIdRaw ? decodeErgoHex(parentIdRaw) : null;

    // Simple encryption detection and decryption
    if (content && content.includes('enc-')) {
      console.log('Found encrypted content, decrypting:', content.substring(0, 30) + '...');
      content = extractAndDecryptAll(content);
      console.log('Decrypted content:', content.substring(0, 30) + '...');
    }

    // Create message object
    const message = {
      id: box.boxId || box.transactionId,
      sender: cleanAddress(sender),
      content: content,
      timestamp: timestamp,
      chatroomId: chatroomId,
      parentId: parentId,
      pending: false
    };

    console.log('parseBoxToMessage result:', {
      id: message.id?.substring(0, 8),
      sender: message.sender?.substring(0, 10),
      content: message.content?.substring(0, 30) + '...',
      chatroomId: message.chatroomId,
      parentId: message.parentId,
      timestamp: message.timestamp
    });

    return message;

  } catch (error) {
    console.error('Error parsing box to message:', error);
    return null;
  }
}

/**
* Extract sender address from box
*/
function extractSenderFromBox(box) {
try {
  // Try to get from R5 register (custom sender) first
  if (box.additionalRegisters?.R5?.renderedValue) {
    return box.additionalRegisters.R5.renderedValue;
  }
  
  // Fallback to transaction sender (you may need to adjust this)
  // This is a simplified approach - you might need to look at the transaction inputs
  return box.address || 'Unknown';
  
} catch (error) {
  logger.warn('Error extracting sender from box:', error);
  return 'Unknown';
}
}

/**
* Extract timestamp from box
*/
function extractTimestampFromBox(box) {
try {
  // Try to get from R6 register first
  if (box.additionalRegisters?.R6?.renderedValue) {
    return parseInt(box.additionalRegisters.R6.renderedValue);
  }
  
  // Fallback to block creation time (approximate)
  return Math.floor(Date.now() / 1000);
  
} catch (error) {
  logger.warn('Error extracting timestamp from box:', error);
  return Math.floor(Date.now() / 1000);
}
}

/**
* Extract chatroom ID from box
*/
function extractChatroomFromBox(box) {
try {
  // Try to get from R7 register
  if (box.additionalRegisters?.R7?.renderedValue) {
    return box.additionalRegisters.R7.renderedValue;
  }
  
  // Default to 'general' if no chatroom specified
  return 'general';
  
} catch (error) {
  logger.warn('Error extracting chatroom from box:', error);
  return 'general';
}
}

/**
* Extract parent message ID from box (for replies)
*/
function extractParentIdFromBox(box) {
try {
  // Try to get from R8 register
  if (box.additionalRegisters?.R8?.renderedValue) {
    return box.additionalRegisters.R8.renderedValue;
  }
  
  return null;
  
} catch (error) {
  logger.warn('Error extracting parent ID from box:', error);
  return null;
}
}

/**
* Fetch mempool messages (pending transactions)
*/
async function fetchMempoolMessages({ chatroomId, chatrooms, currentUserAddress }) {
try {
  // For now, return empty array - implement mempool fetching if needed
  // You would need to query the mempool API endpoint
  logger.debug('fetchMempoolMessages called - returning empty for now');
  return [];
  
} catch (error) {
  logger.error('Error in fetchMempoolMessages:', error);
  return [];
}
}


/**
* Simple message storage functions
*/
function saveMessages(messages, chatroomId, includeAll = false) {
try {
  const key = includeAll ? 'ergochat_all_messages' : `ergochat_messages_${chatroomId}`;
  localStorage.setItem(key, JSON.stringify(messages));
} catch (error) {
  logger.warn('Error saving messages:', error);
}
}

function loadMessages(chatroomId) {
try {
  const key = `ergochat_messages_${chatroomId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
} catch (error) {
  logger.warn('Error loading messages:', error);
  return [];
}
}

function saveMempoolMessages(messages) {
try {
  localStorage.setItem('ergochat_mempool_messages', JSON.stringify(messages));
} catch (error) {
  logger.warn('Error saving mempool messages:', error);
}
}

function loadMempoolMessages() {
try {
  const stored = localStorage.getItem('ergochat_mempool_messages');
  return stored ? JSON.parse(stored) : [];
} catch (error) {
  logger.warn('Error loading mempool messages:', error);
  return [];
}
}


function cleanupMempoolMessages(mempoolMessages) {
// Remove messages older than 1 hour from mempool
const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
return mempoolMessages.filter(msg => msg.timestamp > oneHourAgo);
}

function findMessageById(messages, id) {
return messages.find(msg => msg.id === id);
}

  function handleCommand(command) {
    switch (command.type) {
      case 'tip':
        if (command.valid) {
          handleTipCommand(command.data.amount, command.data.token, command.data.address);
        } else {
          errorMessage = command.error;
        }
        break;
      case 'help':
        displayHelpMessage();
        inputMessage = '';
        break;
      case 'price':
        priceCommand = inputMessage;
        showPriceDisplay = true;
        inputMessage = '';
        break;
      default:
        errorMessage = command.error;
    }
  }

  function handleTipCommand(amount: string, token: string, address: string) {
    if (!walletConnected) {
      errorMessage = ERROR_MESSAGES.WALLET_NOT_CONNECTED;
      return;
    }

    const validation = validateTipCommand(amount, token, address);
    if (!validation.isValid) {
      errorMessage = validation.errors.join(', ');
      return;
    }

    tipAmount = amount;
    tipTokenId = token;
    tipRecipient = address;
    showTipModal = true;
    inputMessage = "";
  }

  function displayHelpMessage() {
    const supportedTokensList = Object.keys(SUPPORTED_TOKENS).join(', ');

    const helpText = `
Available commands:
/tip [amount] [token] [address] - Send a tip to someone
/price [token] - Check token price (e.g., /price ERG, /price BUNS)
/help - Show this help message

Supported tokens: ${supportedTokensList}

Examples:
/tip 0.1 ERG 9hq...3aG4
/tip 10 BUNS 9hq...3aG4
/price ERG - View ERGO price and stats
    `;

    showCustomToast(helpText, 15000, 'info');
  }

  function markRoomAsViewed(roomId: string) {
    const now = Date.now();
    lastViewedTimestamps[roomId] = now;
    unreadMessageCounts[roomId] = 0;

    chatrooms = chatrooms.map(room => {
      if (room.id === roomId) {
        return { ...room, unreadCount: 0, hasNewMessages: false };
      }
      return room;
    });

    setToStorage(STORAGE_KEYS.LAST_VIEWED_TIMESTAMPS, lastViewedTimestamps);
  }

  function cancelCommand() {
    commandMode = false;
    commandPrompt = null;
    inputMessage = '';
    commandData = { amount: '', token: 'ERG', recipient: '' };
  }

  function isOwnMessage(msg) {
    return (walletConnected && msg.sender === cleanAddress($connected_wallet_address)) ||
           msg.isAIResponse;
  }

  function clearError() {
    errorMessage = "";
  }

  function toggleInbox() {
    showInbox = !showInbox;
    if (showInbox) {
      includeAllRooms = true;
      loadAllMessagesForInbox();
      hasNewDMs = false;
    } else {
      includeAllRooms = false;
      messages = [];
      localMempoolMessages = [];
      fetchMessages(false, $selectedChatroomId);
    }
  }

  function toggleInfo() {
    showInfo = !showInfo;
  }

  function toggleApiChat() {
    showApiChat = !showApiChat;
  }

  function closeApiChat() {
    showApiChat = false;
  }

  // ============= Component Lifecycle =============

  onMount(async () => {
  logger.debug("Landing component mounting...");
  
  // Initialize wallet
  wallet_init.set(true);

  // Load chatrooms WITH DISCOVERY - this is the key change
  await loadChatrooms(); // This now includes discovery
  
  // Initialize message tracking
  initializeMessageTracking();

  // Load cached messages FIRST
  loadCachedMessages();

  // Initialize wallet connection
  await initializeWalletConnection();

  // Fetch initial messages
  try {
    await fetchMessages(false, $selectedChatroomId);
    logger.debug("Initial message fetch completed");
  } catch (error) {
    logger.error("Error in initial message fetch:", error);
  }

  // Set up intervals
  intervalId = setInterval(() => {
    fetchMessages(false, $selectedChatroomId);
  }, 5000);
  
  cleanupIntervalId = setInterval(() => {
    localMempoolMessages = cleanupMempoolMessages(localMempoolMessages);
    saveMempoolMessages(localMempoolMessages);
  }, 10000);

  // Optional: Refresh discovered rooms every 60 seconds
  const roomRefreshInterval = setInterval(() => {
    refreshDiscoveredRooms();
  }, 60000);

  // Add debug functions to window for testing
  window.debugChat = {
    messageLoading: debugMessageLoading,
    fetchMessages: () => fetchMessages(false, $selectedChatroomId),
    loadCached: loadCachedMessages,
    testAPI: testAPI,
    refreshRooms: refreshDiscoveredRooms, // Add this for debugging
    state: () => ({
      messages: messages.length,
      mempool: localMempoolMessages.length,
      all: allMessages.length,
      threaded: threadedMessages.length,
      chatroom: $selectedChatroomId,
      loading: loadingMessages,
      chatrooms: chatrooms.length,
      discoveredRooms: chatrooms.filter(r => r.isDiscovered).length
    })
  };

  logger.debug("Landing component mounted successfully");

  return () => {
    if (intervalId) clearInterval(intervalId);
    if (cleanupIntervalId) clearInterval(cleanupIntervalId);
    if (roomRefreshInterval) clearInterval(roomRefreshInterval);
  };
});

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    if (cleanupIntervalId) clearInterval(cleanupIntervalId);
  });
/**
 * Discover rooms from blockchain
 */
async function discoverRoomsFromBlockchain() {
  try {
    console.log('=== DISCOVERING ROOMS FROM BLOCKCHAIN ===');
    
    const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${CHAT_CONTRACT}?limit=500`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const discoveredRoomsMap = new Map();
    
    console.log(`Processing ${data.items?.length || 0} boxes for room discovery...`);
    
    // Process all boxes to find unique chatroom IDs
    for (const box of data.items || []) {
      if (box.additionalRegisters && box.additionalRegisters.R7) {
        try {
          // Extract chatroom ID from register
          let chatroomRaw = '';
          if (typeof box.additionalRegisters.R7 === 'string') {
            chatroomRaw = box.additionalRegisters.R7;
          } else if (box.additionalRegisters.R7.serializedValue) {
            chatroomRaw = box.additionalRegisters.R7.serializedValue;
          } else if (box.additionalRegisters.R7.renderedValue) {
            chatroomRaw = box.additionalRegisters.R7.renderedValue;
          }
          
          const chatroomId = decodeErgoHex(chatroomRaw);
          
          // Skip if invalid
          if (!chatroomId) continue;
          
          // Skip default rooms, DM rooms, and stream rooms
          if (['general', 'trading', 'development', 'governance'].includes(chatroomId) ||
              chatroomId.startsWith('dm-') || 
              chatroomId.startsWith('stream-')) {
            continue;
          }
          
          // Handle private rooms
          if (chatroomId.startsWith('private-')) {
            if (!discoveredRoomsMap.has(chatroomId)) {
              const privatePart = chatroomId.substring(8);
              discoveredRoomsMap.set(chatroomId, {
                id: chatroomId,
                name: `Private Room ${privatePart.substring(0, 8)}`,
                description: 'Private chatroom',
                isPrivate: true,
                isDiscovered: true,
                messageCount: 1
              });
            } else {
              const room = discoveredRoomsMap.get(chatroomId);
              room.messageCount = (room.messageCount || 0) + 1;
            }
          }
          // Handle public discovered rooms
          else {
            if (!discoveredRoomsMap.has(chatroomId)) {
              discoveredRoomsMap.set(chatroomId, {
                id: chatroomId,
                name: formatDiscoveredRoomName(chatroomId),
                description: `Discovered room: ${chatroomId}`,
                isDiscovered: true,
                isPrivate: false,
                messageCount: 1
              });
            } else {
              const room = discoveredRoomsMap.get(chatroomId);
              room.messageCount = (room.messageCount || 0) + 1;
            }
          }
          
        } catch (e) {
          console.error("Error processing chatroom ID:", e);
        }
      }
    }
    
    const discoveredRooms = Array.from(discoveredRoomsMap.values());
    console.log(`Discovered ${discoveredRooms.length} rooms:`, discoveredRooms);
    
    return discoveredRooms;
    
  } catch (error) {
    console.error('Error discovering rooms from blockchain:', error);
    return [];
  }
}
/**
 * Decode ErgoHex string - same as AdminDashboard
 */
function decodeErgoHex(hex) {
  try {
    if (!hex || typeof hex !== 'string') {
      return String(hex);
    }
    
    if (/^[0-9A-Fa-f]+$/.test(hex)) {
      if (hex.startsWith('0e')) {
        hex = hex.substring(4);
        
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        
        const result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
        return result;
      }
    }
    
    return hex;
  } catch (e) {
    return String(hex);
  }
}

/**
 * Format discovered room name
 */
function formatDiscoveredRoomName(id) {
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
}
  // ============= Additional Helper Functions =============
async function loadChatrooms() {
  console.log('=== LOADING CHATROOMS WITH DISCOVERY ===');
  
  // Start with default chatrooms
  chatrooms = [...DEFAULT_CHATROOMS];
  
  // Load custom chatrooms from storage
  const storedRooms = getFromStorage(STORAGE_KEYS.ROOMS, []);
  for (const room of storedRooms) {
    if (!chatrooms.some(r => r.id === room.id) && !room.id.startsWith('dm-')) {
      chatrooms.push(room);
    }
  }
  
  // Discover rooms from blockchain
  try {
    const discoveredRooms = await discoverRoomsFromBlockchain();
    
    // Add discovered rooms to chatrooms array
    for (const room of discoveredRooms) {
      if (!chatrooms.some(r => r.id === room.id)) {
        chatrooms.push(room);
        console.log(`Added discovered room: ${room.name} (${room.id})`);
      }
    }
  } catch (error) {
    console.error('Error during room discovery:', error);
  }
  
  if (!$selectedChatroomId) {
    selectedChatroomId.set('general');
  }

  console.log(`Final chatrooms loaded: ${chatrooms.length}`, chatrooms);
}

  function initializeMessageTracking() {
    lastViewedTimestamps = getFromStorage(STORAGE_KEYS.LAST_VIEWED_TIMESTAMPS, {});
    
    for (const room of chatrooms) {
      unreadMessageCounts[room.id] = 0;
    }
    
    markRoomAsViewed($selectedChatroomId);
  }

  function loadCachedMessages() {
    try {
      messages = loadMessages($selectedChatroomId);
      localMempoolMessages = loadMempoolMessages();
      populateReplyInfo(messages, localMempoolMessages);
      
      logger.debug(`Loaded cached messages: confirmed=${messages.length}, mempool=${localMempoolMessages.length}`);
    } catch (error) {
      logger.error("Error loading cached messages:", error);
      messages = [];
      localMempoolMessages = [];
    }
  }

  async function initializeWalletConnection() {
    try {
      if (window.ergo) {
        let connected = false;
        try {
          if (typeof window.ergo.check_read_access === 'function') {
            connected = await window.ergo.check_read_access();
          } else if (typeof window.ergo.connect === 'function') {
            connected = await window.ergo.connect();
          }
        } catch (error) {
          logger.warn("Error connecting to wallet:", error);
        }

        if (connected) {
          let address;
          try {
            if (typeof window.ergo.get_change_address === 'function') {
              address = await window.ergo.get_change_address();
            } else if (typeof window.ergo.getChangeAddress === 'function') {
              address = await window.ergo.getChangeAddress();
            }
          } catch (error) {
            logger.warn("Error getting change address:", error);
          }

          soundManager.loadSound('newMessage', notificationSound);

          if (address) {
            connected_wallet_address.set(address);

            try {
              let addresses = [];
              if (typeof window.ergo.get_used_addresses === 'function') {
                addresses = await window.ergo.get_used_addresses();
              } else if (typeof window.ergo.getUsedAddresses === 'function') {
                addresses = await window.ergo.getUsedAddresses();
              }

              connected_wallet_addresses.set(addresses || []);
            } catch (error) {
              logger.warn("Error getting all addresses:", error);
            }

            selected_wallet_ergo.set('nautilus');
            logger.debug("Wallet connected successfully:", address);
          }
        }
      }
    } catch (error) {
      logger.error("Error initializing wallet:", error);
      wallet_init.set(false);
    }
  }

// 1. UPDATED FUNCTION TO OPEN GIFT MODAL WITH PROPER STREAMER ADDRESS DETECTION
function openGiftModal(streamerAddress, streamerName, roomId) {
  console.log('=== OPENING GIFT MODAL ===');
  console.log('Input parameters:', { streamerAddress, streamerName, roomId });
  
  if (!walletConnected) {
    console.log('❌ Wallet not connected');
    showCustomToast('Connect your wallet to send gifts', 3000, 'warning');
    return;
  }

  // Check if we're in a stream room
  if (!roomId || !roomId.startsWith('stream-')) {
    console.log('❌ Not in a stream room, roomId:', roomId);
    showCustomToast('Gifts can only be sent in stream rooms', 3000, 'warning');
    return;
  }

  // Try multiple methods to get the streamer address
  let finalStreamerAddress = null;
  let finalStreamerName = 'Unknown Streamer';

  console.log('🔍 Attempting to find streamer address...');

  // Method 1: From provided parameter
  if (streamerAddress && streamerAddress.length > 40) {
    finalStreamerAddress = streamerAddress;
    console.log('✅ Method 1: Got streamer address from parameter:', finalStreamerAddress);
  }

  // Method 2: From streamRooms array
  if (!finalStreamerAddress) {
    console.log('🔍 Method 2: Searching in streamRooms array...');
    console.log('Available streamRooms:', streamRooms);
    
    const stream = streamRooms.find(s => s.roomId === roomId);
    if (stream && stream.streamerAddress) {
      finalStreamerAddress = stream.streamerAddress;
      finalStreamerName = stream.streamerName || truncateAddress(stream.streamerAddress);
      console.log('✅ Method 2: Found in streamRooms:', { 
        address: finalStreamerAddress, 
        name: finalStreamerName 
      });
    } else {
      console.log('❌ Method 2: Not found in streamRooms');
    }
  }

  // Method 3: Parse from room ID
  if (!finalStreamerAddress) {
    console.log('🔍 Method 3: Parsing from room ID...');
    // Format: stream-{timestamp}-{streamerAddress}
    const parts = roomId.split('-');
    console.log('Room ID parts:', parts);
    
    if (parts.length >= 3) {
      const addressFromRoom = parts[2];
      if (addressFromRoom && addressFromRoom.length > 40) {
        finalStreamerAddress = addressFromRoom;
        console.log('✅ Method 3: Parsed from room ID:', finalStreamerAddress);
      } else {
        console.log('❌ Method 3: Invalid address in room ID:', addressFromRoom);
      }
    } else {
      console.log('❌ Method 3: Room ID format invalid');
    }
  }

  // Method 4: Search in all messages for stream announcement
  if (!finalStreamerAddress) {
    console.log('🔍 Method 4: Searching in messages for stream announcement...');
    const allMessagesForSearch = [...messages, ...localMempoolMessages];
    
    // Look for stream announcement message in this room
    const streamAnnouncement = allMessagesForSearch.find(msg => 
      msg.chatroomId === roomId && 
      (msg.content.includes('stream') || msg.content.includes('🎥') || msg.content.includes('📺')) &&
      msg.sender && 
      msg.sender.length > 40
    );
    
    if (streamAnnouncement) {
      finalStreamerAddress = streamAnnouncement.sender;
      finalStreamerName = truncateAddress(streamAnnouncement.sender);
      console.log('✅ Method 4: Found from stream announcement:', {
        address: finalStreamerAddress,
        message: streamAnnouncement.content.substring(0, 50)
      });
    } else {
      console.log('❌ Method 4: No stream announcement found');
    }
  }

  // Final validation
  if (!finalStreamerAddress) {
    console.log('❌ FAILED: Could not determine streamer address');
    showCustomToast('Could not determine streamer address for this room', 3000, 'error');
    return;
  }

  // Validate address format
  if (finalStreamerAddress.length < 40) {
    console.log('❌ FAILED: Invalid streamer address format:', finalStreamerAddress);
    showCustomToast('Invalid streamer address format', 3000, 'error');
    return;
  }

  // Set modal data
  giftModalData = {
    streamerAddress: finalStreamerAddress,
    streamerName: finalStreamerName,
    roomId: roomId
  };

  console.log('✅ SUCCESS: Opening gift modal with data:', giftModalData);
  showGiftModal = true;
}

// ============= GIFT SYSTEM USING EXISTING createTipTx =============

// 1. SIMPLIFIED handleSendGift function using createTipTx
async function handleSendGift(event) {
  console.log('=== HANDLING GIFT TRANSACTION (USING TIP TX) ===');
  const giftData = event.detail;
  console.log('Gift data received:', giftData);

  try {
    // Validate gift data
    if (!giftData || !giftData.streamerAddress || !giftData.amount) {
      throw new Error('Invalid gift data received');
    }

    console.log('🔍 Getting wallet information...');
    
    // Get wallet information
    const walletInfo = await getWalletInfo($selected_wallet_ergo, $connected_wallet_address);
    console.log('Wallet info retrieved:', {
      address: walletInfo.myAddress,
      height: walletInfo.height,
      utxosCount: walletInfo.utxos?.length
    });

    const { myAddress, height, utxos } = walletInfo;

    // Validate balance
    console.log('🔍 Validating wallet balance...');
    const balanceValidation = validateWalletBalance(utxos);
    console.log('Balance validation result:', balanceValidation);
    
    if (!balanceValidation.valid) {
      throw new Error(balanceValidation.error);
    }

    // Calculate amounts
    const giftAmountERG = giftData.amount;
    const giftAmountNanoERG = BigInt(Math.floor(giftAmountERG * 1000000000));
    
    console.log('💰 Amount calculations:', {
      giftAmountERG,
      giftAmountNanoERG: giftAmountNanoERG.toString(),
      senderAddress: myAddress,
      recipientAddress: giftData.streamerAddress
    });

    // Validate addresses
    if (myAddress === giftData.streamerAddress) {
      throw new Error('Cannot send gift to yourself');
    }

    console.log('🔍 Creating gift transaction using createTipTx...');

    // USE EXISTING createTipTx - THIS WORKS!
    const tx = createTipTx({
      recipientAddress: giftData.streamerAddress,
      senderAddress: myAddress,
      chatContractAddress: CHAT_CONTRACT,
      senderUtxos: utxos,
      height: height,
      tokenId: '', // ERG
      amount: giftAmountNanoERG,
      tokenName: 'ERG',
      chatroomId: giftData.roomId
    });

    console.log('✅ Gift transaction created using createTipTx');
    console.log('Transaction object:', {
      inputs: tx.inputs?.length,
      outputs: tx.outputs?.length,
      fee: tx.fee
    });

    // Store gift info for transaction processing
    window.ergoGiftInfo = giftData;

    // Handle different wallet types
    if ($selected_wallet_ergo !== 'ergopay') {
      console.log('🔍 Signing with Nautilus wallet...');
      
      // Sign and submit with Nautilus
      const result = await signAndSubmitTransaction(tx, $selected_wallet_ergo);
      console.log('Transaction result:', result);
      
      const { txId, signed } = result;

      console.log('✅ Gift transaction submitted successfully:', txId);

      // Show success toast with gift emoji
      showCustomToast(
        `🎁 ${giftData.giftEmoji} ${giftData.giftName} sent successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId.substring(0, 8)}...</a>`,
        5000,
        'success'
      );

      // Add gift message to mempool
      console.log('📝 Adding gift message to mempool...');
      addGiftMessageToMempool(txId, giftData);

      // Update UTXO cache
      console.log('🔄 Updating UTXO cache...');
      const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
      const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
      await updateUTXOCache(myAddress, usedBoxIds, newOutputs);

      // Clear gift info
      window.ergoGiftInfo = null;

      console.log('✅ GIFT TRANSACTION COMPLETED SUCCESSFULLY');

    } else {
      console.log('🔍 Using ErgoPay...');
      
      // Use ErgoPay
      unsignedTx = tx;
      isAuth = false;
      showErgopayModal = true;
      
      console.log('✅ ErgoPay modal opened');
    }

  } catch (error) {
    console.error('❌ GIFT TRANSACTION FAILED:', error);
    console.error('Error stack:', error.stack);
    
    showCustomToast(`Failed to send gift: ${getUserFriendlyError(error)}`, 5000, 'error');
    
    // Clear gift info on error
    window.ergoGiftInfo = null;
    
    // Re-throw so the modal can handle it
    throw error;
  }
}

// 2. ENHANCED addGiftMessageToMempool function
function addGiftMessageToMempool(txId, giftData) {
  console.log('=== ADDING GIFT MESSAGE TO MEMPOOL ===');
  console.log('Transaction ID:', txId);
  console.log('Gift data:', giftData);

  // Create a special gift message format
  const giftMessage = `🎁 ${truncateAddress(giftData.senderAddress)} sent ${giftData.count}x ${giftData.giftEmoji} ${giftData.giftName} (${giftData.amount} ERG) to the streamer!`;
  
  const timestamp = Math.floor(Date.now() / 1000);
  const newMessage = {
    id: txId,
    sender: cleanAddress(giftData.senderAddress),
    content: giftMessage,
    timestamp: timestamp,
    pending: true,
    chatroomId: giftData.roomId,
    parentId: null,
    replyTo: null,
    isGiftMessage: true,
    giftData: {
      giftId: giftData.giftId,
      giftName: giftData.giftName,
      giftEmoji: giftData.giftEmoji,
      count: giftData.count,
      amount: giftData.amount,
      rarity: giftData.rarity,
      recipientAddress: giftData.streamerAddress,
      recipientName: giftData.streamerName
    }
  };
  
  console.log('Gift message created:', newMessage);
  
  localMempoolMessages = [...localMempoolMessages, newMessage];
  saveMempoolMessages(localMempoolMessages);

  console.log('✅ Gift message added to mempool, total mempool messages:', localMempoolMessages.length);
}


// Get streamer name for a room
function getStreamerNameForRoom(roomId) {
  if (!roomId || !roomId.startsWith('stream-')) return 'Streamer';
  
  // Method 1: Check streamRooms array
  const stream = streamRooms.find(s => s.roomId === roomId);
  if (stream && stream.streamerName) {
    return stream.streamerName;
  }
  
  // Method 2: Get from streamer address
  const streamerAddress = getStreamerAddressForRoom(roomId);
  if (streamerAddress) {
    return truncateAddress(streamerAddress);
  }
  
  return 'Streamer';
}

/**
 * Function to refresh discovered rooms (can be called from UI or debug)
 */
async function refreshDiscoveredRooms() {
  try {
    console.log('=== REFRESHING DISCOVERED ROOMS ===');
    const discoveredRooms = await discoverRoomsFromBlockchain();
    
    // Update chatrooms array with new discoveries
    for (const room of discoveredRooms) {
      const existingIndex = chatrooms.findIndex(r => r.id === room.id);
      if (existingIndex >= 0) {
        // Update existing room
        chatrooms[existingIndex] = { ...chatrooms[existingIndex], ...room };
      } else {
        // Add new room
        chatrooms.push(room);
      }
    }
    
    // Trigger reactivity
    chatrooms = [...chatrooms];
    
    showCustomToast(`Refreshed rooms: found ${discoveredRooms.length} discovered rooms`, 3000, 'info');
    
  } catch (error) {
    console.error('Error refreshing discovered rooms:', error);
    showCustomToast('Error refreshing rooms', 3000, 'error');
  }
}

  async function loadAllMessagesForInbox() {
    logger.debug("=== Loading all messages for inbox ===");
    
    const originalMessages = [...messages];
    const originalMempool = [...localMempoolMessages];
    
    messages = [];
    localMempoolMessages = [];
    
    try {
      await fetchMessages(false, 'inbox');
      
      unreadDMCount = countUnreadDMs();
      hasNewDMs = unreadDMCount > 0;
      logger.debug(`Inbox loading complete: ${unreadDMCount} unread DMs`);
    } catch (error) {
      logger.error("Error loading inbox messages:", error);
      messages = originalMessages;
      localMempoolMessages = originalMempool;
    }
  }

  function countUnreadDMs() {
    if (!$connected_wallet_address) return 0;
    
    const cleanCurrentUser = cleanAddress($connected_wallet_address);
    let unreadCount = 0;
    
    const allMessagesForCount = [...messages, ...localMempoolMessages];
    
    for (const msg of allMessagesForCount) {
      if (msg.chatroomId && msg.chatroomId.startsWith('dm-')) {
        const parts = msg.chatroomId.replace('dm-', '').split('-');
        const addr1 = parts[0];
        const addr2 = parts[1];
        
        if (cleanAddress(addr1) === cleanCurrentUser || cleanAddress(addr2) === cleanCurrentUser) {
          const lastViewed = lastViewedTimestamps[msg.chatroomId] || 0;
          const cleanMsgSender = cleanAddress(msg.sender);
          
          if ((msg.timestamp * 1000) > lastViewed && 
              cleanMsgSender !== cleanCurrentUser && 
              !msg.read) {
            unreadCount++;
          }
        }
      }
    }
    
    return unreadCount;
  }

  function addTipMessageToMempool(txId: string, senderAddress: string, recipientAddress: string, amount: string, tokenName: string, chatroomId: string) {
    const tipMessage = `💸 ${truncateAddress(senderAddress)} tipped ${amount} ${tokenName} to ${truncateAddress(recipientAddress)}`;
    
    const timestamp = Math.floor(Date.now() / 1000);
    const newMessage = {
      id: txId,
      sender: cleanAddress(senderAddress),
      content: tipMessage,
      timestamp: timestamp,
      pending: true,
      chatroomId: chatroomId,
      parentId: null,
      replyTo: null,
      isStealthMessage: false,
      stealthDisplayName: undefined
    };
    
    localMempoolMessages = [...localMempoolMessages, newMessage];
    saveMempoolMessages(localMempoolMessages);
  }

  // ============= Event Handlers =============

  function handleReply(event) {
    const { parentId, parentSender, parentContent } = event.detail;
    
    replyingTo = {
      id: parentId,
      sender: parentSender,
      content: parentContent
    };
    
    setTimeout(() => {
      document.querySelector('.message-input')?.focus();
    }, 100);
  }

  function cancelReply() {
    replyingTo = null;
  }

  function handleEmojiSelect(event) {
    const emoji = event.detail.emoji;
    inputMessage += emoji;
    setTimeout(() => {
      document.querySelector('.message-input')?.focus();
    }, 10);
  }

  function handleOpenTip(event) {
    const { recipientAddress, recipientName } = event.detail;
    
    tipRecipient = recipientAddress;
    tipAmount = '';
    tipTokenId = 'ERG';
    showTipModal = true;
    
    showCustomToast(`Tip modal opened for ${recipientName}`, 2000, 'info');
  }

  function handleStealthModeChange(event) {
    const { active, address, displayName } = event.detail;
    
    if (active) {
      isStealthMode = true;
      stealthSenderInfo = {
        address: address,
        displayName: displayName
      };
      
      showCustomToast(`Stealth mode activated: ${displayName}`, 3000, 'success');
    } else {
      isStealthMode = false;
      stealthSenderInfo = null;
      
      showCustomToast('Stealth mode deactivated', 3000, 'info');
    }
  }

  async function disconnectWallet() {
    if ($selected_wallet_ergo === 'nautilus' && window.ergo) {
      try {
        if (typeof window.ergo.disconnect === 'function') {
          await window.ergo.disconnect();
        } else if (typeof window.ergo.disconnect_wallet === 'function') {
          await window.ergo.disconnect_wallet();
        }
      } catch (error) {
        logger.error("Error disconnecting from wallet:", error);
      }
    }
    
    selected_wallet_ergo.set(null);
    connected_wallet_address.set(null);
    connected_wallet_addresses.set([]);
    
    showCustomToast(SUCCESS_MESSAGES.WALLET_DISCONNECTED, 3000, 'info');
  }

  function toggleMobileMenu() {
    showMobileMenu = !showMobileMenu;
    showUserMenu = false;
  }

  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
    showMobileMenu = false;
  }

  function handleClickOutside(event) {
    const target = event.target;
    const mobileMenu = document.querySelector('.mobile-menu');
    const userMenu = document.querySelector('.user-menu');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const userMenuBtn = document.querySelector('.user-menu-btn');
    
    if (mobileMenu && !mobileMenu.contains(target) && !mobileMenuBtn?.contains(target)) {
      showMobileMenu = false;
    }
    
    if (userMenu && !userMenu.contains(target) && !userMenuBtn?.contains(target)) {
      showUserMenu = false;
    }
  }

  // ============= Search Functions =============

  function toggleSearchMode() {
    searchMode = !searchMode;
    if (!searchMode) {
      clearSearch();
    }
  }

  function clearSearch() {
    searchQuery = '';
    searchResults = [];
    showSearchResults = false;
    searchMode = false;
    highlightedMessageId = null;
  }

  function performSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      showSearchResults = false;
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const allMessagesForSearch = [...messages, ...localMempoolMessages];
    
    // Define default rooms
    const defaultRooms = ['general', 'trading', 'development', 'governance'];
    
    // Get discovered public rooms (non-private discovered rooms)
    const discoveredPublicRooms = chatrooms
      .filter(room => room.isDiscovered && !room.isPrivate && !room.id.startsWith('private-'))
      .map(room => room.id);
    
    // Combine allowed rooms
    const allowedRooms = [...defaultRooms, ...discoveredPublicRooms];
    
    // Search through messages, excluding private chats
    searchResults = allMessagesForSearch.filter(msg => {
      // First filter: Only include messages from allowed rooms
      const chatroomId = msg.chatroomId || 'general';
      
      // Exclude private rooms
      if (chatroomId.startsWith('private-')) {
        return false;
      }
      
      // Only include messages from default or discovered public rooms
      if (!allowedRooms.includes(chatroomId)) {
        return false;
      }
      
      // Then filter by search query
      const contentMatch = msg.content?.toLowerCase().includes(query);
      const senderMatch = msg.sender?.toLowerCase().includes(query);
      const idMatch = msg.id?.toLowerCase().includes(query);
      
      return contentMatch || senderMatch || idMatch;
    }).sort((a, b) => b.timestamp - a.timestamp);
    
    showSearchResults = searchResults.length > 0;
    
    if (searchResults.length === 0) {
      showCustomToast(`No messages found for "${searchQuery}" in public rooms`, 3000, 'info');
    }
  }

  function jumpToMessage(messageId: string) {
    highlightedMessageId = messageId;
    showSearchResults = false;
    
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        setTimeout(() => {
          highlightedMessageId = null;
        }, 3000);
      } else {
        showCustomToast('Message not visible in current view', 3000, 'warning');
      }
    }, 100);
  }

  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      performSearch();
    } else if (event.key === 'Escape') {
      clearSearch();
    }
  }

function highlightSearchTerm(content: string, searchTerm: string): string {
  if (!content || !searchTerm) return content;

  // Escape special regex characters in the search term
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, 'gi');

  // Wrap matched terms with <mark> tags
  return content.replace(regex, '<mark>$1</mark>');
}

  function formatSender(sender: string) {
    if (!sender) return 'Unknown';
    
    if (sender.startsWith('3') && sender.length > 50) {
      sender = sender.substring(1);
    }
    
    if (sender.length > 12) {
      return `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}`;
    }
    
    return sender;
  }

  // ============= Achievement Functions =============

  function handleOpenUserAchievements(event) {
    const { userAddress, userName } = event.detail;
    
    logger.debug('Landing.svelte: Opening achievements for user:', userAddress, userName);
    
    targetUserAddress = userAddress;
    targetUserName = userName || truncateAddress(userAddress);
    showAchievements = true;
    
    logger.debug('Landing.svelte: State updated:', {
      targetUserAddress,
      targetUserName,
      showAchievements
    });
  }

  // ============= Stream Functions =============

  function openStreamCreator() {
    streamData = null;
    showLiveStream = true;
  }

  // Add missing getStreamerAddressForRoom function
  function getStreamerAddressForRoom(roomId: string): string {
    // Try to find the stream in streamRooms first
    const stream = streamRooms.find(s => s.roomId === roomId);
    if (stream && stream.streamerAddress) {
      return stream.streamerAddress;
    }
    
    // If not found in streamRooms, try to extract from the roomId
    // Stream room IDs typically follow pattern: stream-{timestamp}-{address}
    if (roomId.startsWith('stream-')) {
      const parts = roomId.split('-');
      if (parts.length >= 3) {
        // Last part should be the streamer address
        return parts[parts.length - 1];
      }
    }
    
    // Fallback: search through all messages for stream announcements in this room
    const allMessagesForSearch = [...messages, ...localMempoolMessages];
    const streamAnnouncement = allMessagesForSearch.find(msg => 
      msg.chatroomId === roomId && 
      (msg.content.includes('🎥 Live Stream') || msg.content.includes('stream'))
    );
    
    if (streamAnnouncement) {
      return cleanAddress(streamAnnouncement.sender);
    }
    
    // If all else fails, return empty string
    return '';
  }

  function handleWatchStream(event) {
    const { streamUrl, streamTitle, platform, isLive, streamerAddress, messageId } = event.detail;
    
    logger.debug('Opening stream popup:', { streamUrl, streamTitle, platform });
    
    currentStreamData = {
      url: streamUrl,
      title: streamTitle,
      platform: platform,
      isLive: isLive,
      streamerAddress: streamerAddress,
      messageId: messageId
    };
    
    showStreamPopup = true;
    
    showCustomToast(`Opening ${platform} stream: ${streamTitle}`, 2000, 'info');
  }

  function handleEndStream(event) {
    const { streamUrl, streamTitle, platform, streamerAddress, messageId, roomId } = event.detail;
    
    if (!walletConnected) {
      showCustomToast("Please connect your wallet to end the stream", 3000, "warning");
      return;
    }
    
    if (!confirm(`Are you sure you want to end the stream "${streamTitle}"?`)) {
      return;
    }
    
    try {
      let streamToEnd = null;
      
      if (roomId) {
        streamToEnd = streamRooms.find(stream => stream.roomId === roomId);
        logger.debug('Found stream by roomId:', roomId, streamToEnd);
      }
      
      if (!streamToEnd && streamRooms && streamRooms.length > 0) {
        streamToEnd = streamRooms.find(stream => 
          stream.url === streamUrl && 
          cleanAddress(stream.streamerAddress) === cleanAddress(streamerAddress) &&
          stream.isActive === true
        );
        logger.debug('Found stream by URL+streamer:', streamToEnd);
      }
      
      if (!streamToEnd) {
        logger.warn('Could not find original stream, creating fallback...');
        const fallbackRoomId = `stream-${messageId || Date.now()}-${cleanAddress(streamerAddress)}`;
        streamToEnd = {
          title: streamTitle,
          url: streamUrl,
          platform: platform,
          roomId: fallbackRoomId,
          streamerAddress: cleanAddress(streamerAddress),
          startTime: Date.now() / 1000 - 3600,
          isActive: true
        };
        logger.debug('Created fallback streamToEnd:', streamToEnd);
      }
      
      logger.debug('Final streamToEnd for ending:', streamToEnd);
      
      // Handle stream end (placeholder - implement in streamUtils.js)
      handleCloseStreamOnBlockchain({ detail: streamToEnd });
      
      streamMessages = streamMessages.map(stream => {
        if (stream.messageId === messageId ||
            stream.roomId === streamToEnd.roomId ||
            (stream.url === streamUrl && stream.announcer === cleanAddress(streamerAddress))) {
          return { ...stream, isActive: false, endedAt: Date.now() / 1000 };
        }
        return stream;
      });
      
      streamRooms = streamRooms.map(stream => {
        if (stream.roomId === streamToEnd.roomId ||
            (stream.url === streamUrl && 
             cleanAddress(stream.streamerAddress) === cleanAddress(streamerAddress))) {
          return { ...stream, isActive: false, endedAt: Date.now() / 1000 };
        }
        return stream;
      });
      
      try {
        setToStorage('ergoChat_streamMessages', streamMessages);
        setToStorage('ergoChat_streamRooms', streamRooms);
      } catch (error) {
        logger.warn('Could not save updated stream data:', error);
      }
      
      const endMessage = `🎬 Stream "${streamTitle}" has ended. Thanks for watching!`;
      
      const timestamp = Math.floor(Date.now() / 1000);
      const endMempoolMessage = {
        id: `stream-end-${timestamp}`,
        sender: cleanAddress($connected_wallet_address),
        content: endMessage,
        timestamp: timestamp,
        pending: true,
        chatroomId: streamToEnd.roomId,
        parentId: null,
        isSystemMessage: true
      };
      
      localMempoolMessages = [...localMempoolMessages, endMempoolMessage];
      saveMempoolMessages(localMempoolMessages);
      
      showCustomToast(`Stream "${streamTitle}" ended successfully`, 3000, 'success');
      
    } catch (error) {
      logger.error('Error ending stream:', error);
      showCustomToast('Failed to end stream: ' + error.message, 3000, 'error');
    }
  }

  function handleCloseStreamPopup() {
    showStreamPopup = false;
    currentStreamData = {
      url: '',
      title: '',
      platform: '',
      isLive: true
    };
  }

  function handleJoinStreamFromSelector(event) {
    streamData = event.detail.streamData;
    const { roomId } = event.detail;

    showLiveStream = true;
    selectChatroom(roomId);
    showCustomToast(`Joined stream: ${streamData.title}`, 3000, 'success');
  }

  function isStreamOwner(stream) {
    return walletConnected && stream && 
           cleanAddress(stream.streamerAddress) === cleanAddress($connected_wallet_address);
  }

  // ============= DM Functions =============

  async function handleSendDMMessage(event) {
    const { recipientAddress, message, chatroomId } = event.detail;
    
    logger.debug("Handling DM send:", { recipientAddress, message, chatroomId });
    
    if (!walletConnected || sendingMessage || !message.trim()) {
      logger.debug("Cannot send DM - wallet not connected or already sending");
      return;
    }
    
    try {
      sendingMessage = true;
      errorMessage = "";
      
      // Get wallet information
      const walletInfo = await getWalletInfo($selected_wallet_ergo, $connected_wallet_address);
      const { myAddress, height, utxos } = walletInfo;
      
      logger.debug("Wallet info retrieved:", { myAddress, height, utxosCount: utxos?.length });
      
      // Validate balance
      const balanceValidation = validateWalletBalance(utxos);
      if (!balanceValidation.valid) {
        errorMessage = balanceValidation.error;
        return;
      }
      
      // Determine sender for message
      let senderForMessage = cleanAddress(myAddress);
      if (isStealthMode && stealthSenderInfo) {
        senderForMessage = stealthSenderInfo.displayName;
        logger.debug("Sending DM in stealth mode as:", senderForMessage);
      }
      
      logger.debug("Creating DM transaction...");
      
      // Create transaction for DM
      const tx = createMessageTx({
        chatContract: CHAT_CONTRACT,
        userAddress: myAddress,
        userUtxos: utxos,
        height: height,
        message: message,
        chatroomId: chatroomId,
        parentId: null,
        customSender: senderForMessage,
        chatrooms: chatrooms
      });
      
      logger.debug("Transaction created, signing...");
      
      if ($selected_wallet_ergo !== 'ergopay') {
        const result = await signAndSubmitTransaction(tx, $selected_wallet_ergo);
        const { txId, signed } = result;
        
        logger.debug("DM transaction submitted successfully:", txId);
        
        showCustomToast(
          `DM sent successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId.substring(0, 8)}...</a>`,
          3000,
          'success'
        );
        
        // Add DM message to local mempool
        const timestamp = Math.floor(Date.now() / 1000);
        const newDMMessage = {
          id: txId,
          sender: senderForMessage,
          content: message,
          timestamp,
          pending: true,
          chatroomId: chatroomId,
          parentId: null,
          replyTo: null,
          isStealthMessage: isStealthMode,
          stealthDisplayName: isStealthMode ? stealthSenderInfo?.displayName : undefined
        };
        
        localMempoolMessages = [...localMempoolMessages, newDMMessage];
        saveMempoolMessages(localMempoolMessages);
        
        logger.debug("DM added to mempool:", newDMMessage);
        
        // Update UTXO cache
        const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
        const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
        await updateUTXOCache(myAddress, usedBoxIds, newOutputs);
        
      } else {
        unsignedTx = tx;
        isAuth = false;
        showErgopayModal = true;
      }
      
    } catch (error) {
      logger.error("Error sending DM:", error);
      errorMessage = getUserFriendlyError(error);
    } finally {
      sendingMessage = false;
    }
  }

  // ============= AI Response Handler =============

  async function handleAIResponse(event) {
    const { originalMessage, response, type } = event.detail;
    
    if (type === 'auto' && walletConnected) {
      const timestamp = Math.floor(Date.now() / 1000);
      const aiMessage = {
        id: `ai-response-${timestamp}`,
        sender: 'Ergonaut 001 🤖',
        content: `🤖 ${response}`,
        timestamp,
        pending: false,
        chatroomId: $selectedChatroomId,
        parentId: originalMessage.id,
        replyTo: {
          id: originalMessage.id,
          sender: originalMessage.sender,
          content: originalMessage.content
        },
        isAIResponse: true
      };
      
      localMempoolMessages = [...localMempoolMessages, aiMessage];
      
      showCustomToast(
        `AI responded to ${truncateAddress(originalMessage.sender)}`,
        3000,
        'info'
      );
      
      setTimeout(scrollToBottom, 100);
    }
  }

  // ============= Placeholder Functions =============

  function executeTipCommand() {
    if (!isValidTipCommand) return;
    
    tipAmount = commandData.amount;
    tipTokenId = commandData.token;
    tipRecipient = commandData.recipient;
    
    showTipModal = true;
    
    commandMode = false;
    commandPrompt = null;
    inputMessage = '';
  }

  function handleCreateStream(event) {
    logger.debug("Create stream event:", event.detail);
  }

  function handleSendStreamMessage(event) {
    logger.debug("Send stream message event:", event.detail);
  }

  function handleCloseStream(event) {
    logger.debug("Close stream event:", event.detail);
  }

  function handleCloseStreamOnBlockchain(event) {
    logger.debug("Close stream on blockchain event:", event.detail);
  }

  // ============= Debug Functions =============

  function debugMessageLoading() {
    console.log('=== MESSAGE LOADING DEBUG ===');
    console.log('Connected wallet:', $connected_wallet_address);
    console.log('Selected chatroom:', $selectedChatroomId);
    console.log('Chatrooms available:', chatrooms.length);
    console.log('Confirmed messages:', messages.length);
    console.log('Mempool messages:', localMempoolMessages.length);
    console.log('All messages:', allMessages.length);
    console.log('Threaded messages:', threadedMessages.length);
    console.log('Loading state:', loadingMessages);
    console.log('Has more messages:', hasMoreMessages);
    
    // Check if messages are being filtered out
    const allUnfiltered = [...messages, ...localMempoolMessages];
    console.log('Total unfiltered messages:', allUnfiltered.length);
    
    // Check chatroom filtering
    const currentRoomMessages = allUnfiltered.filter(m => 
      !m.chatroomId || m.chatroomId === $selectedChatroomId
    );
    console.log('Messages for current room:', currentRoomMessages.length);
    
    return {
      wallet: $connected_wallet_address,
      chatroom: $selectedChatroomId,
      confirmed: messages.length,
      mempool: localMempoolMessages.length,
      total: allMessages.length,
      threaded: threadedMessages.length,
      loading: loadingMessages
    };
  }

  async function testAPI() {
    try {
      const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${CHAT_CONTRACT}?limit=10`);
      const data = await response.json();
      console.log('API Test Result:', data);
      return data;
    } catch (error) {
      console.error('API Test Failed:', error);
      return error;
    }
  }

  // ============= Encryption/Decryption Functions =============

  /**
   * Extract and decrypt any encrypted strings found in the content
   */
  function extractAndDecryptAll(content) {
    // Basic input validation
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    // Case 1: If the content is simply an encrypted string, decrypt it directly
    if (content.startsWith("enc-") && /^enc-[0-9a-fA-F]+$/.test(content)) {
      return decryptMessage(content);
    }
    
    // Case 2: If the content doesn't contain "enc-", no decryption needed
    if (!content.includes("enc-")) {
      return content;
    }
    
    // Case 3: The message has an encrypted part somewhere in the string
    
    // Look for a clean match of "enc-" followed by hex characters at the end of the string
    const endEncryptedMatch = content.match(/(.*?)(enc-[0-9a-fA-F]+)$/);
    
    if (endEncryptedMatch) {
      // We found a clean encrypted part at the end
      const plainPrefix = endEncryptedMatch[1];
      const encryptedPart = endEncryptedMatch[2];
      
      // Decrypt the encrypted part
      const decryptedPart = decryptMessage(encryptedPart);
      
      // Combine the plain prefix with the decrypted part
      return plainPrefix + decryptedPart;
    }
    
    // If not a clean end match, look for all enc- patterns
    const encryptedPattern = /enc-[0-9a-fA-F]+/g;
    let result = content;
    let match;
    
    // Find all matches of encrypted text
    while ((match = encryptedPattern.exec(content)) !== null) {
      const startPos = match.index;
      
      // Try to find where this encrypted part ends
      let endPos = startPos + 4; // Start after "enc-"
      
      while (endPos < content.length && /[0-9a-fA-F]/.test(content[endPos])) {
        endPos++;
      }
      
      // Extract the full encrypted string
      const fullEncrypted = content.substring(startPos, endPos);
      
      // Only decrypt if it looks like a proper encrypted string
      if (fullEncrypted.length > 8) { // At least "enc-" plus some hex
        const decryptedPart = decryptMessage(fullEncrypted);
        
        // Replace this encrypted part with the decrypted version
        result = result.replace(fullEncrypted, decryptedPart);
      }
      
      // Update the regex lastIndex to avoid infinite loop
      encryptedPattern.lastIndex = startPos + 1;
    }
    
    return result;
  }

  /**
   * Decrypt message content
   */
  function decryptMessage(encrypted, secretKey = "ergochat") {
    // Basic validation
    if (!encrypted || typeof encrypted !== 'string') {
      return encrypted;
    }
    
    // Must start with the encryption prefix
    if (!encrypted.startsWith("enc-")) {
      return encrypted;
    }
    
    try {
      // Remove prefix
      const hexStr = encrypted.substring(4);
      
      // Validate hex characters
      if (!/^[0-9a-fA-F]+$/.test(hexStr)) {
        return encrypted;
      }
      
      let decrypted = "";
      
      // Process hex pairs
      for (let i = 0; i < hexStr.length; i += 2) {
        if (i + 1 >= hexStr.length) break; // Skip incomplete pair
        
        // Convert hex pair to character code
        const hexPair = hexStr.substring(i, i + 2);
        const encryptedChar = parseInt(hexPair, 16);
        
        // Calculate position and key character - exactly matching encryption
        const position = i/2;
        const keyChar = secretKey.charCodeAt((position + (position % 5)) % secretKey.length);
        
        // XOR operation for decryption
        const decryptedChar = encryptedChar ^ keyChar;
        
        // Add character to result
        decrypted += String.fromCharCode(decryptedChar);
      }
      
      return decrypted;
    } catch (error) {
      console.error("Error in decryption:", error);
      return encrypted; // Return original on error
    }
  }

  // Add click outside listener
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // Define interface for TypeScript
  interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    pending: boolean;
    chatroomId?: string;
    parentId?: string;
    replyTo?: {
      id: string;
      sender: string;
      content: string;
    };
    isStealthMessage?: boolean;
    stealthDisplayName?: string;
    isAIResponse?: boolean;
    isSystemMessage?: boolean;
    read?: boolean;
  }
  /**
 * Handle escrow creation request from inbox
 */
 function handleInboxEscrowRequest(event) {
    const { escrowData } = event.detail;
    
    logger.debug('Landing: Handling escrow request from inbox:', escrowData);
    
    inboxEscrowData = {
        buyerAddress: escrowData.buyerAddress,
        sellerAddress: escrowData.sellerAddress,
        buyerName: escrowData.buyerName,
        sellerName: escrowData.sellerName,
        initiatedBy: escrowData.initiatedBy
    };
    
    showEscrowFromInbox = true;
    
    showCustomToast(
        `Opening escrow creation as ${escrowData.initiatedBy}`, 
        2000, 
        'info'
    );
}
function handleOpenGiftModal(event) {
  console.log('=== GIFT MODAL EVENT HANDLER ===');
  console.log('Event detail:', event.detail);
  
  const { streamerAddress, streamerName, roomId } = event.detail;
  
  // Use current room if not provided
  const targetRoomId = roomId || $selectedChatroomId;
  
  // Auto-detect streamer info if not provided
  const finalStreamerAddress = streamerAddress || getStreamerAddressForRoom(targetRoomId);
  const finalStreamerName = streamerName || getStreamerNameForRoom(targetRoomId);
  
  console.log('Opening gift modal with:', {
    streamerAddress: finalStreamerAddress,
    streamerName: finalStreamerName,
    roomId: targetRoomId
  });
  
  openGiftModal(finalStreamerAddress, finalStreamerName, targetRoomId);
}
// ============= CORRECTED Reactive Statements =============

$: walletConnected = !!$connected_wallet_address && $selected_wallet_ergo;

$: currentRoom = chatrooms.length > 0
  ? (chatrooms.find(room => room.id === $selectedChatroomId) || chatrooms[0])
  : { name: 'General', id: 'general', description: 'Main discussion channel' };

$: {
  try {
    allMessages = mergeMessages(messages, localMempoolMessages, $selectedChatroomId);
    console.log(`Merged messages: ${allMessages.length} total`);
  } catch (error) {
    console.error('Error merging messages:', error);
    allMessages = [];
  }
}

// SECOND: Organize threading (this must come after merging)
$: {
  try {
    threadedMessages = organizeThreadedMessages(allMessages);
    console.log(`Organized ${threadedMessages.length} threaded messages from ${allMessages.length} total messages`);
  } catch (error) {
    console.error('Error organizing threaded messages:', error);
    threadedMessages = [];
  }
}
</script>
   

<!-- ============= HTML Template ============= -->
<div class="chat-app">
  <!-- Header with logo and status info -->
  <header class="app-header">
    <div class="header-right">
      <!-- Desktop Navigation -->
      <nav class="desktop-nav">
        <!-- Search Button -->
        <button 
          class="header-btn {searchMode ? 'active' : ''}" 
          on:click={toggleSearchMode} 
          title="Search messages"
        >
          <i class="fa-solid fa-search"></i>
          <span class="btn-label">Search</span>
        </button>

        <!-- AI Chat Button -->
        <button 
          class="header-btn" 
          on:click={toggleApiChat} 
          title="Chat with AI"
        >
          <i class="fa-solid fa-robot"></i>
          <span class="btn-label">AI Chat</span>
        </button>

        <!-- Achievements Button -->
        <button 
          class="header-btn" 
          on:click={() => showAchievements = true} 
          title="View Achievements"
        >
          <i class="fa-solid fa-trophy"></i>
          <span class="btn-label">Achievements</span>
        </button>

        <!-- Inbox Button -->
        <button 
          class="header-btn {hasNewDMs ? 'has-notification' : ''}" 
          on:click={toggleInbox} 
          title="Inbox"
        >
          <i class="fa-solid fa-inbox"></i>
          <span class="btn-label">Inbox</span>
          {#if unreadDMCount > 0}
            <span class="notification-badge {hasNewDMs ? 'pulsing' : ''}">{unreadDMCount}</span>
          {/if}
        </button>

        <!-- Live Stream Button -->
        <button 
          class="header-btn" 
          on:click={openStreamCreator} 
          title="Live Streaming"
        >
          <i class="fa-solid fa-video"></i>
          <span class="btn-label">Live Stream</span>
        </button>

        <!-- Admin Button (if authorized) -->
        {#if walletConnected && $connected_wallet_address === ADMIN_WALLET_ADDRESS}
          <button 
            class="header-btn" 
            on:click={() => showAdminDashboard = true} 
            title="Admin Dashboard"
          >
            <i class="fa-solid fa-lock"></i>
            <span class="btn-label">Admin</span>
          </button>
        {/if}

        <!-- Info Button -->
        <button 
          class="header-btn" 
          on:click={toggleInfo} 
          title="About this app"
        >
          <i class="fa-solid fa-info-circle"></i>
          <span class="btn-label">Info</span>
        </button>
      </nav>

      <!-- Stealth Mode Component (Desktop Only) -->
      <div class="stealth-desktop-only">
        <StealthAddressUI 
          {walletConnected}
          currentAddress={$connected_wallet_address}
          on:stealthModeChanged={handleStealthModeChange}
        />
      </div>

      <!-- Wallet Status & User Menu -->
      <div class="wallet-user-container">
        {#if walletConnected}
          <!-- Main Wallet Display -->
          <div class="wallet-status connected">
            <span class="wallet-address">{truncateAddress($connected_wallet_address)}</span>
            <button 
              class="wallet-disconnect-btn" 
              on:click={disconnectWallet} 
              title="Disconnect wallet"
            >
              <i class="fa-solid fa-power-off"></i>
            </button>
          </div>
        {:else}
          <div class="wallet-status disconnected">
            <WalletButton />
          </div>
        {/if}
      </div>

      <!-- Mobile Menu Button -->
      <button class="mobile-menu-btn" on:click={toggleMobileMenu}>
        <i class="fa-solid {showMobileMenu ? 'fa-times' : 'fa-bars'}"></i>
      </button>
    </div>

    <!-- Mobile Menu Dropdown -->
    {#if showMobileMenu}
      <div class="mobile-menu" transition:slide={{ duration: 250 }}>
        <nav class="mobile-nav">
          <button 
            class="mobile-menu-item {searchMode ? 'active' : ''}" 
            on:click={() => { toggleSearchMode(); showMobileMenu = false; }}
          >
            <i class="fa-solid fa-search"></i>
            <span>Search Messages</span>
          </button>

          <button 
            class="mobile-menu-item" 
            on:click={() => { toggleApiChat(); showMobileMenu = false; }}
          >
            <i class="fa-solid fa-robot"></i>
            <span>AI Chat</span>
          </button>

          <button 
            class="mobile-menu-item" 
            on:click={() => { showAchievements = true; showMobileMenu = false; }}
          >
            <i class="fa-solid fa-trophy"></i>
            <span>Achievements</span>
          </button>

          <button 
            class="mobile-menu-item" 
            on:click={() => { openStreamCreator(); showMobileMenu = false; }}
          >
            <i class="fa-solid fa-video"></i>
            <span>Live Streams</span>
          </button>

          <!-- Inbox Button in Mobile -->
          <button 
            class="mobile-menu-item {hasNewDMs ? 'has-notification' : ''}" 
            on:click={() => { toggleInbox(); showMobileMenu = false; }}
          >
            <i class="fa-solid fa-inbox"></i>
            <div class="menu-item-content">
              <span>Inbox</span>
              {#if unreadDMCount > 0}
                <span class="mobile-notification-badge">{unreadDMCount}</span>
              {/if}
            </div>
          </button>

          {#if walletConnected && $connected_wallet_address === ADMIN_WALLET_ADDRESS}
            <button 
              class="mobile-menu-item" 
              on:click={() => { showAdminDashboard = true; showMobileMenu = false; }}
            >
              <i class="fa-solid fa-lock"></i>
              <span>Admin Dashboard</span>
            </button>
          {/if}

          <button 
            class="mobile-menu-item" 
            on:click={() => { toggleInfo(); showMobileMenu = false; }}
          >
            <i class="fa-solid fa-info-circle"></i>
            <span>About</span>
          </button>

          <!-- Stealth Mode in Mobile Menu -->
          {#if walletConnected}
            <div class="mobile-menu-divider"></div>
            <div class="mobile-stealth-container">
              <StealthAddressUI 
                {walletConnected}
                currentAddress={$connected_wallet_address}
                on:stealthModeChanged={handleStealthModeChange}
                mobile={true}
              />
            </div>
          {/if}
        </nav>
      </div>
    {/if}

    <!-- Inbox System Component -->
    <InboxSystem 
    bind:isVisible={showInbox}
    currentUserAddress={$connected_wallet_address}
    allMessages={[...messages, ...localMempoolMessages]}
    on:close={() => showInbox = false}
    on:sendDMMessage={handleSendDMMessage}
    on:reply={handleReply}
    on:showToast={(event) => showCustomToast(event.detail.message, 3000, event.detail.type)}
    on:openTip={handleOpenTip}
    on:escrowRequest={handleInboxEscrowRequest}
/>

    <!-- Achievements Component -->
    <OnChainAchievements
      chatContract={CHAT_CONTRACT}
      {walletConnected}
      currentUserAddress={$connected_wallet_address}
      {allMessages}
      bind:visible={showAchievements}
      bind:targetUserAddress
      bind:targetUserName
      on:close={() => {
        showAchievements = false;
        targetUserAddress = '';
        targetUserName = '';
      }}
      on:achievementUnlocked={(event) => {
        const achievement = event.detail.achievement;
        showCustomToast(
          `🏆 Achievement Unlocked: ${achievement.name}!<br>${achievement.description}`,
          7000,
          'success'
        );
      }}
    />
  </header>

  <!-- Smart AI Features -->
  {#if showSmartAI}
    <div class="smart-ai-container" transition:slide={{ duration: 200 }}>
      <SmartAIFeatures 
        messages={allMessages}
        localMempoolMessages={localMempoolMessages}
        apiConfig={API_CHAT_CONFIG}
        currentUser={cleanAddress($connected_wallet_address) || ''}
        on:aiResponse={handleAIResponse}
      />
    </div>
  {/if}

  <!-- Main Chat Content -->
  <main class="chat-content">
    <!-- Chatroom selector -->
    <div class="chatroom-selector-container">
      <ChatroomSelector 
    discoveredRooms={chatrooms.filter(room => room.isDiscovered)} 
    {streamRooms}
    {streamMessages}
    on:roomSelected={() => scrollToBottom()}
    on:joinStream={handleJoinStreamFromSelector}
    on:watchStream={handleWatchStream}
  />
    </div>

    <!-- Search Interface -->
    {#if searchMode}
      <div class="search-container" transition:slide={{ duration: 200 }}>
        <div class="search-input-wrapper">
          <i class="fa-solid fa-search search-icon"></i>
          <input
            type="text"
            bind:value={searchQuery}
            on:input={performSearch}
            on:keydown={handleSearchKeydown}
            placeholder="Search messages, addresses, or IDs..."
            class="search-input"
            autofocus
          />
          {#if searchQuery}
            <button class="clear-search-btn" on:click={clearSearch}>
              <i class="fa-solid fa-times"></i>
            </button>
          {/if}
        </div>

        {#if searchQuery && searchResults.length > 0}
          <div class="search-stats">
            Found {searchResults.length} message{searchResults.length === 1 ? '' : 's'}
          </div>
        {/if}
      </div>
    {/if}
    {#if showGiftModal}
    <StreamGiftModal
      bind:visible={showGiftModal}
      streamerAddress={giftModalData.streamerAddress}
      streamerName={giftModalData.streamerName}
      roomId={giftModalData.roomId}
      {walletConnected}
      currentUserAddress={$connected_wallet_address}
      {allMessages}
      {localMempoolMessages}
      on:sendGift={handleSendGift}
      on:showToast={(event) => showCustomToast(event.detail.message, 3000, event.detail.type)}
    />
  {/if}
    <!-- Search Results -->
    {#if showSearchResults}
      <div class="search-results" transition:slide={{ duration: 200 }}>
        <div class="search-results-header">
          <span>Search Results ({searchResults.length})</span>
          <button class="close-search-results" on:click={() => showSearchResults = false}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="search-results-list">
          {#each searchResults.slice(0, 10) as result}
            <div 
              class="search-result-item" 
              on:click={() => jumpToMessage(result.id)}
            >
              <div class="result-header">
                <span class="result-sender">{formatSender(result.sender)}</span>
                <span class="result-time">{formatTime(result.timestamp)}</span>
                {#if result.pending}
                  <span class="result-status pending">Pending</span>
                {/if}
              </div>
              <div class="result-content">
                {@html highlightSearchTerm(result.content, searchQuery)}
              </div>
              <div class="result-meta">
                <span class="result-room">#{result.chatroomId || 'general'}</span>
                {#if result.parentId}
                  <span class="result-reply">
                    <i class="fa-solid fa-reply"></i>
                    Reply
                  </span>
                {/if}
              </div>
            </div>
          {/each}

          {#if searchResults.length > 10}
            <div class="search-results-more">
              Showing first 10 of {searchResults.length} results
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Live Streaming -->
    {#if showLiveStream}
      <LiveStreamingRoom 
        bind:visible={showLiveStream}
        {streamData}
        {walletConnected}
        currentUserAddress={$connected_wallet_address}
        chatContract={CHAT_CONTRACT}
        {allMessages}
        {localMempoolMessages}
        isStreamOwner={streamData ? isStreamOwner(streamData) : false}
        on:close={() => showLiveStream = false}
        on:createStream={handleCreateStream}
        on:sendStreamMessage={handleSendStreamMessage}
        on:closeStream={handleCloseStream}
      />
    {/if}

    <!-- Messages container -->
    <div class="messages-container" bind:this={chatContainerElement} on:scroll={handleScroll}>
      {#if loadingMessages && allMessages.length === 0}
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
          <p>Loading chat history...</p>
        </div>
      {:else if allMessages.length === 0}
        <div class="empty-chat">
          <div class="empty-chat-content">
            <i class="fa-solid fa-comments"></i>
            <h2>No messages yet</h2>
            <p>Be the first to send a message in this decentralized chat!</p>
          </div>
        </div>
      {:else}
        <div class="messages-list">
          <!-- Load More button -->
          {#if hasMoreMessages}
            <div class="load-more-container">
              <button 
                class="load-more-button" 
                on:click={() => fetchMessages(true)} 
                disabled={loadingMoreMessages}
              >
                {#if loadingMoreMessages}
                  <div class="button-spinner small"></div>
                  Loading...
                {:else}
                  Load More Messages
                {/if}
              </button>
            </div>
          {/if}

          <!-- Stream Popup -->
          {#if showStreamPopup}
            <StreamPopup
              bind:visible={showStreamPopup}
              streamUrl={currentStreamData.url}
              streamTitle={currentStreamData.title}
              platform={currentStreamData.platform}
              isLive={currentStreamData.isLive}
              on:close={handleCloseStreamPopup}
            />
          {/if}

          <!-- Message display - Using ThreadedMessage component -->
          {#each threadedMessages as message (message.id)}
          <ThreadedMessage 
          {message} 
          isOwn={isOwnMessage(message)} 
          showReplies={true}
          chatContract={CHAT_CONTRACT}
          {allMessages}
          currentUserAddress={$connected_wallet_address}
          isStreamRoom={$selectedChatroomId?.startsWith('stream-')}
          streamerAddress={getStreamerAddressForRoom($selectedChatroomId)}
          on:reply={handleReply}
          on:showToast={(event) => showCustomToast(event.detail.message, 3000, event.detail.type)}
          on:openTip={handleOpenTip}
          on:openGiftModal={handleOpenGiftModal}
          on:openUserAchievements={handleOpenUserAchievements}
          on:watchStream={handleWatchStream}
          on:endStream={handleEndStream}
          on:shareMessage={handleShareMessage}
          highlighted={highlightedMessageId === message.id}
        />
        {/each}
        </div>
      {/if}
    </div>

    <!-- Input area -->
    <div class="input-area">
      {#if errorMessage}
        <div class="error-message">
          <p>{errorMessage}</p>
          <button class="error-close" on:click={clearError}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      {/if}

      <!-- Reply status bar -->
      {#if replyingTo}
        <div class="reply-status">
          <div class="reply-preview">
            <i class="fa-solid fa-reply"></i>
            <div class="reply-info">
              <span class="reply-label">Replying to <strong>{truncateAddress(replyingTo.sender)}</strong></span>
              <span class="reply-content">{replyingTo.content}</span>
            </div>
          </div>
          <button class="cancel-reply" on:click={cancelReply}>
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      {/if}

      <!-- Command UI for Tips -->
      {#if commandMode && commandPrompt === '/tip'}
        <div class="command-ui">
          <div class="command-header">
            <div class="command-title">
              <i class="fa-solid fa-donate"></i>
              <span>Send Tip</span>
            </div>
            <button class="cancel-command" on:click={cancelCommand}>
              <i class="fa-solid fa-times"></i>
            </button>
          </div>

          <div class="command-form">
            <div class="command-field">
              <label>Amount</label>
              <input 
                type="text" 
                bind:value={commandData.amount} 
                placeholder="e.g. 0.1"
                on:input={() => {
                  const validation = validateTipCommand(commandData.amount, commandData.token, commandData.recipient);
                  isValidTipCommand = validation.isValid;
                }}
              />
            </div>
            <div class="command-field">
              <label>Token</label>
              <select 
                bind:value={commandData.token} 
                on:change={() => {
                  const validation = validateTipCommand(commandData.amount, commandData.token, commandData.recipient);
                  isValidTipCommand = validation.isValid;
                }}
              >
                {#each Object.keys(SUPPORTED_TOKENS) as token}
                  <option value={token}>{token}</option>
                {/each}
              </select>
            </div>
            <div class="command-field">
              <label>Recipient Address</label>
              <input 
                type="text" 
                bind:value={commandData.recipient} 
                placeholder="e.g. 9hp..."
                on:input={() => {
                  const validation = validateTipCommand(commandData.amount, commandData.token, commandData.recipient);
                  isValidTipCommand = validation.isValid;
                }}
              />
            </div>

            <div class="command-actions">
              <button class="command-cancel" on:click={cancelCommand}>Cancel</button>
              <button 
                class="command-execute" 
                on:click={executeTipCommand}
                disabled={!isValidTipCommand}
              >
                Send Tip
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Main Input Container -->
      <div class="input-container {!walletConnected ? 'disabled' : ''}">
        <textarea
          bind:value={inputMessage}
          placeholder={walletConnected ? "Type your message here... (use /tip to send tokens)" : "Connect wallet from top nav to send messages"}
          on:keydown={handleKeyPress}
          disabled={!walletConnected || sendingMessage}
          rows="3"
          class="message-input"
        ></textarea>

        <div class="input-actions">
          <EmojiPicker on:select={handleEmojiSelect} />
          {#if $selectedChatroomId?.startsWith('stream-') && walletConnected}
          <button 
            class="gift-btn" 
            on:click={() => openGiftModal(
              getStreamerAddressForRoom($selectedChatroomId),
              'Streamer',
              $selectedChatroomId
            )}
            title="Send Gift"
          >
            <i class="fa-solid fa-gift"></i>
          </button>
        {/if}
          <button 
            class="send-button" 
            on:click={commandMode ? executeTipCommand : sendMessage} 
            disabled={!walletConnected || (!inputMessage.trim() && !commandMode) || sendingMessage || (commandMode && !isValidTipCommand)}
          >
            {#if sendingMessage}
              <div class="button-spinner"></div>
            {:else if commandMode}
              <i class="fa-solid fa-paper-plane"></i>
            {:else}
              <i class="fa-solid fa-paper-plane"></i>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </main>

  <!-- ============= Modals and Overlays ============= -->

  <!-- API Chat Overlay -->
  {#if showApiChat}
    <div class="api-chat-overlay" transition:fade={{ duration: 200 }}>
      <APIChatRoom 
        apiConfig={API_CHAT_CONFIG}
        chatroomId="ai-chat"
        on:close={closeApiChat}
      />
    </div>
  {/if}

  <!-- Tip Modal -->
  {#if showTipModal}
  <div class="modal-overlay" on:click|self={() => showTipModal = false}>
    <div class="tip-modal">
      <div class="tip-modal-header">
        <h3>Confirm Tip</h3>
        <button class="close-button" on:click={() => showTipModal = false}>
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="tip-modal-body">
        <p>You are about to send:</p>
        <div class="tip-amount">
          <span class="amount">{tipAmount}</span>
          <span class="token">{tipTokenId === '' ? 'ERG' : tipTokenId}</span>
        </div>
        <p>To address:</p>
        <div class="tip-address">
          <code>{tipRecipient}</code>
        </div>
        <p class="tip-warning">Please verify the address and amount before confirming.</p>
        
        <!-- Add input fields for amount and token selection -->
        <div class="tip-input-section">
          <div class="tip-input-group">
            <label for="tip-amount">Amount:</label>
            <input 
              id="tip-amount"
              type="number" 
              bind:value={tipAmount} 
              placeholder="0.1" 
              step="0.001"
              min="0"
            />
          </div>
          
          <div class="tip-input-group">
            <label for="tip-token">Token:</label>
            <select id="tip-token" bind:value={tipTokenId}>
              {#each Object.keys(SUPPORTED_TOKENS) as token}
                <option value={token}>{token}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
      <div class="tip-modal-footer">
        <button class="cancel-btn" on:click={() => showTipModal = false}>Cancel</button>
        <button 
          class="confirm-btn" 
          on:click={executeTip}
          disabled={sendingMessage || !tipAmount || parseFloat(tipAmount) <= 0}
        >
          {#if sendingMessage}
            <div class="button-spinner small"></div>
          {:else}
            Send Tip
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

  <!-- Admin Dashboard -->
  <AdminDashboard
    chatContract={CHAT_CONTRACT}
    {chatrooms}
    isVisible={showAdminDashboard}
    on:close={() => showAdminDashboard = false}
    on:selectRoom={({detail}) => {
      logger.debug("Admin selected room:", detail.roomId);
      selectChatroom(detail.roomId);
      showAdminDashboard = false;
    }}
    on:addRooms={({detail}) => {
      chatrooms = [...chatrooms, ...detail.rooms];
      // saveCustomRooms(); // Would be implemented in chatroomUtils.js
    }}
  />

  <!-- Info Modal -->
  <InfoModal 
    bind:showInfo={showInfo}
    {toggleInfo}
    messageCount={messages.length}
    pendingCount={localMempoolMessages.length}
    chatroomsCount={chatrooms.length}
  />

  <!-- Price Display -->
  {#if showPriceDisplay}
    <div class="price-display-container">
      <div class="price-display-header">
        <h3>Token Price Information</h3>
        <button class="close-button" on:click={() => showPriceDisplay = false}>
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <TokenPriceDisplay command={priceCommand} />
    </div>
  {/if}

  <!-- Ergopay Modal -->
  {#if showErgopayModal}
  <ErgopayModal 
    bind:showErgopayModal 
    bind:unsignedTx 
    bind:isAuth 
    {onTxSubmitted}
  >
    <button slot="btn">Close</button>
  </ErgopayModal>
{/if}
</div>
  <style>

  .app-header {

    display: flex;

    justify-content: space-between;

    align-items: center;

    padding: 1rem 1.5rem;

    background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));

    border-bottom: 1px solid rgba(255, 85, 0, 0.2);

    position: relative;

    z-index: 100;

  }



  .header-left {

    display: flex;

    align-items: center;

    gap: 1rem;

  }



  .app-logo {

    display: flex;

    align-items: center;

    justify-content: center;

  }



  .app-logo svg {

    transition: transform 0.2s ease;

  }



  .app-logo:hover svg {

    transform: scale(1.05);

  }



  .app-title {

    font-size: 1.5rem;

    font-weight: 700;

    margin: 0;

    letter-spacing: -0.5px;

  }



  .title-erg {

    color: #FF5500;

  }



  .header-right {

    display: flex;

    align-items: center;

    gap: 0.5rem;

    position: relative;

  }



  /* Desktop Navigation */

  .desktop-nav {

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }



  .header-btn {

    display: flex;

    align-items: center;

    gap: 0.5rem;

    background: rgba(255, 85, 0, 0.1);

    color: #FF5500;

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 8px;

    padding: 0.5rem 0.75rem;

    cursor: pointer;

    transition: all 0.2s ease;

    font-size: 0.9rem;

    position: relative;

    white-space: nowrap;

  }



  .header-btn:hover,

  .header-btn.active {

    background: rgba(255, 85, 0, 0.2);

    transform: translateY(-1px);

  }



  .btn-label {

    font-weight: 500;

  }



  .notification-badge {

    position: absolute;

    top: -0.25rem;

    right: -0.25rem;

    background-color: #ff4444;

    color: white;

    border-radius: 50%;

    width: 1.2rem;

    height: 1.2rem;

    display: flex;

    align-items: center;

    justify-content: center;

    font-size: 0.7rem;

    font-weight: bold;

    animation: pulse 2s infinite;

  }



  @keyframes pulse {

    0% { transform: scale(1); }

    50% { transform: scale(1.1); }

    100% { transform: scale(1); }

  }



  /* Stealth Mode - Desktop Only */

  .stealth-desktop-only {

    display: flex;

  }



  /* Wallet and User Container */

  .wallet-user-container {

    display: flex;

    align-items: center;

    gap: 0.5rem;

  }



  /* Main Wallet Status - Always Visible */

  .wallet-status.connected {

    display: flex;

    align-items: center;

    gap: 0.5rem;

    background: rgba(255, 85, 0, 0.1);

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 8px;

    padding: 0.5rem 0.75rem;

    transition: all 0.2s ease;

  }



  .wallet-status.connected:hover {

    background: rgba(255, 85, 0, 0.15);

  }



  .wallet-address {

    color: #FF5500;

    font-weight: 600;

    font-size: 0.9rem;

    font-family: monospace;

  }



  .wallet-disconnect-btn {

    background: none;

    border: none;

    color: rgba(255, 85, 0, 0.7);

    cursor: pointer;

    padding: 0.25rem;

    border-radius: 4px;

    transition: all 0.2s ease;

    display: flex;

    align-items: center;

    justify-content: center;

  }



  .wallet-disconnect-btn:hover {

    background: rgba(255, 85, 0, 0.2);

    color: #FF5500;

  }



  /* User Menu (Desktop Only) */

  .user-menu-container {

    position: relative;

  }



  .user-menu-container.desktop-only {

    display: flex;

  }



  .user-menu-btn {

    background: rgba(255, 85, 0, 0.1);

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 8px;

    padding: 0.5rem;

    cursor: pointer;

    display: flex;

    align-items: center;

    gap: 0.25rem;

    transition: all 0.2s ease;

    color: #FF5500;

  }



  .user-menu-btn:hover {

    background: rgba(255, 85, 0, 0.2);

  }



  .dropdown-icon {

    color: rgba(255, 85, 0, 0.7);

    font-size: 0.8rem;

    transition: transform 0.2s ease;

  }



  .dropdown-icon.rotated {

    transform: rotate(180deg);

  }



  .user-menu {

    position: absolute;

    top: calc(100% + 0.5rem);

    right: 0;

    background: #262626;

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 12px;

    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    min-width: 280px;

    z-index: 200;

    overflow: hidden;

  }



  .menu-header {

    display: flex;

    align-items: center;

    gap: 0.75rem;

    padding: 1rem;

    background: rgba(255, 85, 0, 0.05);

  }



  .user-avatar {

    width: 40px;

    height: 40px;

    background: rgba(255, 85, 0, 0.2);

    border-radius: 50%;

    display: flex;

    align-items: center;

    justify-content: center;

    color: #FF5500;

    font-size: 1.1rem;

  }



  .user-details {

    flex: 1;

    display: flex;

    flex-direction: column;

  }



  .user-address {

    color: white;

    font-size: 0.8rem;

    font-family: monospace;

    word-break: break-all;

  }



  .user-status {

    color: rgba(255, 255, 255, 0.6);

    font-size: 0.7rem;

  }



  .menu-divider {

    height: 1px;

    background: rgba(255, 255, 255, 0.1);

    margin: 0;

  }



  .menu-items {

    padding: 0.5rem 0;

  }



  .menu-item {

    display: flex;

    align-items: center;

    gap: 0.75rem;

    width: 100%;

    padding: 0.75rem 1rem;

    background: none;

    border: none;

    color: white;

    cursor: pointer;

    transition: all 0.2s ease;

    font-size: 0.9rem;

  }



  .menu-item:hover {

    background: rgba(255, 85, 0, 0.1);

    color: #FF5500;

  }



  .menu-item.disconnect-item {

    color: #ff6b6b;

  }



  .menu-item.disconnect-item:hover {

    background: rgba(255, 107, 107, 0.1);

    color: #ff4444;

  } 

  .wallet-status.connected:hover {

    background: rgba(255, 85, 0, 0.15);

    transform: translateY(-1px);

  }



  .wallet-avatar {

    width: 32px;

    height: 32px;

    background: rgba(255, 85, 0, 0.2);

    border-radius: 50%;

    display: flex;

    align-items: center;

    justify-content: center;

    color: #FF5500;

    font-size: 0.9rem;

  }



  .wallet-info {

    display: flex;

    flex-direction: column;

    align-items: flex-start;

  }



  .wallet-address {

    color: #FF5500;

    font-weight: 600;

    font-size: 0.9rem;

    font-family: monospace;

  }



  .wallet-status-text {

    color: rgba(255, 255, 255, 0.7);

    font-size: 0.7rem;

  }



  .dropdown-icon {

    color: rgba(255, 85, 0, 0.7);

    font-size: 0.8rem;

    transition: transform 0.2s ease;

  }



  .dropdown-icon.rotated {

    transform: rotate(180deg);

  }



  .user-menu {

    position: absolute;

    top: calc(100% + 0.5rem);

    right: 0;

    background: #262626;

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 12px;

    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    min-width: 280px;

    z-index: 200;

    overflow: hidden;

  }



  .menu-header {

    display: flex;

    align-items: center;

    gap: 0.75rem;

    padding: 1rem;

    background: rgba(255, 85, 0, 0.05);

  }



  .user-avatar {

    width: 40px;

    height: 40px;

    background: rgba(255, 85, 0, 0.2);

    border-radius: 50%;

    display: flex;

    align-items: center;

    justify-content: center;

    color: #FF5500;

    font-size: 1.1rem;

  }



  .user-details {

    flex: 1;

    display: flex;

    flex-direction: column;

  }



  .user-address {

    color: white;

    font-size: 0.8rem;

    font-family: monospace;

    word-break: break-all;

  }



  .user-status {

    color: rgba(255, 255, 255, 0.6);

    font-size: 0.7rem;

  }



  .menu-divider {

    height: 1px;

    background: rgba(255, 255, 255, 0.1);

    margin: 0;

  }



  .menu-items {

    padding: 0.5rem 0;

  }



  .menu-item {

    display: flex;

    align-items: center;

    gap: 0.75rem;

    width: 100%;

    padding: 0.75rem 1rem;

    background: none;

    border: none;

    color: white;

    cursor: pointer;

    transition: all 0.2s ease;

    font-size: 0.9rem;

  }



  .menu-item:hover {

    background: rgba(255, 85, 0, 0.1);

    color: #FF5500;

  }



  .menu-item.disconnect-item {

    color: #ff6b6b;

  }



  .menu-item.disconnect-item:hover {

    background: rgba(255, 107, 107, 0.1);

    color: #ff4444;

  }



  /* Mobile Menu Button */

  .mobile-menu-btn {

    display: none;

    background: rgba(255, 85, 0, 0.1);

    color: #FF5500;

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-radius: 8px;

    padding: 0.75rem;

    cursor: pointer;

    transition: all 0.2s ease;

    font-size: 1.1rem;

  }



  .mobile-menu-btn:hover {

    background: rgba(255, 85, 0, 0.2);

  }



  /* Mobile Menu */

  .mobile-menu {

    position: absolute;

    top: 100%;

    left: 0;

    right: 0;

    background: #262626;

    border: 1px solid rgba(255, 85, 0, 0.3);

    border-top: none;

    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    z-index: 150;

  }



  .mobile-nav {

    padding: 0.5rem 0;

  }



  .mobile-menu-item {

    display: flex;

    align-items: center;

    gap: 1rem;

    width: 100%;

    padding: 1rem 1.5rem;

    background: none;

    border: none;

    color: white;

    cursor: pointer;

    transition: all 0.2s ease;

    font-size: 1rem;

    position: relative;

  }



  .mobile-menu-item:hover,

  .mobile-menu-item.active {

    background: rgba(255, 85, 0, 0.1);

    color: #FF5500;

  }



  .menu-item-content {

    display: flex;

    align-items: center;

    justify-content: space-between;

    width: 100%;

  }



  .mobile-notification-badge {

    background-color: #ff4444;

    color: white;

    border-radius: 12px;

    padding: 0.2rem 0.5rem;

    font-size: 0.7rem;

    font-weight: bold;

    min-width: 18px;

    text-align: center;

  }



  /* Mobile Menu Divider */

  .mobile-menu-divider {

    height: 1px;

    background: rgba(255, 255, 255, 0.1);

    margin: 0.5rem 0;

  }



  /* Mobile Stealth Container */

  .mobile-stealth-container {

    padding: 0.5rem 1.5rem 1rem;

    border-top: 1px solid rgba(255, 255, 255, 0.1);

  }



  .wallet-status.disconnected {

    /* Keep existing WalletButton styles */

  }



  /* Responsive Breakpoints */

  @media (max-width: 1024px) {

    .btn-label {

      display: none;

    }

    

    .header-btn {

      padding: 0.5rem;

      min-width: 40px;

      justify-content: center;

    }

    

    .user-menu-container.desktop-only {

      display: none;

    }

    

    .stealth-desktop-only {

      display: none;

    }

  }



  @media (max-width: 768px) {

    .app-header {

      padding: 0.75rem 1rem;

    }

    

    .desktop-nav {

      display: none;

    }

    

    .mobile-menu-btn {

      display: flex;

    }

    

    .app-title {

      font-size: 1.3rem;

    }

    

    .app-logo svg {

      width: 32px;

      height: 32px;

    }

    

    .user-menu-container.desktop-only {

      display: none;

    }

    

    .stealth-desktop-only {

      display: none;

    }

  }



  @media (max-width: 480px) {

    .app-header {

      padding: 0.5rem 0.75rem;

    }

    

    .header-left {

      gap: 0.5rem;

    }

    

    .app-title {

      font-size: 1.2rem;

    }

    

    .app-logo svg {

      width: 28px;

      height: 28px;

    }

    

    .wallet-user-container {

      gap: 0.25rem;

    }

    

    .mobile-menu-item {

      padding: 0.75rem 1rem;

    }

    

    /* Show wallet address in mobile */

    .wallet-address {

      font-size: 0.8rem;

    }

  }



  /* Small screens - hide app title but keep wallet visible */

  @media (max-width: 360px) {

    .app-title {

      display: none;

    }

    

    .header-left {

      gap: 0;

    }

    

    .wallet-address {

      font-size: 0.75rem;

    }

    

    .wallet-user-container {

      flex: 1;

      justify-content: flex-end;

    }

  }
  .gift-btn {
  background: linear-gradient(135deg, #FF5500, #ff7f39);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
}

.gift-btn:hover {
  background: linear-gradient(135deg, #ff7f39, #FF5500);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(255, 85, 0, 0.3);
}
</style>
