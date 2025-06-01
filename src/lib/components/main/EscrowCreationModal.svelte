<!-- EscrowCreationModal.svelte - Modal for creating escrow transactions between inbox users -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import {
        selected_wallet_ergo,
        connected_wallet_address,
        connected_wallet_balance,
        utxosLoading,
        utxosAssets,
        utxosTokenInfos,
        fetchUtxos
    } from '$lib/store/store';
    import {
        ESCROW_CONTRACT,
        DEV_PK,
        ASSETS,
        CATEGORIES,
        MAX_BUNDLE_ASSETS,
        TOKEN_RESTICTIONS
    } from '$lib/common/const';
    import { escrowSellTx } from '$lib/contract/escrowSellTx';
    import {
        nFormatter,
        showCustomToast,
        getImageUrl,
        setPlaceholderImage,
        getCommonBoxIds,
        truncateAddress,
        sleep
    } from '$lib/utils/utils';
    import { fetchBoxes, getBlockHeight, updateTempBoxes } from '$lib/api-explorer/explorer';
    import ErgopayModal from '$lib/components/common/ErgopayModal.svelte';
    import axios from 'axios';
    import { get } from 'svelte/store';
    
    // FIXED: Completely removed JSONbig and BigNumber imports to avoid Vercel build issues
    // We'll use native JavaScript numbers and BigInt instead
    
    const dispatch = createEventDispatcher();
    
    // Props
    export let visible = false;
    export let escrowData = {
        buyerAddress: '',
        sellerAddress: '',
        buyerName: '',
        sellerName: '',
        initiatedBy: 'buyer'
    };
    export let walletConnected = false;
    export let currentUserAddress = '';
    
    // Component state
    let processing = false;
    let assetsLoading = false;
    let assets = [];
    let selectedAssets = [];
    let additionalAssets = [];
    let additionalAssetsFiltered = [];
    let search = '';
    let priceInToken = undefined;
    let selectedToken = ASSETS[0];
    let selectedCategory = '';
    let showErgopayModal = false;
    let isAuth = false;
    let unsignedTx = null;
    let imageUrls = [];
    let selectedTokenId;
    
    // Reactive statements
    $: filterAssets(search);
    $: isInitiatorBuyer = escrowData.initiatedBy === 'buyer';
    $: otherPartyRole = isInitiatorBuyer ? 'seller' : 'buyer';
    $: otherPartyName = isInitiatorBuyer ? escrowData.sellerName : escrowData.buyerName;
    $: otherPartyAddress = isInitiatorBuyer ? escrowData.sellerAddress : escrowData.buyerAddress;
    
    // FIXED: Safe JSON serialization function that handles BigInt and complex types
    function safeJsonCopy(obj) {
        try {
            return JSON.parse(JSON.stringify(obj, (key, value) => {
                // Convert BigInt to string for serialization
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                // Handle other potentially problematic types
                return value;
            }));
        } catch (error) {
            console.warn('Error in safe JSON copy, falling back to shallow copy:', error);
            // Fallback to shallow copy if JSON serialization fails
            if (Array.isArray(obj)) {
                return obj.map(item => ({ ...item }));
            }
            return { ...obj };
        }
    }
    
    function filterAssets(search) {
        search = search.toLowerCase();
        additionalAssetsFiltered = additionalAssets.filter((asset) => {
            if (asset.name) {
                return asset.name.toLowerCase().includes(search);
            } else {
                return asset.tokenId.includes(search);
            }
        });
    }
    
    async function loadWalletBoxes(wallet, forceFresh = false) {
        assetsLoading = true;
        
        if (forceFresh) {
            await fetchUtxos(wallet);
        }
        
        let utxosReady = !get(utxosLoading);
        
        if (!utxosReady) {
            do {
                await sleep(100);
                utxosReady = !get(utxosLoading);
            } while (!utxosReady);
        }
        
        if ($selected_wallet_ergo) {
            // FIXED: Use safe copying instead of JSONbig to avoid BigNumber issues
            const rawAssets = get(utxosAssets);
            assets = safeJsonCopy(rawAssets);
            
            // Ensure all amounts are proper numbers
            assets = assets.map(asset => ({
                ...asset,
                amount: typeof asset.amount === 'string' ? asset.amount : String(asset.amount)
            }));
            
            const tokenInfos = get(utxosTokenInfos);
            
            for (const asset of assets) {
                const tokenInfo = tokenInfos.find((info) => info.id === asset.tokenId);
                
                if (tokenInfo) {
                    asset.name = tokenInfo.name;
                    asset.decimals = tokenInfo.decimals;
                    
                    // FIXED: Safe number conversion
                    try {
                        const amountNum = typeof asset.amount === 'bigint' ? Number(asset.amount) : 
                                         typeof asset.amount === 'string' ? parseFloat(asset.amount) : 
                                         Number(asset.amount);
                        asset.displayAmount = amountNum / Math.pow(10, asset.decimals);
                    } catch (error) {
                        console.warn('Error converting amount for asset:', asset.tokenId, error);
                        asset.displayAmount = 0;
                    }
                    
                    asset.royaltypercent = tokenInfo.royaltypercent;
                    asset.minValue = asset.decimals == 0 ? 1 : 1 / Math.pow(10, asset.decimals);
                } else {
                    await axios.get(`https://api.ergexplorer.com/tokens/updateSingle?id=${asset.tokenId}`);
                    await loadWalletBoxes($connected_wallet_address, true);
                    return;
                }
                
                asset.imageLink = tokenInfo.cachedurl;
                asset.nsfw = tokenInfo.nsfw;
                asset.scam = tokenInfo.scam;
                
                if (tokenInfo.iconurl) {
                    asset.imageLink = tokenInfo.iconurl;
                }
                
                // Check token restrictions
                for (const restrictedToken of TOKEN_RESTICTIONS) {
                    if (restrictedToken.tokenid == asset.tokenId) {
                        let found = false;
                        for (const whitelistAddress of restrictedToken.addresses) {
                            if (whitelistAddress == $connected_wallet_address) {
                                found = true;
                                break;
                            }
                        }
                        
                        if (!found) {
                            asset.restricted = true;
                        }
                    }
                }
            }
            
            // Add ERG
            const ergBalance = $connected_wallet_balance;
            const ergDisplayAmount = typeof ergBalance === 'bigint' ? Number(ergBalance) / 1000000000 :
                                    typeof ergBalance === 'string' ? parseFloat(ergBalance) / 1000000000 :
                                    Number(ergBalance) / 1000000000;
            
            assets.unshift({
                tokenId: 'erg',
                name: 'ERG',
                decimals: 9,
                amount: String(ergBalance),
                displayAmount: ergDisplayAmount,
                minValue: 0.1,
                imageLink: 'https://ergexplorer.com/images/logo-new.png',
                royaltypercent: 0
            });
            
            additionalAssets = assets.filter(
                (a) => !selectedAssets.some((sa) => sa.tokenId == a.tokenId)
            );
            
            updateImageUrls();
            filterAssets(search);
            assetsLoading = false;
        }
    }
    
    function selectToken(token) {
        if (selectedAssets.length >= MAX_BUNDLE_ASSETS) {
            showCustomToast(`Max limit of ${MAX_BUNDLE_ASSETS} assets per escrow reached.`, 3000);
            return;
        }
        
        if (token.restricted) {
            showCustomToast('This token is restricted from being listed.', 3000, 'warning');
            return;
        }
        
        let hasRoyalty = selectedAssets.filter((t) => t.royaltypercent > 0);
        
        if (hasRoyalty.length > 0 || (selectedAssets.length > 0 && token.royaltypercent > 0)) {
            showCustomToast('Assets with royalties cannot be bundled.', 3000);
            return;
        }
        
        if (token.royaltypercent > 0) {
            token.displayAmount = 1;
            setTokenAmount(token, token.displayAmount);
        }
        
        additionalAssets = additionalAssets.filter((t) => t.tokenId != token.tokenId);
        selectedAssets = [...selectedAssets, Object.assign({}, token)];
        
        filterAssets(search);
    }
    
    function removeToken(token) {
        additionalAssets = [assets.find((a) => a.tokenId == token.tokenId), ...additionalAssets];
        selectedAssets = selectedAssets.filter((t) => t.tokenId != token.tokenId);
        
        filterAssets(search);
    }
    
    function updateTokenAmount(e, token, displayAmount) {
        if (token.royaltypercent > 0) {
            if (displayAmount != 1) {
                showCustomToast('Assets with royalties can only be offered as 1 unit.', 3000);
            }
            
            displayAmount = 1;
            e.target.value = displayAmount;
        }
        
        token.displayAmount = displayAmount;
        setTokenAmount(token, displayAmount);
    }
    
    function tokenAmountValidate(e, token, displayAmount) {
        if (displayAmount < token.minValue) {
            displayAmount = token.minValue;
            e.target.value = displayAmount;
            
            showCustomToast(`Minimum amount for ${token.name} is ${displayAmount}`, 3000);
            
            token.displayAmount = displayAmount;
            setTokenAmount(token, displayAmount);
        }
    }
    
    // FIXED: Use BigInt for amount calculation to maintain precision
    function setTokenAmount(token, displayAmount) {
        try {
            const amountBigInt = BigInt(Math.round(displayAmount * Math.pow(10, token.decimals)));
            token.amount = amountBigInt.toString(); // Store as string to avoid serialization issues
        } catch (error) {
            console.warn('Error setting token amount:', error);
            token.amount = String(Math.round(displayAmount * Math.pow(10, token.decimals)));
        }
    }
    
    function updateSelectedToken(event) {
        selectedTokenId = event.target.value;
        selectedToken = ASSETS.find((asset) => asset.tokenId === selectedTokenId);
        priceInToken = 0;
    }
    
    // FIXED: Simplified priceValidate function without any external dependencies
    function priceValidate(e, token) {
        if (e.target.value.length == 0) {
            e.target.value = 0;
        }
        
        try {
            const value = parseFloat(e.target.value);
            const multiplier = Math.pow(10, token.decimals);
            const nanoValue = value * multiplier;
            const minValue = 100;
            
            if (nanoValue < minValue) {
                const displayAmount = (minValue / multiplier).toFixed(token.decimals);
                e.target.value = displayAmount;
                priceInToken = displayAmount;
                showCustomToast(`Minimum price for ${token.name} is ${displayAmount}`, 3000);
            }
        } catch (error) {
            console.error("Error in priceValidate:", error);
            // Fallback validation
            const simpleValue = parseFloat(e.target.value) * Math.pow(10, token.decimals);
            if (simpleValue < 100) {
                const minDisplay = (100 / Math.pow(10, token.decimals)).toFixed(token.decimals);
                e.target.value = minDisplay;
                priceInToken = minDisplay;
                showCustomToast(`Minimum price for ${token.name} is ${minDisplay}`, 3000);
            }
        }
    }
    
    async function createEscrow() {
        if (!walletConnected || !$selected_wallet_ergo) {
            showCustomToast('Connect a wallet to create escrow.', 1500, 'info');
            return;
        }
        
        if (selectedAssets.length < 1) {
            showCustomToast('Select assets for the escrow.', 1500, 'info');
            return;
        }
        
        if (priceInToken == undefined || priceInToken <= 0) {
            showCustomToast('Set a valid price.', 1500, 'info');
            return;
        }
        
        if (!selectedCategory) {
            showCustomToast('Select a category.', 1500, 'info');
            return;
        }
        
        if (!selectedToken) {
            showCustomToast('Invalid payment asset selected.', 1500, 'info');
            return;
        }
        
        processing = true;
        
        let myAddress, height, utxos;
        unsignedTx = null;
        
        try {
            if ($selected_wallet_ergo != 'ergopay') {
                myAddress = await ergo.get_change_address();
                utxos = await fetchBoxes($connected_wallet_address);
                height = await ergo.get_current_height();
            } else {
                myAddress = get(connected_wallet_address);
                utxos = await fetchBoxes($connected_wallet_address);
                height = await getBlockHeight();
            }
            
            // FIXED: Safe price calculation without external dependencies
            let priceInNanoToken;
            try {
                priceInNanoToken = Math.floor(parseFloat(priceInToken) * Math.pow(10, selectedToken.decimals));
                
                if (isNaN(priceInNanoToken) || priceInNanoToken <= 0) {
                    throw new Error('Invalid price calculation');
                }
            } catch (error) {
                console.error("Price calculation failed:", error);
                showCustomToast('Invalid price value', 3000, 'error');
                return;
            }
            
            let royaltypercent = selectedAssets[0].royaltypercent * 1000;
            
            // Always use the correct buyer/seller addresses
            const sellerAddress = myAddress; // Current user is always the seller
            const buyerAddress = otherPartyAddress; // Other party is always the buyer
            
            console.log('Creating escrow with params:', {
                sellerAddress: sellerAddress,
                buyerAddress: buyerAddress,
                assets: selectedAssets.length,
                price: priceInToken,
                token: selectedToken.name,
                priceInNanoToken: priceInNanoToken
            });
            
            const unsigned = escrowSellTx(
                ESCROW_CONTRACT,
                sellerAddress, // Current user (seller)
                utxos,
                height,
                DEV_PK,
                selectedAssets,
                false, // paymentInErg - always false for token payments
                undefined, // priceInNanoErg
                selectedToken.tokenId,
                priceInNanoToken,
                buyerAddress, // Other party (buyer)
                royaltypercent
            );
            
            let transactionId, signed;
            if ($selected_wallet_ergo != 'ergopay') {
                try {
                    signed = await ergo.sign_tx(unsigned);
                    transactionId = await ergo.submit_tx(signed);
                    
                    // Create escrow summary
                    const escrowSummary = createEscrowSummary();
                    
                    dispatch('escrowCreated', {
                        escrowDetails: {
                            summary: escrowSummary,
                            assets: selectedAssets,
                            price: priceInToken,
                            token: selectedToken.name,
                            buyer: escrowData.buyerName,
                            seller: escrowData.sellerName,
                            category: selectedCategory
                        },
                        transactionId
                    });
                    
                    showCustomToast(
                        `Escrow created successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${transactionId}">${transactionId}</a>`,
                        10000,
                        'success'
                    );
                    
                    const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
                    const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);
                    
                    updateTempBoxes(myAddress, usedBoxIds, newOutputs);
                    
                    await loadWalletBoxes(myAddress, true);
                    
                } catch (e) {
                    console.error('Error signing/submitting escrow:', e);
                    if (e.info && e.info == 'User rejected') {
                        showCustomToast('Transaction cancelled by user', 3000, 'info');
                    } else {
                        showCustomToast(`Failed to create escrow: ${e.message}`, 5000, 'error');
                    }
                }
            } else {
                unsignedTx = unsigned;
                isAuth = false;
                showErgopayModal = true;
            }
            
        } catch (e) {
            console.error('Error creating escrow:', e);
            
            if (e.message && e.message.substr(0, 19) == 'Insufficient inputs') {
                showCustomToast(`Insufficient funds to create escrow.`, 5000, 'error');
            } else {
                console.log(e);
                showCustomToast(`Failed to create escrow transaction.`, 5000, 'error');
            }
        } finally {
            processing = false;
        }
    }
    
    function createEscrowSummary() {
        const assetNames = selectedAssets.map(asset => asset.name).join(', ');
        return `selling ${assetNames} for ${priceInToken} ${selectedToken.name}`;
    }
    
    function onTxSubmitted(txId) {
        const escrowSummary = createEscrowSummary();
        
        dispatch('escrowCreated', {
            escrowDetails: {
                summary: escrowSummary,
                assets: selectedAssets,
                price: priceInToken,
                token: selectedToken.name,
                buyer: escrowData.buyerName,
                seller: escrowData.sellerName,
                category: selectedCategory
            },
            transactionId: txId
        });
        
        showCustomToast(
            `Escrow created successfully!<br>TX ID: <a target="_new" href="https://explorer.ergoplatform.com/en/transactions/${txId}">${txId}</a>`,
            10000,
            'success'
        );
    }
    
    function updateImageUrls() {
        const allAssets = additionalAssets.concat(selectedAssets);
        
        imageUrls = allAssets.reduce((acc, asset) => {
            acc[asset.tokenId] = getImageUrl ? getImageUrl(asset, false) : asset.imageLink || '';
            return acc;
        }, {});
    }
    
    function closeModal() {
        dispatch('close');
    }
    
    function resetForm() {
        selectedAssets = [];
        priceInToken = undefined;
        selectedCategory = '';
        search = '';
    }
    
    onMount(() => {
        if (visible && walletConnected) {
            loadWalletBoxes($selected_wallet_ergo);
        }
    });
    
    $: if (visible && walletConnected) {
        loadWalletBoxes($selected_wallet_ergo);
    }
