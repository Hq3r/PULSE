<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount, onDestroy } from 'svelte';
	import {
		selected_wallet_ergo,
		connected_wallet_address,
		connected_wallet_addresses,
		mewTier,
		connected_wallet_balance,
		wallet_init,
		showNsfw
	} from '$lib/store/store.ts';
	import WalletsModal from '$lib/components/common/WalletsModal.svelte';
	import ErgopayModal from '$lib/components/common/ErgopayModal.svelte';
	import AddressChangeModal from '$lib/components/common/AddressChangeModal.svelte';
	import NotificationFetcher from '$lib/components/common/NotificationFetcher.svelte';
	import NotificationItem from '$lib/components/common/NotificationItem.svelte';
	import { connectErgoWallet, disconnectErgoWallet, KEY_ADDRESS } from '$lib/common/wallet.js';
	import { fetchConfirmedBalance } from '$lib/api-explorer/explorer.ts';
	import {
		nFormatter,
		showCustomToast,
		isMobileDevice,
		truncateAddress
	} from '$lib/utils/utils.js';
	import { writable } from 'svelte/store';
	import { fly } from 'svelte/transition';

	// Create a store for notifications
	export const notificationsStore = writable([]);

	let showWalletsModal = false;
	let showErgopayModal = false;
	let qrCodeText = false;
	let isAuth = false;
	let balanceInNanoErg = '0';
	let balanceErg = '';
	let paymentTokenBalance = '0.00';
	let truncatedAddress = '';
	let showAddressChangeModal = false;
	let isDropdownOpen = false;
	let activeTab = 'wallet'; // 'wallet' or 'notifications'
	let hasUnreadNotifications = false;
	let checkingForNew = false;
	let showQrModal = false; // For QR code modal
	let notificationFetcher; // Reference to notification fetcher component
	let refreshIntervalId; // For periodic notification checks

	let selectedAddress = '';
	let notifications = [];
	let qrCode = null; // For QR code generation

	// Function to toggle the QR Modal
	function toggleQrModal(e) {
		e?.stopPropagation();
		showQrModal = !showQrModal;

		if (showQrModal) {
			setTimeout(generateQRCode, 1);
		}
	}

	// Generate QR code for MewFi Mart link
	function generateQRCode() {
		const address = get(connected_wallet_address);
		const url = `https://mart.mewfinance.com/explore?seller=${address}`;

		if (qrCode == null) {
			qrCode = new QRCode(document.getElementById('qr-code-container'), {
				text: url,
				width: 250,
				height: 250,
				colorDark: '#000000',
				colorLight: '#ffffff',
				correctLevel: QRCode.CorrectLevel.L
			});
		} else {
			qrCode.clear(); // clear the code.
			qrCode.makeCode(url); // make another code.
		}
	}

	// Function to copy the URL to the clipboard
	function copyUrlToClipboard() {
		const url = `https://mart.mewfinance.com/explore?seller=${get(connected_wallet_address)}`;
		navigator.clipboard
			.writeText(url)
			.then(() => showCustomToast('URL copied to clipboard', 'success'))
			.catch((err) => showCustomToast('Failed to copy URL', 'error'));
	}

	async function clickOnNautilusButton() {
		showWalletsModal = false;
		if ($selected_wallet_ergo) {
			await disconnectErgoWallet();
			balanceErg = '';
			paymentTokenBalance = '0.00';
			truncatedAddress = '';
		} else {
			await connectErgoWallet('nautilus');
		}
	}

	async function clickOnErgopayButton() {
		showWalletsModal = false;
		if ($selected_wallet_ergo) {
			await disconnectErgoWallet();
			balanceErg = '';
			paymentTokenBalance = '0.00';
			truncatedAddress = '';
		} else {
			isAuth = true;
			showErgopayModal = true;
		}
	}

	async function loadBalance(wallet, address) {
		if (!$selected_wallet_ergo || !wallet) {
			return;
		}

		selectedAddress = address;

		console.log('Loading balance', selectedAddress);

		try {
			const balanceData = await fetchConfirmedBalance($connected_wallet_address);

			// Fetch balance from API
			if (!balanceData) {
				throw 'Failed to fetch balance';
			}

			balanceInNanoErg = balanceData.nanoErgs;
			connected_wallet_balance.set(balanceData.nanoErgs);
			balanceErg = (+balanceInNanoErg / 10 ** 9).toFixed(2);

			const address = $connected_wallet_address;
			truncatedAddress = address.substr(0, 4) + '...' + address.substr(address.length - 4);
		} catch (error) {
			console.error('Failed to fetch balance:', error);
			showCustomToast('Failed to fetch balance', 3000, 'danger');
		}
	}

	$: loadBalance($selected_wallet_ergo, $connected_wallet_address);

	function toggleDropdown(e) {
		isDropdownOpen = !isDropdownOpen;
		e.stopPropagation();
	}

	function handleAddressChange() {
		connected_wallet_address.set(selectedAddress);
		localStorage.setItem(KEY_ADDRESS, selectedAddress);
		truncatedAddress =
			selectedAddress.substr(0, 4) + '...' + selectedAddress.substr(selectedAddress.length - 4);
		isDropdownOpen = false;
	}

	// Mark notification as read
	function markAsRead(id) {
		notificationsStore.update((notifs) => {
			return notifs.map((n) => {
				if (n.txidin === id) {
					return { ...n, read: true };
				}
				return n;
			});
		});
	}

	// Mark all notifications as read
	function markAllAsRead() {
		notificationsStore.update((notifs) => {
			return notifs.map((n) => ({ ...n, read: true }));
		});
		hasUnreadNotifications = false;
	}

	// Navigate to transaction details
	function navigateToTransaction(txid) {
		if (txid) {
			window.open(`https://ergexplorer.com/transactions#${txid}`, '_blank');
		}
	}

	// Force refresh notifications
	function refreshNotifications() {
		if (notificationFetcher) {
			checkingForNew = notificationFetcher.refresh();
		}
	}

	// Handle new notifications
	function handleNewNotifications(event) {
		const { orders, count } = event.detail;

		if (count > 0) {
			// Count by type
			const newBuys = orders.filter((o) => o.notificationType === 'buy').length;
			const newSells = orders.filter((o) => o.notificationType === 'sell').length;
			const newListings = orders.filter((o) => o.notificationType === 'list').length;
			const newCanceled = orders.filter((o) => o.notificationType === 'cancel').length;

			// Create meaningful message
			let message = '';
			if (newBuys > 0) message += `${newBuys} new purchase${newBuys > 1 ? 's' : ''}, `;
			if (newSells > 0) message += `${newSells} new sale${newSells > 1 ? 's' : ''}, `;
			if (newListings > 0) message += `${newListings} new listing${newListings > 1 ? 's' : ''}, `;
			if (newCanceled > 0)
				message += `${newCanceled} canceled order${newCanceled > 1 ? 's' : ''}, `;

			// Remove trailing comma and space
			if (message.endsWith(', ')) {
				message = message.slice(0, -2);
			}

			// Show toast notification
			showCustomToast(message, 'success');
			hasUnreadNotifications = true;
		}
	}

	// Handle loaded notifications
	function handleNotificationsLoaded(event) {
		const { orders } = event.detail;
		notifications = orders;
		hasUnreadNotifications = orders.some((n) => !n.read);

		// Update the notificationsStore for external access
		notificationsStore.set(orders);
	}

	// Set active tab
	function setActiveTab(tab) {
		activeTab = tab;
		if (tab === 'notifications') {
			// Only mark as read when switching to notification tab
			markAllAsRead();
		}
	}

	onMount(() => {
		// Initialize notification fetcher right away, don't wait for tab click
		if (get(connected_wallet_address)) {
			// Small delay to ensure component is fully mounted
			setTimeout(() => {
				if (notificationFetcher) {
					notificationFetcher.refresh();
				}
			}, 100);
		}

		// Check for new notifications every 2 minutes
		refreshIntervalId = setInterval(() => {
			if (get(connected_wallet_address)) {
				refreshNotifications();
			}
		}, 2 * 60 * 1000);

		// Close dropdown when clicking outside
		const handleDocumentClick = () => {
			if (isDropdownOpen) {
				isDropdownOpen = false;
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('click', handleDocumentClick);
		}

		return () => {
			// Clean up on component destroy
			if (refreshIntervalId) {
				clearInterval(refreshIntervalId);
			}

			if (typeof document !== 'undefined') {
				document.removeEventListener('click', handleDocumentClick);
			}
		};
	});
</script>

{#if !$wallet_init}
	<div />
{:else if $selected_wallet_ergo}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="wallet-container relative">
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="wallet-button bg-footer py-[10px] px-[10px]" on:click={toggleDropdown}>
			<span class="tier-badge py-1 px-2">T{$mewTier}</span>
			<span class="address-text">
				{#if truncatedAddress.length > 0}
					{truncatedAddress}
				{:else}
					<div class="btn-spinner" style="scale: 0.7;" />
				{/if}
			</span>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="dropdown-icon {isDropdownOpen ? 'rotate-180' : ''}"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
			{#if hasUnreadNotifications}
				<span class="notification-dot" />
			{/if}
		</div>

		{#if isDropdownOpen}
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				on:click={(e) => e.stopPropagation()}
				in:fly={{ y: -10, duration: 200 }}
				out:fly={{ y: -5, duration: 200 }}
				class="wallet-dropdown rounded-lg bg-form"
			>
				<div class="tabs">
					<button
						class="tab-button {activeTab === 'wallet' ? 'active' : ''}"
						on:click|stopPropagation={() => setActiveTab('wallet')}
					>
						Wallet
					</button>
					<button
						class="tab-button {activeTab === 'notifications' ? 'active' : ''}"
						on:click|stopPropagation={() => setActiveTab('notifications')}
					>
						Transactions
						{#if hasUnreadNotifications}
							<span class="tab-notification-indicator" />
						{/if}
					</button>
				</div>

				{#if activeTab === 'wallet'}
					<div class="wallet-info">
						<div class="info-row pt-0">
							<span class="info-label">Connection:</span>
							<span class="info-value">
								{get(selected_wallet_ergo).charAt(0).toUpperCase() +
									get(selected_wallet_ergo).slice(1).toLowerCase()}
							</span>
						</div>
						<div class="info-row">
							<span class="info-label">Balance:</span>
							<span class="info-value">
								{#if balanceErg === ''}
									<div class="btn-spinner" style="scale: 0.7;" />
								{:else}
									{balanceErg} <span class="font-bold text-primary">ERG</span>
								{/if}
							</span>
						</div>

						<div class="info-row">
							<span class="info-label">MEW Tier:</span>
							<span class="info-value">{$mewTier}</span>
						</div>
						<div class="info-row">
							<span class="info-label">Address:</span>
							<div class="address-explorer-row">
								<span class="info-value full-address"
									>{truncateAddress($connected_wallet_address, 7)}</span
								>
								<a
									href={`https://ergexplorer.com/addresses#${$connected_wallet_address}`}
									target="_blank"
									rel="noopener noreferrer"
									class="explorer-link"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
										<polyline points="15 3 21 3 21 9" />
										<line x1="10" y1="14" x2="21" y2="3" />
									</svg>
								</a>
							</div>
						</div>
						<div class="info-row">
							<span class="info-label">My Profile:</span>
							<a href={`/profile`} rel="noopener noreferrer" class="explorer-link">
								<button class="btn-info p-1 text-bg text-xs rounded-md pt-0 pb-0 me-2">View</button>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
									<polyline points="15 3 21 3 21 9" />
									<line x1="10" y1="14" x2="21" y2="3" />
								</svg>
							</a>
						</div>
						<div class="info-row">
							<span class="info-label">Personal Mart:</span>
							<button
								class="share-button"
								on:click|stopPropagation={toggleQrModal}
								title="Show QR code for your personalized Mew Mart link"
							>
								<i class="fa-solid fa-qrcode" /> Share
							</button>
						</div>
					</div>

					<div class="nsfw-toggle">
						<label class="inline-flex items-center cursor-pointer">
							<input type="checkbox" bind:checked={$showNsfw} class="sr-only peer" />
							<div
								class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-400 rounded-full peer bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
							/>
							<span class="ms-3 text-sm font-medium text-gray-200">Show NSFW content</span>
						</label>
					</div>

					<div class="wallet-actions">
						{#if $connected_wallet_addresses.length > 1}
							<button
								class="btn btn-info w-full"
								on:click|stopPropagation={() => {
									isDropdownOpen = false;
									showAddressChangeModal = true;
								}}
								>Change Address
							</button>
						{/if}

						<button
							class="btn btn-secondary w-full disconnect"
							on:click|stopPropagation={clickOnNautilusButton}
						>
							<i class="fa-solid fa-wallet" /> Disconnect
						</button>
					</div>
				{:else}
					<div class="notifications-container">
						<div class="notifications-header">
							<span class="notifications-title">Recent Transactions</span>
							<button
								class="refresh-button"
								on:click|stopPropagation={refreshNotifications}
								disabled={checkingForNew}
								title="Refresh transactions"
							>
								<i class="fa-solid fa-sync-alt {checkingForNew ? 'fa-spin' : ''}" />
							</button>
						</div>

						<NotificationFetcher
							type="all"
							bind:this={notificationFetcher}
							on:newOrders={handleNewNotifications}
							on:loaded={handleNotificationsLoaded}
							let:orders
							let:isRefreshing={checkingForNew}
							showNotifications={activeTab === 'notifications'}
						>
							<div
								slot="loading"
								style="display: {activeTab === 'notifications' ? 'block' : 'none'}"
							>
								<div class="loading-indicator">Loading transactions...</div>
							</div>

							<div slot="empty" style="display: {activeTab === 'notifications' ? 'block' : 'none'}">
								<div class="empty-notifications">No transactions to display</div>
							</div>

							<!-- Only render items when tab is active but keep fetcher always working -->
							{#if activeTab === 'notifications'}
								{#each orders as notification}
									<NotificationItem
										{notification}
										onMarkAsRead={markAsRead}
										onNavigate={navigateToTransaction}
									/>
								{/each}
							{/if}
						</NotificationFetcher>

						{#if notifications.length > 0}
							<div class="notification-actions">
								<button class="action-button" on:click|stopPropagation={markAllAsRead}>
									<i class="fa-solid fa-check-double" /> Mark all as read
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<button class="connect-wallet-btn btn-primary" on:click={() => (showWalletsModal = true)}>
		<i class="fa-solid fa-wallet" /> Connect Wallet
	</button>
{/if}

<!-- Add this outside the dropdown but inside the component -->
{#if showQrModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-backdrop" on:click={toggleQrModal}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal-content qr-modal bg-form" on:click|stopPropagation>
			<h2 class="modal-title">Personalized Mew Mart Link</h2>
			<div id="qr-code-container" class="qr-code-container" />
			<br />
			<button on:click={copyUrlToClipboard} class="btn btn-primary mb-3 mt-1">Copy URL</button>
			<button on:click={toggleQrModal} class="btn btn-secondary">Close</button>
		</div>
	</div>
{/if}

{#if showWalletsModal}
	<WalletsModal bind:showWalletsModal>
		<div class="w-52 h-52">
			<div
				class="leading-6 pb-2 text-white w-100 text-center font-bold"
				style="font-family:'Manrope';font-size:1.5em;"
			>
				Select Wallet
			</div>
			<div class="w-full mt-6 mb-4">
				{#if !isMobileDevice() && (!window.ergoConnector || !window.ergoConnector['nautilus'])}
					<a
						href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"
						target="blank_"
						style="height: 50px;text-wrap:nowrap;"
						class="w-full flex justify-center items-center btn btn-primary mb-3 install-naut"
					>
						<img style="height: 1.4em; width: 1.4em;" src="/wallets/nautilus.svg" alt="" />
						<div>Install Nautilus</div>
					</a>
				{:else if !isMobileDevice()}
					<button
						on:click={clickOnNautilusButton}
						class:grayscale={!window.ergoConnector['nautilus']}
						class="w-full flex justify-center items-center btn btn-primary mb-3"
					>
						<img style="height: 1.4em; width: 1.4em;" src="/wallets/nautilus.svg" alt="" />
						<div class="flex justify-center">
							{#if $selected_wallet_ergo == 'nautilus'}
								Disconnect
							{/if}
							Nautilus
						</div>
					</button>
				{/if}
				<button
					on:click={clickOnErgopayButton}
					class="w-full flex justify-center items-center btn btn-primary mb-3"
				>
					<svg
						stroke="currentColor"
						fill="currentColor"
						stroke-width="0"
						viewBox="0 0 24 24"
						aria-hidden="true"
						focusable="false"
						height="20"
						width="20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path fill="none" d="M0 0h24v24H0z" />
						<path
							d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"
						/>
					</svg>
					<div class="flex justify-center">
						{#if $selected_wallet_ergo == 'ergopay'}
							Disconnect
						{/if}
						Ergopay
					</div>
				</button>
			</div>
		</div>
		<button slot="btn">Close</button>
	</WalletsModal>
{/if}

{#if showErgopayModal}
	<ErgopayModal bind:showErgopayModal bind:qrCodeText bind:isAuth>
		<button slot="btn">Close</button>
	</ErgopayModal>
{/if}

{#if showAddressChangeModal}
	<AddressChangeModal bind:showAddressChangeModal onBtnClick={handleAddressChange}>
		<div
			class="leading-6 pb-2 text-white w-100 text-center font-bold rounded-lg"
			style="font-family:'Manrope';font-size:1.5em;"
		>
			Select Address
		</div>
		<br />
		<div class="address-select-container">
			<label class="pb-1 address-select-label" for="paymentToken">Selected Address:</label>
			<div class="select-wrapper">
				<select id="paymentToken" class="address-select" bind:value={selectedAddress}>
					{#each $connected_wallet_addresses as address}
						<option value={address} selected={address === selectedAddress}>
							{address}
						</option>
					{/each}
				</select>
				<div class="select-arrow">
					<i class="fa-solid fa-chevron-down" />
				</div>
			</div>
		</div>
		<span slot="btn">Confirm</span>
	</AddressChangeModal>
{/if}

<style>
	.wallet-container {
  position: relative;
}

.wallet-button {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
  position: relative;
}

.wallet-button:hover {
  background: rgba(0, 0, 0, 0.3);
}

.tier-badge {
  background: rgba(255, 85, 0, 0.2);
  color: white;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
}

.address-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.dropdown-icon {
  color: rgba(255, 255, 255, 0.6);
  transition: transform 0.2s ease;
}

.dropdown-icon.rotate-180 {
  transform: rotate(180deg);
}

.notification-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  background-color: #FF5500;
  border-radius: 50%;
}

.wallet-dropdown {
  position: absolute;
  top: 110%;
  right: 0;
  width: 275px;
  padding: 12px;
  z-index: 50;
  background-color: #1A1A1A;
  border: 1px solid rgba(255, 85, 0, 0.2);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 12px;
}

.tab-button {
  flex: 1;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 0;
  padding-top: 0;
  font-size: 13px;
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
}

.tab-button:hover {
  color: rgba(255, 255, 255, 0.8);
}

.tab-button.active {
  color: white;
  font-weight: 500;
}

.tab-button.active:after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 25%;
  width: 50%;
  height: 2px;
  background: #FF5500;
  border-radius: 2px;
}

.tab-notification-indicator {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: #FF5500;
  border-radius: 50%;
  margin-left: 4px;
  vertical-align: top;
}

.wallet-info {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.info-value {
  color: white;
  font-size: 13px;
  text-align: right;
}

.address-explorer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.full-address {
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.explorer-link {
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.explorer-link:hover {
  color: #FF5500;
}

.nsfw-toggle {
  margin-bottom: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.wallet-actions,
.notification-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn-info {
  background-color: #1E1E1E;
  color: white;
  border: 1px solid rgba(255, 85, 0, 0.3);
}

.btn-info:hover {
  background-color: #2C2C2C;
  border-color: rgba(255, 85, 0, 0.5);
}

.btn-secondary {
  background-color: #333333;
  color: white;
  border: none;
}

.btn-secondary:hover {
  background-color: #444444;
}

.action-button {
  flex: 1;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  transition: background 0.2s ease;
}

.action-button:hover {
  background: rgba(0, 0, 0, 0.4);
}

.action-button.disconnect {
  background: rgba(255, 85, 0, 0.2);
}

.action-button.disconnect:hover {
  background: rgba(255, 85, 0, 0.3);
}

.connect-wallet-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 85, 0, 0.2);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.connect-wallet-btn:hover {
  background: rgba(255, 85, 0, 0.3);
}

/* Notifications styles */
.notifications-container {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 2px;
}

.notifications-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.refresh-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.refresh-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #FF5500;
}

.refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-notifications,
.loading-indicator {
  padding: 20px 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

/* QR Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.qr-modal {
  background: #1A1A1A;
  border-radius: 1rem;
  padding: 20px;
  max-width: 400px;
  text-align: center;
  border: 1px solid rgba(255, 85, 0, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes zoom {
  from { transform: scale(0.95); }
  to { transform: scale(1); }
}

.modal-title {
  color: white;
  font-size: 18px;
  margin-bottom: 15px;
  font-weight: 600;
}

.qr-code-container {
  margin: 0 auto;
  background: white;
  padding: 10px;
  border-radius: 8px;
  display: inline-block;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-primary {
  background: rgba(255, 85, 0, 0.2);
  color: white;
}

.btn-primary:hover {
  background: rgba(255, 85, 0, 0.3);
}

.btn-spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid rgba(255, 85, 0, 0.1);
  border-top-color: #FF5500;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Media query for smaller screens */
@media (max-width: 400px) {
  .wallet-dropdown {
    max-width: none;
    width: 93vw;
    right: -60px;
  }
}

/* Modal Styles for ErgoPayModal */
dialog {
  border-radius: 1rem;
  border: none;
  padding: 0;
  background: rgba(16, 16, 16, 0.2);
  color: #d1d1d1;
  border: 1px solid rgba(255, 85, 0, 0.3);
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
}

dialog > div {
  padding: 1em;
  background-color: #1A1A1A;
}

dialog[open] {
  animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

dialog[open]::backdrop {
  animation: fade 0.2s ease-out;
}

@keyframes fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.qrcode-container {
  min-height: 290px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: white;
  border-radius: 8px;
  margin: 0 auto;
}
</style>
