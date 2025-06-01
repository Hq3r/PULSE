import { get } from 'svelte/store';
import {
	selected_wallet_ergo,
	connected_wallet_address,
	showNsfw,
	assetsInfos,
	showPleaseWaitModal
} from '$lib/store/store';
import axios from 'axios';
import { goto } from '$app/navigation';
import { SConstant, SLong, SColl, SInt, SByte } from '@fleet-sdk/serializer';
import { ErgoAddress, OutputBuilder, RECOMMENDED_MIN_FEE_VALUE, TransactionBuilder } from '@fleet-sdk/core';
import { stringToBytes } from '@scure/base';

let toastTimeout = null;
const CUSTOM_MIN_BOX_VALUE = 400000n;

// Existing utils functions
function getDecimals(value, additional = 1) {
	if (value < 0) {
		value *= -1;
	}

	value = value.toString();
	if (value.includes('e-')) {
		let eIndex = value.indexOf('e-');
		return value.substr(eIndex + 2);
	}

	let decimals = 2;
	value = value.split('.');
	if (value.length > 1) {
		let realSmall = value[1].split('-');
		if (realSmall.length > 1) {
			decimals = parseInt(realSmall[1]) + 1;
		} else {
			for (let j = 0; j < value[1].length; j++) {
				if (value[1][j] != '0') {
					decimals = j + additional;

					if (value[1].length > j + 1 && value[1][j + 1] != '0') {
						decimals++;
					}

					break;
				}
			}
		}
	} else {
		decimals = 2;
	}

	if (decimals < 2) {
		decimals = 2;
	}

	return decimals;
}

export function nFormatter(num) {
	if (num == undefined) {
		return num;
	}

	num = Number(num);
	let digits = getDecimals(num);

	const lookup = [
		{ value: 1, symbol: '' },
		{ value: 1e6, symbol: 'M' },
		{ value: 1e9, symbol: 'B' },
		{ value: 1e12, symbol: 'T' },
		{ value: 1e15, symbol: 'P' },
		{ value: 1e18, symbol: 'E' }
	];

	if (num > 10) {
		digits = 2;
	}

	let minimumFractionDigits = 2;
	if (digits < minimumFractionDigits) {
		minimumFractionDigits = digits;
	}

	const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
	var item = lookup
		.slice()
		.reverse()
		.find(function (item) {
			return num >= item.value;
		});

	return item
		? (num / item.value)
				.toLocaleString('en-US', {
					maximumFractionDigits: digits,
					minimumFractionDigits: minimumFractionDigits
				})
				.replace(rx, '$1') + item.symbol
		: num.toLocaleString('en-US', {
				maximumFractionDigits: digits,
				minimumFractionDigits: minimumFractionDigits
		  });
}

export function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function showCustomToast(text, time, type = 'default') {
	const toastElement = jQuery('#customToast');
	const toastBody = jQuery('#customToastBody');

	// Reset classes and styles
	toastElement.removeClass('bg-success bg-danger bg-warning bg-primary bg-info');
	toastBody.removeClass('text-white');

	// Set dark theme
	toastElement.addClass('bg-dark text-white');

	let icon = '';

	switch (type) {
		case 'success':
			icon = ``<svg class="me-2" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="#4CAF50"/>
          </svg>``;
			break;
		case 'error':
		case 'danger':
			icon = ``<svg class="me-2" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="#F44336"/>
          </svg>``;
			break;
		case 'info':
			icon = ``<svg class="me-2" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="#2196F3"/>
          </svg>``;
			break;
		case 'warning':
			icon = ``<svg class="me-2" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
            <path d="M1 21H23L12 2L1 21ZM13 18H11V16H13V18ZM13 14H11V10H13V14Z" fill="#FFC107"/>
          </svg>``;
			break;
		default:
			break;
	}

	toastBody.html(
		`<div style="display: flex; align-items: center;">${icon}<span>${text}</span></div>`
	);

	toastElement.off('click');

	const toastLiveExample = document.getElementById('customToast');
	const toast = new bootstrap.Toast(toastLiveExample);
	toast.show();

	if (toastTimeout != null) {
		clearTimeout(toastTimeout);
		toastTimeout = null;
	}

	if (time > 0) {
		toastTimeout = setTimeout(() => {
			toast.hide();
		}, time);
	} else {
		toastElement.click(() => {
			toast.hide();
		});
	}
}

