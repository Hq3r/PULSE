// OnChainAchievementSystem.js - Blockchain-based achievement system for Ergo Chat

export class OnChainAchievementSystem {
    constructor(chatContract, achievementContract = null) {
      this.chatContract = chatContract;
      // For now, we'll use the same contract but with different register patterns
      // Later you could deploy a dedicated achievement contract
      this.achievementContract = achievementContract || chatContract;
      
      this.achievements = this.defineAchievements();
      this.userStatsCache = new Map(); // Cache for performance
      this.lastFetchTime = 0;
      this.cacheTimeout = 30000; // 30 seconds cache
      this.allMessagesCache = null; // Cache all messages for leaderboard
    }
  
    // Define all possible achievements
    defineAchievements() {
      return new Map([
        ['first_message', {
          id: 'first_message',
          name: 'First Words',
          description: 'Send your first message',
          icon: '💬',
          category: 'messaging',
          criteria: { type: 'message_count', threshold: 1 }
        }],
        ['chatty_user', {
          id: 'chatty_user',
          name: 'Chatty User',
          description: 'Send 100 messages',
          icon: '🗣️',
          category: 'messaging',
          criteria: { type: 'message_count', threshold: 100 }
        }],
        ['super_chatty', {
          id: 'super_chatty',
          name: 'Super Chatty',
          description: 'Send 500 messages',
          icon: '💬',
          category: 'messaging',
          criteria: { type: 'message_count', threshold: 500 }
        }],
        ['first_tip', {
          id: 'first_tip',
          name: 'Generous Soul',
          description: 'Send your first tip',
          icon: '💝',
          category: 'tipping',
          criteria: { type: 'tips_sent', threshold: 1 }
        }],
        ['generous_tipper', {
          id: 'generous_tipper',
          name: 'Generous Tipper',
          description: 'Send 10 tips',
          icon: '🤝',
          category: 'tipping',
          criteria: { type: 'tips_sent', threshold: 10 }
        }],
        ['whale_tipper', {
          id: 'whale_tipper',
          name: 'Whale Tipper',
          description: 'Send tips worth over 10 ERG total',
          icon: '🐋',
          category: 'tipping',
          criteria: { type: 'erg_tipped', threshold: 10 }
        }],
        ['community_favorite', {
          id: 'community_favorite',
          name: 'Community Favorite',
          description: 'Receive 25 tips from others',
          icon: '⭐',
          category: 'social',
          criteria: { type: 'tips_received', threshold: 25 }
        }],
        ['early_adopter', {
          id: 'early_adopter',
          name: 'Early Adopter',
          description: 'One of the first 100 users',
          icon: '🚀',
          category: 'special',
          criteria: { type: 'join_order', threshold: 100 }
        }],
        ['thread_starter', {
          id: 'thread_starter',
          name: 'Thread Starter',
          description: 'Start 20 conversation threads',
          icon: '🎯',
          category: 'messaging',
          criteria: { type: 'threads_started', threshold: 20 }
        }],
        ['room_explorer', {
          id: 'room_explorer',
          name: 'Room Explorer',
          description: 'Send messages in 5 different rooms',
          icon: '🗺️',
          category: 'exploration',
          criteria: { type: 'rooms_visited', threshold: 5 }
        }]
      ]);
    }
  
