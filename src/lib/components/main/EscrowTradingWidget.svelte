<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import {
        selected_wallet_ergo,
        connected_wallet_address,
        connected_wallet_balance,
        utxosLoading,
        fetchUtxos
    } from '$lib/store/store';
    import {
        ESCROW_CONTRACT,
        OFFERS_ESCROW_CONTRACT,
        DEV_PK,
        ASSETS
    } from '$lib/common/const';
    import {
        nFormatter,
        showCustomToast,
        getCommonBoxIds,
        truncateAddress,
        sleep
    } from '$lib/utils/utils';
    import { fetchBoxes, getBlockHeight, updateTempBoxes } from '$lib/api-explorer/explorer';
    import ErgopayModal from '$lib/components/common/ErgopayModal.svelte';
    import { buyTx } from '$lib/contract/buyTx';
    import axios from 'axios';
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let visible = false;
    export let currentUserAddress = '';
    export let otherUserAddress = '';
    export let otherUserName = '';
    export let walletConnected = false;
    
    // Component state
    let loading = false;
    let processing = false;
    let escrows = [];
    let selectedEscrow = null;
    let error = '';
    let imageCache = new Map(); // Cache for asset images
    
    // Reactive statements
    $: if (visible && currentUserAddress && otherUserAddress) {
        loadEscrows();
    }
    
    // Clean address helper
    function cleanAddress(address) {
        if (!address) return '';
        if (address.startsWith('3') && address.length > 50) {
            return address.substring(1);
        }
        return address;
    }
    
    // Get asset image URL with fallback
    function getAssetImageUrl(asset) {
        if (!asset) return 'https://via.placeholder.com/80x80/333/fff?text=NFT';
        
        const cacheKey = asset.tokenId || asset.name;
        if (imageCache.has(cacheKey)) {
            return imageCache.get(cacheKey);
        }
        
        // Try different image sources in order of preference
        let imageUrl = 'https://via.placeholder.com/80x80/333/fff?text=NFT';
        
        if (asset.imageLink) {
            imageUrl = asset.imageLink;
        } else if (asset.thumbnail) {
            imageUrl = asset.thumbnail;
        } else if (asset.iconurl) {
            imageUrl = asset.iconurl;
        } else if (asset.cachedurl) {
            imageUrl = asset.cachedurl;
        } else if (asset.tokenId) {
            // Try to get image from token registry
            imageUrl = `https://api.ergoplatform.com/tokens/${asset.tokenId}/image`;
        }
        
        imageCache.set(cacheKey, imageUrl);
        return imageUrl;
    }
    
    // Handle image error with fallback
    function handleImageError(event, asset) {
        const fallbackUrl = 'https://via.placeholder.com/80x80/333/fff?text=' + 
                           encodeURIComponent(asset?.name?.substring(0, 3).toUpperCase() || 'NFT');
        event.target.src = fallbackUrl;
        
        // Update cache with fallback
        const cacheKey = asset?.tokenId || asset?.name;
        if (cacheKey) {
            imageCache.set(cacheKey, fallbackUrl);
        }
    }
    
    // Load escrows for both users
    async function loadEscrows() {
        if (!currentUserAddress || !otherUserAddress) return;
        
        loading = true;
        error = '';
        escrows = [];
        
        try {
            const cleanCurrentUser = cleanAddress(currentUserAddress);
            const cleanOtherUser = cleanAddress(otherUserAddress);
            
            console.log('Loading escrows for:', {
                currentUser: cleanCurrentUser,
                otherUser: cleanOtherUser
            });
            
            // Fetch all escrows involving both users (including completed ones)
            const [buyerEscrowsResponse, sellerEscrowsResponse, soldEscrowsResponse] = await Promise.all([
                // Current user as buyer (active escrows)
                axios.get(
                    `https://api.mewfinance.com/mart/getOrders?contract[]=1497470166&contract[]=1074363005&contract[]=3534619052&contract[]=1777493708&offset=0&limit=30&status=Order&buyer=${cleanCurrentUser}`
                ),
                // Current user as seller (active escrows)  
                axios.get(
                    `https://api.mewfinance.com/mart/getOrders?contract[]=1497470166&contract[]=1074363005&contract[]=3534619052&contract[]=1777493708&offset=0&limit=30&status=Order&buyer=${cleanOtherUser}`
                ),
                // Completed/sold escrows involving both users
                axios.get(
                    `https://api.mewfinance.com/mart/getOrders?contract[]=1497470166&contract[]=1074363005&contract[]=3534619052&contract[]=1777493708&offset=0&limit=50&status=Sold`
                )
            ]);
            
            console.log('API Responses:', {
                buyerEscrows: buyerEscrowsResponse.data,
                sellerEscrows: sellerEscrowsResponse.data,
                soldEscrows: soldEscrowsResponse.data
            });
            
            const allEscrows = [];
            
            // Process active escrows where current user is buyer
            if (buyerEscrowsResponse.data.items) {
                for (const escrow of buyerEscrowsResponse.data.items) {
                    if (cleanAddress(escrow.seller) === cleanOtherUser) {
                        allEscrows.push({
                            ...escrow,
                            role: 'buyer',
                            canExecute: true,
                            title: `Available to Buy from ${otherUserName}`,
                            description: `Complete this purchase on MEW Finance marketplace`,
                            status: 'active',
                            marketplaceUrl: `https://mart.mewfinance.com/profile`
                        });
                    }
                }
            }
            
            // Process active escrows where current user is seller
            if (sellerEscrowsResponse.data.items) {
                for (const escrow of sellerEscrowsResponse.data.items) {
                    if (cleanAddress(escrow.seller) === cleanCurrentUser) {
                        allEscrows.push({
                            ...escrow,
                            role: 'seller',
                            canExecute: false,
                            title: `Waiting for ${otherUserName} to Buy`,
                            description: `${otherUserName} can complete this purchase on MEW Finance marketplace`,
                            status: 'active',
                            marketplaceUrl: `https://mart.mewfinance.com/profile`
                        });
                    }
                }
            }
            
            // Process completed/sold escrows
            if (soldEscrowsResponse.data.items) {
                for (const escrow of soldEscrowsResponse.data.items) {
                    const isBuyer = cleanAddress(escrow.buyer) === cleanCurrentUser;
                    const isSeller = cleanAddress(escrow.seller) === cleanCurrentUser;
                    const otherParty = isBuyer ? cleanAddress(escrow.seller) : cleanAddress(escrow.buyer);
                    
                    // Only include if the other party matches our conversation partner
                    if (otherParty === cleanOtherUser && (isBuyer || isSeller)) {
                        allEscrows.push({
                            ...escrow,
                            role: isBuyer ? 'buyer' : 'seller',
                            canExecute: false,
                            title: isBuyer ? `Purchased from ${otherUserName}` : `Sold to ${otherUserName}`,
                            description: isBuyer 
                                ? `You successfully bought these assets from ${otherUserName}`
                                : `You successfully sold these assets to ${otherUserName}`,
                            status: 'completed',
                            completedAt: escrow.buytime || escrow.timestamp,
                            marketplaceUrl: `https://mart.mewfinance.com/profile`
                        });
                    }
                }
            }
            
            // Sort by timestamp (newest first), with active escrows on top
            escrows = allEscrows.sort((a, b) => {
                // Active escrows first
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (b.status === 'active' && a.status !== 'active') return 1;
                
                // Then by timestamp
                const aTime = new Date(a.completedAt || a.timestamp).getTime();
                const bTime = new Date(b.completedAt || b.timestamp).getTime();
                return bTime - aTime;
            });
            
            console.log('Filtered and sorted escrows:', escrows);
            
        } catch (err) {
            console.error('Error loading escrows:', err);
            error = 'Failed to load escrows';
        } finally {
            loading = false;
        }
    }
    
    // Redirect to marketplace with disclaimer
    function goToMarketplace(escrow) {
        // Show disclaimer toast
        showCustomToast(
            `🛍️ <strong>Complete Your Purchase</strong><br>
            Redirecting to MEW Finance marketplace to finalize this escrow trade.<br>
            <small>You'll be able to complete the transaction securely on their platform.</small>`,
            7000,
            'info'
        );
        
        // Wait a moment then open marketplace
        setTimeout(() => {
            window.open(escrow.marketplaceUrl, '_blank', 'noopener,noreferrer');
        }, 1500);
    }
    
    // Format asset display with enhanced info
    function formatAssets(assets) {
        if (!assets || assets.length === 0) return 'No assets';
        
        return assets.map(asset => {
            const amount = asset.amount || 1;
            const name = asset.name || `Token ${asset.tokenId?.substring(0, 8)}...`;
            return `${amount} ${name}`;
        }).join(', ');
    }
    
    // Get primary asset for display (first asset or most valuable)
    function getPrimaryAsset(assets) {
        if (!assets || assets.length === 0) return null;
        
        // Return first asset for now, could be enhanced to find most valuable
        return assets[0];
    }
    
    // Format payment amount
    function formatPayment(amount, asset) {
        if (asset === 'ERG') {
            return `${nFormatter(amount)} ERG`;
        }
        
        const assetInfo = ASSETS.find(a => a.tokenId === asset || a.name === asset);
        return `${nFormatter(amount)} ${assetInfo?.name || asset}`;
    }
    
    // Get escrow category/type for display
    function getEscrowCategory(escrow) {
        if (!escrow.assets || escrow.assets.length === 0) return 'Digital Asset';
        
        const primaryAsset = escrow.assets[0];
        if (primaryAsset.name?.toLowerCase().includes('nft')) return 'NFT';
        if (primaryAsset.name?.toLowerCase().includes('token')) return 'Token';
        if (primaryAsset.royaltypercent > 0) return 'NFT';
        
        return 'Digital Asset';
    }
    
    // Format time ago
    function timeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);
        
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        
        const diffInDays = Math.floor(diffInSeconds / 86400);
        if (diffInDays < 30) return `${diffInDays}d ago`;
        
        return time.toLocaleDateString();
    }
    
    // Close widget
    function closeWidget() {
        dispatch('close');
    }
    
    onMount(() => {
        if (visible) {
            loadEscrows();
        }
    });