export async function getConnectedWalletAddress() {
	const selectedWalletErgo = get(selected_wallet_ergo);
	const connectedWalletAddress = get(connected_wallet_address);

	if (
		selectedWalletErgo &&
		selectedWalletErgo != 'ergopay' &&
		window.ergoConnector[selectedWalletErgo]?.isConnected
	) {
		return await ergo.get_change_address();
	} else if (selectedWalletErgo && selectedWalletErgo == 'ergopay') {
		return connectedWalletAddress;
	} else {
		return '';
	}
}

export function isWalletConected() {
	const selectedWalletErgo = get(selected_wallet_ergo);

	return (
		(selectedWalletErgo &&
			selectedWalletErgo != 'ergopay' &&
			window.ergoConnector[selectedWalletErgo]?.isConnected) ||
		(selectedWalletErgo && selectedWalletErgo == 'ergopay')
	);
}

export function formatNftUrl(r9RenderedValue) {
	let link = hex2a(r9RenderedValue);

	if (link.includes('ipfs://')) {
		link = link.replace('ipfs://', '');
		link = 'https://nftstorage.link/ipfs/' + link;
	} else if (link.includes('https://ipfs.infura.io')) {
		link = link.replace('https://ipfs.infura.io', 'https://ipfs.io');
	} else if (!link.includes('https://') && !link.includes('http://')) {
		link = 'https://gateway.pinata.cloud/ipfs/' + link;
	}

	return link;
}

export function hex2a(hexx) {
	if (hexx == undefined) {
		return undefined;
	}

	let hex = hexx.toString(); //force conversion
	let str = '';

	for (let i = 0; i < hex.length; i += 2) {
		str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
	}

	return str;
}

export function getImageUrl(token) {
	try {
		let aInfo = get(assetsInfos);

		const assetInfoMap = new Map(aInfo.map((item) => [item.id, item]));
		let tokenInfo = assetInfoMap.get(token.tokenId);

		if (tokenInfo && !token.isUpdated) {
			token.isUpdated = true;
			token.name = tokenInfo.name;
			token.decimals = parseInt(tokenInfo.decimals);

			if (tokenInfo.additionalRegisters) {
				const r7SerializedValue = tokenInfo.additionalRegisters.R7?.serializedValue;
				if (r7SerializedValue === '0e020101') {
					token.isImage = true;
				}
				if (r7SerializedValue === '0e020102') {
					token.isAudio = true;
				}
				if (r7SerializedValue === '0e020103') {
					token.isVideo = true;
				}
			}

			if (tokenInfo.cachedurl && tokenInfo.cachedurl !== '') {
				token.imageLink = tokenInfo.cachedurl;
			} else if (tokenInfo.additionalRegisters.R9?.renderedValue) {
				token.imageLink = formatNftUrl(tokenInfo.additionalRegisters.R9.renderedValue);
			} else {
				token.imageLink = '';
			}

			token.nsfw = tokenInfo.nsfw;
			token.scam = tokenInfo.scam;
			token.mintTx = tokenInfo.transactionId;
		}
	} catch (e) {
		//
	}

	if (token.nsfw && !get(showNsfw)) {
		return getPlaceholderImage(token);
	}

	let imageUrl;

	if (hasIcon(token.tokenId)) {
		return getIcon(token.tokenId);
	}

	imageUrl = token.imageLink || `https://spectrum.fi/logos/ergo/${token.tokenId}.svg`;

	return imageUrl;
}

function getPlaceholderImage(asset) {
	let imgSrc = '/default/token.png';

	if (asset.isImage) {
		imgSrc = '/default/nft-image.png';
	}

	if (asset.isAudio) {
		imgSrc = '/default/nft-audio.png';
	}

	if (asset.isVideo) {
		imgSrc = '/default/nft-video.png';
	}

	return imgSrc;
}

export function setPlaceholderImage(e, asset) {
	let imgSrc = getPlaceholderImage(asset);

	jQuery(e.target).prop('src', imgSrc);
}

export function destroy(e) {
	jQuery(e.currentTarget).remove();
}

export function destroyParent(e) {
	jQuery(e.currentTarget).parent().remove();
}

export function truncateAddress(address) {
	return address ? `${address.slice(0, 3)}..${address.slice(-3)}` : 'N/A';
}

export function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