    // Calculate user statistics from on-chain data
    async calculateUserStats(userAddress, allMessages = null) {
      const cleanAddress = this.cleanAddress(userAddress);
      
      // Check cache first
      const cacheKey = cleanAddress;
      const now = Date.now();
      
      if (this.userStatsCache.has(cacheKey) && 
          (now - this.lastFetchTime) < this.cacheTimeout) {
        return this.userStatsCache.get(cacheKey);
      }
  
      let messages = allMessages;
      
      // If no messages provided, fetch them
      if (!messages) {
        messages = await this.fetchAllUserMessages(cleanAddress);
      }
  
      // Filter messages for this user
      const userMessages = messages.filter(msg => 
        this.cleanAddress(msg.sender) === cleanAddress
      );
  
      // Calculate statistics
      const stats = {
        message_count: 0,
        tips_sent: 0,
        tips_received: 0,
        erg_tipped: 0,
        erg_received: 0,
        threads_started: 0,
        rooms_visited: new Set(),
        first_message_timestamp: null,
        join_order: 0 // Will be calculated separately
      };
  
      // Process user's own messages
      for (const message of userMessages) {
        // Count regular messages
        if (!message.content.includes('💸')) {
          stats.message_count++;
          
          // Track first message
          if (!stats.first_message_timestamp || 
              message.timestamp < stats.first_message_timestamp) {
            stats.first_message_timestamp = message.timestamp;
          }
          
          // Count rooms visited
          if (message.chatroomId) {
            stats.rooms_visited.add(message.chatroomId);
          }
          
          // Count threads started (messages without parentId)
          if (!message.parentId) {
            stats.threads_started++;
          }
        }
        
        // Count tips sent
        if (message.content.includes('💸') && message.content.includes('tipped')) {
          stats.tips_sent++;
          
          // Extract tip amount (this is a simplified parser)
          const tipMatch = message.content.match(/tipped (\d+\.?\d*) (\w+)/);
          if (tipMatch && tipMatch[2] === 'ERG') {
            stats.erg_tipped += parseFloat(tipMatch[1]);
          }
        }
      }
  
      // Count tips received (look for tips TO this user in all messages)
      const tipsToUser = messages.filter(msg => 
        msg.content.includes('💸') && 
        msg.content.includes('tipped') && 
        msg.content.includes(this.truncateAddress(userAddress))
      );
  
      stats.tips_received = tipsToUser.length;
      stats.erg_received = tipsToUser.reduce((total, tip) => {
        const tipMatch = tip.content.match(/tipped (\d+\.?\d*) (\w+)/);
        if (tipMatch && tipMatch[2] === 'ERG') {
          return total + parseFloat(tipMatch[1]);
        }
        return total;
      }, 0);
  
      // Calculate join order (simplified - could be more sophisticated)
      if (stats.first_message_timestamp) {
        const earlierUsers = await this.countEarlierUsers(stats.first_message_timestamp);
        stats.join_order = earlierUsers + 1;
      }
  
      // Convert Set to Array for storage
      stats.rooms_visited = Array.from(stats.rooms_visited);
  
      // Cache the results
      this.userStatsCache.set(cacheKey, stats);
      this.lastFetchTime = now;
  
      return stats;
    }
  
    // Fetch all messages for analysis (reusing your existing pattern)
    async fetchAllUserMessages(userAddress = null) {
      try {
        console.log('Fetching messages for leaderboard...');
        
        // Fetch more messages for leaderboard (increase limit)
        const response = await fetch(`https://api.ergoplatform.com/api/v1/boxes/byAddress/${this.chatContract}?limit=500`);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
  
        const data = await response.json();
        const messages = [];
        console.log(`Processing ${data.items.length} boxes...`);
  
        for (const box of data.items) {
          if (box.additionalRegisters && 
              box.additionalRegisters.R4 && 
              box.additionalRegisters.R5 && 
              box.additionalRegisters.R6) {
            
            try {
              // Extract message data (reusing your existing logic)
              const senderRaw = this.extractRegisterValue(box.additionalRegisters.R4);
              const messageRaw = this.extractRegisterValue(box.additionalRegisters.R5);
              const timestampRaw = this.extractRegisterValue(box.additionalRegisters.R6);
              const chatroomRaw = this.extractRegisterValue(box.additionalRegisters.R7);
              const parentIdRaw = this.extractRegisterValue(box.additionalRegisters.R8);
  
              const sender = this.decodeHex(senderRaw);
              const content = this.decodeHex(messageRaw);
              const timestamp = parseInt(timestampRaw) || Math.floor(Date.now() / 1000);
              const chatroomId = chatroomRaw ? this.decodeHex(chatroomRaw) : 'general';
              const parentId = parentIdRaw ? this.decodeHex(parentIdRaw) : null;
  
              // Validate sender address
              const cleanedSender = this.cleanAddress(sender);
              if (cleanedSender && cleanedSender.length > 10) {
                messages.push({
                  id: box.boxId,
                  sender: cleanedSender,
                  content,
                  timestamp,
                  chatroomId,
                  parentId
                });
              }
            } catch (error) {
              console.warn('Error processing message box:', error);
            }
          }
        }
  
        console.log(`Successfully processed ${messages.length} messages`);
        return messages.sort((a, b) => a.timestamp - b.timestamp);
      } catch (error) {
        console.error('Error fetching messages for achievement calculation:', error);
        return [];
      }
    }
  
    // Count users who joined before a given timestamp
    async countEarlierUsers(timestamp) {
      try {
        // This is a simplified implementation
        // In practice, you might want to cache this or use a more efficient method
        const allMessages = await this.fetchAllUserMessages();
        const firstMessages = new Map(); // userAddress -> earliest timestamp
  
        for (const message of allMessages) {
          if (!message.content.includes('💸')) { // Skip tip messages
            const userAddr = this.cleanAddress(message.sender);
            if (!firstMessages.has(userAddr) || 
                message.timestamp < firstMessages.get(userAddr)) {
              firstMessages.set(userAddr, message.timestamp);
            }
          }
        }
  
        // Count how many users had their first message before the given timestamp
        let earlierCount = 0;
        for (const firstMessageTime of firstMessages.values()) {
          if (firstMessageTime < timestamp) {
            earlierCount++;
          }
        }
  
        return earlierCount;
      } catch (error) {
        console.error('Error counting earlier users:', error);
        return 0;
      }
    }
  
