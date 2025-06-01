// reputationSystem.js - Core reputation system functionality
import { writable } from 'svelte/store';

// Reputation tiers with increasing privileges
export const ReputationTier = {
  NEWCOMER: "newcomer",     // 0-9 points
  REGULAR: "regular",       // 10-49 points
  RESPECTED: "respected",   // 50-99 points
  TRUSTED: "trusted",       // 100-199 points
  CORE: "core"              // 200+ points
};

// Reputation tier benefits
export const TIER_BENEFITS = {
  [ReputationTier.NEWCOMER]: {
    description: "New community member",
    voteWeight: 1,
    specialEmojis: false,
    canCreateRooms: false
  },
  [ReputationTier.REGULAR]: {
    description: "Regular community member",
    voteWeight: 1,
    specialEmojis: true,
    canCreateRooms: false
  },
  [ReputationTier.RESPECTED]: {
    description: "Respected community member",
    voteWeight: 1.5,
    specialEmojis: true,
    canCreateRooms: true
  },
  [ReputationTier.TRUSTED]: {
    description: "Trusted community member",
    voteWeight: 2,
    specialEmojis: true,
    canCreateRooms: true,
    canModerate: true
  },
  [ReputationTier.CORE]: {
    description: "Core community member",
    voteWeight: 3,
    specialEmojis: true,
    canCreateRooms: true,
    canModerate: true,
    canCreatePolls: true
  }
};

// Svelte store for reputation data
export const userReputationStore = writable(new Map());

/**
 * Initialize the reputation system
 * Load stored reputations from localStorage
 */
export function initReputationSystem() {
  try {
    // Load reputation data from localStorage
    const reputationData = localStorage.getItem('ergoChat_reputations');
    
    if (reputationData) {
      // Convert JSON to Map
      const reputationMap = new Map(Object.entries(JSON.parse(reputationData)));
      userReputationStore.set(reputationMap);
    }
    
    // Initialize message handlers for votes
    initMessageVoteHandlers();
  } catch (error) {
    console.error("Error initializing reputation system:", error);
  }
}

/**
 * Save reputation data to localStorage
 */
function saveReputationData() {
  try {
    userReputationStore.update(reputations => {
      // Convert Map to Object for localStorage
      const reputationObj = Object.fromEntries(reputations);
      localStorage.setItem('ergoChat_reputations', JSON.stringify(reputationObj));
      return reputations;
    });
  } catch (error) {
    console.error("Error saving reputation data:", error);
  }
}

/**
 * Update a user's reputation score based on votes received
 */
function updateUserReputation(messageId, isUpvote, voterAddress, messageSender) {
  if (!messageSender) return; // Message sender not provided
  
  // Skip if voting on own message
  if (voterAddress === messageSender) return;
  
  // Get the voter's reputation to determine their vote weight
  userReputationStore.update(reputations => {
    let voterWeight = 1; // Default weight is 1
    
    // Get voter's reputation if available
    if (reputations.has(voterAddress)) {
      const voterRep = reputations.get(voterAddress);
      const tier = voterRep.tier;
      voterWeight = TIER_BENEFITS[tier].voteWeight;
    }
    
    // Get or initialize recipient's reputation
    let recipientRep = reputations.get(messageSender) || {
      address: messageSender,
      score: 0,
      totalUpvotes: 0,
      totalDownvotes: 0,
      lastUpdated: Date.now(),
      tier: ReputationTier.NEWCOMER
    };
    
    // Update the score
    const pointValue = 0.1 * voterWeight; // Base value * voter weight
    
    if (isUpvote) {
      recipientRep.score += pointValue;
      recipientRep.totalUpvotes += 1;
    } else {
      recipientRep.score -= pointValue;
      recipientRep.totalDownvotes += 1;
    }
    
    // Update tier based on new score
    if (recipientRep.score >= 200) {
      recipientRep.tier = ReputationTier.CORE;
    } else if (recipientRep.score >= 100) {
      recipientRep.tier = ReputationTier.TRUSTED;
    } else if (recipientRep.score >= 50) {
      recipientRep.tier = ReputationTier.RESPECTED;
    } else if (recipientRep.score >= 10) {
      recipientRep.tier = ReputationTier.REGULAR;
    } else {
      recipientRep.tier = ReputationTier.NEWCOMER;
    }
    
    recipientRep.lastUpdated = Date.now();
    
    // Update the store
    reputations.set(messageSender, recipientRep);
    
    // Save to localStorage
    saveReputationData();
    
    return reputations;
  });
}

/**
 * Process a vote on a message
 */
export function processVote(messageId, voterAddress, isUpvote, messageSender) {
  // Update user reputation
  updateUserReputation(messageId, isUpvote, voterAddress, messageSender);
}

/**
 * Initialize event handlers for message votes
 */
function initMessageVoteHandlers() {
  // Listen for vote events
  document.addEventListener('message-vote', (event) => {
    const { messageId, isUpvote, messageSender } = event.detail;
    
    // Process the vote (update reputation)
    processVote(messageId, event.detail.voterAddress, isUpvote, messageSender);
  });
}

/**
 * Get a user's reputation tier badge
 */
export function getReputationBadge(address) {
  let reputation = null;
  
  // Get the user's reputation
  userReputationStore.subscribe(reputations => {
    reputation = reputations.get(address);
  })();
  
  if (!reputation) {
    return {
      tier: ReputationTier.NEWCOMER,
      icon: '🌱',
      color: '#aaaaaa',
      benefits: TIER_BENEFITS[ReputationTier.NEWCOMER]
    };
  }
  
  // Return badge based on tier
  switch (reputation.tier) {
    case ReputationTier.CORE:
      return {
        tier: ReputationTier.CORE,
        icon: '⭐',
        color: '#FFD700',
        benefits: TIER_BENEFITS[ReputationTier.CORE]
      };
    case ReputationTier.TRUSTED:
      return {
        tier: ReputationTier.TRUSTED,
        icon: '🔷',
        color: '#0088FF',
        benefits: TIER_BENEFITS[ReputationTier.TRUSTED]
      };
    case ReputationTier.RESPECTED:
      return {
        tier: ReputationTier.RESPECTED,
        icon: '🟢',
        color: '#00CC88',
        benefits: TIER_BENEFITS[ReputationTier.RESPECTED]
      };
    case ReputationTier.REGULAR:
      return {
        tier: ReputationTier.REGULAR,
        icon: '🔵',
        color: '#6666FF',
        benefits: TIER_BENEFITS[ReputationTier.REGULAR]
      };
    default:
      return {
        tier: ReputationTier.NEWCOMER,
        icon: '🌱',
        color: '#aaaaaa',
        benefits: TIER_BENEFITS[ReputationTier.NEWCOMER]
      };
  }
}

/**
 * Get user's reputation score 
 */
export function getUserReputationScore(address) {
  let reputation = null;
  
  // Get the user's reputation
  userReputationStore.subscribe(reputations => {
    reputation = reputations.get(address);
  })();
  
  if (!reputation) {
    return 0;
  }
  
  return reputation.score;
}