<!-- MessageList.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { formatTime, truncateAddress } from '$lib/utils/chatConstants.js';
  import WalletButton from '$lib/components/nav/WalletButton.svelte';
  import DOMPurify from 'dompurify';
  import { sanitizeForDisplay } from '$lib/utils/securityUtils.js';

  export let messages = [];
  export let loading = false;
  export let walletConnected = false;
  export let selectedChatroom = "general";
  export let currentWalletAddress = "";
  export let stealthMode = { active: false, displayName: '' };
  export let compactMode = false;

  const dispatch = createEventDispatcher();

  // SECURITY: Configure DOMPurify for safe message rendering
  const purifyConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br'], // Only allow basic formatting
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    WHOLE_DOCUMENT: false,
    FORCE_BODY: false
  };

  // SECURITY: Sanitize message content to prevent XSS
  function sanitizeMessage(content) {
    if (!content || typeof content !== 'string') return '';
    
    // First, sanitize with DOMPurify
    const cleaned = DOMPurify.sanitize(content, purifyConfig);
    
    // Additional escaping for extra safety
    return cleaned
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/data:/gi, '') // Remove data: URLs
      .replace(/vbscript:/gi, ''); // Remove vbscript: URLs
  }

  // SECURITY: Process URLs safely (if you want to allow links)
  function processMessageContentSafely(content) {
    if (!content) return '';
    
    // First sanitize the content
    let sanitized = sanitizeMessage(content);
    
    // If you want to allow links, do it safely AFTER sanitization
    const urlRegex = /(https?:\/\/[^\s<>"'`]+)/gi;
    
    return sanitized.replace(urlRegex, (url) => {
      // Validate URL format
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
          // Truncate display text for very long URLs
          let displayText = url;
          if (url.length > 60) {
            displayText = url.substring(0, 57) + '...';
          }
          
          // Use rel="noopener noreferrer" for security
          return `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer" class="message-link">${sanitizeMessage(displayText)}</a>`;
        }
      } catch (e) {
        // Invalid URL, just return sanitized text
      }
      return sanitizeMessage(url);
    });
  }

  function openMnemonicModal() {
    dispatch('openMnemonicModal');
  }

  function isOwnMessage(message) {
    if (!walletConnected || !currentWalletAddress) return false;
    
    const cleanCurrentAddress = currentWalletAddress.startsWith('3') 
      ? currentWalletAddress.substring(1) 
      : currentWalletAddress;
    
    const cleanMessageSender = message.sender.startsWith('3') 
      ? message.sender.substring(1) 
      : message.sender;
    
    return truncateAddress(cleanCurrentAddress) === message.sender ||
           cleanMessageSender === truncateAddress(cleanCurrentAddress);
  }

  function isStealthMessage(sender) {
    return sender.includes('stealth') || 
           sender.match(/^(Silent|Hidden|Shadow|Ghost|Phantom|Invisible|Secret|Anonymous|Stealth|Masked)/);
  }
</script>

