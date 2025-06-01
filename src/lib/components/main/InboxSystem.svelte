<!-- InboxSystem.svelte - Complete private messaging inbox interface with escrow integration - WALLET-SPECIFIC CACHING FIXED -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { slide, fade } from 'svelte/transition';
  import {
  selected_wallet_ergo,
  connected_wallet_address,
  connected_wallet_addresses,
  wallet_init
} from '$lib/store/store';
  import { truncateAddress, showCustomToast } from '$lib/utils/utils';
  import ThreadedMessage from './ThreadedMessage.svelte';
  import EscrowCreationModal from './EscrowCreationModal.svelte';
  import EscrowTradingWidget from './EscrowTradingWidget.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let currentUserAddress = '';
  export let allMessages = []; // All messages from the chat system
  export let isVisible = false;
  export let onNewDM = null; // Callback for new DM notifications
  
  // Inbox state
  let conversations = [];
  let selectedConversation = null;
  let showNewMessageModal = false;
  let showContactModal = false;
  let newRecipientAddress = '';
  let newMessageContent = '';
  let searchQuery = '';
  let sendingMessage = false;
  let contacts = new Map(); // Store custom contact names
  let editingContact = null;
  let newContactName = '';
  
  // NEW: Escrow state
  let showEscrowModal = false;
  let showEscrowTrades = false;
  let escrowData = {
      buyerAddress: '',
      sellerAddress: '',
      buyerName: '',
      sellerName: '',
      initiatedBy: 'buyer'
  };
  
  // Track previous message count for notifications
  let previousDMCount = 0;
  
  // Track previous wallet to detect changes
  let previousWalletAddress = '';
  
  // FIXED: Debug function to log current state
  function debugConversationState(context) {
    console.log(`=== INBOX DEBUG: ${context} ===`);
    console.log('Current state:', {
      conversationsCount: conversations.length,
      allMessagesCount: allMessages.length,
      currentUserAddress: currentUserAddress,
      selectedConversation: selectedConversation?.id,
      isVisible: isVisible
    });
    
    conversations.forEach((conv, index) => {
      console.log(`Conversation ${index}:`, {
        id: conv.id,
        otherUser: conv.otherUser,
        messagesCount: conv.messages?.length || 0,
        lastMessage: conv.lastMessage?.content?.substring(0, 30) || 'none',
        isFromCache: conv.isFromCache,
        lastActivity: conv.lastActivity,
        unreadCount: conv.unreadCount
      });
    });
    
    console.log('=== END DEBUG ===');
  }

  // NEW: Helper function to create wallet-specific cache keys
  function getWalletCacheKey(baseKey, walletAddress) {
    if (!walletAddress) return null;
    const cleanWallet = cleanAddress(walletAddress);
    return `${baseKey}_${cleanWallet}`;
  }

  // NEW: Function to clear cache when wallet changes
  function clearCacheForDifferentWallet(newWalletAddress) {
    // Clear in-memory state immediately
    conversations = [];
    selectedConversation = null;
    
    console.log(`Cleared cache for wallet change to: ${cleanAddress(newWalletAddress)}`);
  }

  // FIXED: Enhanced reactive statements with wallet change detection
  $: {
    // CRITICAL: Detect wallet changes and clear cache
    if (currentUserAddress && currentUserAddress !== previousWalletAddress) {
      console.log('WALLET CHANGE DETECTED:', {
        previous: previousWalletAddress,
        current: currentUserAddress
      });
      
      // Clear conversations from previous wallet
      if (previousWalletAddress && conversations.length > 0) {
        console.log('Clearing conversations from previous wallet');
        clearCacheForDifferentWallet(currentUserAddress);
      }
      
      previousWalletAddress = currentUserAddress;
    }
    
    console.log('REACTIVE TRIGGER:', {
      allMessagesLength: allMessages.length, 
      currentUserAddress: !!currentUserAddress,
      conversationsCount: conversations.length,
      timestamp: Date.now()
    });
    
    // Primary condition: We have messages AND a user address
    if (allMessages && allMessages.length > 0 && currentUserAddress) {
      console.log('REACTIVE: Conditions met - calling updateConversationsWithMessages');
      updateConversationsWithMessages();
    } 
    // Secondary condition: User exists but no conversations loaded yet
    else if (currentUserAddress && conversations.length === 0) {
      console.log('REACTIVE: User exists but no conversations - loading cached');
      loadCachedConversations();
    }
    // Third condition: If we have conversations but no current user yet, preserve them
    else if (!currentUserAddress && conversations.length > 0) {
      console.log('REACTIVE: Preserving existing conversations until user loads');
    }
    
    // Always debug the state after reactive updates
    setTimeout(() => {
      debugConversationState('After Reactive Update');
    }, 100);
  }
  
  // FIXED: Additional watcher for currentUserAddress changes
  $: if (currentUserAddress && allMessages.length > 0) {
    console.log('USER ADDRESS CHANGED - Force updating conversations');
    // Small delay to ensure all reactive statements have run
    setTimeout(() => updateConversationsWithMessages(), 50);
  }
  
  $: filteredConversations = conversations.filter(conv => 
    !searchQuery || 
    getContactName(conv.otherUser).toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Check for new DMs and trigger notifications
  $: {
    const currentDMCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    if (currentDMCount > previousDMCount && previousDMCount > 0) {
      // New DM received - trigger notification
      if (onNewDM && typeof onNewDM === 'function') {
        onNewDM(currentDMCount);
      }
    }
    previousDMCount = currentDMCount;
  }
  
  // Get contact name or fallback to address
  function getContactName(address) {
    const customName = contacts.get(address);
    if (customName) {
      return customName;
    }
    return truncateAddress(address);
  }
  
  // Save contact name
  function saveContactName(address, name) {
    if (name.trim()) {
      contacts.set(address, name.trim());
      saveContactsToStorage();
      showCustomToast('Contact name saved!', 2000, 'success');
    }
  }
  
  // Delete contact name
  function deleteContactName(address) {
    contacts.delete(address);
    saveContactsToStorage();
    showCustomToast('Contact name removed', 2000, 'info');
  }
  
  // FIXED: Save contacts to localStorage with wallet-specific key
  function saveContactsToStorage() {
    try {
      if (!currentUserAddress) return;
      
      const contactsKey = getWalletCacheKey('ergoChat_contacts', currentUserAddress);
      if (!contactsKey) return;
      
      const contactsObj = Object.fromEntries(contacts);
      localStorage.setItem(contactsKey, JSON.stringify(contactsObj));
    } catch (error) {
      console.error('Error saving contacts:', error);
    }
  }
  
  // FIXED: Load contacts from localStorage with wallet-specific key
  function loadContactsFromStorage() {
    try {
      if (!currentUserAddress) return;
      
      const contactsKey = getWalletCacheKey('ergoChat_contacts', currentUserAddress);
      if (!contactsKey) return;
      
      const stored = localStorage.getItem(contactsKey);
      if (stored) {
        const contactsObj = JSON.parse(stored);
        contacts = new Map(Object.entries(contactsObj));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }
  
  // Open contact edit modal
  function editContact(address) {
    editingContact = address;
    newContactName = contacts.get(address) || '';
    showContactModal = true;
  }
  
  // Save contact edit
  function saveContactEdit() {
    if (editingContact && newContactName.trim()) {
      saveContactName(editingContact, newContactName);
      showContactModal = false;
      editingContact = null;
      newContactName = '';
    }
  }
  
  // Cancel contact edit
  function cancelContactEdit() {
    showContactModal = false;
    editingContact = null;
    newContactName = '';
  }
  
  // Create conversation ID from two addresses (consistent ordering)
  function createConversationId(addr1, addr2) {
    const addresses = [addr1, addr2].sort();
    return `dm-${addresses[0]}-${addresses[1]}`;
  }
  
  // Clean address helper
  function cleanAddress(address) {
    if (!address) return '';
    if (address.startsWith('3') && address.length > 50) {
      return address.substring(1);
    }
    return address;
  }
  
  // Check if message is a DM (private conversation between two users)
  function isDMMessage(message) {
    // DMs would be stored in chatrooms with format: dm-address1-address2
    return message.chatroomId && message.chatroomId.startsWith('dm-');
  }
  
  // Extract other user from DM room ID
  function getOtherUserFromDMRoom(roomId, currentUser) {
    if (!roomId || !roomId.startsWith('dm-')) return '';
    
    const parts = roomId.replace('dm-', '').split('-');
    const addr1 = parts[0];
    const addr2 = parts[1];
    
    const cleanCurrentUser = cleanAddress(currentUser);
    
    if (cleanAddress(addr1) === cleanCurrentUser) {
      return addr2;
    } else if (cleanAddress(addr2) === cleanCurrentUser) {
      return addr1;
    }
    
    return '';
  }
  
  // NEW: Escrow functions
  function initiateEscrow() {
      if (!selectedConversation) {
          showCustomToast('Please select a conversation first', 3000, 'warning');
          return;
      }

      const cleanCurrentUser = cleanAddress(currentUserAddress);
      const otherUser = selectedConversation.otherUser;
      
      // Current user is always the seller, other user is always the buyer
      escrowData = {
          buyerAddress: otherUser,        // Other party is buyer
          sellerAddress: cleanCurrentUser, // Current user is seller  
          buyerName: getContactName(otherUser),
          sellerName: 'You',
          initiatedBy: 'seller'  // Always selling
      };
      
      showEscrowModal = true;
      
      showCustomToast('Creating escrow to sell to ' + getContactName(otherUser), 2000, 'info');
  }

  // NEW: Show escrow trades
  function showEscrowTradesWidget() {
      if (!selectedConversation) {
          showCustomToast('Please select a conversation first', 3000, 'warning');
          return;
      }
      
      showEscrowTrades = true;
      showCustomToast('Loading escrow trades...', 2000, 'info');
  }

  // NEW: Close escrow trades widget
  function closeEscrowTrades() {
      showEscrowTrades = false;
  }

  function closeEscrowModal() {
      showEscrowModal = false;
      escrowData = {
          buyerAddress: '',
          sellerAddress: '',
          buyerName: '',
          sellerName: '',
          initiatedBy: 'buyer'
      };
  }

  async function handleEscrowCreated(event) {
      const { escrowDetails, transactionId } = event.detail;
      
      try {
          // Close escrow modal
          closeEscrowModal();
          
          showCustomToast(
              `Escrow created successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${transactionId}">${transactionId.substring(0, 8)}...</a>`,
              7000,
              'success'
          );
          
      } catch (error) {
          console.error('InboxSystem: Error handling escrow creation:', error);
          showCustomToast('Escrow created successfully!', 3000, 'success');
          closeEscrowModal();
      }
  }
  
  // FIXED: Update conversations while preserving cache
  function updateConversationsWithMessages() {
    console.log('=== updateConversationsWithMessages START ===');
    console.log('Input data:', {
      existingConversations: conversations.length,
      allMessages: allMessages.length,
      currentUser: currentUserAddress
    });
    
    if (!currentUserAddress) {
      console.log('No current user address - skipping update');
      return;
    }
    
    const cleanCurrentUser = cleanAddress(currentUserAddress);
    console.log('Processing for user:', cleanCurrentUser);
    
    const conversationMap = new Map();
    
    // Start with existing conversations (including cached ones)
    console.log('Preserving existing conversations...');
    conversations.forEach((conv, index) => {
      console.log(`Preserving conversation ${index}:`, {
        id: conv.id,
        otherUser: conv.otherUser,
        wasFromCache: conv.isFromCache,
        hadMessages: conv.messages?.length || 0
      });
      
      conversationMap.set(conv.id, {
        ...conv,
        messages: [], // Reset messages, will be repopulated
        lastMessage: null, // Will be recalculated
        // Preserve other properties like unreadCount, lastViewedTimestamp
      });
    });
    
    // Filter DM messages involving current user
    const dmMessages = allMessages.filter(msg => {
      if (!isDMMessage(msg)) return false;
      
      const otherUser = getOtherUserFromDMRoom(msg.chatroomId, cleanCurrentUser);
      const isValidDM = otherUser !== '';
      
      if (isValidDM) {
        console.log('Found DM message:', {
          chatroomId: msg.chatroomId,
          otherUser: otherUser,
          content: msg.content?.substring(0, 30),
          sender: msg.sender?.substring(0, 10)
        });
      }
      
      return isValidDM;
    });
    
    console.log(`Processing ${dmMessages.length} DM messages for ${conversations.length} existing conversations`);
    
    // Group messages by conversation
    dmMessages.forEach((msg, msgIndex) => {
      const otherUser = getOtherUserFromDMRoom(msg.chatroomId, cleanCurrentUser);
      const conversationId = createConversationId(cleanCurrentUser, otherUser);
      
      if (!conversationMap.has(conversationId)) {
        console.log(`Creating NEW conversation for message ${msgIndex}:`, {
          conversationId,
          otherUser,
          messageContent: msg.content?.substring(0, 30)
        });
        
        // Create new conversation if not in cache
        conversationMap.set(conversationId, {
          id: conversationId,
          otherUser: otherUser,
          messages: [],
          lastMessage: null,
          unreadCount: 0,
          lastActivity: 0,
          lastViewedTimestamp: 0,
          isFromCache: false
        });
      }
      
      const conversation = conversationMap.get(conversationId);
      conversation.messages.push(msg);
      
      // Update last message and activity
      if (!conversation.lastMessage || msg.timestamp > conversation.lastMessage.timestamp) {
        conversation.lastMessage = msg;
        conversation.lastActivity = msg.timestamp;
      }
      
      // Count unread (messages not from current user and after last viewed)
      const cleanMsgSender = cleanAddress(msg.sender);
      const lastViewed = conversation.lastViewedTimestamp || 0;
      const msgTime = msg.timestamp * 1000; // Convert to milliseconds
      
      if (cleanMsgSender !== cleanCurrentUser && msgTime > lastViewed && !msg.read) {
        conversation.unreadCount++;
      }
      
      // Remove cache flag when real messages are present
      conversation.isFromCache = false;
    });
    
    // Sort messages in each conversation by timestamp (oldest first for chat display)
    conversationMap.forEach((conversation, convId) => {
      if (conversation.messages.length > 0) {
        conversation.messages.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`Conversation ${convId} now has ${conversation.messages.length} messages`);
      } else {
        console.log(`Conversation ${convId} has NO messages - keeping as cached`);
      }
    });
    
    // Convert to array and sort conversations by last activity (newest first)
    const previousCount = conversations.length;
    conversations = Array.from(conversationMap.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);
    
    console.log(`=== updateConversationsWithMessages COMPLETE ===`);
    console.log('Result:', {
      previousCount,
      newCount: conversations.length,
      withMessages: conversations.filter(c => c.messages.length > 0).length,
      stillCached: conversations.filter(c => c.isFromCache).length
    });
    
    // Save the updated state
    saveConversationMetadata();
    
    // Debug final state
    debugConversationState('After updateConversationsWithMessages');
  }
  
  // FIXED: Enhanced conversation metadata management with wallet-specific caching
  function loadAndMergeConversationMetadata() {
    try {
      if (!currentUserAddress) {
        console.log('No user address - cannot load wallet-specific metadata');
        return;
      }
      
      const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', currentUserAddress);
      const conversationCacheKey = getWalletCacheKey('ergoChat_cached_conversations', currentUserAddress);
      
      if (!metadataKey || !conversationCacheKey) {
        console.warn('Could not create wallet-specific cache keys for metadata');
        return;
      }
      
      const stored = localStorage.getItem(metadataKey);
      const cachedConversations = localStorage.getItem(conversationCacheKey);
      
      if (stored) {
        const metadata = JSON.parse(stored);
        
        // Update existing conversations with stored metadata
        conversations = conversations.map(conv => {
          const storedMeta = metadata.find(m => m.id === conv.id);
          if (storedMeta) {
            return { 
              ...conv, 
              unreadCount: storedMeta.unreadCount,
              lastViewedTimestamp: storedMeta.lastViewedTimestamp || 0
            };
          }
          return conv;
        });
      }
      
      // Merge with cached conversations (for conversations that might not have messages yet)
      if (cachedConversations) {
        const cached = JSON.parse(cachedConversations);
        
        cached.forEach(cachedConv => {
          // Only add if not already in conversations AND belongs to current wallet
          const belongsToWallet = getOtherUserFromDMRoom(cachedConv.id, cleanAddress(currentUserAddress)) !== '';
          
          if (belongsToWallet && !conversations.find(conv => conv.id === cachedConv.id)) {
            conversations.push({
              ...cachedConv,
              messages: [], // Start with empty messages, will be populated when messages arrive
              lastMessage: null,
              unreadCount: 0,
              lastActivity: cachedConv.lastActivity || Date.now() / 1000
            });
          }
        });
        
        // Re-sort after merging
        conversations.sort((a, b) => b.lastActivity - a.lastActivity);
      }
      
    } catch (error) {
      console.error('Error loading conversation metadata:', error);
    }
  }
  
  // FIXED: Enhanced saving with wallet-specific conversation caching
  function saveConversationMetadata() {
    try {
      if (!currentUserAddress) {
        console.log('No user address - skipping save');
        return;
      }
      
      // Save metadata with wallet-specific key
      const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', currentUserAddress);
      const conversationCacheKey = getWalletCacheKey('ergoChat_cached_conversations', currentUserAddress);
      
      if (!metadataKey || !conversationCacheKey) {
        console.warn('Could not create wallet-specific cache keys');
        return;
      }
      
      const metadata = conversations.map(conv => ({
        id: conv.id,
        otherUser: conv.otherUser,
        unreadCount: conv.unreadCount,
        lastActivity: conv.lastActivity,
        lastViewedTimestamp: conv.lastViewedTimestamp || 0
      }));
      
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
      
      // Cache conversation structure for quick loading
      const conversationCache = conversations.map(conv => ({
        id: conv.id,
        otherUser: conv.otherUser,
        lastActivity: conv.lastActivity,
        lastViewedTimestamp: conv.lastViewedTimestamp || 0
      }));
      
      localStorage.setItem(conversationCacheKey, JSON.stringify(conversationCache));
      
      console.log(`Saved metadata for ${conversations.length} conversations for wallet ${cleanAddress(currentUserAddress)}`);
      
    } catch (error) {
      console.error('Error saving conversation metadata:', error);
    }
  }
  
  // FIXED: Load cached conversations with wallet-specific keys
  function loadCachedConversations() {
    try {
      if (!currentUserAddress) {
        console.log('No user address - cannot load wallet-specific cache');
        return;
      }
      
      const conversationCacheKey = getWalletCacheKey('ergoChat_cached_conversations', currentUserAddress);
      const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', currentUserAddress);
      
      if (!conversationCacheKey || !metadataKey) {
        console.warn('Could not create wallet-specific cache keys');
        return;
      }
      
      const cachedConversations = localStorage.getItem(conversationCacheKey);
      const metadata = localStorage.getItem(metadataKey);
      
      if (cachedConversations) {
        const cached = JSON.parse(cachedConversations);
        const metaData = metadata ? JSON.parse(metadata) : [];
        
        console.log(`Loading ${cached.length} cached conversations for wallet ${cleanAddress(currentUserAddress)}`);
        
        // Only load cache if we don't already have conversations
        if (conversations.length === 0) {
          // Create conversations from cache - but only for current wallet
          conversations = cached
            .filter(cachedConv => {
              // Double-check that this conversation belongs to current wallet
              const otherUser = getOtherUserFromDMRoom(cachedConv.id, cleanAddress(currentUserAddress));
              return otherUser !== '';
            })
            .map(cachedConv => {
              const meta = metaData.find(m => m.id === cachedConv.id) || {};
              
              return {
                id: cachedConv.id,
                otherUser: cachedConv.otherUser,
                messages: [], // Will be populated when actual messages load
                lastMessage: null, // Will be updated when messages arrive
                unreadCount: meta.unreadCount || 0,
                lastActivity: cachedConv.lastActivity || Date.now() / 1000,
                lastViewedTimestamp: meta.lastViewedTimestamp || 0,
                isFromCache: true // Flag to indicate this is from cache
              };
            })
            .sort((a, b) => b.lastActivity - a.lastActivity);
          
          console.log(`Loaded ${conversations.length} wallet-specific conversations from cache`);
        } else {
          console.log(`Skipped cache loading - already have ${conversations.length} conversations`);
        }
      } else {
        console.log(`No cached conversations found for wallet ${cleanAddress(currentUserAddress)}`);
      }
    } catch (error) {
      console.error('Error loading cached conversations:', error);
      if (conversations.length === 0) {
        conversations = [];
      }
    }
  }
  
  // Start new conversation with caching
  function startNewConversation() {
    if (!newRecipientAddress.trim()) {
      showCustomToast('Please enter a recipient address', 3000, 'warning');
      return;
    }
    
    const cleanRecipient = cleanAddress(newRecipientAddress.trim());
    const cleanCurrentUser = cleanAddress(currentUserAddress);
    
    if (cleanRecipient === cleanCurrentUser) {
      showCustomToast('Cannot send message to yourself', 3000, 'warning');
      return;
    }
    
    // Check if conversation already exists
    const existingConv = conversations.find(conv => 
      cleanAddress(conv.otherUser) === cleanRecipient
    );
    
    if (existingConv) {
      selectedConversation = existingConv;
      showNewMessageModal = false;
      newRecipientAddress = '';
      return;
    }
    
    // Create new conversation
    const conversationId = createConversationId(cleanCurrentUser, cleanRecipient);
    const newConversation = {
      id: conversationId,
      otherUser: cleanRecipient,
      messages: [],
      lastMessage: null,
      unreadCount: 0,
      lastActivity: Date.now() / 1000,
      lastViewedTimestamp: Date.now(),
      isFromCache: false
    };
    
    conversations = [newConversation, ...conversations];
    selectedConversation = newConversation;
    showNewMessageModal = false;
    newRecipientAddress = '';
    
    saveConversationMetadata();
  }
  
  // Select conversation with proper read marking
  function selectConversation(conversation) {
    selectedConversation = conversation;
    
    // Mark as read and update timestamp
    conversation.unreadCount = 0;
    conversation.lastViewedTimestamp = Date.now();
    conversation.isFromCache = false; // Remove cache flag when actively viewing
    
    // Mark all messages in this conversation as read
    conversation.messages.forEach(msg => {
      msg.read = true;
    });
    
    saveConversationMetadata();
  }
  
  // Send DM message
  async function sendDMMessage() {
      if (!selectedConversation || !newMessageContent.trim() || sendingMessage) {
          return;
      }
      
      console.log("InboxSystem: Preparing to send DM message");
      console.log("Selected conversation:", selectedConversation);
      console.log("Message content:", newMessageContent);
      
      sendingMessage = true;
      
      try {
          const cleanCurrentUser = cleanAddress(currentUserAddress);
          const dmRoomId = createConversationId(cleanCurrentUser, selectedConversation.otherUser);
          
          console.log("InboxSystem: Dispatching sendDMMessage event", {
              recipientAddress: selectedConversation.otherUser,
              message: newMessageContent.trim(),
              chatroomId: dmRoomId
          });
          
          // Dispatch to parent to handle the actual sending
          dispatch('sendDMMessage', {
              recipientAddress: selectedConversation.otherUser,
              message: newMessageContent.trim(),
              chatroomId: dmRoomId
          });
          
          // Clear input immediately (optimistic UI)
          newMessageContent = '';
          
      } catch (error) {
          console.error('InboxSystem: Error preparing DM:', error);
          showCustomToast('Failed to prepare DM', 3000, 'error');
      } finally {
          setTimeout(() => {
              sendingMessage = false;
          }, 1000);
      }
  }
  
  // Format time for display
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  // Handle keypress in message input
  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendDMMessage();
    }
  }
  
  // Close inbox
  function closeInbox() {
    dispatch('close');
  }
  
  // FIXED: Enhanced onMount with wallet-specific loading
  onMount(() => {
    console.log('=== InboxSystem: MOUNTING ===');
    console.log('Mount state:', {
      currentUserAddress,
      allMessagesLength: allMessages.length,
      existingConversations: conversations.length
    });
    
    // Load contacts first (wallet-specific)
    if (currentUserAddress) {
      loadContactsFromStorage();
      
      // Load cached conversations for immediate display
      loadCachedConversations();
    }
    
    console.log(`InboxSystem: After mount - ${conversations.length} conversations loaded`);
    debugConversationState('After Mount Complete');
    
    // ENHANCED: Add comprehensive debugging to window with wallet-specific functions
    window.debugInbox = {
      conversations: () => conversations,
      allMessages: () => allMessages,
      debugState: () => debugConversationState('Manual Debug'),
      forceUpdate: () => {
        console.log('FORCE UPDATE: Manually triggering updateConversationsWithMessages');
        updateConversationsWithMessages();
      },
      clearCache: () => {
        if (currentUserAddress) {
          const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', currentUserAddress);
          const conversationKey = getWalletCacheKey('ergoChat_cached_conversations', currentUserAddress);
          const contactsKey = getWalletCacheKey('ergoChat_contacts', currentUserAddress);
          
          localStorage.removeItem(metadataKey);
          localStorage.removeItem(conversationKey);
          localStorage.removeItem(contactsKey);
          console.log(`All inbox cache cleared for wallet ${cleanAddress(currentUserAddress)}`);
        } else {
          console.log('No current user - cannot clear wallet-specific cache');
        }
      },
      testCache: () => {
        if (currentUserAddress) {
          const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', currentUserAddress);
          const conversationKey = getWalletCacheKey('ergoChat_cached_conversations', currentUserAddress);
          
          const cached = localStorage.getItem(conversationKey);
          const metadata = localStorage.getItem(metadataKey);
          console.log(`Cache contents for wallet ${cleanAddress(currentUserAddress)}:`, { 
            cached: !!cached, 
            metadata: !!metadata 
          });
          if (cached) console.log('Cached conversations:', JSON.parse(cached));
          if (metadata) console.log('Metadata:', JSON.parse(metadata));
        } else {
          console.log('No current user - cannot check wallet-specific cache');
        }
      },
      getCurrentUser: () => currentUserAddress,
      testMessageFiltering: () => {
        const cleanCurrentUser = cleanAddress(currentUserAddress);
        const dmMessages = allMessages.filter(msg => {
          if (!isDMMessage(msg)) return false;
          const otherUser = getOtherUserFromDMRoom(msg.chatroomId, cleanCurrentUser);
          return otherUser !== '';
        });
        console.log(`Found ${dmMessages.length} DM messages for user ${cleanCurrentUser}`);
        dmMessages.forEach((msg, i) => {
          console.log(`${i + 1}. ${msg.chatroomId} - ${msg.content?.substring(0, 30)}`);
        });
        return dmMessages;
      },
      reinitialize: () => {
        console.log('REINITIALIZE: Clearing state and reloading...');
        conversations = [];
        if (currentUserAddress) {
          loadCachedConversations();
          if (allMessages.length > 0) {
            setTimeout(() => updateConversationsWithMessages(), 100);
          }
        }
      },
      testReactive: () => {
        console.log('TESTING REACTIVE: Simulating prop changes...');
        console.log('Current props:', {
          allMessagesLength: allMessages.length,
          currentUserAddress,
          conversationsLength: conversations.length
        });
        
        // Force trigger reactive statement
        if (allMessages.length > 0 && currentUserAddress) {
          updateConversationsWithMessages();
        }
      },
      // NEW: Wallet-specific debug functions
      checkWalletCache: (walletAddress) => {
        const cleanWallet = cleanAddress(walletAddress || currentUserAddress);
        const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', cleanWallet);
        const conversationKey = getWalletCacheKey('ergoChat_cached_conversations', cleanWallet);
        const contactsKey = getWalletCacheKey('ergoChat_contacts', cleanWallet);
        
        console.log(`Checking cache for wallet: ${cleanWallet}`);
        console.log('Metadata key:', metadataKey);
        console.log('Conversation key:', conversationKey);
        console.log('Contacts key:', contactsKey);
        
        const metadata = localStorage.getItem(metadataKey);
        const conversations = localStorage.getItem(conversationKey);
        const contacts = localStorage.getItem(contactsKey);
        
        console.log('Has metadata:', !!metadata);
        console.log('Has conversations:', !!conversations);
        console.log('Has contacts:', !!contacts);
        
        if (metadata) console.log('Metadata:', JSON.parse(metadata));
        if (conversations) console.log('Conversations:', JSON.parse(conversations));
        if (contacts) console.log('Contacts:', JSON.parse(contacts));
      },
      
      clearWalletCache: (walletAddress) => {
        const cleanWallet = cleanAddress(walletAddress || currentUserAddress);
        const metadataKey = getWalletCacheKey('ergoChat_inbox_metadata', cleanWallet);
        const conversationKey = getWalletCacheKey('ergoChat_cached_conversations', cleanWallet);
        const contactsKey = getWalletCacheKey('ergoChat_contacts', cleanWallet);
        
        localStorage.removeItem(metadataKey);
        localStorage.removeItem(conversationKey);
        localStorage.removeItem(contactsKey);
        
        console.log(`Cleared cache for wallet: ${cleanWallet}`);
      },
      
      listAllWalletCaches: () => {
        console.log('All wallet caches in localStorage:');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('ergoChat_inbox_') || key.includes('ergoChat_cached_conversations_') || key.includes('ergoChat_contacts_'))) {
            console.log(`${key}: ${localStorage.getItem(key) ? 'EXISTS' : 'EMPTY'}`);
          }
        }
      },
      
      simulateWalletChange: (newWalletAddress) => {
        console.log(`Simulating wallet change from ${currentUserAddress} to ${newWalletAddress}`);
        previousWalletAddress = currentUserAddress;
        currentUserAddress = newWalletAddress;
        clearCacheForDifferentWallet(newWalletAddress);
        loadContactsFromStorage();
        loadCachedConversations();
      }
    };
    
    console.log('Enhanced debug functions added to window.debugInbox');
    console.log('Available functions: conversations, allMessages, debugState, forceUpdate, clearCache, testCache, getCurrentUser, testMessageFiltering, reinitialize, testReactive, checkWalletCache, clearWalletCache, listAllWalletCaches, simulateWalletChange');
    
    // FORCE: Try immediate update if we have data
    if (allMessages.length > 0 && currentUserAddress) {
      console.log('MOUNT: Force triggering initial update...');
      setTimeout(() => {
        updateConversationsWithMessages();
      }, 100);
    }
  });