export function isMobileDevice() {
	return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getCommonBoxIds(array1, array2) {
	// Create sets of boxIds from both arrays
	const set1 = new Set(array1.map((obj) => obj.boxId));
	const set2 = new Set(array2.map((obj) => obj.boxId));

	// Use filter and has method to find common boxIds
	return Array.from(set1).filter((boxId) => set2.has(boxId));
}

export function consumeClick(event) {
	event.stopPropagation();
}

export async function sendMessageToGroup(message, botToken, groupId) {
	const sendMessageEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage?parse_mode=HTML&disable_web_page_preview=true`;

	const params = new URLSearchParams({
		chat_id: groupId,
		text: message
	});

	try {
		const response = await axios.post(sendMessageEndpoint, params);
		if (response.data && response.data.ok) {
			console.log('Message sent successfully!');
		} else {
			console.log('Failed to send the message.');
		}
	} catch (error) {
		console.error('Error sending message:', error);
	}
}

export const setLocalStorage = (key, value, ttlMinutes) => {
	const ttl = ttlMinutes * 60 * 1000; // Convert minutes to milliseconds
	const expiry = Date.now() + ttl;

	const data = {
		value,
		expiry
	};

	localStorage.setItem(key, JSON.stringify(data));
};

export const getLocalStorage = (key) => {
	const itemStr = localStorage.getItem(key);

	if (!itemStr) {
		return null; // Key not found
	}

	const item = JSON.parse(itemStr);
	const now = Date.now();

	// Check if the item has expired
	if (now > item.expiry) {
		localStorage.removeItem(key); // Remove expired item
		return null;
	}

	return item.value; // Return the stored value
};

export function showPleaseWait() {
	showPleaseWaitModal.set(true);
}

export function hidePleaseWait() {
	showPleaseWaitModal.set(false);
}

export function updateSearchParams(param, value, page) {
	let changed = false;

	if (value && page.url.searchParams.get(param) !== value) {
		page.url.searchParams.set(param, value);
		changed = true;
	} else if (value === null && page.url.searchParams.get(param) !== null) {
		page.url.searchParams.delete(param);
		changed = true;
	}

	if (changed) {
		goto(page.url.toString(), { replaceState: true, keepFocus: true });

		const event = new CustomEvent('urlChanged', {
			detail: { params: page.url.searchParams }
		});
		window.dispatchEvent(event);
	}
}

export function parseMempoolBoxToOrder(box) {
	const pricenano = parseInt(SConstant.from(hexToBytes(box.additionalRegisters.R4)).data);

	const hexToUint8Array = (hex) =>
		new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
	const sigmaProp = ErgoAddress.fromPublicKey(
		hexToUint8Array(box.additionalRegisters.R5.substring(4))
	);

	// Get the encoded address
	const seller = sigmaProp.encode();

	const fee = parseInt(SConstant.from(hexToBytes(box.additionalRegisters.R6)).data);
	const asset = bytesToString(SConstant.from(hexToBytes(box.additionalRegisters.R7)).data);
	const info = bytesToString(SConstant.from(hexToBytes(box.additionalRegisters.R8)).data).split(
		','
	);
	const royalty = parseInt(SConstant.from(hexToBytes(box.additionalRegisters.R9)).data);

	const mart = info[0];
	const category = info[1];
	const type = info[2];

	const decimals = 0;
	const price = 1000; // asset === '' ? pricenano / (10 ** 9) : pricenano / (10 ** decimals);

	const outBox = {};

	outBox.contract = '1006322691';
	outBox.seller = seller;
	outBox.buyer = null;
	outBox.payasset = asset === '' ? 'ERG' : asset;
	outBox.payamount = price;
	outBox.category = category;
	outBox.timestamp = getFormattedTimestamp();
	outBox.buytime = null;
	outBox.boxin = box.boxId;
	outBox.txidin = null;
	outBox.txidout = null;
	outBox.payassetname = null;
	outBox.assets = box.assets;
	outBox.ismempool = true;
	outBox.box = box;

	return outBox;
}

function hexToBytes(hex) {
	return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

function bytesToString(bytes) {
	return new TextDecoder().decode(bytes);
}

function getFormattedTimestamp() {
	const now = new Date();
	return now.toISOString().slice(0, -1); // Removes the 'Z' at the end
}

// === CHAT-SPECIFIC UTILITY FUNCTIONS ===

// Clean up address if it has a "3" prefix
export function cleanAddress(address) {
	if (address && address.startsWith('3') && address.length > 50) {
		return address.substring(1);
	}
	return address;
}

// Check if user is admin
export function isAdminWallet(connectedWalletAddress) {
	return connectedWalletAddress === '9gvDVNy1XvDeFoi4ZHn5v6u3tFRECMXGKbwuHbijJu6Z2hLQTQz';
}

// Format discovered room name
export function formatDiscoveredRoomName(id) {
	return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
}

// Format sender address for display
export function formatSender(sender) {
	if (!sender) return 'Unknown';
	
	// Clean up any "3" prefix if present
	if (sender.startsWith('3') && sender.length > 50) {
		sender = sender.substring(1);
	}
	
	// Truncate long addresses
	if (sender.length > 12) {
		return `${sender.substring(0, 6)}...${sender.substring(sender.length - 4)}`;
	}
	
	return sender;
}

// Format time for display
export function formatTime(timestamp) {
	const date = new Date(timestamp * 1000);
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Decode Ergo hex format
export function decodeErgoHex(hex) {
	try {
		// If it's not a string or empty, return default
		if (!hex || typeof hex !== 'string') {
			return String(hex);
		}
		
		// If it's a valid hex string
		if (/^[0-9A-Fa-f]+$/.test(hex)) {
			// If it starts with '0e', it's a Coll[Byte] serialized value
			if (hex.startsWith('0e')) {
				// Skip the '0e' prefix and length bytes
				hex = hex.substring(4);
				
				// Decode the hex string to bytes
				const bytes = [];
				for (let i = 0; i < hex.length; i += 2) {
					bytes.push(parseInt(hex.substring(i, i + 2), 16));
				}
				
				// Convert bytes to UTF-8 string
				const result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
				return result;
			}
		}
		
		// If it's not a hex string or doesn't have 0e prefix, try to return as-is
		return hex;
	} catch (e) {
		return String(hex); // Return as-is in case of error
	}
}

// Encryption/Decryption functions
export function encryptMessage(message, secretKey = "ergochat") {
	if (!message) return "";
	
	// For longer text, use a derived key based on position
	let encrypted = "";
	
	for (let i = 0; i < message.length; i++) {
		// Get character code from message
		const charCode = message.charCodeAt(i);
		
		// Derive key character based on position and key
		const keyChar = secretKey.charCodeAt((i + (i % 5)) % secretKey.length);
		
		// XOR operation for encryption
		const encryptedChar = charCode ^ keyChar;
		
		// Convert to hex
		const hexChar = encryptedChar.toString(16).padStart(2, '0');
		encrypted += hexChar;
	}
	
	// Add prefix to identify encrypted messages
	return "enc-" + encrypted;
}

export function decryptMessage(encrypted, secretKey = "ergochat") {
	// Basic validation
	if (!encrypted || typeof encrypted !== 'string') {
		return encrypted;
	}
	
	// Must start with the encryption prefix
	if (!encrypted.startsWith("enc-")) {
		return encrypted;
	}
	
	try {
		// Remove prefix
		const hexStr = encrypted.substring(4);
		
		// Validate hex characters
		if (!/^[0-9a-fA-F]+$/.test(hexStr)) {
			return encrypted;
		}
		
		let decrypted = "";
		
		// Process hex pairs
		for (let i = 0; i < hexStr.length; i += 2) {
			if (i + 1 >= hexStr.length) break; // Skip incomplete pair
			
			// Convert hex pair to character code
			const hexPair = hexStr.substring(i, i + 2);
			const encryptedChar = parseInt(hexPair, 16);
			
			// Calculate position and key character - exactly matching encryption
			const position = i/2;
			const keyChar = secretKey.charCodeAt((position + (position % 5)) % secretKey.length);
			
			// XOR operation for decryption
			const decryptedChar = encryptedChar ^ keyChar;
			
			// Add character to result
			decrypted += String.fromCharCode(decryptedChar);
		}
		
		return decrypted;
	} catch (error) {
		console.error("Error in decryption:", error);
		return encrypted; // Return original on error
	}
}

export function isEncryptedText(text) {
	if (!text || typeof text !== 'string' || !text.startsWith("enc-")) {
		return false;
	}
	
	// Further validate that everything after "enc-" is valid hex
	const hexPart = text.substring(4); // Skip the "enc-" prefix
	return /^[0-9a-fA-F]+$/.test(hexPart);
}

// Room code encryption/decryption
export function encryptRoomCode(code, secretKey = "ergochat") {
	if (!code) return "";
	
	// Ensure the code is a string
	const codeStr = String(code);
	let encrypted = "";
	
	// XOR each character with a character from the key
	for (let i = 0; i < codeStr.length; i++) {
		const codeChar = codeStr.charCodeAt(i);
		const keyChar = secretKey.charCodeAt(i % secretKey.length);
		const encryptedChar = codeChar ^ keyChar;
		
		// Convert to hex and ensure it's 2 digits
		const hexChar = encryptedChar.toString(16).padStart(2, '0');
		encrypted += hexChar;
	}
	
	// Add a prefix to identify encrypted codes
	return "enc-" + encrypted;
}

export function decryptRoomCode(encrypted, secretKey = "ergochat") {
	if (!encrypted || !encrypted.startsWith("enc-")) return "";
	
	// Remove the prefix
	const hexStr = encrypted.substring(4);
	let decrypted = "";
	
	// Process each pair of hex characters
	for (let i = 0; i < hexStr.length; i += 2) {
		if (i + 1 >= hexStr.length) break;
		
		const hexPair = hexStr.substring(i, i + 2);
		const encryptedChar = parseInt(hexPair, 16);
		const keyChar = secretKey.charCodeAt((i/2) % secretKey.length);
		const decryptedChar = encryptedChar ^ keyChar;
		
		decrypted += String.fromCharCode(decryptedChar);
	}
	
	return decrypted;
}

export function isEncryptedRoomCode(code) {
	return code && typeof code === 'string' && code.startsWith("enc-");
}

// Extract and decrypt all encrypted parts
export function extractAndDecryptAll(content) {
	// Basic input validation
	if (!content || typeof content !== 'string') {
		return content;
	}
	
	// Case 1: If the content is simply an encrypted string, decrypt it directly
	if (content.startsWith("enc-") && /^enc-[0-9a-fA-F]+$/.test(content)) {
		return decryptMessage(content);
	}
	
	// Case 2: If the content doesn't contain "enc-", no decryption needed
	if (!content.includes("enc-")) {
		return content;
	}
	
	// Case 3: The message has an encrypted part somewhere in the string
	
	// Look for a clean match of "enc-" followed by hex characters at the end of the string
	const endEncryptedMatch = content.match(/(.*?)(enc-[0-9a-fA-F]+)$/);
	
	if (endEncryptedMatch) {
		// We found a clean encrypted part at the end
		const plainPrefix = endEncryptedMatch[1];
		const encryptedPart = endEncryptedMatch[2];
		
		// Decrypt the encrypted part
		const decryptedPart = decryptMessage(encryptedPart);
		
		// Combine the plain prefix with the decrypted part
		return plainPrefix + decryptedPart;
	}
	
	// If not a clean end match, look for all enc- patterns
	const encryptedPattern = /enc-[0-9a-fA-F]+/g;
	let result = content;
	let match;
	
	// Find all matches of encrypted text
	while ((match = encryptedPattern.exec(content)) !== null) {
		const startPos = match.index;
		
		// Try to find where this encrypted part ends
		let endPos = startPos + 4; // Start after "enc-"
		
		while (endPos < content.length && /[0-9a-fA-F]/.test(content[endPos])) {
			endPos++;
		}
		
		// Extract the full encrypted string
		const fullEncrypted = content.substring(startPos, endPos);
		
		// Only decrypt if it looks like a proper encrypted string
		if (fullEncrypted.length > 8) { // At least "enc-" plus some hex
			const decryptedPart = decryptMessage(fullEncrypted);
			
			// Replace this encrypted part with the decrypted version
			result = result.replace(fullEncrypted, decryptedPart);
		}
		
		// Update the regex lastIndex to avoid infinite loop
		encryptedPattern.lastIndex = startPos + 1;
	}
	
	return result;
}

// Transaction creation
export function createMessageTx(
	chatContract,
	userAddress,
	userUtxos,
	height,
	message,
	chatroomId = 'general',
	parentId = null
) {
	// Get current timestamp
	const timestamp = Math.floor(Date.now() / 1000);
	
	// Clean the address if needed before encoding
	const cleanedAddress = cleanAddress(userAddress);
	
	// For private rooms, use the encrypted blockchain roomId
	let blockchainChatroomId = chatroomId;
	
	if (chatroomId.startsWith('private-')) {
		// Find the room in chatrooms
		const room = window.chatrooms?.find(r => r.id === chatroomId);
		if (room && room.blockchainRoomId) {
			// Use the encrypted version for blockchain
			blockchainChatroomId = room.blockchainRoomId;
		} else {
			// If not found, encrypt the ID directly (for backward compatibility)
			const originalCode = chatroomId.replace('private-', '');
			const encryptedCode = encryptRoomCode(originalCode);
			blockchainChatroomId = 'private-' + encryptedCode;
		}
	}
	
	// Encrypt message content
	const encryptedMessage = encryptMessage(message);
	
	// Convert values to bytes
	const messageBytes = stringToBytes('utf8', encryptedMessage);
	const addressBytes = stringToBytes('utf8', cleanedAddress);
	const chatroomBytes = stringToBytes('utf8', blockchainChatroomId);
	const parentIdBytes = parentId ? stringToBytes('utf8', parentId) : new Uint8Array(0);
	
	// Create output box with message data
	const chatBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContract)
		.setAdditionalRegisters({
			R4: SColl(SByte, addressBytes).toHex(),        // Sender address
			R5: SColl(SByte, messageBytes).toHex(),        // Encrypted message content
			R6: SLong(timestamp).toHex(),                  // Timestamp
			R7: SColl(SByte, chatroomBytes).toHex(),       // Chatroom ID (encrypted for private rooms)
			R8: SColl(SByte, parentIdBytes).toHex()        // Parent message ID (if replying)
		});
	
	// Build transaction
	const messageTx = new TransactionBuilder(height)
		.from(userUtxos)
		.to([chatBox])
		.sendChangeTo(ErgoAddress.fromBase58(userAddress))
		.payFee(RECOMMENDED_MIN_FEE_VALUE)
		.build()
		.toEIP12Object();
	
	return messageTx;
}

// Create tip transaction
export async function createTipTx(
	recipientAddress,
	senderAddress,
	chatContractAddress,
	senderUtxos,
	height,
	tokenId,
	amount,
	tokenName,
	chatroomId = 'general'
) {
	console.log(`Creating tip transaction: ${amount} ${tokenName} (${tokenId}) to ${recipientAddress} in chatroom ${chatroomId}`);
	
	// Minimum ERG value to send to recipient
	const MIN_ERG_VALUE = 1000000n; // 0.001 ERG
	
	// Get current timestamp
	const timestamp = Math.floor(Date.now() / 1000);
	
	// Format the token display
	const tokenDisplay = !tokenId || tokenId === '' ? 'ERG' : tokenName;
	
	// Calculate display amount from raw amount
	let displayAmount;
	if (!tokenId || tokenId === '') {
		// ERG - convert from nanoERG
		displayAmount = Number(amount) / 1000000000;
	} else {
		// Token - find decimals
		const SUPPORTED_TOKENS = {
			'ERG': ['', 9],
			'BUNS': ['abe0a3c2f646dcd430aac9c29d80feee865bd8b5231edb545a41105d4c8e4985', 4],
			'COMET': ['0cd8c9f416e5b1ca9f986a7f10a84191dfb85941619e49e53c0dc30ebf83324b', 0],
			'MEW': ['6c35aa395c7c75b0f67f7804d6930f0e11ef93c3387dc1faa86498d54af7962c', 2],
			'FAKU': ['f0cac602d618081f46db086726d3c4da53006b646b50e382989054dcf3c93bd8', 2],
			'PAC': ['9386c9269a697142b6b47e77684a14a121ae493d8a84c6d40d62b12f459e3899', 5]
		};
		const decimals = SUPPORTED_TOKENS[tokenName.toUpperCase()]?.[1] || 0;
		displayAmount = Number(amount) / Math.pow(10, decimals);
	}
	
	// Format the tip message that will be shown in chat
	const tipMessage = `💸 ${truncateAddress(senderAddress)} tipped ${displayAmount} ${tokenDisplay} to ${truncateAddress(recipientAddress)}`;
	
	// Convert data to bytes
	const cleanedAddress = cleanAddress(senderAddress);
	const messageBytes = stringToBytes('utf8', tipMessage);
	const addressBytes = stringToBytes('utf8', cleanedAddress);
	const chatroomBytes = stringToBytes('utf8', chatroomId);
	const emptyBytes = new Uint8Array(0); // No parent for tip messages
	
	// Create output boxes
	const outputs = [];
	
	// 1. Create recipient box for tip
	let tipBox;
	if (!tokenId || tokenId === '') {
		// ERG tip
		console.log(`Creating ERG tip box: ${amount} nanoERG`);
		tipBox = new OutputBuilder(amount, recipientAddress);
	} else {
		// Token tip
		console.log(`Creating token tip box: ${amount} of token ${tokenId}`);
		tipBox = new OutputBuilder(MIN_ERG_VALUE, recipientAddress)
			.addTokens([{
				tokenId: tokenId,
				amount: amount
			}]);
	}
	outputs.push(tipBox);
	
	// 2. Create chat message box
	console.log(`Creating chat message box to ${chatContractAddress}`);
	const chatBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContractAddress)
		.setAdditionalRegisters({
			R4: SColl(SByte, addressBytes).toHex(),  // Sender address
			R5: SColl(SByte, messageBytes).toHex(),  // Tip message content
			R6: SLong(timestamp).toHex(),            // Timestamp
			R7: SColl(SByte, chatroomBytes).toHex(), // Chatroom ID
			R8: SColl(SByte, emptyBytes).toHex()     // Empty parent ID
		});
	outputs.push(chatBox);
	
	// Build transaction with both outputs
	console.log(`Building transaction with ${outputs.length} outputs`);
	try {
		const tipTx = new TransactionBuilder(height)
			.from(senderUtxos)
			.to(outputs)
			.sendChangeTo(ErgoAddress.fromBase58(senderAddress))
			.payFee(RECOMMENDED_MIN_FEE_VALUE)
			.build()
			.toEIP12Object();
		
		console.log("Transaction built successfully");
		return tipTx;
	} catch (error) {
		console.error("Error building transaction:", error);
		// Provide more specific error for insufficient tokens
		if (error.message.includes("Insufficient inputs") && tokenId !== '') {
			throw new Error(`Insufficient tokens: Not enough ${tokenName} in your wallet.`);
		}
		throw error;
	}
}

// Token resolution
export async function resolveTokenInfo(tokenIdOrName) {
	console.log(`Resolving token info for: ${tokenIdOrName}`);
	
	const SUPPORTED_TOKENS = {
		'ERG': ['', 9],
		'BUNS': ['abe0a3c2f646dcd430aac9c29d80feee865bd8b5231edb545a41105d4c8e4985', 4],
		'COMET': ['0cd8c9f416e5b1ca9f986a7f10a84191dfb85941619e49e53c0dc30ebf83324b', 0],
		'MEW': ['6c35aa395c7c75b0f67f7804d6930f0e11ef93c3387dc1faa86498d54af7962c', 2],
		'FAKU': ['f0cac602d618081f46db086726d3c4da53006b646b50e382989054dcf3c93bd8', 2],
		'PAC': ['9386c9269a697142b6b47e77684a14a121ae493d8a84c6d40d62b12f459e3899', 5]
	};
	
	// First check if it's a supported token name (case insensitive)
	const upperTokenName = tokenIdOrName.toUpperCase();
	if (SUPPORTED_TOKENS[upperTokenName]) {
		const [tokenId, decimals] = SUPPORTED_TOKENS[upperTokenName];
		console.log(`Found supported token: ${upperTokenName}, ID: ${tokenId}, decimals: ${decimals}`);
		return {
			tokenId: tokenId,
			name: upperTokenName,
			decimals: decimals
		};
	}
	
	// Check if it's a supported token ID
	for (const [name, [id, decimals]] of Object.entries(SUPPORTED_TOKENS)) {
		if (id === tokenIdOrName) {
			return {
				tokenId: id,
				name: name,
				decimals: decimals
			};
		}
	}
	
	// If it's not in our supported list, check if it's a valid token ID
	const isTokenId = /^[0-9a-fA-F]{64}$/.test(tokenIdOrName);
	
	if (isTokenId) {
		// It's a token ID but not in our supported list, fetch details from API
		console.log(`${tokenIdOrName} appears to be an unsupported token ID, fetching details...`);
		try {
			const details = await getTokenDetails(tokenIdOrName);
			return {
				tokenId: tokenIdOrName,
				name: details.name || tokenIdOrName.substring(0, 8) + '...',
				decimals: details.decimals
			};
		} catch (error) {
			console.error(`Error fetching details for unsupported token:`, error);
			// Default to 0 decimals for unknown tokens as a safe fallback
			return {
				tokenId: tokenIdOrName,
				name: tokenIdOrName.substring(0, 8) + '...',
				decimals: 0
			};
		}
	}
	
	// If we get here, it's neither a supported token nor a valid token ID
	throw new Error(`Unsupported token: ${tokenIdOrName}. Please use one of the supported tokens or a valid token ID.`);
}

// Helper function to get token details from API
async function getTokenDetails(tokenId) {
	// This would need to be implemented based on your token API
	// For now, return default values
	return {
		name: tokenId.substring(0, 8) + '...',
		decimals: 0
	};
}

// Search functionality helpers
export function highlightSearchTerm(content, searchTerm) {
	if (!content || !searchTerm) return content;
	
	const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\	// Create output box with message data
	const chatBox = new OutputBuilder(CUSTOM_MIN_BOX_VALUE, chatContract)
		.setAdditionalRegisters({
			R4: SColl(SByte, addressBytes).toHex(),        // Sender address
			R5: SColl(SByte, messageBytes).toHex(),        // Encrypted message content
			R6: SLong(timestamp).toHex(),                  // Timestamp
			R7:')})`, 'gi');
	return content.replace(regex, '<mark>$1</mark>');
}

