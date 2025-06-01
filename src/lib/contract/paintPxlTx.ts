import { 
    ErgoAddress, 
    OutputBuilder, 
    RECOMMENDED_MIN_FEE_VALUE, 
    SAFE_MIN_BOX_VALUE, 
    TransactionBuilder
  } from '@fleet-sdk/core';
  import { SLong, SColl, SByte } from '@fleet-sdk/serializer';
  import { stringToBytes } from '@scure/base';
  
  /**
   * Creates a transaction for painting a pixel on the canvas
   * 
   * @param {string} canvasContract - P2S address of the pixel canvas contract
   * @param {string} userAddress - User's wallet address
   * @param {Array<any>} userUtxos - UTXOs from user's wallet to use as inputs
   * @param {number} height - Current blockchain height
   * @param {number} x - X coordinate of the pixel (horizontal position)
   * @param {number} y - Y coordinate of the pixel (vertical position)
   * @param {string} colorHex - Color value in hex format without the # prefix
   * @returns {Object} Unsigned transaction object in EIP-12 format
   */
  export function paintPixelTx(
    canvasContract,
    userAddress,
    userUtxos,
    height,
    x,
    y,
    colorHex
  ) {
    // Encode pixel data
    const pixelPosition = `${x},${y}`;
    const positionBytes = stringToBytes('utf8', pixelPosition);
    
    // Convert hex color to bytes
    const colorBytes = [];
    for (let i = 0; i < colorHex.length; i += 2) {
      colorBytes.push(parseInt(colorHex.substr(i, 2), 16));
    }
    
    // Create output box with pixel data
    const canvasBox = new OutputBuilder(SAFE_MIN_BOX_VALUE, canvasContract)
      .setAdditionalRegisters({
        R4: SLong(x).toHex(),
        R5: SLong(y).toHex(),
        R6: SColl(SByte, colorBytes).toHex(),
        R7: SColl(SByte, stringToBytes('utf8', userAddress)).toHex()
      });
    
    // Build transaction
    const paintTransaction = new TransactionBuilder(height)
      .from(userUtxos)
      .to([canvasBox])
      .sendChangeTo(ErgoAddress.fromBase58(userAddress))
      .payFee(RECOMMENDED_MIN_FEE_VALUE)
      .build()
      .toEIP12Object();
      
    return paintTransaction;
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