</script>
<!-- Rest of the HTML template remains the same -->
{#if visible}
<div class="modal-overlay" transition:fade={{ duration: 200 }}>
    <div class="escrow-modal" transition:slide={{ duration: 300 }}>
        <!-- Modal Header -->
        <div class="modal-header">
            <div class="header-content">
                <i class="fa-solid fa-handshake"></i>
                <div class="header-text">
                    <h2>Create Escrow</h2>
                    <p>
                        You're creating an escrow to <strong>sell</strong> to {otherPartyName}
                    </p>
                </div>
            </div>
            <button class="close-btn" on:click={closeModal}>
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        
        <!-- Modal Body -->
        <div class="modal-body">
            <!-- Escrow Participants -->
            <div class="escrow-participants">
                <div class="participant seller you">
                    <div class="role-icon">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div class="participant-info">
                        <h4>Seller (You)</h4>
                        <p>You</p>
                        <small>{truncateAddress(currentUserAddress)}</small>
                    </div>
                </div>
                
                <div class="escrow-arrow">
                    <i class="fa-solid fa-arrow-right"></i>
                </div>
                
                <div class="participant buyer other">
                    <div class="role-icon">
                        <i class="fa-solid fa-shopping-cart"></i>
                    </div>
                    <div class="participant-info">
                        <h4>Buyer</h4>
                        <p>{otherPartyName}</p>
                        <small>{truncateAddress(otherPartyAddress)}</small>
                    </div>
                </div>
            </div>
            
            <!-- Selected Assets Section -->
            {#if selectedAssets.length > 0}
                <div class="selected-assets-section">
                    <h3>Assets for Escrow:</h3>
                    <div class="selected-assets">
                        {#each selectedAssets as token}
                            <div class="asset-card">
                                <div class="asset-image">
                                    <img
                                        src={imageUrls[token.tokenId] || token.imageLink}
                                        alt={token.name}
                                        on:error={(event) => setPlaceholderImage && setPlaceholderImage(event, token)}
                                    />
                                </div>
                                <div class="asset-details">
                                    <span class="asset-name">{token.name}</span>
                                    <input
                                        class="asset-amount"
                                        type="number"
                                        min="0"
                                        step={1 / Math.pow(10, token.decimals)}
                                        bind:value={token.displayAmount}
                                        on:input={(e) => updateTokenAmount(e, token, token.displayAmount)}
                                        on:blur={(e) => tokenAmountValidate(e, token, token.displayAmount)}
                                    />
                                </div>
                                <button
                                    class="remove-asset-btn"
                                    on:click={() => removeToken(token)}
                                >
                                    <i class="fa-solid fa-times"></i>
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
            
            <!-- Configuration Section -->
            <div class="config-section">
                <div class="form-row">
                    <div class="form-group">
                        <label for="category">Category:</label>
                        <select
                            id="category"
                            class="form-input"
                            bind:value={selectedCategory}
                        >
                            <option value="" disabled>Select a category</option>
                            {#each CATEGORIES as category}
                                <option value={category.name}>{category.name}</option>
                            {/each}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="payment-token">Payment Asset:</label>
                        <select
                            id="payment-token"
                            class="form-input"
                            bind:value={selectedTokenId}
                            on:change={updateSelectedToken}
                        >
                            {#each ASSETS as asset}
                                <option value={asset.tokenId}>{asset.name}</option>
                            {/each}
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="price">
                        Price in {selectedToken ? selectedToken.name : 'Token'}:
                    </label>
                    <input
                        id="price"
                        type="number"
                        class="form-input"
                        min={selectedToken ? 100 / Math.pow(10, selectedToken.decimals) : 0}
                        step={selectedToken ? 1 / Math.pow(10, selectedToken.decimals) : 0.01}
                        placeholder="Enter price"
                        bind:value={priceInToken}
                        on:blur={(e) => selectedToken && priceValidate(e, selectedToken)}
                    />
                </div>
            </div>
            
            <!-- Asset Selection -->
            <div class="asset-selection">
                <h3>Your Assets</h3>
                
                {#if !assetsLoading}
                    <div class="search-container">
                        <input
                            bind:value={search}
                            class="search-input"
                            type="text"
                            placeholder="Search by asset name..."
                        />
                    </div>
                {/if}
                
                {#if assetsLoading}
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <p>Loading your assets...</p>
                    </div>
                {:else if additionalAssetsFiltered.length > 0}
                    <div class="assets-grid">
                        {#each additionalAssetsFiltered as token}
                            <div
                                class="asset-item {token.restricted ? 'restricted' : ''}"
                                on:click={() => !token.restricted && selectToken(token)}
                            >
                                <div class="asset-image-small">
                                    <img
                                        src={imageUrls[token.tokenId] || token.imageLink}
                                        alt={token.name}
                                        on:error={(event) => setPlaceholderImage && setPlaceholderImage(event, token)}
                                    />
                                </div>
                                <div class="asset-info">
                                    <span class="asset-name-small">{token.name}</span>
                                    <span class="asset-balance">{nFormatter(token.displayAmount)}</span>
                                    {#if token.royaltypercent > 0}
                                        <span class="royalty-badge">{nFormatter(token.royaltypercent)}% royalty</span>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="no-assets">No assets found.</p>
                {/if}
            </div>
        </div>
        
        <!-- Modal Footer -->
        <div class="modal-footer">
            <button class="cancel-btn" on:click={closeModal} disabled={processing}>
                Cancel
            </button>
            <button 
                class="create-btn" 
                on:click={createEscrow}
                disabled={processing || selectedAssets.length === 0 || !priceInToken || !selectedCategory}
            >
                {#if processing}
                    <div class="button-spinner"></div>
                    Creating...
                {:else}
                    Create Escrow
                {/if}
            </button>
        </div>
    </div>
</div>
{/if}

<!-- ErgoPay Modal -->
{#if showErgopayModal}
    <ErgopayModal 
        bind:showErgopayModal 
        bind:isAuth 
        bind:unsignedTx
        {onTxSubmitted}
    >
        <button slot="btn">Close</button>
    </ErgopayModal>
{/if}
<style>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
}

.escrow-modal {
    background-color: #262626;
    border-radius: 12px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 85, 0, 0.2);
    overflow: hidden;
}

.modal-header {
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

.header-text h2 {
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

.modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.escrow-participants {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.participant {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    padding: 0.75rem;
    border-radius: 6px;
    transition: all 0.2s ease;
}

.participant.you {
    background: rgba(255, 85, 0, 0.1);
    border: 1px solid rgba(255, 85, 0, 0.3);
}

.participant.other {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.role-icon {
    width: 40px;
    height: 40px;
    background: rgba(255, 85, 0, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FF5500;
    font-size: 1.1rem;
    flex-shrink: 0;
}

.participant-info h4 {
    margin: 0;
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
}

.participant-info p {
    margin: 0.25rem 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
}

.participant-info small {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.7rem;
    font-family: monospace;
}

.escrow-arrow {
    color: #FF5500;
    font-size: 1.2rem;
    flex-shrink: 0;
}

.selected-assets-section h3,
.asset-selection h3 {
    color: white;
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    font-weight: 600;
}

.selected-assets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
}

.asset-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s ease;
}

.asset-card:hover {
    background: rgba(255, 255, 255, 0.08);
}

.asset-image {
    width: 50px;
    height: 50px;
    background: #000;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
}

.asset-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.asset-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.asset-name {
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
}

.asset-amount {
    background: #333;
    border: 1px solid #444;
    border-radius: 4px;
    color: white;
    padding: 0.5rem;
    font-size: 0.8rem;
    width: 100%;
}

.asset-amount:focus {
    border-color: #FF5500;
    outline: none;
}

.remove-asset-btn {
    background: rgba(255, 68, 68, 0.2);
    border: 1px solid rgba(255, 68, 68, 0.4);
    color: #ff6b6b;
    border-radius: 4px;
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.remove-asset-btn:hover {
    background: rgba(255, 68, 68, 0.3);
    color: #ff4444;
}

.config-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-group label {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
    font-weight: 500;
}

.form-input {
    background: #333;
    border: 1px solid #444;
    border-radius: 6px;
    color: white;
    padding: 0.75rem;
    font-size: 0.9rem;
    transition: border-color 0.2s ease;
}

.form-input:focus {
    border-color: #FF5500;
    outline: none;
}

.search-container {
    margin-bottom: 1rem;
}

.search-input {
    width: 100%;
    background: #333;
    border: 1px solid #444;
    border-radius: 6px;
    color: white;
    padding: 0.75rem;
    font-size: 0.9rem;
}

.search-input:focus {
    border-color: #FF5500;
    outline: none;
}

.loading-container {
    text-align: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.7);
}

.loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 85, 0, 0.3);
    border-top-color: #FF5500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

.assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
}

.asset-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.asset-item:hover:not(.restricted) {
    background: rgba(255, 85, 0, 0.1);
    border-color: rgba(255, 85, 0, 0.3);
    transform: translateY(-1px);
}

.asset-item.restricted {
    opacity: 0.5;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.02);
}

.asset-image-small {
    width: 32px;
    height: 32px;
    background: #000;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
}

.asset-image-small img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.asset-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
}

.asset-name-small {
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.asset-balance {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.7rem;
}

.royalty-badge {
    background: rgba(255, 85, 0, 0.2);
    color: #FF5500;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.6rem;
    font-weight: 600;
}

.no-assets {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    padding: 2rem;
    font-style: italic;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.02);
}

.cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
}

.cancel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.create-btn {
    background: linear-gradient(135deg, #FF5500, #ff6a1f);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.create-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #ff6a1f, #FF5500);
    transform: translateY(-1px);
}

.create-btn:disabled {
    background: #555;
    cursor: not-allowed;
    transform: none;
    opacity: 0.7;
}

.button-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
    .modal-overlay {
        padding: 10px;
    }
    
    .escrow-modal {
        max-height: 95vh;
    }
    
    .modal-header {
        padding: 1rem;
    }
    
    .header-text h2 {
        font-size: 1.1rem;
    }
    
    .modal-body {
        padding: 1rem;
    }
    
    .escrow-participants {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .escrow-arrow {
        transform: rotate(90deg);
    }
    
    .form-row {
        grid-template-columns: 1fr;
    }
    
    .assets-grid {
        grid-template-columns: 1fr;
    }
    
    .selected-assets {
        grid-template-columns: 1fr;
    }
    
    .modal-footer {
        padding: 1rem;
        flex-direction: column;
    }
    
    .cancel-btn,
    .create-btn {
        width: 100%;
        justify-content: center;
    }
}

@media (max-width: 480px) {
    .asset-card {
        padding: 0.75rem;
    }
    
    .asset-image {
        width: 40px;
        height: 40px;
    }
    
    .participant {
        padding: 0.5rem;
    }
    
    .role-icon {
        width: 32px;
        height: 32px;
        font-size: 0.9rem;
    }
}
</style>