// Message processing for hyperlinks
export function processMessageContent(content, filterEnabled, profanityFilter) {
	if (!content) return '';
	
	// First apply profanity filter if enabled
	const filteredContent = filterEnabled ? profanityFilter.filter(content) : content;
	
	// Simplified URL regex pattern
	const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.(com|org|net|edu|gov|mil|int|co|uk|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|info|biz|name|tech|io|app|dev|xyz|me|tv|cc|ai|crypto|nft|defi|dao)[^\s]*/gi;
	
	return filteredContent.replace(urlRegex, function(url) {
		// Ensure the URL has a protocol
		let href = url;
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			href = 'https://' + url;
		}
		
		// Truncate display text for very long URLs
		let displayText = url;
		if (url.length > 60) {
			displayText = url.substring(0, 57) + '...';
		}
		
		return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="message-link">' + displayText + '</a>';
	});
}

// Command parsing
export function parseCommand(message, supportedTokens) {
	// Check if message starts with a slash
	if (!message.startsWith('/')) {
		return false;
	}
	
	// Split message into parts
	const parts = message.trim().split(' ').filter(p => p);
	const command = parts[0].toLowerCase();
	
	// Handle different commands
	switch(command) {
		case '/tip':
			if (parts.length < 3) {
				return { error: "Usage: /tip [amount] [token] [address]" };
			}
			
			const amount = parts[1];
			const token = parts[2].toUpperCase();
			const address = parts.slice(3).join(' ');
			
			return { command: 'tip', amount, token, address };
			
		case '/help':
			// Display help text
			return { command: 'help' };
			
		case '/price':
			if (parts.length < 2) {
				return { error: "Usage: /price [token]" };
			}
			return { command: 'price', token: parts[1] };
			
		default:
			return { error: `Unknown command: ${command}. Type /help for available commands.` };
	}
}

