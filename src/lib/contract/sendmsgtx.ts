import {
    ErgoAddress,
    OutputBuilder,
    RECOMMENDED_MIN_FEE_VALUE,
    SAFE_MIN_BOX_VALUE,
    TransactionBuilder
  } from '@fleet-sdk/core';
  import { SLong, SColl, SByte, SString } from '@fleet-sdk/serializer';
  import { stringToBytes } from '@scure/base';
  
  /**
   * Creates a transaction for sending a chat message to the blockchain
   *
   * @param {string} chatContract - P2S address of the chat contract
   * @param {string} userAddress - User's wallet address
   * @param {Array<any>} userUtxos - UTXOs from user's wallet to use as inputs
   * @param {number} height - Current blockchain height
   * @param {string} message - The chat message to send
   * @returns {Object} Unsigned transaction object in EIP-12 format
   */
  export function sendMessageTx(
    chatContract,
    userAddress,
    userUtxos,
    height,
    message
  ) {
    // Get current timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Convert message to bytes
    const messageBytes = stringToBytes('utf8', message);
    
    // Create output box with message data
    const chatBox = new OutputBuilder(SAFE_MIN_BOX_VALUE, chatContract)
      .setAdditionalRegisters({
        R4: SColl(SByte, stringToBytes('utf8', userAddress)).toHex(), // Sender address
        R5: SColl(SByte, messageBytes).toHex(),                       // Message content
        R6: SLong(timestamp).toHex()                                 // Timestamp
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
  
  /**
   * Helper function to get common box IDs between UTXOs and transaction inputs
   *
   * @param {Array<any>} utxos - UTXOs from wallet
   * @param {Array<any>} inputs - Transaction inputs
   * @returns {Array<string>} Array of box IDs that are used as inputs
   */
  export function getCommonBoxIds(utxos, inputs) {
    const usedBoxIds = [];
    
    for (const input of inputs) {
      for (const utxo of utxos) {
        if (input.boxId === utxo.boxId) {
          usedBoxIds.push(utxo.boxId);
          break;
        }
      }
    }
    
    return usedBoxIds;
  }