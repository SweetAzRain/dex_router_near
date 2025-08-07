import { setupWalletSelector, WalletSelector } from '@near-wallet-selector/core';
import { setupBitgetWallet } from '@near-wallet-selector/bitget-wallet';
import { setupHotWallet } from '@near-wallet-selector/hot-wallet';
import { setupMeteorWalletApp } from '@near-wallet-selector/meteor-wallet-app';
import { setupIntearWallet } from '@near-wallet-selector/intear-wallet';
import { setupWalletConnect } from '@near-wallet-selector/wallet-connect';
import { setupOKXWallet } from '@near-wallet-selector/okx-wallet';

export async function initWalletSelector(network: 'mainnet' | 'testnet' = 'mainnet'): Promise<WalletSelector> {
  return await setupWalletSelector({
    network,
    modules: [
      setupBitgetWallet(),
      setupHotWallet(),
      setupMeteorWalletApp({ contractId: '', }),
      setupIntearWallet(),
      setupWalletConnect({
        projectId: '', // TODO: Укажите свой WalletConnect ProjectId
        metadata: {
          name: 'YourAppName',
          description: 'Your app description',
          url: 'https://your-app-url.com',
          icons: ['https://your-app-url.com/icon.png'],
        },
      }),
      setupOKXWallet(),
    ],
  });
}
