<!-- TokenPriceDisplay.svelte -->
<script>
    import { onMount } from 'svelte';
    import { processPriceCommand } from '$lib/utils/tokenPriceChecker';
    
    // Props
    export let command = ''; // Command string like "/price ERG"
    
    // Local state
    let loading = true;
    let error = null;
    let priceData = null;
    
    onMount(async () => {
      try {
        loading = true;
        error = null;
        
        // Process the price command
        priceData = await processPriceCommand(command);
        
        // Handle error response
        if (priceData.type === 'error') {
          error = priceData.message;
          priceData = null;
        }
      } catch (err) {
        error = err.message || 'Failed to fetch price data';
        priceData = null;
      } finally {
        loading = false;
      }
    });
  </script>
  
  {#if loading}
    <div class="price-loader">
      <div class="loader-spinner"></div>
      <p>Fetching token price data...</p>
    </div>
  {:else if error}
    <div class="price-error">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>{error}</p>
    </div>
  {:else if priceData}
    <div class="price-card {priceData.type === 'ergo' ? 'ergo-card' : 'token-card'}">
      <div class="price-header">
        <h3>{priceData.title}</h3>
        {#if priceData.url}
          <a href={priceData.url} target="_blank" rel="noopener noreferrer" class="external-link">
            <i class="fa-solid fa-external-link-alt"></i>
          </a>
        {/if}
      </div>
      
      <div class="price-details">
        {#each priceData.details as detail}
          <div class="detail-row">
            <span class="detail-label">{detail.label}:</span>
            <span class="detail-value">{detail.value}</span>
          </div>
        {/each}
      </div>
      
      {#if priceData.actions && priceData.actions.length > 0}
        <div class="price-actions">
          {#each priceData.actions as action}
            <a 
              href={action.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              class="action-button"
            >
              {action.label}
            </a>
          {/each}
        </div>
      {/if}
      
      {#if priceData.type === 'token'}
        <div class="token-footer">
          <span class="token-id-label">Token ID:</span>
          <span class="token-id">{priceData.tokenId}</span>
        </div>
      {/if}
    </div>
  {/if}
  
  <style>
    .price-card {
      background-color: #1E1E1E;
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-left: 4px solid #FF5500;
      max-width: 100%;
      animation: fadeIn 0.3s ease;
    }
    
    .ergo-card {
      border-left-color: #FF5500;
    }
    
    .token-card {
      border-left-color: #5F9EA0;
    }
    
    .price-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .price-header h3 {
      margin: 0;
      font-size: 1.2rem;
      color: white;
    }
    
    .external-link {
      color: #AAA;
      text-decoration: none;
      transition: color 0.2s ease;
    }
    
    .external-link:hover {
      color: #FF5500;
    }
    
    .price-details {
      margin-bottom: 1rem;
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }
    
    .detail-label {
      color: #AAA;
    }
    
    .detail-value {
      color: white;
      font-weight: 500;
    }
    
    .price-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    
    .action-button {
      background-color: rgba(255, 85, 0, 0.2);
      color: #FF5500;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      flex: 1;
      text-align: center;
      min-width: 120px;
    }
    
    .action-button:hover {
      background-color: rgba(255, 85, 0, 0.3);
    }
    
    .token-footer {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 0.8rem;
    }
    
    .token-id-label {
      color: #AAA;
      margin-right: 0.5rem;
    }
    
    .token-id {
      color: #CCC;
      word-break: break-all;
      font-family: monospace;
    }
    
    .price-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background-color: rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      margin: 1rem 0;
    }
    
    .loader-spinner {
      width: 2rem;
      height: 2rem;
      border: 2px solid rgba(255, 85, 0, 0.1);
      border-top-color: #FF5500;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    .price-error {
      background-color: rgba(255, 68, 68, 0.1);
      border-left: 4px solid #FF4444;
      color: #FF9999;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .price-error i {
      font-size: 1.5rem;
    }
    
    .price-error p {
      margin: 0;
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
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    @media (max-width: 480px) {
      .detail-row {
        flex-direction: column;
        margin-bottom: 0.75rem;
      }
      
      .detail-value {
        margin-top: 0.25rem;
      }
    }
  </style>