</script>

<!-- Inbox Modal -->
{#if isVisible}
<div class="inbox-overlay" transition:fade={{ duration: 200 }}>
<div class="inbox-container" transition:slide={{ duration: 300 }}>
  <!-- Inbox Header -->
  <div class="inbox-header">
    <div class="header-left">
      <i class="fa-solid fa-inbox"></i>
      <h2>Inbox</h2>
      <span class="conversation-count">({conversations.length})</span>
      {#if currentUserAddress}
        <span class="wallet-indicator" title="Wallet: {truncateAddress(currentUserAddress)}">
          <i class="fa-solid fa-wallet"></i>
          {truncateAddress(currentUserAddress)}
        </span>
      {/if}
    </div>
    <div class="header-right">
      <button class="header-btn" on:click={() => showNewMessageModal = true}>
        <i class="fa-solid fa-plus"></i>
        <span>New DM</span>
      </button>
      <button class="header-btn close-btn" on:click={closeInbox}>
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
  </div>
  
  <div class="inbox-body">
    <!-- Conversations Sidebar -->
    <div class="conversations-sidebar {selectedConversation ? 'hidden-mobile' : ''}">
      <!-- Search -->
      <div class="search-container">
        <i class="fa-solid fa-search search-icon"></i>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search conversations..."
          class="search-input"
        />
      </div>
      
      <!-- Conversations List -->
      <div class="conversations-list">
        {#if filteredConversations.length === 0}
          <div class="empty-conversations">
            <i class="fa-solid fa-comments"></i>
            <p>No conversations yet</p>
            <button class="start-conversation-btn" on:click={() => showNewMessageModal = true}>
              Start a conversation
            </button>
          </div>
        {:else}
          {#each filteredConversations as conversation (conversation.id)}
            <div 
              class="conversation-item {selectedConversation?.id === conversation.id ? 'active' : ''}"
              on:click={() => selectConversation(conversation)}
            >
              <div class="conversation-avatar">
                <i class="fa-solid fa-user"></i>
              </div>
              <div class="conversation-info">
                <div class="conversation-header">
                  <span class="conversation-name">
                    {getContactName(conversation.otherUser)}
                  </span>
                  {#if conversation.unreadCount > 0}
                    <span class="unread-badge">{conversation.unreadCount}</span>
                  {/if}
                </div>
                <div class="conversation-preview">
                  {#if conversation.lastMessage}
                    <span class="last-message">
                      {conversation.lastMessage.content.length > 50 
                        ? conversation.lastMessage.content.substring(0, 50) + '...' 
                        : conversation.lastMessage.content}
                    </span>
                    <span class="last-time">{formatTime(conversation.lastActivity)}</span>
                  {:else}
                    <span class="no-messages {conversation.isFromCache ? 'cached' : ''}">
                      {conversation.isFromCache ? 'Cached conversation' : 'No messages yet'}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
    
    <!-- Conversation View -->
    <div class="conversation-view {selectedConversation ? 'active' : ''}">
      {#if selectedConversation}
        <!-- Conversation Header -->
        <div class="conversation-header">
          <div class="conversation-user">
            <!-- Mobile back button -->
            <button class="back-btn" on:click={() => selectedConversation = null}>
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            
            <div class="user-avatar">
              <i class="fa-solid fa-user"></i>
            </div>
            <div class="user-info">
              <h3>{getContactName(selectedConversation.otherUser)}</h3>
              <span class="user-address">{selectedConversation.otherUser}</span>
            </div>
          </div>
          <div class="conversation-actions">
            <!-- NEW: Escrow actions -->
            <button 
              class="action-btn escrow-btn" 
              title="View escrow trades" 
              on:click={() => showEscrowTradesWidget()}
            >
              <i class="fa-solid fa-list"></i>
              <span class="btn-tooltip">Trades</span>
            </button>
            
            <button 
              class="action-btn escrow-btn" 
              title="Create escrow to sell" 
              on:click={() => initiateEscrow()}
            >
              <i class="fa-solid fa-handshake"></i>
              <span class="btn-tooltip">Sell</span>
            </button>
            
            <!-- Existing buttons -->
            <button class="action-btn" title="Edit contact name" on:click={() => editContact(selectedConversation.otherUser)}>
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="action-btn" title="Tip this user" on:click={() => dispatch('openTip', {
              recipientAddress: selectedConversation.otherUser,
              recipientName: getContactName(selectedConversation.otherUser)
            })}>
              <i class="fa-solid fa-donate"></i>
            </button>
            <button class="action-btn" title="Copy address" on:click={async () => {
              try {
                await navigator.clipboard.writeText(selectedConversation.otherUser);
                showCustomToast('Address copied to clipboard!', 2000, 'success');
              } catch (err) {
                console.error('Failed to copy:', err);
              }
            }}>
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        </div>
        
        <!-- Messages Area -->
        <div class="messages-area">
          {#if selectedConversation.messages.length === 0}
            <div class="empty-conversation">
              <i class="fa-solid fa-comment-dots"></i>
              <h3>Start a conversation</h3>
              <p>Send the first message to {getContactName(selectedConversation.otherUser)}</p>
              {#if selectedConversation.isFromCache}
                <p class="cache-notice">
                  <i class="fa-solid fa-info-circle"></i>
                  This conversation was loaded from cache. Messages will appear when they load.
                </p>
              {/if}
            </div>
          {:else}
            <div class="messages-list">
              {#each selectedConversation.messages as message (message.id)}
                <ThreadedMessage 
                  message={message} 
                  isOwn={cleanAddress(message.sender) === cleanAddress(currentUserAddress)} 
                  showReplies={true}
                  on:reply
                  on:showToast={(event) => showCustomToast(event.detail.message, 3000, event.detail.type)}
                  on:openTip
                />
              {/each}
            </div>
          {/if}
        </div>
        
        <!-- Message Input -->
        <div class="message-input-area">
          <div class="input-container">
            <textarea
              bind:value={newMessageContent}
              placeholder="Type your private message..."
              on:keydown={handleKeyPress}
              disabled={sendingMessage}
              rows="2"
              class="message-input"
            ></textarea>
            
            <button 
              class="send-btn" 
              on:click={sendDMMessage} 
              disabled={!newMessageContent.trim() || sendingMessage}
            >
              {#if sendingMessage}
                <div class="button-spinner"></div>
              {:else}
                <i class="fa-solid fa-paper-plane"></i>
              {/if}
            </button>
          </div>
        </div>
      {:else}
        <!-- No Conversation Selected -->
        <div class="no-conversation">
          <i class="fa-solid fa-inbox"></i>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the sidebar or start a new one</p>
          <button class="new-conversation-btn" on:click={() => showNewMessageModal = true}>
            <i class="fa-solid fa-plus"></i>
            New Conversation
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
</div>
{/if}

<!-- NEW: Escrow Creation Modal -->
{#if showEscrowModal}
<EscrowCreationModal
  bind:visible={showEscrowModal}
  {escrowData}
  walletConnected={!!currentUserAddress}
  currentUserAddress={currentUserAddress}
  on:close={closeEscrowModal}
  on:escrowCreated={handleEscrowCreated}
/>
{/if}

<!-- NEW: Escrow Trading Widget -->
{#if showEscrowTrades && selectedConversation}
<EscrowTradingWidget
  bind:visible={showEscrowTrades}
  currentUserAddress={currentUserAddress}
  otherUserAddress={selectedConversation.otherUser}
  otherUserName={getContactName(selectedConversation.otherUser)}
  walletConnected={!!currentUserAddress}
  on:close={closeEscrowTrades}
/>
{/if}

<!-- Contact Name Edit Modal -->
{#if showContactModal}
<div class="modal-overlay" on:click|self={cancelContactEdit}>
<div class="contact-modal" transition:slide={{ duration: 200 }}>
  <div class="modal-header">
    <h3>Edit Contact Name</h3>
    <button class="close-btn" on:click={cancelContactEdit}>
      <i class="fa-solid fa-times"></i>
    </button>
  </div>
  <div class="modal-body">
    <div class="form-group">
      <label for="contact-name">Contact Name</label>
      <input 
        type="text" 
        id="contact-name"
        bind:value={newContactName} 
        placeholder="Enter a friendly name"
        class="form-input"
        maxlength="50"
      />
      <small class="form-hint">
        Address: {editingContact ? truncateAddress(editingContact) : ''}
      </small>
    </div>
  </div>
  <div class="modal-footer">
    <button class="cancel-btn" on:click={cancelContactEdit}>
      Cancel
    </button>
    {#if contacts.has(editingContact)}
      <button class="delete-btn" on:click={() => {
        deleteContactName(editingContact);
        cancelContactEdit();
      }}>
        Remove Name
      </button>
    {/if}
    <button 
      class="confirm-btn" 
      on:click={saveContactEdit}
      disabled={!newContactName.trim()}
    >
      Save Name
    </button>
  </div>
</div>
</div>
{/if}

<!-- New Message Modal -->
{#if showNewMessageModal}
<div class="modal-overlay" on:click|self={() => showNewMessageModal = false}>
<div class="new-message-modal" transition:slide={{ duration: 200 }}>
  <div class="modal-header">
    <h3>New Conversation</h3>
    <button class="close-btn" on:click={() => showNewMessageModal = false}>
      <i class="fa-solid fa-times"></i>
    </button>
  </div>
  <div class="modal-body">
    <div class="form-group">
      <label for="recipient">Recipient Address</label>
      <input 
        type="text" 
        id="recipient"
        bind:value={newRecipientAddress} 
        placeholder="Enter Ergo address (9...)"
        class="form-input"
      />
    </div>
  </div>
  <div class="modal-footer">
    <button class="cancel-btn" on:click={() => showNewMessageModal = false}>
      Cancel
    </button>
    <button 
      class="confirm-btn" 
      on:click={startNewConversation}
      disabled={!newRecipientAddress.trim()}
    >
      Start Conversation
    </button>
  </div>
</div>
</div>
{/if}

<style>
/* Existing styles... (keeping all your original styles) */
.inbox-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background-color: rgba(0, 0, 0, 0.7);
display: flex;
align-items: center;
justify-content: center;
z-index: 1000;
padding: 20px;
}

.inbox-container {
background-color: #262626;
border-radius: 12px;
width: 100%;
max-width: 1200px;
height: 80vh;
max-height: 700px;
display: flex;
flex-direction: column;
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
border: 1px solid rgba(255, 85, 0, 0.2);
overflow: hidden;
}

.inbox-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 1rem 1.5rem;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
flex-shrink: 0;
}

.header-left {
display: flex;
align-items: center;
gap: 0.75rem;
color: #FF5500;
}

.header-left h2 {
margin: 0;
font-size: 1.5rem;
font-weight: 600;
}

.conversation-count {
color: rgba(255, 255, 255, 0.6);
font-size: 0.9rem;
}

.header-right {
display: flex;
gap: 0.5rem;
}

.header-btn {
background: rgba(255, 85, 0, 0.1);
color: #FF5500;
border: 1px solid rgba(255, 85, 0, 0.3);
border-radius: 6px;
padding: 0.5rem 1rem;
cursor: pointer;
transition: all 0.2s ease;
display: flex;
align-items: center;
gap: 0.5rem;
font-size: 0.9rem;
}

.header-btn:hover {
background: rgba(255, 85, 0, 0.2);
}

.inbox-body {
flex: 1;
display: flex;
overflow: hidden;
position: relative;
}

.conversations-sidebar {
width: 350px;
border-right: 1px solid rgba(255, 255, 255, 0.1);
display: flex;
flex-direction: column;
background-color: #1E1E1E;
transition: transform 0.3s ease;
flex-shrink: 0;
}

.search-container {
position: relative;
padding: 1rem;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-icon {
position: absolute;
left: 1.75rem;
top: 50%;
transform: translateY(-50%);
color: #999;
font-size: 0.9rem;
}

.search-input {
width: 100%;
padding: 0.75rem 0.75rem 0.75rem 2.5rem;
background-color: #333;
border: 1px solid #444;
border-radius: 6px;
color: white;
font-size: 0.9rem;
}

.search-input:focus {
border-color: #FF5500;
outline: none;
}

.conversations-list {
flex: 1;
overflow-y: auto;
-webkit-overflow-scrolling: touch;
}

.conversation-item {
display: flex;
align-items: center;
gap: 0.75rem;
padding: 1rem;
cursor: pointer;
transition: background-color 0.2s ease;
border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.conversation-item:hover {
background-color: rgba(255, 255, 255, 0.05);
}

.conversation-item.active {
background-color: rgba(255, 85, 0, 0.1);
border-left: 3px solid #FF5500;
}

.conversation-avatar {
width: 40px;
height: 40px;
background-color: rgba(255, 85, 0, 0.2);
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
color: #FF5500;
font-size: 1.1rem;
flex-shrink: 0;
}

.conversation-info {
flex: 1;
min-width: 0;
overflow: hidden;
}

.conversation-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 0.25rem;
}

.conversation-name {
font-weight: 600;
color: white;
font-size: 0.9rem;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
max-width: 160px;
}

.unread-badge {
background-color: #FF5500;
color: white;
border-radius: 10px;
padding: 0.1rem 0.4rem;
font-size: 0.7rem;
font-weight: bold;
min-width: 18px;
text-align: center;
flex-shrink: 0;
}

.conversation-preview {
display: flex;
justify-content: space-between;
align-items: center;
}

.last-message {
color: #999;
font-size: 0.8rem;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
flex: 1;
}

.last-time {
color: #777;
font-size: 0.7rem;
margin-left: 0.5rem;
flex-shrink: 0;
}

.no-messages {
color: #777;
font-size: 0.8rem;
font-style: italic;
}

.no-messages.cached {
color: rgba(255, 85, 0, 0.6);
font-style: italic;
font-size: 0.75rem;
}

.cache-notice {
color: rgba(255, 85, 0, 0.7);
font-size: 0.8rem;
font-style: italic;
margin-top: 1rem;
padding: 0.5rem;
background: rgba(255, 85, 0, 0.1);
border-radius: 4px;
border-left: 3px solid rgba(255, 85, 0, 0.5);
}

.cache-notice i {
margin-right: 0.5rem;
}

.empty-conversations {
text-align: center;
padding: 2rem 1rem;
color: #999;
}

.empty-conversations i {
font-size: 2rem;
margin-bottom: 1rem;
color: #666;
}

.start-conversation-btn {
background: rgba(255, 85, 0, 0.1);
color: #FF5500;
border: 1px solid rgba(255, 85, 0, 0.3);
border-radius: 6px;
padding: 0.5rem 1rem;
cursor: pointer;
margin-top: 1rem;
transition: all 0.2s ease;
}

.start-conversation-btn:hover {
background: rgba(255, 85, 0, 0.2);
}

.conversation-view {
flex: 1;
display: flex;
flex-direction: column;
background-color: #1A1A1A;
}

.conversation-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 1rem 1.5rem;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
background-color: #222;
flex-shrink: 0;
}

.conversation-user {
display: flex;
align-items: center;
gap: 0.75rem;
overflow: hidden;
}

.back-btn {
background: none;
border: 1px solid rgba(255, 255, 255, 0.2);
color: #999;
border-radius: 6px;
padding: 0.5rem;
cursor: pointer;
transition: all 0.2s ease;
width: 36px;
height: 36px;
display: none;
align-items: center;
justify-content: center;
flex-shrink: 0;
}

.back-btn:hover {
color: #FF5500;
border-color: rgba(255, 85, 0, 0.3);
background: rgba(255, 85, 0, 0.1);
}

.user-avatar {
width: 45px;
height: 45px;
background-color: rgba(255, 85, 0, 0.2);
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
color: #FF5500;
font-size: 1.2rem;
flex-shrink: 0;
}

.user-info {
overflow: hidden;
}

.user-info h3 {
margin: 0;
color: white;
font-size: 1rem;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.user-address {
color: #999;
font-size: 0.8rem;
font-family: monospace;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.conversation-actions {
display: flex;
gap: 0.4rem;
flex-shrink: 0;
flex-wrap: wrap;
}

.action-btn {
background: none;
border: 1px solid rgba(255, 255, 255, 0.2);
color: #999;
border-radius: 6px;
padding: 0.5rem;
cursor: pointer;
transition: all 0.2s ease;
width: 36px;
height: 36px;
display: flex;
align-items: center;
justify-content: center;
flex-shrink: 0;
position: relative;
}

.action-btn:hover {
color: #FF5500;
border-color: rgba(255, 85, 0, 0.3);
background: rgba(255, 85, 0, 0.1);
}

/* NEW: Escrow button styles */
.escrow-btn {
background: linear-gradient(135deg, rgba(255, 85, 0, 0.2), rgba(255, 85, 0, 0.1));
border-color: rgba(255, 85, 0, 0.4);
color: #FF5500;
position: relative;
overflow: visible;
}

.escrow-btn:hover {
background: linear-gradient(135deg, rgba(255, 85, 0, 0.3), rgba(255, 85, 0, 0.2));
border-color: rgba(255, 85, 0, 0.6);
color: #ff6a1f;
transform: translateY(-1px);
}

.btn-tooltip {
position: absolute;
bottom: -25px;
left: 50%;
transform: translateX(-50%);
background: rgba(0, 0, 0, 0.8);
color: white;
padding: 2px 6px;
border-radius: 4px;
font-size: 0.7rem;
white-space: nowrap;
opacity: 0;
pointer-events: none;
transition: opacity 0.2s ease;
z-index: 1000;
}

.escrow-btn:hover .btn-tooltip {
opacity: 1;
}

.messages-area {
flex: 1;
overflow-y: auto;
padding: 1rem;
-webkit-overflow-scrolling: touch;
}

.empty-conversation {
text-align: center;
padding: 3rem 2rem;
color: #999;
}

.empty-conversation i {
font-size: 3rem;
margin-bottom: 1rem;
color: #666;
}

.no-conversation {
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
height: 100%;
color: #999;
text-align: center;
padding: 2rem;
}

.no-conversation i {
font-size: 4rem;
margin-bottom: 1rem;
color: #666;
}

.new-conversation-btn {
background: rgba(255, 85, 0, 0.8);
color: white;
border: none;
border-radius: 6px;
padding: 0.75rem 1.5rem;
cursor: pointer;
margin-top: 1rem;
transition: all 0.2s ease;
display: flex;
align-items: center;
gap: 0.5rem;
font-weight: 500;
}

.new-conversation-btn:hover {
background: #FF5500;
}

.message-input-area {
padding: 1rem 1.5rem;
border-top: 1px solid rgba(255, 255, 255, 0.1);
background-color: #222;
flex-shrink: 0;
}

.input-container {
display: flex;
gap: 0.75rem;
align-items: flex-end;
}

.message-input {
flex: 1;
background-color: #333;
border: 1px solid #444;
border-radius: 8px;
color: white;
padding: 0.75rem;
resize: none;
min-height: 40px;
max-height: 120px;
font-size: 0.9rem;
transition: border-color 0.2s ease;
}

.message-input:focus {
border-color: #FF5500;
outline: none;
}

.send-btn {
background: #FF5500;
color: white;
border: none;
border-radius: 50%;
width: 44px;
height: 44px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
transition: all 0.2s ease;
flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
background: #ff6a1f;
transform: scale(1.05);
}

.send-btn:disabled {
background: #666;
cursor: not-allowed;
transform: none;
}

.button-spinner {
width: 16px;
height: 16px;
border: 2px solid rgba(255, 255, 255, 0.3);
border-top-color: white;
border-radius: 50%;
animation: spin 1s linear infinite;
}

@keyframes spin {
to { transform: rotate(360deg); }
}

/* Modal styles */
.modal-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background-color: rgba(0, 0, 0, 0.5);
display: flex;
align-items: center;
justify-content: center;
z-index: 1100;
}

.new-message-modal,
.contact-modal {
background-color: #262626;
border-radius: 8px;
width: 90%;
max-width: 400px;
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
border: 1px solid rgba(255, 85, 0, 0.2);
}

.form-hint {
font-size: 0.8rem;
color: #AAA;
margin-top: 0.25rem;
display: block;
}

.delete-btn {
background-color: rgba(255, 68, 68, 0.8);
color: white;
border: none;
border-radius: 6px;
padding: 0.6rem 1rem;
cursor: pointer;
font-weight: 500;
transition: all 0.2s ease;
}

.delete-btn:hover {
background-color: #ff4c4c;
}

.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 1rem 1.5rem;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
margin: 0;
color: white;
font-size: 1.1rem;
font-weight: 500;
}

.close-btn {
background: none;
border: none;
color: #AAA;
cursor: pointer;
width: 2rem;
height: 2rem;
border-radius: 50%;
display: flex;
align-items: center;
justify-content: center;
transition: all 0.2s ease;
}

.close-btn:hover {
background-color: rgba(255, 255, 255, 0.1);
color: white;
}

.modal-body {
padding: 1.5rem;
}

.form-group {
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.form-group label {
color: #CCC;
font-size: 0.9rem;
font-weight: 500;
}

.form-input {
padding: 0.75rem;
background-color: #333;
border: 1px solid #444;
border-radius: 6px;
color: white;
font-size: 0.9rem;
font-family: monospace;
}

.form-input:focus {
border-color: #FF5500;
outline: none;
}

.modal-footer {
display: flex;
justify-content: flex-end;
gap: 0.75rem;
padding: 1rem 1.5rem;
border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn {
background-color: rgba(255, 255, 255, 0.1);
color: #CCC;
border: none;
border-radius: 6px;
padding: 0.6rem 1rem;
cursor: pointer;
font-weight: 500;
transition: all 0.2s ease;
}

.cancel-btn:hover {
background-color: rgba(255, 255, 255, 0.2);
color: white;
}

.confirm-btn {
background-color: rgba(255, 85, 0, 0.8);
color: white;
border: none;
border-radius: 6px;
padding: 0.6rem 1rem;
cursor: pointer;
font-weight: 500;
transition: all 0.2s ease;
}

.confirm-btn:hover:not(:disabled) {
background-color: #FF5500;
}

.confirm-btn:disabled {
background-color: #555;
cursor: not-allowed;
opacity: 0.7;
}

/* Mobile responsive styles */
@media (max-width: 1024px) {
.btn-tooltip {
  display: none;
}

.conversation-actions {
  gap: 0.3rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  font-size: 0.8rem;
}
}

@media (max-width: 768px) {
.inbox-overlay {
  padding: 10px;
}

.inbox-container {
  height: 95vh;
  max-height: none;
}

.inbox-header {
  padding: 0.75rem 1rem;
}

.header-btn span {
  display: none;
}

.header-btn {
  padding: 0.5rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conversations-sidebar {
  width: 220px;
}

.conversation-name {
  max-width: 100px;
}

.search-container {
  padding: 0.75rem;
}

.search-input {
  padding: 0.6rem 0.6rem 0.6rem 2.5rem;
}

.conversation-item {
  padding: 0.75rem;
}
}

/* Mobile Styles */
@media (max-width: 640px) {
.inbox-overlay {
  padding: 5px;
}

.inbox-container {
  height: 100vh;
  max-height: none;
  border-radius: 0;
}

.inbox-body {
  position: relative;
}

/* Show/hide sidebar based on conversation selection */
.conversations-sidebar {
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transform: translateX(0);
  z-index: 2;
  transition: transform 0.3s ease;
}

.conversations-sidebar.hidden-mobile {
  transform: translateX(-100%);
}

/* Show/hide conversation view based on selection */
.conversation-view {
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transform: translateX(100%);
  opacity: 0;
  z-index: 1;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.conversation-view.active {
  transform: translateX(0);
  opacity: 1;
  z-index: 3;
}

/* Show back button on mobile */
.back-btn {
  display: flex;
}

.conversation-header {
  padding: 0.75rem 1rem;
}

.user-info h3 {
  font-size: 0.9rem;
}

.user-address {
  font-size: 0.7rem;
}

.conversation-actions {
  gap: 0.3rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  font-size: 0.8rem;
}

.message-input-area {
  padding: 0.75rem 1rem;
}

.messages-area {
  padding: 0.75rem;
}

.empty-conversation {
  padding: 2rem 1rem;
}

.empty-conversation i {
  font-size: 2.5rem;
}

.empty-conversation h3 {
  font-size: 1.1rem;
}

.no-conversation i {
  font-size: 3rem;
}

.no-conversation h3 {
  font-size: 1.1rem;
}

.modal-body {
  padding: 1.25rem;
}

.modal-footer {
  padding: 0.75rem 1.25rem;
}
}

@media (max-width: 480px) {
.inbox-overlay {
  padding: 0;
}

.inbox-container {
  width: 100%;
  border-radius: 0;
  margin: 0;
}

.inbox-header {
  padding: 0.5rem 0.75rem;
}

.header-left h2 {
  font-size: 1.1rem;
}

.header-btn {
  width: 32px;
  height: 32px;
  font-size: 0.8rem;
}

.conversation-item {
  padding: 0.6rem 0.75rem;
}

.conversation-avatar {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  font-size: 1rem;
}

.user-info h3 {
  font-size: 0.85rem;
}

.user-address {
  font-size: 0.65rem;
}

.message-input-area {
  padding: 0.5rem 0.75rem;
}

.message-input {
  padding: 0.5rem;
  font-size: 0.85rem;
  min-height: 36px;
}

.send-btn {
  width: 36px;
  height: 36px;
}

.new-message-modal,
.contact-modal {
  width: 95%;
}

.form-input {
  padding: 0.6rem;
}

.cancel-btn,
.confirm-btn,
.delete-btn {
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
}

.modal-header h3 {
  font-size: 1rem;
}

.empty-conversation h3,
.no-conversation h3 {
  font-size: 1rem;
}

.empty-conversation p,
.no-conversation p {
  font-size: 0.85rem;
}

.conversation-name {
  font-size: 0.85rem;
}

.last-message {
  font-size: 0.75rem;
}

.last-time {
  font-size: 0.65rem;
}
}

/* Very small devices */
@media (max-width: 360px) {
.inbox-header {
  padding: 0.4rem 0.6rem;
}

.header-left {
  gap: 0.4rem;
}

.header-left h2 {
  font-size: 1rem;
}

.header-btn {
  width: 28px;
  height: 28px;
  font-size: 0.75rem;
}

.conversation-avatar {
  width: 28px;
  height: 28px;
  font-size: 0.8rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
}

.back-btn {
  width: 28px;
  height: 28px;
}

.action-btn {
  width: 28px;
  height: 28px;
  font-size: 0.75rem;
}

.message-input {
  min-height: 32px;
}

.send-btn {
  width: 32px;
  height: 32px;
}

.message-input-area {
  padding: 0.4rem 0.6rem;
}

.modal-body {
  padding: 1rem;
}

.modal-footer {
  padding: 0.6rem 1rem;
}
}

/* Fix for Safari */
@supports (-webkit-touch-callout: none) {
.inbox-container {
  height: -webkit-fill-available;
}

.conversations-list,
.messages-area {
  overflow-y: scroll;
}
}
</style>