<div class="messages-container">
  {#if loading && messages.length === 0}
    <!-- Loading State - Same as before -->
    <div class="state-container">
      <div class="loading-state">
        <div class="spinner large"></div>
        <h3>Loading messages...</h3>
        <p>Please wait while we fetch the latest messages...</p>
      </div>
    </div>
  {:else if messages.length === 0}
    <!-- Empty State - Same as before -->
    <div class="state-container">
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3>Welcome to Pulse</h3>
        <p>
          {#if !walletConnected}
            Connect your wallet or import a seed phrase to start chatting with the Ergo community!
          {:else}
            Be the first to send a message in #{selectedChatroom}!
          {/if}
        </p>
        
        {#if !walletConnected}
          <div class="empty-actions">
            <WalletButton />
            <span class="divider">or</span>
            <button class="btn btn-primary" on:click={openMnemonicModal}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
                <line x1="8" y1="7" x2="16" y2="7"/>
              </svg>
              Import Wallet
            </button>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Messages List -->
    <div class="messages-list">
      {#each messages as message, index (message.id)}
        <div class="message {message.pending ? 'pending' : ''} {message.isMempool ? 'mempool' : ''} {compactMode ? 'compact' : ''} {isOwnMessage(message) ? 'own-message' : ''}">
          <!-- Message Avatar -->
          <div class="message-avatar">
            <div class="avatar {isOwnMessage(message) ? 'own-avatar' : ''}">
              {#if isStealthMessage(message.sender)}
                <!-- Stealth/Anonymous Avatar -->
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
                  <path d="M12 1v6"/>
                  <path d="M12 19v4"/>
                  <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              {:else}
                <!-- Regular Avatar with First Letter -->
                {message.sender.charAt(0).toUpperCase()}
              {/if}
            </div>
            {#if message.pending}
              <div class="pending-indicator">
                <div class="pulse"></div>
              </div>
            {/if}
          </div>
          
          <!-- Message Content -->
          <div class="message-content">
            <div class="message-header">
              <span class="sender {isStealthMessage(message.sender) ? 'stealth-sender' : ''}">{message.sender}</span>
              <span class="timestamp">{formatTime(message.timestamp)}</span>
              {#if message.pending}
                <span class="status pending">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12,6 12,12 16,14"></polyline>
                  </svg>
                  Pending...
                </span>
              {:else}
                <span class="status sent">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                </span>
              {/if}
            </div>
            
            <!-- SECURITY FIX: Use @html with sanitized content -->
            <div class="message-body">
        {@html sanitizeForDisplay(message.content)}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    min-height: 0;
  }

  .state-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
  }

  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
    max-width: 500px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 85, 0, 0.3);
    border-top-color: var(--primary-color, #FF5500);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  .spinner.large {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-icon {
    margin-bottom: 24px;
    color: var(--primary-color, #FF5500);
    opacity: 0.7;
  }

  .empty-state h3, .loading-state h3 {
    margin: 0 0 12px 0;
    color: var(--primary-color, #FF5500);
    font-size: 24px;
    font-weight: 700;
  }

  .empty-state p, .loading-state p {
    margin: 0 0 24px 0;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 16px;
    line-height: 1.5;
  }

  .empty-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .divider {
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    font-size: 14px;
    font-weight: 500;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    font-size: 14px;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--primary-color, #FF5500), #ff7733);
    color: white;
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, #ff7733, var(--primary-color, #FF5500));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 85, 0, 0.3);
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: var(--surface-color, #262626);
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.1));
    border-radius: 12px;
    transition: all 0.2s ease;
    position: relative;
  }

  .message:hover {
    background: var(--background-color, #1a1a1a);
    border-color: var(--border-color, rgba(255, 85, 0, 0.2));
  }

  .message.pending {
    background: rgba(255, 85, 0, 0.05);
    border-color: var(--primary-color, #FF5500);
    border-left-width: 4px;
  }

  .message.own-message {
    background: rgba(255, 85, 0, 0.08);
    border-color: rgba(255, 85, 0, 0.3);
  }

  .message.compact {
    padding: 12px;
    gap: 8px;
  }

  .message-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-color, #FF5500);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    border: 2px solid var(--border-color, rgba(255, 85, 0, 0.2));
  }

  .avatar.own-avatar {
    background: linear-gradient(135deg, var(--primary-color, #FF5500), #ff7733);
    border-color: var(--primary-color, #FF5500);
  }

  .compact .avatar {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .pending-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    background: var(--primary-color, #FF5500);
    border-radius: 50%;
    border: 2px solid var(--surface-color, #262626);
  }

  .pulse {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--primary-color, #FF5500);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.2);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .sender {
    font-weight: 700;
    color: var(--primary-color, #FF5500);
    font-size: 14px;
  }

  .sender.stealth-sender {
    color: #9333ea;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sender.stealth-sender::before {
    content: "🎭";
    font-size: 12px;
  }

  .timestamp {
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    margin-left: auto;
  }

  .status.pending {
    color: var(--primary-color, #FF5500);
    animation: fade 2s infinite;
  }

  .status.sent {
    color: var(--success-color, #4CAF50);
  }

  @keyframes fade {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .message-body {
    color: var(--text-color, #ffffff);
    line-height: 1.5;
    word-break: break-word;
    font-size: 15px;
  }

  .compact .message-header {
    margin-bottom: 4px;
  }

  .compact .sender {
    font-size: 13px;
  }

  .compact .timestamp {
    font-size: 11px;
  }

  .compact .message-body {
    font-size: 14px;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .messages-container {
      padding: 16px;
    }

    .messages-list {
      gap: 12px;
    }

    .message {
      padding: 12px;
      gap: 10px;
    }

    .avatar {
      width: 36px;
      height: 36px;
      font-size: 14px;
    }

    .message-header {
      gap: 8px;
    }

    .sender {
      font-size: 13px;
    }

    .timestamp {
      font-size: 11px;
    }

    .message-body {
      font-size: 14px;
    }

    .empty-actions {
      flex-direction: column;
      gap: 12px;
    }

    .btn {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .messages-container {
      padding: 12px;
    }

    .message {
      padding: 10px;
      gap: 8px;
    }

    .avatar {
      width: 32px;
      height: 32px;
      font-size: 12px;
    }

    .empty-state h3, .loading-state h3 {
      font-size: 20px;
    }

    .empty-state p, .loading-state p {
      font-size: 14px;
    }
  }

  /* Dark/Light theme compatibility */
  :global(.light) .message {
    background: #ffffff;
    border-color: rgba(255, 85, 0, 0.1);
  }

  :global(.light) .message:hover {
    background: #f8f9fa;
  }

  :global(.light) .message.own-message {
    background: rgba(255, 85, 0, 0.05);
  }

  :global(.light) .message-body {
    color: #333333;
  }

  :global(.light) .timestamp {
    color: rgba(0, 0, 0, 0.6);
  }

  :global(.light) .empty-state p, 
  :global(.light) .loading-state p {
    color: rgba(0, 0, 0, 0.7);
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .spinner,
    .pulse,
    .status.pending {
      animation: none;
    }
  }

  .message:focus-within {
    outline: 2px solid var(--primary-color, #FF5500);
    outline-offset: 2px;
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .message {
      border-width: 2px;
    }
    
    .avatar {
      border-width: 3px;
    }
  }
</style>