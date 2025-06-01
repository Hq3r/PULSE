<script lang="ts">
	import { onMount } from 'svelte';
	import {
		selected_wallet_ergo,
		connected_wallet_address,
		showNsfw,
		authorizedMerchant,
		connected_wallet_balance,
		utxosLoading,
		utxosAssets,
		utxosTokenInfos,
		fetchUtxos
	} from '$lib/store/store.ts';
	import {
		CONTRACT,
		ESCROW_CONTRACT,
		DEV_PK,
		MART_NAME,
		ASSETS,
		CATEGORIES,
		MAX_BUNDLE_ASSETS,
		TOKEN_RESTICTIONS,
		OFFERS_CONTRACT,
		OFFERS_ESCROW_CONTRACT
	} from '$lib/common/const.ts';
	import { sellTx } from '$lib/contract/sellTx.js';
	import { escrowSellTx } from '$lib/contract/escrowSellTx.js';
	import {
		nFormatter,
		showCustomToast,
		getImageUrl,
		setPlaceholderImage,
		getCommonBoxIds,
		truncateAddress,
		sleep
	} from '$lib/utils/utils.js';
	import { fetchBoxes, getBlockHeight, updateTempBoxes } from '$lib/api-explorer/explorer.ts';
	import { createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import ErgopayModal from '$lib/components/common/ErgopayModal.svelte';
	import JSONbig from 'json-bigint';
	import axios from 'axios';
	import BigNumber from 'bignumber.js';
	import Loading from './Loading.svelte';
	import { fade, fly } from 'svelte/transition';

	const dispatch = createEventDispatcher();

	let mounted = false;
	let processing = false;
	let openedFromEvent = false;
	let assetsLoading = false;
	let imageUrls = [];
	let utxos = [];
	let assets = [];
	let editAssets = true;
	let showErgopayModal = false;
	let isAuth = false;
	let unsignedTx = null;
	let search = '';
	let additionalAssets: Array<Token> = [];
	let additionalAssetsFiltered: Array<Token> = [];
	let selectedAssets: Array<Token> = [];
	let priceInErg: undefined | number;
	let priceInToken: undefined | number;
	let paymentInErg: boolean = false;
	let selectedCategory: string = ''; // Added for category dropdown
	let selectedToken = ASSETS[0]; // Default to the first token
	let selectedPaymentTokenId = ASSETS[0].tokenId; // Default to the first token
	let escrow = false;
	let buyerAddress = '';
	let isPhygital = false;
	let activeModalTab = 'sell';
	export let offerTokenId = '';
	export let sellTokenId = '';
	let offerToken = null;
	let offerTokenError = '';

	$: filterAssets(search);
	$: isPhygital = selectedCategory?.toLowerCase().substr(0, 8) == 'phygital';

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
			assets = JSONbig.parse(JSONbig.stringify(get(utxosAssets)));
			const tokenInfos = get(utxosTokenInfos);

			for (const asset of assets) {
				const tokenInfo = tokenInfos.find((info) => info.id === asset.tokenId);

				if (tokenInfo) {
					asset.name = tokenInfo.name;
					asset.decimals = tokenInfo.decimals;
					asset.displayAmount = Number(asset.amount) / Math.pow(10, asset.decimals);
					asset.royaltypercent = tokenInfo.royaltypercent;
					if (activeModalTab == 'sell') {
						asset.minValue = asset.decimals == 0 ? 1 : 1 / Math.pow(10, asset.decimals);
					} else {
						asset.minValue = asset.decimals == 0 ? 100 : 100 / Math.pow(10, asset.decimals);
					}
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

			assets.unshift({
				tokenId: 'erg',
				name: 'ERG',
				decimals: 9,
				amount: $connected_wallet_balance,
				displayAmount: Number($connected_wallet_balance) / Math.pow(10, 9),
				minValue: 0.1,
				imageLink: 'https://ergexplorer.com/images/logo-new.png',
				royaltypercent: 0
			});

			additionalAssets = assets.filter(
				(a) => !selectedAssets.some((sa) => sa.tokenId == a.tokenId)
			);

			if (activeModalTab == 'offer') {
				additionalAssets = additionalAssets.filter(
					(a) => ASSETS.find((asset) => asset.tokenId == a.tokenId) || a.tokenId == 'erg'
				);
			}

			updateImageUrls($showNsfw);

			filterAssets(search);
			assetsLoading = false;

			if (sellTokenId) {
				selectToken(assets.find((a) => a.tokenId == sellTokenId));
				sellTokenId = '';
			}
		}
	}

	function selectToken(token) {
		if (selectedAssets.length >= MAX_BUNDLE_ASSETS) {
			showCustomToast(`Max limit of 10 assets per Bundle reached.`, 3000);
			return;
		}

		let hasRoyalty = selectedAssets.filter((t) => t.royaltypercent > 0);

		if (hasRoyalty.length > 0 || (selectedAssets.length > 0 && token.royaltypercent > 0)) {
			showCustomToast('Asset with royalties can not be bundled.', 3000);
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

	function cleanUpSaleWidget() {
		if (!mounted) return;
		if (openedFromEvent && activeModalTab == 'offer') return;

		selectedAssets = [];
		priceInErg = undefined;
		priceInToken = undefined;
		paymentInErg = false;
		offerToken = null;
		offerTokenId = '';
		sellTokenId = '';
		escrow = false;
		buyerAddress = '';
		openedFromEvent = false;
		offerTokenError = '';
	}

	async function sellAssets() {
		if (isPhygital) {
			escrow = false;
		}

		if (
			!$selected_wallet_ergo ||
			($selected_wallet_ergo != 'ergopay' &&
				!window.ergoConnector[$selected_wallet_ergo]?.isConnected)
		) {
			showCustomToast('Connect a wallet.', 1500, 'info');
			return;
		}
		if (selectedAssets.length < 1) {
			showCustomToast('Add assets.', 1500, 'info');
			return;
		}
		if ((paymentInErg && priceInErg == undefined) || (!paymentInErg && priceInToken == undefined)) {
			showCustomToast('Set a price.', 1500, 'info');
			return;
		}
		if (!selectedCategory) {
			showCustomToast('Select a category.', 1500, 'info');
			return;
		}
		if (escrow && buyerAddress.length != 51) {
			showCustomToast('Invalid buyer address.', 1500, 'info');
			return;
		}
		if (activeModalTab == 'offer' && !offerToken) {
			showCustomToast('Choose valid asset for offer.', 1500, 'info');
			return;
		}
		if (activeModalTab == 'sell' && !selectedToken) {
			showCustomToast('Invalid payment asset selected.', 1500, 'info');
			return;
		}

		if (activeModalTab == 'offer') {
			selectedToken = offerToken;
			selectedToken.tokenId = selectedToken.id;
		}

		processing = true;

		let myAddress, height;
		unsignedTx = null;

		if ($selected_wallet_ergo != 'ergopay') {
			myAddress = await ergo.get_change_address();
			utxos = await fetchBoxes($connected_wallet_address);
			height = await ergo.get_current_height();
		} else {
			myAddress = get(connected_wallet_address);
			utxos = await fetchBoxes($connected_wallet_address);
			height = await getBlockHeight();
		}

		const priceInNanoErg = paymentInErg ? new BigNumber(priceInErg).times(10 ** 9) : undefined;
		const priceInNanoToken = !paymentInErg
			? new BigNumber(priceInToken).times(10 ** selectedToken.decimals).toNumber()
			: undefined;

		const orderType = activeModalTab == 'sell' ? 'Sell' : 'Offer';
		let royaltypercent = selectedAssets[0].royaltypercent * 1000;

		if (activeModalTab == 'offer') {
			royaltypercent = offerToken.royaltypercent * 1000;
		}

		let unsigned;

		try {
			if (activeModalTab == 'sell') {
				if (escrow) {
					unsigned = escrowSellTx(
						ESCROW_CONTRACT,
						myAddress,
						utxos,
						height,
						DEV_PK,
						selectedAssets,
						paymentInErg,
						priceInNanoErg,
						selectedToken.tokenId,
						priceInNanoToken,
						buyerAddress,
						royaltypercent
					);
				} else {
					unsigned = sellTx(
						CONTRACT,
						myAddress,
						utxos,
						height,
						DEV_PK,
						selectedAssets,
						paymentInErg,
						priceInNanoErg,
						selectedToken.tokenId,
						priceInNanoToken,
						MART_NAME,
						selectedCategory,
						royaltypercent,
						orderType
					);
				}
			} else {
				if (escrow) {
					unsigned = escrowSellTx(
						OFFERS_ESCROW_CONTRACT,
						myAddress,
						utxos,
						height,
						DEV_PK,
						selectedAssets,
						paymentInErg,
						priceInNanoErg,
						selectedToken.tokenId,
						priceInNanoToken,
						buyerAddress,
						royaltypercent
					);
				} else {
					unsigned = sellTx(
						OFFERS_CONTRACT,
						myAddress,
						utxos,
						height,
						DEV_PK,
						selectedAssets,
						paymentInErg,
						priceInNanoErg,
						selectedToken.tokenId,
						priceInNanoToken,
						MART_NAME,
						selectedCategory,
						royaltypercent,
						orderType
					);
				}
			}
		} catch (e) {
			console.error(e);

			if (e.message && e.message.substr(0, 19) == 'Insufficient inputs') {
				showCustomToast(`Insufficient funds.`, 5000, 'danger');
			} else if (e.info && e.info == 'User rejected') {
				//
			} else {
				console.log(e);
				showCustomToast(`Failed to submit TX.`, 5000, 'danger');
			}

			processing = false;
			return;
		}

		let transactionId, signed;
		if ($selected_wallet_ergo != 'ergopay') {
			try {
				signed = await ergo.sign_tx(unsigned);
				transactionId = await ergo.submit_tx(signed);

				showCustomToast(
					`Order submitted successfully. TX ID: <a target="_new" href="https://ergexplorer.com/transactions/${transactionId}">${transactionId}</a>`,
					10000,
					'success'
				); // Notify success with TX ID

				const usedBoxIds = getCommonBoxIds(utxos, signed.inputs);
				const newOutputs = signed.outputs.filter((output) => output.ergoTree == utxos[0].ergoTree);

				updateTempBoxes(myAddress, usedBoxIds, newOutputs);

				cleanUpSaleWidget();
				await loadWalletBoxes(myAddress, true);
			} catch (e) {
				console.error(e);
				showCustomToast(`Failed to submit TX.`, 5000, 'danger');
			}
		} else {
			unsignedTx = unsigned;
			isAuth = false;
			showErgopayModal = true;
		}

		processing = false;
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
		if (activeModalTab == 'offer') {
			if (displayAmount < token.minValue) {
				displayAmount = token.minValue;
				e.target.value = displayAmount;

				showCustomToast(`Minimum offer amount for ${token.name} is ${displayAmount}`, 3000);

				token.displayAmount = displayAmount;
				setTokenAmount(token, displayAmount);
			}
		} else if (activeModalTab == 'sell') {
			if (displayAmount < token.minValue) {
				displayAmount = token.minValue;
				e.target.value = displayAmount;

				showCustomToast(`Minimum amount for ${token.name} is ${displayAmount}`, 3000);

				token.displayAmount = displayAmount;
				setTokenAmount(token, displayAmount);
			}
		}
	}

	function setTokenAmount(token, displayAmount) {
		token.amount = BigInt(Math.round(displayAmount * Math.pow(10, token.decimals)));
	}

	function updateSelectedToken(this) {
		selectedToken = ASSETS.find((asset) => asset.tokenId === this.value);
		priceInToken = 0;
		jQuery('#price').focus();
	}

	async function updateOfferToken() {
		offerTokenError = '';
		offerToken = null;

		if (offerTokenId.length == 64) {
			try {
				offerTokenError = 'Loading token info...';

				let offerTokenInfo = (
					await axios.post(`https://api.ergexplorer.com/tokens/byId`, { ids: [offerTokenId] })
				).data.items[0];

				if (offerTokenInfo) {
					offerToken = offerTokenInfo;
					priceInToken = 0;
					jQuery('#price').focus();
				} else {
					offerTokenError = 'Invalid token ID.';
				}
			} catch (error) {
				offerTokenError = 'Invalid token ID.';
				console.error(error);
			}
		} else if (offerTokenId.length > 0) {
			offerTokenError = 'Invalid token ID.';
		}
	}

	function priceValidate(e, token) {
		if (e.target.value.length == 0) {
			e.target.value = 0;
		}

		if (activeModalTab == 'sell') {
			let nanoValue = new BigNumber(e.target.value).times(Math.pow(10, token.decimals));
			let minValue = 100;

			if (nanoValue < minValue) {
				let displayAmount = new BigNumber(minValue)
					.div(Math.pow(10, token.decimals))
					.toFormat()
					.replaceAll(',', '.');

				e.target.value = displayAmount;
				priceInToken = displayAmount;

				showCustomToast(`Minimum sell price for ${token.name} is ${displayAmount}`, 3000);
			}
		} else if (activeModalTab == 'offer') {
			let nanoValue = new BigNumber(e.target.value).times(Math.pow(10, offerToken.decimals));
			let minValue = 1;

			if (nanoValue < minValue) {
				let displayAmount = new BigNumber(minValue)
					.div(Math.pow(10, offerToken.decimals))
					.toFormat()
					.replaceAll(',', '.');

				e.target.value = displayAmount;
				priceInToken = displayAmount;

				showCustomToast(`Minimum amount for ${offerToken.name} is ${displayAmount}`, 3000);
			}
		}
	}

	onMount(() => {
		let tempTokenId = '';

		let isOfferEvent = false;
		let isSellEvent = false;

		if (offerTokenId && offerTokenId != '') {
			tempTokenId = offerTokenId;
			activeModalTab = 'offer';
			openedFromEvent = true;
			isOfferEvent = true;
			updateOfferToken();
		}

		if (sellTokenId && sellTokenId != '') {
			tempTokenId = sellTokenId;
			activeModalTab = 'sell';
			openedFromEvent = true;
			isSellEvent = true;
		}

		cleanUpSaleWidget();

		if (isOfferEvent) offerTokenId = tempTokenId;
		if (isSellEvent) sellTokenId = tempTokenId;

		mounted = true;

		return () => {
			mounted = false;
		};
	});

	function close() {
		offerTokenId = '';
		sellTokenId = '';
		dispatch('close');
	}

	$: activeModalTab && loadWalletBoxes($selected_wallet_ergo);
	$: activeModalTab && cleanUpSaleWidget();

	// Function to scroll to the top of the modal content
	const scrollToTop = () => {
		const modalContent = document.querySelector('.modal-content');
		if (modalContent) {
			modalContent.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}
	};

	function updateImageUrls(showNsfw) {
		const allAssets = additionalAssets.concat(selectedAssets);

		imageUrls = allAssets.reduce((acc, asset) => {
			acc[asset.tokenId] = getImageUrl(asset, showNsfw);
			return acc;
		}, {});
	}

	function changeTab(tab) {
		if (processing) return;

		activeModalTab = tab;
	}

	$: updateImageUrls($showNsfw);
</script>

<div
	class="table overflow-x-hidden leading-6 relative text-white font-bold w-100 text-center mt-2 mb-0"
	style="font-family:'Manrope';font-size:1.5em;box-sizing: border-box;"
>
	New Listing
</div>

<div class="flex mb-0 mt-2">
	<button
		style="border-radius: 0.5rem 0rem 0rem 0.5rem;"
		class="flex-1 px-6 py-2 font-medium transition-colors duration-200 {activeModalTab === 'sell'
			? 'bg-footer text-primary'
			: 'bg-bg contribute-tab text-gray-300'}"
		on:click={() => changeTab('sell')}
	>
		Sell
	</button>
	<button
		style="border-radius: 0rem 0.5rem 0.5rem 0rem;"
		class="flex-1 px-6 py-2 font-medium transition-colors duration-200 {activeModalTab === 'offer'
			? 'bg-footer text-primary'
			: 'bg-bg contribute-tab text-gray-300'}"
		on:click={() => changeTab('offer')}
	>
		Offer
	</button>
</div>

{#if activeModalTab == 'sell'}
	<p class="text-light text-sm" style="margin-top: -15px;">
		When listing asset(s) for sale, the buyer covers the fee at the time of purchase.
	</p>
	<p class="text-light text-sm" style="margin-top: -20px; margin-bottom: -10px;">
		Can list any token you own.
	</p>
{:else}
	<p class="text-light text-sm" style="margin-top: -15px;">
		When listing asset(s) as offer, fee is paid from offered assets at the time of purchase.
	</p>
	<p class="text-light text-sm" style="margin-top: -20px; margin-bottom: -10px;">
		Can offer only confirmed payment assets.
	</p>
{/if}

{#if editAssets && selectedAssets.length == 0}
	<p class="mt-2">No assets selected.</p>
{:else if editAssets}
	<div id="selected-assets-sticky" class="z-10 sticky pt-4 pb-2 bg-form">
		{#if activeModalTab == 'sell'}
			<p>Assets for sale:</p>
		{:else}
			<p>Offered assets:</p>
		{/if}
		<div class="selected-assets mt-2 pb-2">
			{#each selectedAssets as token}
				<div class="flex flex-row rounded-[8px] gap-x-2 token-card w-100 p-2">
					<div class="h-full w-[85px] bg-black rounded-lg">
						<img
							src={imageUrls[token.tokenId]}
							alt={token.name}
							class="token-image object-contain rounded-lg"
							on:error={(event) => setPlaceholderImage(event, token)}
						/>
					</div>
					<div class="flex flex-col flex-grow min-w-0 space-y-3">
						<span class="token-name text-white">{token.name}</span>
						<input
							class="token-amount"
							type="number"
							min="0"
							step={1 / Math.pow(10, token.decimals)}
							bind:value={token.displayAmount}
							on:input={(e) => updateTokenAmount(e, token, token.displayAmount)}
							on:blur={(e) => tokenAmountValidate(e, token, token.displayAmount)}
						/>
					</div>
					<div>
						<button
							class="btn-remove btn btn-secondary p-2 px-3"
							on:click={() => removeToken(token)}>x</button
						>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<div class="actions bg-bg p-3 rounded-lg">
	<div
		class="flex flex-wrap flex-col sm:flex-row space-x-0 space-y-2 sm:space-y-0 sm:space-x-4 mb-2"
	>
		<div class="flex-1">
			<label class="pb-1 font-bold text-md ms-[3px]" for="category">Category:</label>
			<select
				id="category"
				class="bg-form text-white-900 text-sm rounded-lg focus-primary block w-full p-2.5"
				bind:value={selectedCategory}
			>
				<option value="" disabled selected>Select a category</option>
				{#each CATEGORIES as category}
					<option value={category.name}>{category.name}</option>
				{/each}
			</select>
		</div>

		{#if activeModalTab == 'sell'}
			<div class="flex-1">
				<label class="pb-1 font-bold text-md md:ms-[3px]" for="paymentToken">Payment Asset:</label>
				<select
					id="paymentToken"
					class="bg-form text-white-900 text-sm rounded-lg focus-primary block w-full p-2.5"
					on:change={updateSelectedToken}
					bind:value={selectedPaymentTokenId}
				>
					{#each ASSETS as asset}
						<option value={asset.tokenId} selected={asset.tokenId === selectedPaymentTokenId}>
							{asset.name}
						</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	{#if activeModalTab == 'offer'}
		<div class="mt-2">
			<div class="flex-1">
				<label class="pb-1 font-bold text-md ms-[3px]" for="paymentToken"
					>Desired asset token ID:</label
				>
				<input
					class="form-control w-100 mb-1 bg-form border-0 text-white focus-primary"
					type="text"
					placeholder="Asset Token ID"
					bind:value={offerTokenId}
					on:input={updateOfferToken}
				/>
			</div>

			{#if offerToken}
				<div class="flex flex-col sm:flex-row w-100 rounded-xl bg-bg h-full sm:h-[200px] mt-2">
					<div class="flex flex-grow-1 flex-col gap-x-2 p-3">
						<p><b>Name:</b> {offerToken.name}</p>
						<p><b>Decimals:</b> {offerToken.decimals}</p>
						<p><b>Royalty:</b> {offerToken.royaltypercent}%</p>
					</div>
					<div class="flex flex-grow-1 justify-end">
						<img
							src={offerToken.cachedurl ?? offerToken.iconurl ?? 'none'}
							class="max-w-full max-h-full h-full sm:h-[200px] w-full sm:w-auto rounded-b-lg sm:rounded-none sm:rounded-e-lg"
							alt="Offer token"
							on:error={(event) => setPlaceholderImage(event, offerToken)}
						/>
					</div>
				</div>
			{:else if offerTokenError}
				<div class="flex flex-col gap-x-2 p-3 rounded-xl mt-2 bg-bg">
					<p>{offerTokenError}</p>
				</div>
			{/if}
		</div>
	{/if}

	<div class="mt-2">
		{#if paymentInErg}
			<input
				class="form-control w-100 mb-1 bg-form border-0 text-white focus-primary"
				type="number"
				min="0"
				step="0.000000001"
				placeholder="Price in ERG"
				bind:value={priceInErg}
			/>
		{:else}
			<div class="flex-1">
				{#if activeModalTab == 'sell'}
					<label for="price" class="pb-1 text-md ms-[3px]"
						>Price in {selectedToken ? ` ${selectedToken.name}` : ''}:</label
					>
				{:else}
					<label for="price" class="pb-1 text-md ms-[3px]">Desired asset amount:</label>
				{/if}
				<input
					id="price"
					class="form-control w-100 mb-1 bg-form border-0 text-white focus-primary"
					type="number"
					min={100 / Math.pow(10, selectedToken.decimals)}
					step={1 / Math.pow(10, selectedToken.decimals)}
					placeholder={activeModalTab === 'offer' ? 'Amount' : 'Price'}
					bind:value={priceInToken}
					on:blur={(e) => priceValidate(e, selectedToken)}
				/>
			</div>
		{/if}
	</div>

	{#if !isPhygital}
		<div class="form-group mt-4">
			<div class="flex items-center">
				<input
					bind:checked={escrow}
					id="checked-checkbox"
					type="checkbox"
					class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded bg-gray-700 border-gray-600"
				/>
				<label for="checked-checkbox" class="ms-2 text-sm font-medium text-gray-100">Escrow</label>
			</div>
			{#if escrow}
				<input
					bind:value={buyerAddress}
					class="mt-2 form-control w-100 mb-1 bg-form border-0 text-white focus-primary"
					type="text"
					placeholder="Buyer address"
				/>
			{/if}
		</div>
	{:else if !$authorizedMerchant}
		<p class="mt-3">You are not authorized to list <b>Phygital NFT</b>s.</p>
		<p>
			Contact us on <a class="text-primary" target="_new" href="https://t.me/MewFinance">Telegram</a
			> to apply.
		</p>
	{/if}
</div>

{#if editAssets}
	<h6 class="text-white text-xl font-bold font-manrope text-center mt-3">Your Assets</h6>
	<div class="bg-bg p-3 rounded-xl flex flex-col space-y-3">
		<p>
			<b>Address:</b>
			<a href="https://ergexplorer.com/addresses/{$connected_wallet_address}" target="_new"
				>{truncateAddress($connected_wallet_address)}</a
			>
		</p>
		{#if !assetsLoading}
			<input
				bind:value={search}
				class="form-control w-100 bg-form border-0 text-white focus-primary"
				type="text"
				placeholder="Search by asset name..."
			/>
		{/if}
	</div>
	{#if assetsLoading}
		<div class="w-100 relative min-h-[150px] col-span-12 mt-12 bg-form">
			<Loading />
		</div>
	{:else if !assetsLoading && additionalAssetsFiltered.length > 0}
		<div class="additional-assets">
			{#each additionalAssetsFiltered as token, index}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<!-- svelte-ignore missing-declaration -->
				<div
					in:fly={{ y: -20, duration: 200, delay: index * 50 }}
					out:fade={{ duration: 150 }}
					class:token-restricted={token.restricted}
					class="flex flex-row rounded-[8px] gap-x-2 token-card w-100 p-2"
					on:click={() => {
						if (token.restricted) {
							showCustomToast('This token is restricted from being listed.', 3000, 'warning');
							return;
						}

						selectToken(token);
					}}
				>
					<div class="h-full min-w-[85px] w-[85px] flex-grow bg-black rounded-lg">
						<img
							src={imageUrls[token.tokenId]}
							alt={token.name}
							class="token-image object-contain rounded-lg"
							on:error={(event) => setPlaceholderImage(event, token)}
						/>
					</div>
					<div class="flex flex-col flex-grow min-w-0 space-y-3">
						<span class="token-name text-white">{token.name}</span>
						<span class:invisible={token.tokenId == 'erg'} class="token-royalty text-xs"
							><span class="text-primary">Royalties:</span>
							{#if token.royaltypercent > 0}
								<span class="text-white">{nFormatter(token.royaltypercent)}%</span>
							{:else}
								<span class="text-light">0%</span>
							{/if}
						</span>
						<input class="token-amount disabled" value={nFormatter(token.displayAmount)} disabled />
					</div>
				</div>
			{/each}
			{#if additionalAssetsFiltered.length > 10}
				<button class="scroll-top-button btn btn-secondary" on:click={scrollToTop}>▲</button>
			{/if}
		</div>
	{:else}
		<p>No assets found.</p>
	{/if}
{/if}

<div
	class="flex sticky bg-form flex-col space-y-3 gap-[20px] sm:flex-row sm:space-y-0 sm:space-x-4 ms-[-22px] bottom-[-20px] sm:bottom-[-25px] p-4 justify-between"
	style="width: calc(100% + 45px);"
>
	<button
		disabled={processing}
		class="max-w-full sm:max-w-[200px] order-1 sm:order-2 flex-grow btn btn-secondary m-0"
		style="font-weight:600;"
		on:click={close}>Cancel</button
	>
	<button
		class="max-w-full sm:max-w-[200px] order-2 sm:order-1 flex-grow btn btn-primary m-0"
		disabled={(isPhygital && !$authorizedMerchant) || processing}
		style="font-weight:600;"
		on:click={sellAssets}>Submit</button
	>
</div>

{#if showErgopayModal}
	<ErgopayModal bind:showErgopayModal bind:isAuth bind:unsignedTx>
		<button slot="btn">Close</button>
	</ErgopayModal>
{/if}

<style>
	:global(body) {
		background-color: #1a1a1a;
		color: #ffffff;
		margin: 0;
		padding: 0;
	}

	#selected-assets-sticky {
		top: -25px;
	}

	.box {
		background: linear-gradient(145deg, #2a2a2a, #333333);
		border-radius: 15px;
		padding: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.title {
		font-size: 1.5rem;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.scroll-top-button {
		bottom: 10px;
		right: 10px;
		padding: 10px;
		cursor: pointer;
		font-size: 16px;
		line-height: 0;
		grid-column: -2;
		min-height: 100px;
		height: fill-available;
	}

	.selected-assets {
		overflow-y: auto;
		overflow-x: hidden;
		max-height: 200px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
		gap: 1rem;
		border-bottom: 1px solid #333;
	}

	.token-card {
		background-color: var(--footer);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: all 0.2s ease;
		box-sizing: border-box;
		place-content: space-between;
	}

	.token-card:hover {
		scale: 1.03;
	}

	.token-name {
		font-weight: bold;
		white-space: wrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-height: 50px;
		text-align: start;
	}

	.token-restricted {
		background: #333 !important;
		cursor: not-allowed !important;
		scale: 1 !important;
	}

	.token-amount {
		background-color: var(--forms-bg);
		border: none;
		padding: 5px 0;
		border-radius: 5px;
		color: #ffffff;
		width: 100%;
		text-align: center;
	}

	.token-royalty {
		width: 100%;
		text-align: start;
	}

	.token-image {
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain; /* Fill container by covering it */
		object-position: center; /* Center the image */
		overflow: hidden;
		margin: 0 auto;
	}

	.actions {
		display: flex;
		flex-direction: column;
	}

	.payment-options {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.radio-label input {
		margin-right: 0.5rem;
	}

	.additional-assets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.additional-assets .token-card {
		cursor: pointer;
	}

	.additional-assets .token-amount {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.close-button {
		position: absolute;
		top: 0px;
		right: 0px;
		cursor: pointer;
		font-size: 16px;
		line-height: 0;
	}
</style>
