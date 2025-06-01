<!-- ChatMessage.svelte - Component for individual chat messages with copy address feature, profanity filter, hyperlink support, and tip button -->
<script lang="ts">
    import { type ChatMessage } from './chatstore';
    import { onMount, createEventDispatcher } from 'svelte';
    import { profanityFilter } from '$lib/components/main/ProfanityFilter';
    import { filterEnabled } from '$lib/components/main/profanityFilterStore';
    import { getContext } from 'svelte';
   
    // Props
    export let message: ChatMessage;
    export let isOwn: boolean = false;
   
    // Create event dispatcher for tip functionality
    const dispatch = createEventDispatcher();
   
    // State variables
    let isCopied = false;
    let tooltipVisible = false;
    let tooltipTimeout: number;
    
    // Format sender address for display
    function formatSender(sender: string): string {
      if (!sender) return 'Unknown';
     
      // Clean up any "3" prefix if present
      if (sender.startsWith('3') && sender.length > 50) {
        sender = sender.substring(1);
      }
     
      // Truncate long addresses
      if (sender.length > 12) {
        return `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}`;
      }
     
      return sender;
    }
   
    // Format timestamp for display
    function formatTime(timestamp: number): string {
      const date = new Date(timestamp * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Get clean sender address (without any "3" prefix)
    function getCleanAddress(): string {
      if (!message.sender) return '';
      
      // Clean up any "3" prefix if present
      if (message.sender.startsWith('3') && message.sender.length > 50) {
        return message.sender.substring(1);
      }
      
      return message.sender;
    }
    
    // Copy address to clipboard
    async function copyAddressToClipboard() {
      const addressToCopy = getCleanAddress();
      
      try {
        await navigator.clipboard.writeText(addressToCopy);
        isCopied = true;
        
        // Show tooltip
        clearTimeout(tooltipTimeout);
        tooltipVisible = true;
        
        // Hide tooltip after 2 seconds
        tooltipTimeout = setTimeout(() => {
          tooltipVisible = false;
          setTimeout(() => { isCopied = false; }, 300); // Reset after tooltip fade out
        }, 2000);
      } catch (err) {
        console.error('Failed to copy address: ', err);
      }
    }
    
    // Handle tip button click
    function handleTipClick() {
      const cleanAddress = getCleanAddress();
      if (cleanAddress) {
        dispatch('openTip', {
          recipientAddress: cleanAddress,
          recipientName: formatSender(message.sender)
        });
      }
    }
    
    // Convert URLs to clickable links with improved regex
    function processMessageContent(content: string): string {
      if (!content) return '';
      
      // First apply profanity filter if enabled
      const filteredContent = $filterEnabled ? profanityFilter.filter(content) : content;
      
      // Enhanced URL regex pattern that handles query parameters and fragments
      const urlRegex = /(https?:\/\/[^\s]+(?:\?[^\s]*)?(?:#[^\s]*)?|www\.[^\s]+(?:\?[^\s]*)?(?:#[^\s]*)?|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.(?:com|org|net|edu|gov|mil|int|co|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil|info|biz|name|tech|io|app|dev|xyz|me|tv|cc|ai|crypto|nft|defi|dao)(?:\/[^\s]*)?(?:\?[^\s]*)?(?:#[^\s]*)?)/gi;
      
      return filteredContent.replace(urlRegex, (url) => {
        // Ensure the URL has a protocol
        let href = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          href = 'https://' + url;
        }
        
        // Truncate display text for very long URLs
        let displayText = url;
        if (url.length > 60) {
          displayText = url.substring(0, 57) + '...';
        }
        
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="message-link">${displayText}</a>`;
      });
    }
    
    // Get processed message content with hyperlinks
    $: processedContent = processMessageContent(message.content);
    
    // Clean up on unmount
    onMount(() => {
      return () => {
        if (tooltipTimeout) clearTimeout(tooltipTimeout);
      };
    });
  </script>
  
  <div class="message-row {isOwn ? 'own' : 'other'}">
    <div class="message {message.pending ? 'pending' : 'confirmed'} {isOwn ? 'my-message' : 'their-message'}">
      <div class="message-header">
        <div class="sender-container">
          <span class="message-sender">{formatSender(message.sender)}</span>
          {#if message.sender && !isOwn}
            <button 
              class="copy-button" 
              on:click|stopPropagation={copyAddressToClipboard}
              aria-label="Copy address"
            >
              {#if isCopied}
                <i class="fa-solid fa-check"></i>
              {:else}
                <i class="fa-regular fa-copy"></i>
              {/if}
              
              {#if tooltipVisible}
                <span class="tooltip">Copied!</span>
              {/if}
            </button>
            
         
          {/if}
        </div>
        <span class="message-time">{formatTime(message.timestamp)}</span>
      </div>
      <div class="message-content">
      
      </div>
      {#if message.pending}
        <div class="message-status">Pending...</div>
      {/if}
    </div>
  </div>
  
  <style>
    /* Full-width container for message alignment */
    .message-row {
      width: 100%;
      display: flex;
      margin-bottom: 0.8rem;
    }
   
    /* Align messages based on sender */
    .message-row.own {
      justify-content: flex-end;
    }
   
    .message-row.other {
      justify-content: flex-start;
    }
   
    /* Actual message bubble */
    .message {
      padding: 0.8rem 1rem;
      border-radius: 8px;
      max-width: 80%; /* Limit width to 80% for better appearance */
      animation: fadeIn 0.3s ease;
      box-sizing: border-box;
    }
   
    /* Your messages on the right with orange background */
    .message.my-message {
      background-color: #ff55001a;
      border: 1px solid rgba(255,85,0,.3);
    }
    
    /* Their messages on the left with dark background */
    .message.their-message {
      background-color: #1E1E1E;
      border-radius: 12px 12px 12px 0; /* Rounded corners with point on bottom left */
    }
   
    .message.pending {
      border-left: 3px solid #FF5500;
      opacity: 0.9;
    }
   
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
      color: #AAA;
    }

    /* Make header text more visible on orange background */
    .my-message .message-header {
      color: rgba(255, 255, 255, 0.9);
    }
    
    /* Sender container with copy button */
    .sender-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      position: relative;
    }
   
    .message-sender {
      font-weight: bold;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* Copy button and tip button styles */
    .copy-button,
    .tip-button {
      background: none;
      border: none;
      color: #777;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.2rem;
      height: 1.2rem;
      opacity: 0.6;
      transition: all 0.2s ease;
      border-radius: 50%;
    }
    
    .my-message .copy-button,
    .my-message .tip-button {
      color: rgba(255, 255, 255, 0.8);
    }
    
    .copy-button:hover,
    .tip-button:hover {
      opacity: 1;
      color: #FFF;
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .tip-button:hover {
      color: #FF5500;
      background-color: rgba(255, 85, 0, 0.1);
    }
    
    /* Tooltip styles */
    .tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background-color: #FF5500;
      color: white;
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 1;
      animation: fadeInOut 2s ease;
      margin-bottom: 0.25rem;
    }
    
    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -4px;
      border-width: 4px;
      border-style: solid;
      border-color: #FF5500 transparent transparent transparent;
    }
   
    .message-content {
      word-break: break-word;
      line-height: 1.4;
    }
    
    .their-message .message-content {
      color: #FFF;
    }
    
    .my-message .message-content {
      color: #FFF; /* White text on orange background */
    }
    
    /* Hyperlink styles within messages */
    :global(.message-content .message-link) {
      color: #4A9EFF;
      text-decoration: underline;
      transition: all 0.2s ease;
      word-break: break-all;
    }
    
    :global(.message-content .message-link:hover) {
      color: #66B3FF;
      text-decoration: none;
    }
    
    /* Different link color for own messages (on orange background) */
    :global(.my-message .message-content .message-link) {
      color: #87CEEB;
    }
    
    :global(.my-message .message-content .message-link:hover) {
      color: #ADD8E6;
    }
   
    .message-status {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.7); /* More visible on orange background */
      margin-top: 0.5rem;
      text-align: right;
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
    
    @keyframes fadeInOut {
      0% { opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
  </style>