</script>

{#if visible}
<div class="escrow-widget-overlay" transition:fade={{ duration: 200 }}>
    <div class="escrow-widget" transition:slide={{ duration: 300 }}>
        <!-- Widget Header -->
        <div class="widget-header">
            <div class="header-content">
                <i class="fa-solid fa-handshake"></i>
                <div class="header-text">
                    <h3>🛍️ Marketplace Trades</h3>
                    <p>Available escrow trades with {otherUserName}</p>
                </div>
            </div>
            <button class="close-btn" on:click={closeWidget}>
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        
        <!-- Widget Body -->
        <div class="widget-body">
            {#if loading}
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Loading marketplace trades...</p>
                </div>
            {:else if error}
                <div class="error-container">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>{error}</p>
                    <button class="retry-btn" on:click={loadEscrows}>
                        <i class="fa-solid fa-redo"></i>
                        Retry
                    </button>
                </div>
            {:else if escrows.length === 0}
                <div class="empty-container">
                    <i class="fa-solid fa-store"></i>
                    <h4>No Marketplace Trades</h4>
                    <p>No escrow trades found between you and {otherUserName}</p>
                    <div class="empty-actions">
                        <button class="refresh-btn" on:click={loadEscrows}>
                            <i class="fa-solid fa-refresh"></i>
                            Refresh
                        </button>
                        <button class="refresh-btn" on:click={() => window.open('https://mart.mewfinance.com/profile', '_blank')}>
                            <i class="fa-solid fa-external-link-alt"></i>
                            Visit Marketplace
                        </button>
                    </div>
                </div>
            {:else}
                <div class="escrows-grid">
                    {#each escrows as escrow (escrow.id)}
                        <div class="escrow-card {escrow.role} {escrow.status}" transition:slide={{ duration: 200 }}>
                            <!-- Asset Image -->
                           
                                {#if escrow.assets && escrow.assets.length > 0}
                                   
                                    {#if escrow.assets.length > 1}
                                        <div class="asset-count-badge">
                                            <i class="fa-solid fa-layer-group"></i>
                                            {escrow.assets.length}
                                        </div>
                                    {/if}
                                {:else}
                                    <div class="asset-placeholder">
                                        <i class="fa-solid fa-image"></i>
                                    </div>
                                {/if}
                                
                            
                            
                            
                            <!-- Card Content -->
                            <div class="card-content">
                                <div class="card-header">
                                    <h4 class="card-title">{escrow.title}</h4>
                                    <div class="card-badges">
                                        <span class="role-badge {escrow.role}">
                                            {escrow.role === 'buyer' ? 'You Buy' : 'You Sell'}
                                        </span>
                                        <span class="category-badge">
                                            {getEscrowCategory(escrow)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="asset-details">
                                    <div class="asset-name">
                                        {formatAssets(escrow.assets)}
                                    </div>
                                    <div class="asset-description">
                                        {escrow.description}
                                    </div>
                                </div>
                                
                                <div class="price-section">
                                    <div class="price-main">
                                        {formatPayment(escrow.payamount, escrow.payasset)}
                                    </div>
                                    {#if escrow.usdamount > 0}
                                        <div class="price-usd">
                                            ≈ ${nFormatter(escrow.usdamount)} USD
                                        </div>
                                    {/if}
                                </div>
                                
                                <div class="card-meta">
                                    <div class="meta-item">
                                        <i class="fa-solid fa-calendar"></i>
                                        <span>
                                            {#if escrow.status === 'completed' && escrow.completedAt}
                                                Completed {timeAgo(escrow.completedAt)}
                                            {:else}
                                                Created {timeAgo(escrow.timestamp)}
                                            {/if}
                                        </span>
                                    </div>
                                    {#if escrow.txidout}
                                        <button 
                                            class="meta-link"
                                            title="View transaction"
                                            on:click={() => window.open(`https://explorer.ergoplatform.com/en/transactions/${escrow.txidout}`, '_blank')}
                                        >
                                            <i class="fa-solid fa-external-link-alt"></i>
                                            View TX
                                        </button>
                                    {/if}
                                </div>
                            </div>
                            
                            <!-- Card Actions -->
                            <div class="card-actions">
                                {#if escrow.status === 'completed'}
                                    <button class="action-btn completed" disabled>
                                        <i class="fa-solid fa-check-circle"></i>
                                        Trade Completed
                                    </button>
                                {:else if escrow.canExecute}
                                    <button 
                                        class="action-btn primary"
                                        on:click={() => goToMarketplace(escrow)}
                                    >
                                        <i class="fa-solid fa-external-link-alt"></i>
                                        Complete on Marketplace
                                    </button>
                                    
                                    <div class="disclaimer">
                                        <i class="fa-solid fa-info-circle"></i>
                                        <span>Complete this purchase securely on MEW Finance marketplace</span>
                                    </div>
                                {:else}
                                    <button class="action-btn waiting" disabled>
                                        <i class="fa-solid fa-clock"></i>
                                        Waiting for {otherUserName}
                                    </button>
                                    
                                    <button 
                                        class="action-btn secondary"
                                        on:click={() => goToMarketplace(escrow)}
                                    >
                                        <i class="fa-solid fa-external-link-alt"></i>
                                        View on Marketplace
                                    </button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
        
        <!-- Widget Footer -->
        <div class="widget-footer">
            <button class="refresh-all-btn" on:click={loadEscrows} disabled={loading}>
                <i class="fa-solid fa-refresh {loading ? 'spinning' : ''}"></i>
                Refresh Trades
            </button>
            
            <button class="refresh-all-btn" on:click={() => window.open('https://mart.mewfinance.com/profile', '_blank')}>
                <i class="fa-solid fa-external-link-alt"></i>
                Visit MEW Finance
            </button>
        </div>
    </div>
</div>
{/if}

<style>
/* Base Styles */
.escrow-widget-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2100;
    padding: 20px;
}

.escrow-widget {
    background-color: #1a1a1a;
    border-radius: 12px;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 85, 0, 0.2);
    overflow: hidden;
}

/* Header */
.widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(135deg, rgba(255, 85, 0, 0.1), rgba(255, 85, 0, 0.05));
}

.header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-content i {
    font-size: 1.5rem;
    color: #FF5500;
}

.header-text h3 {
    margin: 0;
    color: white;
    font-size: 1.3rem;
    font-weight: 600;
}

.header-text p {
    margin: 0.25rem 0 0 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
}

.close-btn {
    background: none;
    border: none;
    color: #AAA;
    cursor: pointer;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: 1.1rem;
}

.close-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
}

/* Body */
.widget-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
}

/* Loading/Error/Empty States */
.loading-container,
.error-container,
.empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 85, 0, 0.3);
    border-top-color: #FF5500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

.error-container i,
.empty-container i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #666;
}

.empty-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
}

.retry-btn,
.refresh-btn,
.marketplace-btn {
    background: rgba(255, 85, 0, 0.2);
    color: #FF5500;
    border: 1px solid rgba(255, 85, 0, 0.3);
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
}

.retry-btn:hover,
.refresh-btn:hover,
.marketplace-btn:hover {
    background: rgba(255, 85, 0, 0.3);
}

/* Escrows Grid */
.escrows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
}

/* Escrow Cards */
.escrow-card {
    background: #262626;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
}

.escrow-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 85, 0, 0.5);
    box-shadow: 0 8px 32px rgba(255, 85, 0, 0.2);
}

