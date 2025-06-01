<!-- VoteButtons.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { connected_wallet_address } from '$lib/store/store';
    import { getReputationBadge, getUserReputationScore } from '$lib/components/main/reputationSystem';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let message; // The message being voted on
    export let upvotes = []; // Array of addresses that upvoted
    export let downvotes = []; // Array of addresses that downvoted
    export let score = 0; // Calculated score
    
    // Local state
    $: hasUpvoted = $connected_wallet_address && upvotes && upvotes.includes($connected_wallet_address);
    $: hasDownvoted = $connected_wallet_address && downvotes && downvotes.includes($connected_wallet_address);
    
    // Get reputation badge for sender
    $: senderBadge = message?.sender ? getReputationBadge(message.sender) : null;
    $: senderScore = message?.sender ? getUserReputationScore(message.sender) : 0;
    
    // Format score for display
    $: formattedScore = formatScore(score);
    
    // Handle upvote
    function handleUpvote(event) {
      event.stopPropagation();
      
      if (!$connected_wallet_address) {
        dispatch('showToast', {
          message: 'Please connect your wallet to vote',
          type: 'warning'
        });
        return;
      }
      
      // Create a custom event for voting
      const voteEvent = new CustomEvent('message-vote', {
        detail: { 
          messageId: message.id,
          isUpvote: true,
          voterAddress: $connected_wallet_address,
          messageSender: message.sender
        }
      });
      
      // Dispatch both the event for the message store and a local event
      document.dispatchEvent(voteEvent);
      dispatch('vote', { messageId: message.id, isUpvote: true });
    }
    
    // Handle downvote
    function handleDownvote(event) {
      event.stopPropagation();
      
      if (!$connected_wallet_address) {
        dispatch('showToast', {
          message: 'Please connect your wallet to vote',
          type: 'warning'
        });
        return;
      }
      
      // Create a custom event for voting
      const voteEvent = new CustomEvent('message-vote', {
        detail: { 
          messageId: message.id,
          isUpvote: false,
          voterAddress: $connected_wallet_address,
          messageSender: message.sender
        }
      });
      
      // Dispatch both the event for the message store and a local event
      document.dispatchEvent(voteEvent);
      dispatch('vote', { messageId: message.id, isUpvote: false });
    }
    
    // Format score as +X or -X
    function formatScore(score) {
      if (score === 0) return "0";
      return score > 0 ? `+${score}` : `${score}`;
    }
  </script>
  
  <div class="vote-controls">
    <!-- Reputation Badge if available -->
    {#if senderBadge}
      <div class="reputation-badge" style="color: {senderBadge.color}" title="{senderBadge.tier} ({senderScore} points)">
        {senderBadge.icon}
      </div>
    {/if}
    
    <!-- Vote buttons -->
    <div class="vote-buttons">
      <button 
        class="vote-button upvote {hasUpvoted ? 'active' : ''}" 
        on:click={handleUpvote}
        title="Upvote this message"
      >
        <i class="fa-solid fa-arrow-up"></i>
      </button>
      
      <span class="vote-score {score > 0 ? 'positive' : score < 0 ? 'negative' : ''}">
        {formattedScore}
      </span>
      
      <button 
        class="vote-button downvote {hasDownvoted ? 'active' : ''}" 
        on:click={handleDownvote}
        title="Downvote this message"
      >
        <i class="fa-solid fa-arrow-down"></i>
      </button>
    </div>
  </div>
  
  <style>
    .vote-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      font-size: 0.85rem;
    }
    
    .reputation-badge {
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .vote-buttons {
      display: flex;
      align-items: center;
      background-color: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .vote-button {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      width: 2rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .vote-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .vote-button.upvote.active {
      color: #00CC88;
    }
    
    .vote-button.downvote.active {
      color: #FF5555;
    }
    
    .vote-score {
      min-width: 1.5rem;
      text-align: center;
      font-weight: 500;
    }
    
    .vote-score.positive {
      color: #00CC88;
    }
    
    .vote-score.negative {
      color: #FF5555;
    }
  </style>