// Display help message
export function getHelpMessage(supportedTokens) {
	const supportedTokensList = Object.keys(supportedTokens).join(', ');
	
	return `
Available commands:
/tip [amount] [token] [address] - Send a tip to someone
/price [token] - Check token price (e.g., /price ERG, /price BUNS)
/help - Show this help message

Supported tokens: ${supportedTokensList}

Examples:
/tip 0.1 ERG 9hq...3aG4
/tip 10 BUNS 9hq...3aG4
/price ERG - View ERGO price and stats
/tip 5 NETA 9hq...3aG4

You can also use any token ID directly:
/tip 1 abe0a3c2f646dcd430aac9c29d80feee865bd8b5231edb545a41105d4c8e4985 9hq...3aG4
	`;
}

// Message tracking utilities
export function markRoomAsViewed(roomId, lastViewedTimestamps, unreadMessageCounts, chatrooms) {
	const now = Date.now();
	lastViewedTimestamps[roomId] = now;
	
	// Reset unread count for this room
	unreadMessageCounts[roomId] = 0;
	
	// Update chatroom object with unread count
	chatrooms = chatrooms.map(room => {
		if (room.id === roomId) {
			return { ...room, unreadCount: 0, hasNewMessages: false };
		}
		return room;
	});
	
	// Save to localStorage
	try {
		localStorage.setItem('ergoChat_lastViewedTimestamps', JSON.stringify(lastViewedTimestamps));
	} catch (error) {
		console.error("Error saving message tracking data:", error);
	}
	
	return { lastViewedTimestamps, unreadMessageCounts, chatrooms };
}

