import { ethers } from 'ethers';

export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBalance(balance: string): string {
  if (!balance) return '0.00';
  try {
    // Convert from wei to XDC
    const formattedBalance = ethers.formatEther(balance);
    // Format to 4 decimal places
    return Number(formattedBalance).toFixed(4);
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0.00';
  }
} 