.escrow-card.buyer {
    border-left: 3px solid #4CAF50;
}

.escrow-card.seller {
    border-left: 3px solid #FF9800;
}

.escrow-card.completed {
    border-left: 3px solidrgb(91, 238, 6)
}

/* Asset Preview */
.asset-preview {
    position: relative;
    height: 200px;
    background: linear-gradient(135deg, #333, #444);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.asset-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s ease;
}

.escrow-card:hover .asset-image {
    transform: scale(1.05);
}

.asset-placeholder {
    color: #666;
    font-size: 2rem;
}

.asset-count-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.status-badge-overlay {
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    text-transform: uppercase;
}

.status-badge-overlay.active {
    background: rgba(76, 175, 80, 0.9);
    color: white;
}

.status-badge-overlay.completed {
    background: rgba(33, 150, 243, 0.9);
    color: white;
}

/* Card Content */
.card-content {
    padding: 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.card-header {
    margin-bottom: 1rem;
}

.card-title {
    margin: 0 0 0.5rem 0;
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.3;
}

.card-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.role-badge,
.category-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
}

.role-badge.buyer {
    background: rgba(76, 175, 80, 0.2);
    color: #4CAF50;
}

.role-badge.seller {
    background: rgba(255, 152, 0, 0.2);
    color: #FF9800;
}

.category-badge {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
}

.asset-details {
    margin-bottom: 1rem;
}

.asset-name {
    color: white;
    font-weight: 600;
    margin-bottom: 0.5rem;
    line-height: 1.3;
}

.asset-description {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    line-height: 1.4;
}

.price-section {
    margin-bottom: 1rem;
    padding: 1rem;
    background: rgba(255, 85, 0, 0.1);
    border-radius: 8px;
    border-left: 3px solid #FF5500;
}

.price-main {
    color: #FF5500;
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
}

.price-usd {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
}

.card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.8rem;
}

