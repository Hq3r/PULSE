<!-- ErrorBar.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';

  export let error = "";

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }
</script>

{#if error}
  <div class="error-bar" transition:slide={{ duration: 200 }}>
    <div class="error-content">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span>{error}</span>
    </div>
    <button class="error-close" on:click={handleClose}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
{/if}

<style>
  .error-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: white;
    border-bottom: 1px solid rgba(220, 53, 69, 0.3);
    position: relative;
    z-index: 50;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .error-content span {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    word-break: break-word;
  }

  .error-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-left: 12px;
  }

  .error-close:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  /* Different error types */
  .error-bar.warning {
    background: linear-gradient(135deg, #ffc107, #e0a800);
    color: #000;
  }

  .error-bar.info {
    background: linear-gradient(135deg, #17a2b8, #138496);
    color: white;
  }

  .error-bar.success {
    background: linear-gradient(135deg, #28a745, #1e7e34);
    color: white;
  }

  /* Animation for attention */
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }

  .error-bar {
    animation: shake 0.5s ease-in-out;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .error-bar {
      padding: 10px 16px;
    }

    .error-content {
      gap: 8px;
    }

    .error-content span {
      font-size: 13px;
    }

    .error-close {
      margin-left: 8px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .error-bar {
      border: 2px solid #dc3545;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .error-bar {
      animation: none;
    }
  }
</style>