    // Check which achievements a user has unlocked
    async checkUserAchievements(userAddress, allMessages = null) {
      const stats = await this.calculateUserStats(userAddress, allMessages);
      const unlockedAchievements = [];
      const progress = [];
  
      for (const [achievementId, achievement] of this.achievements) {
        let isUnlocked = false;
        let currentValue = 0;
        let targetValue = achievement.criteria.threshold;
  
        switch (achievement.criteria.type) {
          case 'message_count':
            currentValue = stats.message_count;
            isUnlocked = currentValue >= targetValue;
            break;
          
          case 'tips_sent':
            currentValue = stats.tips_sent;
            isUnlocked = currentValue >= targetValue;
            break;
          
          case 'tips_received':
            currentValue = stats.tips_received;
            isUnlocked = currentValue >= targetValue;
            break;
          
          case 'erg_tipped':
            currentValue = stats.erg_tipped;
            isUnlocked = currentValue >= targetValue;
            break;
          
          case 'threads_started':
            currentValue = stats.threads_started;
            isUnlocked = currentValue >= targetValue;
            break;
          
          case 'rooms_visited':
            currentValue = stats.rooms_visited.length;
            isUnlocked = currentValue >= targetValue;
            break;
          
          case 'join_order':
            currentValue = stats.join_order;
            isUnlocked = currentValue <= targetValue && currentValue > 0;
            targetValue = `Top ${targetValue}`;
            break;
        }
  
        if (isUnlocked) {
          unlockedAchievements.push({
            ...achievement,
            unlockedAt: stats.first_message_timestamp || Date.now() / 1000
          });
        }
  
        progress.push({
          ...achievement,
          isUnlocked,
          currentValue,
          targetValue,
          progress: Math.min(currentValue / (typeof targetValue === 'number' ? targetValue : achievement.criteria.threshold), 1)
        });
      }
  
      return {
        unlockedAchievements,
        progress,
        stats
      };
    }
  
    // Get leaderboard data - UPDATED to use existing messages
    async getLeaderboard(allMessages = null, category = 'all', limit = 10) {
      try {
        console.log('Generating leaderboard...');
        
        // Use provided messages or fetch if not available
        let messages = allMessages;
        if (!messages || messages.length === 0) {
          console.log('No messages provided, fetching from blockchain...');
          messages = await this.fetchAllUserMessages();
        } else {
          console.log(`Using provided ${messages.length} messages for leaderboard`);
        }
        
        if (messages.length === 0) {
          console.warn('No messages available for leaderboard');
          return [];
        }
  
        // Get unique users and their basic stats
        const userStats = new Map();
        
        for (const message of messages) {
          const userAddr = this.cleanAddress(message.sender);
          
          // Skip invalid addresses and bot messages
          if (!userAddr || userAddr.length < 10 || 
              message.content.includes('🤖') || 
              userAddr.includes('AI')) {
            continue;
          }
          
          if (!userStats.has(userAddr)) {
            userStats.set(userAddr, {
              address: userAddr,
              messageCount: 0,
              tipsSent: 0,
              ergTipped: 0,
              firstMessageTime: message.timestamp
            });
          }
          
          const stats = userStats.get(userAddr);
          
          // Count messages (exclude tip notifications)
          if (!message.content.includes('💸')) {
            stats.messageCount++;
            
            // Track earliest message
            if (message.timestamp < stats.firstMessageTime) {
              stats.firstMessageTime = message.timestamp;
            }
          } else if (message.content.includes('tipped')) {
            // Count tips sent
            stats.tipsSent++;
            
            // Extract ERG amount if possible
            const tipMatch = message.content.match(/tipped (\d+\.?\d*) ERG/);
            if (tipMatch) {
              stats.ergTipped += parseFloat(tipMatch[1]);
            }
          }
        }
  
        console.log(`Found ${userStats.size} unique users for leaderboard`);
        
        // Filter to users with at least some activity
        const activeUsers = Array.from(userStats.values())
          .filter(user => user.messageCount > 0)
          .sort((a, b) => b.messageCount - a.messageCount)
          .slice(0, Math.min(50, userStats.size)); // Limit for performance
  
        console.log(`Processing ${activeUsers.length} active users...`);
  
        // Calculate achievements for each active user
        const leaderboardData = [];
        
        for (const userBasicStats of activeUsers) {
          try {
            console.log(`Calculating achievements for: ${userBasicStats.address.substring(0, 8)}...`);
            
            const userAchievements = await this.checkUserAchievements(userBasicStats.address, messages);
            
            leaderboardData.push({
              address: userBasicStats.address,
              displayAddress: this.truncateAddress(userBasicStats.address),
              achievementCount: userAchievements.unlockedAchievements.length,
              messageCount: userAchievements.stats.message_count || userBasicStats.messageCount,
              tipsSent: userAchievements.stats.tips_sent || userBasicStats.tipsSent,
              tipsReceived: userAchievements.stats.tips_received || 0,
              ergTipped: userAchievements.stats.erg_tipped || userBasicStats.ergTipped,
              joinOrder: userAchievements.stats.join_order || 999999,
              firstMessageTime: userBasicStats.firstMessageTime,
              topAchievements: this.getTopAchievements(userAchievements.unlockedAchievements, 3)
            });
          } catch (error) {
            console.warn(`Error calculating achievements for user ${userBasicStats.address}:`, error);
            
            // Add basic entry even if achievement calculation fails
            leaderboardData.push({
              address: userBasicStats.address,
              displayAddress: this.truncateAddress(userBasicStats.address),
              achievementCount: 0,
              messageCount: userBasicStats.messageCount,
              tipsSent: userBasicStats.tipsSent,
              tipsReceived: 0,
              ergTipped: userBasicStats.ergTipped,
              joinOrder: 999999,
              firstMessageTime: userBasicStats.firstMessageTime,
              topAchievements: []
            });
          }
        }
  
        // Sort by achievement count, then by message count
        leaderboardData.sort((a, b) => {
          if (b.achievementCount !== a.achievementCount) {
            return b.achievementCount - a.achievementCount;
          }
          return b.messageCount - a.messageCount;
        });
  
        const finalLeaderboard = leaderboardData.slice(0, limit);
        console.log(`Leaderboard generated with ${finalLeaderboard.length} users`);
        
        return finalLeaderboard;
        
      } catch (error) {
        console.error('Error generating leaderboard:', error);
        return [];
      }
    }
  