.meta-item i {
    color: #FF5500;
}

.meta-link {
    background: none;
    border: none;
    color: #FF5500;
    cursor: pointer;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: color 0.2s ease;
}

.meta-link:hover {
    color: #ff7f39;
}

/* Card Actions */
.card-actions {
    padding: 1rem 1.5rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);
}

.action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.action-btn.primary {
    background: linear-gradient(135deg, #FF5500, #ff7f39);
    color: white;
}

.action-btn.primary:hover {
    background: linear-gradient(135deg, #ff7f39, #FF5500);
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(255, 85, 0, 0.3);
}

.action-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.action-btn.waiting {
    background: rgba(255, 152, 0, 0.2);
    color: #FF9800;
    cursor: not-allowed;
    opacity: 0.7;
}

.action-btn.completed {
   background: rgb(205, 72, 6);
  color: #F6FBFF;
  cursor: not-allowed
}

.disclaimer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
    line-height: 1.3;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border-left: 3px solid #FF5500;
}

.disclaimer i {
    color: #FF5500;
    flex-shrink: 0;
}

/* Footer */
.widget-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    gap: 1rem;
}

.refresh-all-btn,
.marketplace-link-btn {
    flex: 1;
    background: rgba(255, 85, 0, 0.1);
    color: #FF5500;
    border: 1px solid rgba(255, 85, 0, 0.3);
    border-radius: 6px;
    padding: 0.75rem;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.refresh-all-btn:hover:not(:disabled),
.marketplace-link-btn:hover {
    background: rgba(255, 85, 0, 0.2);
}

.refresh-all-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.marketplace-link-btn {
    background: rgba(33, 150, 243, 0.1);
    color: #2196F3;
    border-color: rgba(33, 150, 243, 0.3);
}

.marketplace-link-btn:hover {
    background: rgba(33, 150, 243, 0.2);
}

/* Animations */
.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 768px) {
    .escrow-widget-overlay {
        padding: 10px;
    }
    
    .escrow-widget {
        max-height: 95vh;
    }
    
    .widget-header {
        padding: 1rem;
    }
    
    .header-text h3 {
        font-size: 1.1rem;
    }
    
    .widget-body {
        padding: 1rem;
    }
    
    .escrows-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    .asset-preview {
        height: 160px;
    }
    
    .card-content {
        padding: 1rem;
    }
    
    .card-actions {
        padding: 1rem;
    }
    
    .widget-footer {
        flex-direction: column;
        padding: 1rem;
    }
    
    .empty-actions {
        flex-direction: column;
        align-items: center;
    }
}

@media (max-width: 480px) {
    .escrow-widget {
        margin: 5px;
    }
    
    .widget-header {
        padding: 0.75rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .header-text h3 {
        font-size: 1rem;
    }
    
    .asset-preview {
        height: 140px;
    }
    
    .card-title {
        font-size: 1rem;
    }
    
    .price-main {
        font-size: 1.1rem;
    }
    
    .card-badges {
        gap: 0.25rem;
    }
    
    .role-badge,
    .category-badge {
        font-size: 0.65rem;
        padding: 0.15rem 0.5rem;
    }
    
    .card-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
}
</style>