<!-- KYA.svelte - Know Your Assumptions Component for Pulse -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  
  const dispatch = createEventDispatcher();
  
  export let isVisible = false;
  export let isDarkMode = true;
  
  let accepted = false;
  
  function handleAccept() {
    accepted = true;
    dispatch('accept');
  }
  
  function handleDecline() {
    dispatch('decline');
  }
  
  function closeModal() {
    if (accepted) {
      dispatch('close');
    }
  }
</script>

{#if isVisible}
  <div 
    class="kya-overlay {isDarkMode ? 'dark' : 'light'}" 
    transition:fade={{ duration: 200 }}
    on:click|self={closeModal}
  >
    <div class="kya-container" transition:slide={{ duration: 300, y: -20 }}>
      <div class="kya-header">
        <div class="kya-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <h2>Pulse</h2>
        </div>
        {#if accepted}
          <button class="close-btn" on:click={closeModal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>
      
      <div class="kya-content">
        <div class="kya-title">
          <h3>Know Your Assumptions And Terms of Use</h3>
        </div>
        
        <div class="kya-text">
          <p>
            <strong>Pulse</strong> is a decentralized messaging interface for the Ergo Blockchain that enables 
            secure, peer-to-peer communication through blockchain transactions.
          </p>
          
          <div class="notice-section">
            <h4><span class="highlight">Notice that:</span></h4>
            <ul class="notice-list">
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                We don't log, profile, or sell your data. All messages are stored on-chain.
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Pulse operates on the live Ergo blockchain - all transactions are final and irreversible once confirmed.
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Every message transaction can be viewed via 
                <a href="https://explorer.ergoplatform.com/" target="_blank" rel="noopener noreferrer">
                  Ergo Explorer
                </a>.
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Each message requires a small transaction fee (≈0.0015 ERG) to be recorded on-chain.
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Messages can be encrypted for privacy but are permanently stored on the public blockchain.
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
                This is experimental software - use only with funds you can afford to lose.
              </li>
            </ul>
          </div>
          
          <div class="agreement-section">
            <h4><span class="highlight">By accepting these terms, you agree that:</span></h4>
            <div class="agreement-text">
              <p>• You will use Pulse at your own risk and peril.</p>
              <p>• Only <strong>YOU</strong> are responsible for your assets and wallet security.</p>
              <p>• Only <strong>YOU</strong> are responsible for securely storing your recovery phrase.</p>
              <p>• You understand that blockchain transactions are irreversible.</p>
              <p>• You acknowledge this is experimental software and may contain bugs.</p>
              <p>
                By using this service, you agree to our 
                <a href="/privacy-policy" target="_blank">Privacy Policy</a> and 
                <a href="/terms-of-service" target="_blank">Terms of Service</a>.
              </p>
            </div>
          </div>
          
          <div class="warning-section">
            <div class="warning-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div>
                <strong>Important:</strong> Never share your seed phrase with anyone. 
                This demo is for educational purposes - use only test wallets with small amounts.
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="kya-actions">
        <button class="btn btn-secondary" on:click={handleDecline}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Decline
        </button>
        <button class="btn btn-primary" on:click={handleAccept}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
          I Understand & Accept
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .kya-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  
  .kya-container {
    background: var(--surface-color);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  }
  
  .kya-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 32px 16px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .kya-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--primary-color);
  }
  
  .kya-logo h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .close-btn:hover {
    background: var(--hover-color);
    color: var(--text-primary);
  }
  
  .kya-content {
    padding: 32px;
  }
  
  .kya-title {
    margin-bottom: 24px;
  }
  
  .kya-title h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .kya-text {
    line-height: 1.6;
    color: var(--text-primary);
  }
  
  .kya-text p {
    margin: 0 0 16px 0;
  }
  
  .notice-section,
  .agreement-section {
    margin: 32px 0;
  }
  
  .notice-section h4,
  .agreement-section h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .highlight {
    color: var(--primary-color);
  }
  
  .notice-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .notice-list li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--primary-color);
  }
  
  .notice-list li svg {
    color: var(--success-color);
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .agreement-text {
    background: var(--bg-secondary);
    padding: 20px;
    border-radius: 8px;
    border-left: 3px solid var(--warning-color);
  }
  
  .agreement-text p {
    margin: 0 0 8px 0;
  }
  
  .agreement-text p:last-child {
    margin: 0;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }
  
  .warning-section {
    margin: 24px 0;
  }
  
  .warning-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid var(--warning-color);
    border-radius: 8px;
    color: var(--warning-color);
  }
  
  .warning-box svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .kya-actions {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    padding: 24px 32px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0 0 16px 16px;
  }
  
  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    border: none;
    font-size: 14px;
  }
  
  .btn-primary {
    background: var(--primary-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }
  
  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--hover-color);
    color: var(--text-primary);
  }
  
  a {
    color: var(--primary-color);
    text-decoration: underline;
  }
  
  a:hover {
    color: var(--primary-hover);
  }
  
  /* Theme Variables */
  .dark {
    --primary-color: #FF5500;
    --primary-hover: #ff6b1a;
    --success-color: #4CAF50;
    --warning-color: #ffc107;
    --surface-color: #262626;
    --bg-secondary: #1a1a1a;
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.7);
    --border-color: rgba(255, 85, 0, 0.2);
    --hover-color: rgba(255, 255, 255, 0.1);
  }
  
  .light {
    --primary-color: #FF5500;
    --primary-hover: #ff6b1a;
    --success-color: #4CAF50;
    --warning-color: #ffc107;
    --surface-color: #ffffff;
    --bg-secondary: #f5f5f5;
    --text-primary: #000000;
    --text-secondary: rgba(0, 0, 0, 0.7);
    --border-color: rgba(255, 85, 0, 0.2);
    --hover-color: rgba(0, 0, 0, 0.05);
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .kya-overlay {
      padding: 16px;
    }
    
    .kya-container {
      max-height: 95vh;
    }
    
    .kya-header,
    .kya-content,
    .kya-actions {
      padding-left: 20px;
      padding-right: 20px;
    }
    
    .kya-content {
      padding-top: 24px;
      padding-bottom: 24px;
    }
    
    .kya-actions {
      flex-direction: column;
    }
    
    .btn {
      justify-content: center;
    }
    
    .notice-list li {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }
  
  /* Scrollbar Styling */
  .kya-container::-webkit-scrollbar {
    width: 8px;
  }
  
  .kya-container::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }
  
  .kya-container::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }
  
  .kya-container::-webkit-scrollbar-thumb:hover {
    background: var(--primary-color);
  }
</style>