    // Helper to get top achievements for display
    getTopAchievements(achievements, count = 3) {
      const priorityOrder = [
        'early_adopter',
        'whale_tipper',
        'community_favorite',
        'super_chatty',
        'room_explorer',
        'generous_tipper'
      ];
  
      return achievements
        .sort((a, b) => {
          const aIndex = priorityOrder.indexOf(a.id);
          const bIndex = priorityOrder.indexOf(b.id);
          
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, count);
    }
  
    // Utility functions (reusing your existing patterns)
    extractRegisterValue(register) {
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
  
    decodeHex(hex) {
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
            return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
          }
        }
        
        return hex;
      } catch (e) {
        return String(hex);
      }
    }
  
    cleanAddress(address) {
      if (!address) return '';
      if (address.startsWith('3') && address.length > 50) {
        return address.substring(1);
      }
      return address;
    }
  
    truncateAddress(address) {
      if (!address) return 'Unknown';
      if (address.length > 12) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
      }
      return address;
    }
  
    // Clear cache (useful for testing or forcing refresh)
    clearCache() {
      this.userStatsCache.clear();
      this.lastFetchTime = 0;
    }
  }
  
  // Usage in your Landing.svelte:
  /*
  // Import and initialize
  import { OnChainAchievementSystem } from './OnChainAchievementSystem.js';
  
  let achievementSystem = new OnChainAchievementSystem(CHAT_CONTRACT);
  let userAchievements = null;
  let showAchievementModal = false;
  
  // Load user achievements when wallet connects
  $: if (walletConnected && $connected_wallet_address) {
    loadUserAchievements();
  }
  
  async function loadUserAchievements() {
    try {
      // Pass your existing allMessages array for better performance
      userAchievements = await achievementSystem.checkUserAchievements(
        $connected_wallet_address,
        allMessages // This reuses data you already have!
      );
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  }
  
  // Check for new achievements after each message/tip
  async function checkForNewAchievements() {
    if (!walletConnected) return;
    
    const newAchievements = await achievementSystem.checkUserAchievements(
      $connected_wallet_address,
      allMessages
    );
    
    // Compare with previous and show notifications for new ones
    if (userAchievements) {
      const previousIds = new Set(userAchievements.unlockedAchievements.map(a => a.id));
      const newUnlocked = newAchievements.unlockedAchievements.filter(a => !previousIds.has(a.id));
      
      newUnlocked.forEach(achievement => {
        showCustomToast(
          `🏆 Achievement Unlocked: ${achievement.name}!<br>${achievement.description}`,
          7000,
          'success'
        );
      });
    }
    
    userAchievements = newAchievements;
  }
  
  // Call this after sending messages or tips
  // In your existing onTxSubmitted function:
  async function onTxSubmitted(txId) {
    // ... your existing code ...
    
    // Check for new achievements
    setTimeout(() => {
      checkForNewAchievements();
    }, 2000); // Small delay to ensure message is processed
  }
  */