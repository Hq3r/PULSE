<!-- APIChatRoom.svelte - Component for Chatbase API chatbot with improved debugging -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { truncateAddress } from '$lib/utils/utils';
    import { showCustomToast } from '$lib/utils/utils';
    import EmojiPicker from '$lib/components/main/EmojiPicker.svelte';
    import { connected_wallet_address } from '$lib/store/store';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let apiConfig;
    export let chatroomId = "ai-chat";
    
    // Local state
    let messages = [];
    let inputMessage = "";
    let loading = false;
    let chatHistory = [];
    let chatContainerElement;
    let autoScroll = true;
    let debugInfo = { lastRequest: null, lastResponse: null, lastError: null };
    
    // Initialize component
    onMount(() => {
      console.log("APIChatRoom: Mounting component with config:", apiConfig);
      
      // Load chat history from localStorage
      loadChatHistory();
      
      // Add welcome message if no messages
      if (messages.length === 0) {
        const welcomeMessage = {
          id: `system-${Date.now()}`,
          content: `Hello! I'm ${apiConfig.botName || 'AI Assistant'}. How can I help you today?`,
          timestamp: Math.floor(Date.now() / 1000),
          isUser: false,
          sender: apiConfig.botName || 'AI Assistant',
          pending: false
        };
        
        messages = [welcomeMessage];
        chatHistory = [{ role: 'assistant', content: welcomeMessage.content }];
        saveChatHistory();
        
        console.log("APIChatRoom: Added welcome message:", welcomeMessage);
      }
      
      // Scroll to bottom initially
      setTimeout(scrollToBottom, 100);
      
      return () => {
        // Save chat history on component destruction
        saveChatHistory();
        console.log("APIChatRoom: Component unmounted, saved chat history");
      };
    });
    
    // Load chat history from localStorage
    function loadChatHistory() {
      try {
        const storageKey = `apiChat_${chatroomId}`;
        const storedHistory = localStorage.getItem(storageKey);
        
        if (storedHistory) {
          console.log("APIChatRoom: Found cached API chat history");
          messages = JSON.parse(storedHistory);
          console.log(`APIChatRoom: Loaded ${messages.length} cached messages for API chat`);
          
          // Prepare chat history for API
          chatHistory = [];
          
          // Convert messages to Chatbase format
          for (const msg of messages) {
            chatHistory.push({
              role: msg.isUser ? 'user' : 'assistant',
              content: msg.content
            });
          }
          
          console.log("APIChatRoom: Prepared chat history for API:", chatHistory);
        }
      } catch (error) {
        console.error("APIChatRoom: Error loading chat history:", error);
      }
    }
    
    // Save chat history to localStorage
    function saveChatHistory() {
      try {
        const storageKey = `apiChat_${chatroomId}`;
        
        // Limit to last 50 messages to save space
        const historyToSave = messages.slice(-50);
        localStorage.setItem(storageKey, JSON.stringify(historyToSave));
        console.log(`APIChatRoom: Saved ${historyToSave.length} messages to localStorage`);
      } catch (error) {
        console.error("APIChatRoom: Error saving chat history:", error);
      }
    }
    
    // Send message to API
    async function sendMessage() {
      if (!inputMessage.trim() || loading) return;
      
      const userMessage = inputMessage.trim();
      inputMessage = "";
      
      console.log("APIChatRoom: Sending message:", userMessage);
      
      // Add user message to chat
      const timestamp = Date.now();
      const newUserMessage = {
        id: `user-${timestamp}`,
        content: userMessage,
        timestamp: Math.floor(timestamp / 1000),
        isUser: true,
        sender: $connected_wallet_address || 'You',
        pending: false
      };
      
      messages = [...messages, newUserMessage];
      
      // Add a placeholder for the assistant's response
      const responseId = `assistant-${timestamp}`;
      const placeholderMessage = {
        id: responseId,
        content: "...",
        timestamp: Math.floor(timestamp / 1000),
        isUser: false,
        sender: apiConfig.botName || 'AI Assistant',
        pending: true
      };
      
      messages = [...messages, placeholderMessage];
      
      // Auto-scroll to the newest message
      setTimeout(scrollToBottom, 100);
      
      // Prepare the API request
      const apiUrl = apiConfig.endpoint || 'https://www.chatbase.co/api/v1/chat';
      
      // Construct headers according to Chatbase documentation
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add the correct authorization header format
      if (apiConfig.headers && apiConfig.headers['x-api-key']) {
        headers['Authorization'] = `Bearer ${apiConfig.headers['x-api-key']}`;
        console.log("APIChatRoom: Using Bearer token authorization");
      } else if (apiConfig.headers) {
        // Preserve any other headers
        Object.assign(headers, apiConfig.headers);
        console.log("APIChatRoom: Using custom headers:", headers);
      }
      
      // Create correct message format for Chatbase API
      const messageHistory = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add current user message
      messageHistory.push({
        role: 'user',
        content: userMessage
      });
      
      // Create Chatbase-specific request body according to docs
      const requestBody = {
  messages: messageHistory,
  chatbotId: apiConfig.chatbotId || apiConfig.chatId || 'ergo-blockchain-chat',
  stream: false,
  temperature: 0
};
      
      // Log the full request for debugging
      console.log("APIChatRoom: Sending API request to:", apiUrl);
      console.log("APIChatRoom: Request headers:", headers);
      console.log("APIChatRoom: Request body:", requestBody);
      
      // Store for debugging
      debugInfo.lastRequest = { url: apiUrl, headers, body: requestBody };
      
      try {
        // Set loading state
        loading = true;
        
        // Make the API request
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody)
        });
        
        console.log("APIChatRoom: Received response status:", response.status);
        
        // Get the response data
        const responseText = await response.text();
        console.log("APIChatRoom: Raw response:", responseText);
        
        // Store for debugging
        debugInfo.lastResponse = { status: response.status, text: responseText };
        
        let data;
        try {
          // Try to parse JSON response
          data = JSON.parse(responseText);
          console.log("APIChatRoom: Parsed response data:", data);
        } catch (e) {
          console.error("APIChatRoom: Error parsing response JSON:", e);
          throw new Error(`Failed to parse response: ${responseText}`);
        }
        
        if (!response.ok) {
          throw new Error(data.message || `API error: ${response.status} ${response.statusText}`);
        }
        
        // Extract the assistant response from Chatbase
        const assistantResponse = data.text || data.response || "No response from API";
        console.log("APIChatRoom: Extracted assistant response:", assistantResponse);
        
        // Update the placeholder message with the actual response
        messages = messages.map(msg => 
          msg.id === responseId ? 
            {...msg, content: assistantResponse, pending: false} : 
            msg
        );
        
        // Update chat history
        chatHistory = [
          ...chatHistory.slice(0, chatHistory.length - (placeholderMessage ? 1 : 0)),
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantResponse }
        ];
        
        console.log("APIChatRoom: Updated chat history:", chatHistory);
        
        // Save to localStorage
        saveChatHistory();
        
      } catch (error) {
        console.error("APIChatRoom: API request error:", error);
        
        // Store for debugging
        debugInfo.lastError = { 
          message: error.message,
          stack: error.stack,
          name: error.name,
          timestamp: new Date().toISOString()
        };
        
        // Add more detailed error info to console
        console.error("APIChatRoom: Error details:", {
          error,
          lastRequest: debugInfo.lastRequest,
          lastResponse: debugInfo.lastResponse
        });
        
        // Update the placeholder with error message
        messages = messages.map(msg => 
          msg.id === responseId ? 
            {...msg, 
              content: `Error: ${error.message}. Please try again.`, 
              pending: false, 
              isError: true
            } : 
            msg
        );
        
        showCustomToast(`API Error: ${error.message}`, 5000, 'error');
      } finally {
        loading = false;
        
        // Scroll to the bottom to show the response
        setTimeout(scrollToBottom, 100);
      }
    }
    
    // Handle emoji selection
    function handleEmojiSelect(event) {
      const emoji = event.detail.emoji;
      inputMessage += emoji;
      // Focus the textarea after selecting an emoji
      setTimeout(() => {
        document.querySelector('.api-message-input').focus();
      }, 10);
    }
    
    // Handle scroll event to detect if user has scrolled up
    function handleScroll() {
      if (!chatContainerElement) return;
      
      const { scrollTop, scrollHeight, clientHeight } = chatContainerElement;
      // If user is within 100px of bottom, enable auto-scroll
      autoScroll = scrollHeight - scrollTop - clientHeight < 100;
    }
    
    // Scroll to bottom of chat
    function scrollToBottom() {
      if (chatContainerElement && autoScroll) {
        chatContainerElement.scrollTop = chatContainerElement.scrollHeight;
      }
    }
    
    // Handle key press in the input field
    function handleKeyPress(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }
    
    // Format time for display
    function formatTime(timestamp) {
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Clear chat history
    function clearChat() {
      if (confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
        // Keep just the welcome message
        const welcomeMessage = {
          id: `system-${Date.now()}`,
          content: `Hello! I'm ${apiConfig.botName || 'AI Assistant'}. How can I help you today?`,
          timestamp: Math.floor(Date.now() / 1000),
          isUser: false,
          sender: apiConfig.botName || 'AI Assistant',
          pending: false
        };
        
        messages = [welcomeMessage];
        chatHistory = [{ role: 'assistant', content: welcomeMessage.content }];
        saveChatHistory();
        showCustomToast("Chat history cleared", 3000, "success");
      }
    }
    
    // Show debugging info
    function showDebugInfo() {
      console.log("APIChatRoom Debug Info:", {
        apiConfig,
        lastRequest: debugInfo.lastRequest,
        lastResponse: debugInfo.lastResponse,
        lastError: debugInfo.lastError,
        chatHistory,
        messages
      });
      
      showCustomToast("Debug info logged to console", 2000, "info");
    }
  </script>
  
  <div class="api-chat-container">
    <!-- Header with API info -->
    <div class="api-chat-header">
      <div class="api-chat-info">
        <i class="fa-solid fa-robot bot-icon"></i>
        <span class="bot-name">{apiConfig.botName || 'AI Assistant'}</span>
      </div>
      
      <div class="api-actions">
        <button class="api-action-btn" on:click={showDebugInfo} title="Show debug info">
          <i class="fa-solid fa-bug"></i>
        </button>
        <button class="api-action-btn" on:click={clearChat} title="Clear chat history">
          <i class="fa-solid fa-trash-alt"></i>
        </button>
        <button class="api-action-btn" on:click={() => dispatch('close')} title="Close AI chat">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    </div>
    
    <!-- Messages container -->
    <div class="api-messages-container" bind:this={chatContainerElement} on:scroll={handleScroll}>
      {#if messages.length === 0}
        <div class="api-empty-chat">
          <div class="api-empty-content">
            <i class="fa-solid fa-robot"></i>
            <h3>Start chatting with {apiConfig.botName || 'AI Assistant'}</h3>
            <p>{apiConfig.description || 'This is an AI chatbot. Send a message to start the conversation.'}</p>
          </div>
        </div>
      {:else}
        <div class="api-messages-list">
          {#each messages as message (message.id)}
            <div class="api-message {message.isUser ? 'user-message' : 'bot-message'} {message.pending ? 'pending' : ''} {message.isError ? 'error' : ''}">
              <div class="api-message-header">
                <span class="api-message-sender">
                  {message.isUser ? (truncateAddress(message.sender) || 'You') : (apiConfig.botName || 'AI Assistant')}
                </span>
                <span class="api-message-time">{formatTime(message.timestamp)}</span>
              </div>
              
              <div class="api-message-content">
                {#if message.pending}
                  <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                {:else}
                  {message.content}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- Input area -->
    <div class="api-input-area">
      <div class="api-input-container">
        <textarea
          bind:value={inputMessage}
          placeholder="Type your message here..."
          on:keydown={handleKeyPress}
          disabled={loading}
          rows="3"
          class="api-message-input"
        ></textarea>
        
        <div class="api-input-actions">
          <EmojiPicker on:select={handleEmojiSelect} />
          
          <button 
            class="api-send-button" 
            on:click={sendMessage} 
            disabled={!inputMessage.trim() || loading}
          >
            {#if loading}
              <div class="api-button-spinner"></div>
            {:else}
              <i class="fa-solid fa-paper-plane"></i>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <style>
    .api-chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: #1b1b1b;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .api-chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background-color: #262626;
      border-bottom: 1px solid rgba(255, 85, 0, 0.2);
    }
    
    .api-chat-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .bot-icon {
      color: #FF5500;
      font-size: 1.2rem;
    }
    
    .bot-name {
      font-weight: 600;
      color: white;
    }
    
    .api-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .api-action-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .api-action-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .api-messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
    }
    
    .api-empty-chat {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #777;
    }
    
    .api-empty-content {
      max-width: 300px;
    }
    
    .api-empty-content i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #FF5500;
      opacity: 0.6;
    }
    
    .api-empty-content h3 {
      margin-bottom: 0.5rem;
      color: #CCC;
    }
    
    .api-empty-content p {
      font-size: 0.9rem;
    }
    
    .api-messages-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .api-message {
      max-width: 80%;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      animation: fadeIn 0.3s ease;
    }
    
    .user-message {
      align-self: flex-end;
      background-color: rgba(255, 85, 0, 0.1);
      border: 1px solid rgba(255, 85, 0, 0.3);
    }
    
    .bot-message {
      align-self: flex-start;
      background-color: #262626;
      border-radius: 8px 8px 8px 0;
    }
    
    .api-message.pending {
      opacity: 0.8;
    }
    
    .api-message.error {
      border-left: 3px solid #ff4c4c;
    }
    
    .api-message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
      color: #AAA;
    }
    
    .api-message-sender {
      font-weight: bold;
    }
    
    .api-message-content {
      word-break: break-word;
      line-height: 1.4;
      color: white;
    }
    
    .typing-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #CCC;
      display: inline-block;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-indicator span:nth-child(1) {
      animation-delay: 0s;
    }
    
    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.6;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }
    
    .api-input-area {
      padding: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .api-input-container {
      display: flex;
      flex-direction: column;
    }
    
    .api-message-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background-color: #2a2a2a;
      color: white;
      resize: none;
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
    }
    
    .api-message-input:focus {
      outline: none;
      border-color: rgba(255, 85, 0, 0.5);
    }
    
    .api-input-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .api-send-button {
      background-color: #FF5500;
      color: white;
      border: none;
      border-radius: 50%;
      width: 2.5rem;
      height: 2.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
    }
    
    .api-send-button:hover {
      background-color: #ff6a1f;
    }
    
    .api-send-button:disabled {
      background-color: #555;
      cursor: not-allowed;
    }
    
    .api-button-spinner {
      width: 1.2rem;
      height: 1.2rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>