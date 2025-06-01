<!-- SmartAIFeatures.svelte - AI-powered notifications and analytics -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { showCustomToast } from '$lib/utils/utils';
    
    const dispatch = createEventDispatcher();
    
    // Props - need to receive localMempoolMessages too
    export let messages = [];
    export let localMempoolMessages = []; // Add this prop
    export let apiConfig;
    export let currentUser = '';
    
    // AI Features State
    let aiAnalytics = {
      mostActiveUsers: [],
      messageStats: {},
      trendingTopics: [],
      roomStats: {},
      lastUpdated: null
    };
    
    let smartNotifications = {
      keywordAlerts: [],
      priceAlerts: [],
      importantMessages: [],
      missedMessagesSummary: ''
    };
    
    let showAnalytics = false;
    let showNotificationSettings = false;
    let isAnalyzing = false;
    
    // User Settings
    let userSettings = {
      enableSmartNotifications: true,
      keywordAlerts: ['ergo', 'price', 'announcement'],
      priceAlerts: {
        enabled: true,
        threshold: 10 // 10% price change
      },
      summaryEnabled: true,
      autoRespond: true, // Enable by default
      responseKeywords: ['help', 'how', 'what', 'explain', 'tutorial', 'beginner', 'started', 'work']
    };
    
    // Auto-response system
    let lastCheckTime = Date.now();
    let pendingResponses = new Set();
    
    onMount(() => {
      console.log('🤖 SmartAI mounted with props:');
      console.log('- messages:', messages.length, messages);
      console.log('- localMempoolMessages:', localMempoolMessages.length, localMempoolMessages);
      console.log('- currentUser:', currentUser);
      console.log('- apiConfig:', apiConfig);
      
      loadUserSettings();
      
      // Start AI monitoring - much faster response time
      const interval = setInterval(() => {
        if (userSettings.enableSmartNotifications) {
          analyzeMessages();
          checkForAutoResponses();
        }
      }, 3000); // Check every 3 seconds for quick responses
      
      return () => clearInterval(interval);
    });
    
    // Load user settings from localStorage
    function loadUserSettings() {
      try {
        const stored = localStorage.getItem('ergoChat_aiSettings');
        if (stored) {
          userSettings = { ...userSettings, ...JSON.parse(stored) };
        }
      } catch (error) {
        console.error('Error loading AI settings:', error);
      }
    }
    
    // Save user settings to localStorage
    function saveUserSettings() {
      try {
        localStorage.setItem('ergoChat_aiSettings', JSON.stringify(userSettings));
        showCustomToast('AI settings saved', 2000, 'success');
      } catch (error) {
        console.error('Error saving AI settings:', error);
      }
    }
    
    // Analyze messages for insights
    async function analyzeMessages() {
      if (isAnalyzing || messages.length === 0) return;
      
      isAnalyzing = true;
      
      try {
        // Calculate analytics
        await calculateAnalytics();
        
        // Check for important messages
        await detectImportantMessages();
        
        // Check keyword alerts
        checkKeywordAlerts();
        
        // Generate missed messages summary if user was away
        if (shouldGenerateSummary()) {
          await generateMissedMessagesSummary();
        }
        
        aiAnalytics.lastUpdated = Date.now();
        
      } catch (error) {
        console.error('Error analyzing messages:', error);
      } finally {
        isAnalyzing = false;
      }
    }
    
    // Calculate chat analytics
    async function calculateAnalytics() {
      const now = Date.now();
      const last24h = now - (24 * 60 * 60 * 1000);
      const recentMessages = messages.filter(msg => (msg.timestamp * 1000) > last24h);
      
      // Most active users
      const userActivity = {};
      recentMessages.forEach(msg => {
        if (msg.sender && !msg.sender.includes('AI') && !msg.content.includes('💸')) {
          userActivity[msg.sender] = (userActivity[msg.sender] || 0) + 1;
        }
      });
      
      aiAnalytics.mostActiveUsers = Object.entries(userActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, count }));
      
      // Message statistics
      aiAnalytics.messageStats = {
        total24h: recentMessages.length,
        averagePerHour: Math.round(recentMessages.length / 24),
        uniqueUsers: Object.keys(userActivity).length,
        tipsCount: recentMessages.filter(msg => msg.content.includes('💸')).length
      };
      
      // Trending topics (keywords mentioned frequently)
      await extractTrendingTopics(recentMessages);
      
      // Room statistics
      const roomActivity = {};
      recentMessages.forEach(msg => {
        const room = msg.chatroomId || 'general';
        roomActivity[room] = (roomActivity[room] || 0) + 1;
      });
      
      aiAnalytics.roomStats = roomActivity;
    }
    
    // Extract trending topics using AI
    async function extractTrendingTopics(recentMessages) {
      if (!apiConfig || recentMessages.length < 5) {
        aiAnalytics.trendingTopics = [];
        return;
      }
      
      try {
        const messageContent = recentMessages
          .slice(-20) // Last 20 messages
          .map(msg => msg.content)
          .filter(content => content.length > 10 && !content.includes('💸'))
          .join(' ');
        
        if (messageContent.length < 100) {
          aiAnalytics.trendingTopics = [];
          return;
        }
        
        const prompt = `Analyze this chat content and extract the top 5 trending topics or keywords being discussed. Return only a JSON array of strings: ${messageContent.substring(0, 1000)}`;
        
        const response = await callAIAPI(prompt);
        
        try {
          const topics = JSON.parse(response);
          aiAnalytics.trendingTopics = Array.isArray(topics) ? topics.slice(0, 5) : [];
        } catch {
          // Fallback: extract common words
          const words = messageContent.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
          
          const wordCount = {};
          words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
          });
          
          aiAnalytics.trendingTopics = Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
        }
      } catch (error) {
        console.error('Error extracting trending topics:', error);
        aiAnalytics.trendingTopics = [];
      }
    }
    
    // Detect important messages using AI
    async function detectImportantMessages() {
      if (!userSettings.enableSmartNotifications) return;
      
      const recentMessages = messages
        .filter(msg => (Date.now() - msg.timestamp * 1000) < 3600000) // Last hour
        .filter(msg => !msg.sender.includes(currentUser))
        .slice(-10);
      
      for (const message of recentMessages) {
        if (await isImportantMessage(message)) {
          if (!smartNotifications.importantMessages.find(m => m.id === message.id)) {
            smartNotifications.importantMessages.push({
              ...message,
              importance: 'high',
              reason: 'AI detected as important'
            });
            
            showSmartNotification(
              'Important Message Detected',
              `${formatSender(message.sender)}: ${message.content.substring(0, 50)}...`,
              'important'
            );
          }
        }
      }
    }
    
    // Check if message is important using AI
    async function isImportantMessage(message) {
      try {
        const prompt = `Is this message important or urgent for a crypto/blockchain chat? Answer only "yes" or "no": "${message.content}"`;
        const response = await callAIAPI(prompt);
        return response.toLowerCase().includes('yes');
      } catch {
        // Fallback: keyword-based detection
        const importantKeywords = ['urgent', 'important', 'announcement', 'breaking', 'alert', 'warning', 'update'];
        return importantKeywords.some(keyword => 
          message.content.toLowerCase().includes(keyword)
        );
      }
    }
    
    // Check for keyword alerts
    function checkKeywordAlerts() {
      const recentMessages = messages.filter(msg => 
        (Date.now() - msg.timestamp * 1000) < 300000 && // Last 5 minutes
        !msg.sender.includes(currentUser)
      );
      
      recentMessages.forEach(message => {
        userSettings.keywordAlerts.forEach(keyword => {
          if (message.content.toLowerCase().includes(keyword.toLowerCase())) {
            showSmartNotification(
              'Keyword Alert',
              `"${keyword}" mentioned by ${formatSender(message.sender)}`,
              'keyword'
            );
          }
        });
      });
    }
    
    // Generate missed messages summary
    async function generateMissedMessagesSummary() {
      const missedMessages = messages.filter(msg => 
        (msg.timestamp * 1000) > lastCheckTime &&
        !msg.sender.includes(currentUser)
      );
      
      if (missedMessages.length === 0) return;
      
      try {
        const messageText = missedMessages
          .slice(-10)
          .map(msg => `${formatSender(msg.sender)}: ${msg.content}`)
          .join('\n');
        
        const prompt = `Summarize these chat messages in 2-3 sentences, focusing on the main topics and any important information: ${messageText}`;
        
        const summary = await callAIAPI(prompt);
        smartNotifications.missedMessagesSummary = summary;
        
        if (summary && missedMessages.length > 3) {
          showSmartNotification(
            'Missed Messages Summary',
            summary,
            'summary'
          );
        }
      } catch (error) {
        console.error('Error generating summary:', error);
      }
      
      lastCheckTime = Date.now();
    }
    
    // Check for auto-responses
    async function checkForAutoResponses() {
      if (!userSettings.autoRespond) return;
      
      console.log('🔍 AI checking for auto-responses...');
      console.log('📊 Props received - messages:', messages.length, 'localMempoolMessages:', localMempoolMessages.length);
      
      // Check BOTH confirmed messages AND mempool messages
      const allCurrentMessages = [...messages, ...localMempoolMessages];
      console.log('📊 Total messages to check:', allCurrentMessages.length);
      
      const recentMessages = allCurrentMessages.filter(msg => {
        // Fix timestamp calculation - handle both Unix seconds and milliseconds
        let messageTimestamp = msg.timestamp;
        
        // If timestamp is in seconds, convert to milliseconds
        if (messageTimestamp < 10000000000) { // Less than year 2286 in seconds
          messageTimestamp = messageTimestamp * 1000;
        }
        
        const messageAge = Date.now() - messageTimestamp;
        const isRecent = messageAge < 300000; // Increased to 5 minutes for testing
        const isNotFromCurrentUser = !msg.sender.includes(currentUser);
        const isNotAI = !msg.sender.includes('AI') && !msg.sender.includes('🤖');
        const notPending = !pendingResponses.has(msg.id);
        
        console.log('📝 Message check:', {
          content: msg.content.substring(0, 30),
          sender: msg.sender.substring(0, 10),
          originalTimestamp: msg.timestamp,
          convertedTimestamp: messageTimestamp,
          age: Math.round(messageAge / 1000) + 's',
          isRecent,
          isNotFromCurrentUser,
          isNotAI,
          notPending
        });
        
        return isRecent && isNotFromCurrentUser && isNotAI && notPending;
      });
      
      console.log('🔍 AI checking messages:', recentMessages.length, 'recent messages found');
      
      for (const message of recentMessages) {
        const shouldRespond = userSettings.responseKeywords.some(keyword =>
          message.content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        console.log('🤖 Message:', message.content.substring(0, 50), 'Should respond:', shouldRespond);
        console.log('🔑 Keywords found:', userSettings.responseKeywords.filter(keyword =>
          message.content.toLowerCase().includes(keyword.toLowerCase())
        ));
        
        if (shouldRespond && await needsAIResponse(message)) {
          pendingResponses.add(message.id);
          console.log('✅ AI Auto-responding to:', message.content);
          await generateAutoResponse(message);
        }
      }
    }
    
    // Check if message needs AI response
    async function needsAIResponse(message) {
      try {
        const prompt = `Should an AI assistant respond to this message in a crypto chat? Consider if it's asking for help, information, or explanation. Answer only "yes" or "no": "${message.content}"`;
        const response = await callAIAPI(prompt);
        return response.toLowerCase().includes('yes');
      } catch {
        return false;
      }
    }
    
    // Generate auto-response
    async function generateAutoResponse(message) {
      try {
        console.log('🤖 Generating AI response for:', message.content);
        
        const context = `You are Ergonaut 001, an expert AI assistant in an Ergo blockchain chat. Someone asked: "${message.content}". 
  
  Provide a helpful, concise response (2-3 sentences max) about Ergo, cryptocurrency, or blockchain topics. Be friendly and informative. Focus on Ergo-specific information when relevant.
  
  If the question is about:
  - Ergo basics: Explain Ergo's unique features (UTXO model, ErgoScript, storage rent)
  - Wallets: Recommend Nautilus, mention security best practices
  - DEXs: Mention Spectrum, ErgoDEX for trading
  - Mining: Explain Autolykos PoW algorithm
  - Development: Point to Ergo docs and ErgoScript
  
  Keep responses conversational and helpful.`;
        
        const response = await callAIAPI(context);
        
        if (response && response.length > 10) {
          // Emit event to send AI response to main chat
          dispatch('aiResponse', {
            originalMessage: message,
            response: response.trim(),
            type: 'auto'
          });
          
          console.log('✅ AI response generated and dispatched');
        } else {
          console.log('❌ AI response too short or empty');
        }
        
      } catch (error) {
        console.error('❌ Error generating auto-response:', error);
      }
    }
    
    // Call AI API
    async function callAIAPI(prompt) {
      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.headers['x-api-key']}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          chatbotId: apiConfig.chatbotId,
          stream: false,
          temperature: 0.1
        })
      });
      
      const data = await response.json();
      return data.text || data.response || '';
    }
    
    // Utility functions
    function shouldGenerateSummary() {
      return userSettings.summaryEnabled && 
             (Date.now() - lastCheckTime) > 1800000; // 30 minutes
    }
    
    function formatSender(sender) {
      if (!sender) return 'Unknown';
      return sender.length > 12 ? 
        `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}` : 
        sender;
    }
    
    function showSmartNotification(title, message, type) {
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: type
        });
      }
      
      // In-app notification
      showCustomToast(`${title}: ${message}`, 5000, type === 'important' ? 'warning' : 'info');
    }
    
    function requestNotificationPermission() {
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            showCustomToast('Smart notifications enabled!', 3000, 'success');
          }
        });
      }
    }
    
    function addKeywordAlert() {
      const keyword = prompt('Enter keyword to monitor:');
      if (keyword && !userSettings.keywordAlerts.includes(keyword)) {
        userSettings.keywordAlerts.push(keyword);
        saveUserSettings();
      }
    }
    
    function removeKeywordAlert(keyword) {
      userSettings.keywordAlerts = userSettings.keywordAlerts.filter(k => k !== keyword);
      saveUserSettings();
    }
  </script>
  
  <!-- AI Features UI -->
  <div class="ai-features-container">
    <!-- AI Features Toggle Buttons -->
    <div class="ai-controls">
      <button 
        class="ai-control-btn {showAnalytics ? 'active' : ''}" 
        on:click={() => showAnalytics = !showAnalytics}
        title="Chat Analytics"
      >
        <i class="fa-solid fa-chart-bar"></i>
        <span>Analytics</span>
      </button>
      
      <button 
        class="ai-control-btn {showNotificationSettings ? 'active' : ''}" 
        on:click={() => showNotificationSettings = !showNotificationSettings}
        title="Smart Notifications"
      >
        <i class="fa-solid fa-bell"></i>
        <span>Smart Alerts</span>
        {#if smartNotifications.importantMessages.length > 0}
          <span class="notification-badge">{smartNotifications.importantMessages.length}</span>
        {/if}
      </button>
      
      <button 
        class="ai-control-btn" 
        on:click={analyzeMessages}
        disabled={isAnalyzing}
        title="Refresh Analytics"
      >
        {#if isAnalyzing}
          <div class="mini-spinner"></div>
        {:else}
          <i class="fa-solid fa-refresh"></i>
        {/if}
        <span>Refresh</span>
      </button>
    </div>
    
    <!-- Analytics Panel -->
    {#if showAnalytics}
      <div class="analytics-panel">
        <div class="panel-header">
          <h3><i class="fa-solid fa-chart-bar"></i> Chat Analytics</h3>
          {#if aiAnalytics.lastUpdated}
            <span class="last-updated">
              Updated: {new Date(aiAnalytics.lastUpdated).toLocaleTimeString()}
            </span>
          {/if}
        </div>
        
        <div class="analytics-grid">
          <!-- Message Stats -->
          <div class="stat-card">
            <h4>24h Activity</h4>
            <div class="stat-number">{aiAnalytics.messageStats.total24h || 0}</div>
            <div class="stat-label">Messages</div>
            <div class="stat-detail">
              {aiAnalytics.messageStats.uniqueUsers || 0} users, {aiAnalytics.messageStats.averagePerHour || 0}/hour
            </div>
          </div>
          
          <!-- Tips Stats -->
          <div class="stat-card">
            <h4>Tips Sent</h4>
            <div class="stat-number">{aiAnalytics.messageStats.tipsCount || 0}</div>
            <div class="stat-label">Today</div>
          </div>
          
          <!-- Most Active Users -->
          <div class="stat-card wide">
            <h4>Most Active Users (24h)</h4>
            <div class="user-list">
              {#each aiAnalytics.mostActiveUsers.slice(0, 5) as {user, count}}
                <div class="user-item">
                  <span class="user-name">{formatSender(user)}</span>
                  <span class="user-count">{count} msgs</span>
                </div>
              {/each}
            </div>
          </div>
          
          <!-- Trending Topics -->
          <div class="stat-card wide">
            <h4>Trending Topics</h4>
            <div class="topic-tags">
              {#each aiAnalytics.trendingTopics as topic}
                <span class="topic-tag">{topic}</span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Smart Notifications Panel -->
    {#if showNotificationSettings}
      <div class="notifications-panel">
        <div class="panel-header">
          <h3><i class="fa-solid fa-bell"></i> Smart Notifications</h3>
        </div>
        
        <div class="notification-settings">
          <!-- Enable/Disable -->
          <div class="setting-row">
            <label class="setting-label">
              <input 
                type="checkbox" 
                bind:checked={userSettings.enableSmartNotifications}
                on:change={saveUserSettings}
              />
              Enable Smart Notifications
            </label>
            {#if userSettings.enableSmartNotifications && Notification.permission !== 'granted'}
              <button class="enable-btn" on:click={requestNotificationPermission}>
                Enable Browser Notifications
              </button>
            {/if}
          </div>
          
          <!-- Auto Response -->
          <div class="setting-row">
            <label class="setting-label">
              <input 
                type="checkbox" 
                bind:checked={userSettings.autoRespond}
                on:change={saveUserSettings}
              />
              AI Auto-Response to Help Requests
            </label>
          </div>
          
          <!-- Keyword Alerts -->
          <div class="setting-section">
            <h4>Keyword Alerts</h4>
            <div class="keyword-list">
              {#each userSettings.keywordAlerts as keyword}
                <span class="keyword-tag">
                  {keyword}
                  <button on:click={() => removeKeywordAlert(keyword)}>×</button>
                </span>
              {/each}
              <button class="add-keyword-btn" on:click={addKeywordAlert}>
                + Add Keyword
              </button>
            </div>
          </div>
          
          <!-- Important Messages -->
          {#if smartNotifications.importantMessages.length > 0}
            <div class="setting-section">
              <h4>Recent Important Messages</h4>
              <div class="important-messages">
                {#each smartNotifications.importantMessages.slice(0, 3) as msg}
                  <div class="important-msg">
                    <div class="msg-header">
                      <span class="msg-sender">{formatSender(msg.sender)}</span>
                      <span class="msg-time">{new Date(msg.timestamp * 1000).toLocaleTimeString()}</span>
                    </div>
                    <div class="msg-content">{msg.content.substring(0, 100)}...</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          
          <!-- Missed Messages Summary -->
          {#if smartNotifications.missedMessagesSummary}
            <div class="setting-section">
              <h4>Recent Activity Summary</h4>
              <div class="summary-box">
                {smartNotifications.missedMessagesSummary}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .ai-features-container {
      margin-bottom: 1rem;
    }
    
    .ai-controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    
    .ai-control-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: rgba(255, 85, 0, 0.1);
      color: #FF5500;
      border: 1px solid rgba(255, 85, 0, 0.3);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.9rem;
      position: relative;
    }
    
    .ai-control-btn:hover,
    .ai-control-btn.active {
      background-color: rgba(255, 85, 0, 0.2);
    }
    
    .ai-control-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
    }
    
    .mini-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 85, 0, 0.3);
      border-top-color: #FF5500;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    .analytics-panel,
    .notifications-panel {
      background-color: #262626;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid rgba(255, 85, 0, 0.3);
      margin-bottom: 1rem;
    }
    
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .panel-header h3 {
      margin: 0;
      color: #FF5500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .last-updated {
      font-size: 0.8rem;
      color: #999;
    }
    
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    
    .stat-card {
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      padding: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .stat-card.wide {
      grid-column: span 2;
    }
    
    .stat-card h4 {
      margin: 0 0 0.5rem 0;
      color: #CCC;
      font-size: 0.9rem;
    }
    
    .stat-number {
      font-size: 2rem;
      font-weight: bold;
      color: #FF5500;
      line-height: 1;
    }
    
    .stat-label {
      color: #999;
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }
    
    .stat-detail {
      color: #AAA;
      font-size: 0.75rem;
      margin-top: 0.5rem;
    }
    
    .user-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .user-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.25rem 0;
    }
    
    .user-name {
      color: white;
      font-weight: 500;
    }
    
    .user-count {
      color: #FF5500;
      font-size: 0.8rem;
    }
    
    .topic-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .topic-tag {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.8rem;
      border: 1px solid rgba(255, 85, 0, 0.3);
    }
    
    .notification-settings {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
    }
    
    .setting-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: white;
      cursor: pointer;
    }
    
    .enable-btn {
      background-color: #FF5500;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      font-size: 0.8rem;
    }
    
    .setting-section {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 1rem;
    }
    
    .setting-section h4 {
      margin: 0 0 0.75rem 0;
      color: #CCC;
    }
    
    .keyword-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    
    .keyword-tag {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .keyword-tag button {
      background: none;
      border: none;
      color: #FF5500;
      cursor: pointer;
      font-weight: bold;
    }
    
    .add-keyword-btn {
      background-color: rgba(255, 255, 255, 0.1);
      color: #CCC;
      border: 1px dashed rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      font-size: 0.8rem;
    }
    
    .important-messages {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .important-msg {
      background-color: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 6px;
      padding: 0.75rem;
    }
    
    .msg-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
    }
    
    .msg-sender {
      font-weight: bold;
      color: #FFC107;
    }
    
    .msg-time {
      color: #999;
    }
    
    .msg-content {
      color: white;
      font-size: 0.9rem;
    }
    
    .summary-box {
      background-color: rgba(74, 158, 255, 0.1);
      border: 1px solid rgba(74, 158, 255, 0.3);
      border-radius: 6px;
      padding: 0.75rem;
      color: white;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @media (max-width: 768px) {
      .analytics-grid {
        grid-template-columns: 1fr;
      }
      
      .stat-card.wide {
        grid-column: span 1;
      }
      
      .ai-controls {
        justify-content: center;
      }
    }
  </style>