// Update unread counts when new messages arrive
export function updateUnreadCounts(newMessages, chatroomId, selectedChatroomId, lastViewedTimestamps, unreadMessageCounts, chatrooms) {
	// Skip if it's the currently viewed room
	if (chatroomId === selectedChatroomId) return { unreadMessageCounts, chatrooms };
	
	// Get the last time the user viewed this room
	const lastViewed = lastViewedTimestamps[chatroomId] || 0;
	
	// Count messages newer than last viewed time
	const newUnreadCount = newMessages.filter(msg => 
		(msg.timestamp * 1000) > lastViewed
	).length;
	
	if (newUnreadCount > 0) {
		// Update the unread count
		unreadMessageCounts[chatroomId] = (unreadMessageCounts[chatroomId] || 0) + newUnreadCount;
		
		// Update the chatroom object with unread count
		chatrooms = chatrooms.map(room => {
			if (room.id === chatroomId) {
				return { 
					...room, 
					unreadCount: unreadMessageCounts[chatroomId],
					hasNewMessages: true
				};
			}
			return room;
		});
	}
	
	return { unreadMessageCounts, chatrooms };
}

// Save custom rooms to localStorage
export function saveCustomRooms(chatrooms, defaultChatrooms) {
	const customRooms = chatrooms.filter(room => 
		!defaultChatrooms.some(dr => dr.id === room.id) && 
		!room.isDiscovered
	);
	
	localStorage.setItem('ergoChat_rooms', JSON.stringify(customRooms));
}