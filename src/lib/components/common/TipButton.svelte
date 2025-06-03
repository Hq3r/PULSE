<!-- TipButton.svelte - Tip Icon Button -->
<script>
  import { createEventDispatcher } from 'svelte';

  export let recipientAddress = "";
  export let recipientName = "";
  export let size = "small"; // "small", "medium", "large"
  export let disabled = false;
  export let tooltip = true;

  const dispatch = createEventDispatcher();

  let showTooltip = false;
  let tooltipTimeout;

  function handleClick(event) {
    event?.stopPropagation();
    if (!disabled && recipientAddress) {
      dispatch('openTip', {
        recipientAddress: getCleanAddress(),
        recipientName: recipientName || formatAddress(recipientAddress)
      });
    }
  }

  function getCleanAddress() {
    if (!recipientAddress) return '';
    
    // Clean up any "3" prefix if present
    if (recipientAddress.startsWith('3') && recipientAddress.length > 50) {
      return recipientAddress.substring(1);
    }
    
    return recipientAddress;
  }

  function formatAddress(address) {
    if (!address) return 'Unknown';
    if (address.length > 12) {
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
    return address;
  }

  function handleMouseEnter() {
    if (tooltip && !disabled) {
      clearTimeout(tooltipTimeout);
      showTooltip = true;
    }
  }

  function handleMouseLeave() {
    if (tooltip) {
      tooltipTimeout = setTimeout(() => {
        showTooltip = false;
      }, 100);
    }
  }

  // Size configurations
  const sizeConfig = {
    small: { width: 14, height: 14, padding: '4px' },
    medium: { width: 16, height: 16, padding: '6px' },
    large: { width: 20, height: 20, padding: '8px' }
  };

  $: currentSize = sizeConfig[size] || sizeConfig.small;
</script>

<button 
  class="tip-button {size} {disabled ? 'disabled' : ''}"
  on:click={handleClick}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  style="padding: {currentSize.padding}"
  {disabled}
  title={tooltip ? `Send tip to ${recipientName || formatAddress(recipientAddress)}` : ''}
>
  <!-- Tip Icon -->
  <svg 
    width={currentSize.width} 
    height={currentSize.height} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2"
    class="tip-icon"
  >
    <!-- Coin/Money icon -->
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>

  <!-- Alternative: Star tip icon -->
  <!-- 
  <svg 
    width={currentSize.width} 
    height={currentSize.height} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2"
    class="tip-icon"
  >
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"></polygon>
  </svg>
  -->

  <!-- Alternative: Dollar sign icon -->
  <!--
  <svg 
    width={currentSize.width} 
    height={currentSize.height} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2"
    class="tip-icon"
  >
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
  -->

  <!-- Tooltip -->
  {#if showTooltip && tooltip && !disabled}
    <div class="tooltip">
      Send tip
    </div>
  {/if}
</button>

<style>
  .tip-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    opacity: 0.7;
  }

  .tip-button:hover:not(.disabled) {
    color: var(--primary-color, #FF5500);
    background: rgba(255, 85, 0, 0.1);
    opacity: 1;
    transform: scale(1.1);
  }

  .tip-button:active:not(.disabled) {
    transform: scale(0.95);
  }

  .tip-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .tip-button.small {
    min-width: 22px;
    min-height: 22px;
  }

  .tip-button.medium {
    min-width: 28px;
    min-height: 28px;
  }

  .tip-button.large {
    min-width: 36px;
    min-height: 36px;
  }

  .tip-icon {
    transition: all 0.2s ease;
  }

  .tip-button:hover:not(.disabled) .tip-icon {
    stroke-width: 2.5;
  }

  /* Tooltip styles */
  .tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface-color, #262626);
    color: var(--text-color, #ffffff);
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 1;
    animation: tooltipFadeIn 0.2s ease;
    z-index: 1000;
    border: 1px solid var(--border-color, rgba(255, 85, 0, 0.2));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -4px;
    border-width: 4px;
    border-style: solid;
    border-color: var(--surface-color, #262626) transparent transparent transparent;
  }

  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* Context-specific styles */
  .tip-button.in-message {
    color: rgba(255, 255, 255, 0.5);
  }

  .tip-button.in-message:hover:not(.disabled) {
    color: var(--primary-color, #FF5500);
    background: rgba(255, 85, 0, 0.15);
  }

  .tip-button.in-header {
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  .tip-button.in-header:hover:not(.disabled) {
    color: var(--primary-color, #FF5500);
    background: rgba(255, 85, 0, 0.1);
  }

  /* Focus states for accessibility */
  .tip-button:focus:not(.disabled) {
    outline: 2px solid var(--primary-color, #FF5500);
    outline-offset: 2px;
    background: rgba(255, 85, 0, 0.1);
    color: var(--primary-color, #FF5500);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .tip-button,
    .tip-icon,
    .tooltip {
      transition: none;
      animation: none;
    }

    .tip-button:hover:not(.disabled) {
      transform: none;
    }

    .tip-button:active:not(.disabled) {
      transform: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .tip-button {
      border: 1px solid currentColor;
    }

    .tip-button:hover:not(.disabled) {
      border-color: var(--primary-color, #FF5500);
    }
  }

  /* Mobile touch targets */
  @media (pointer: coarse) {
    .tip-button {
      min-width: 32px;
      min-height: 32px;
      padding: 6px;
    }

    .tip-button.small {
      min-width: 32px;
      min-height: 32px;
    }
  }
</style>