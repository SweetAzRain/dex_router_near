
import { setupWalletSelector, WalletSelector } from '@near-wallet-selector/core';
import { setupBitgetWallet } from '@near-wallet-selector/bitget-wallet';
import { setupHotWallet } from '@near-wallet-selector/hot-wallet';
import { setupMeteorWalletApp } from '@near-wallet-selector/meteor-wallet-app';
import { setupIntearWallet } from '@near-wallet-selector/intear-wallet';
import { setupWalletConnect } from '@near-wallet-selector/wallet-connect';
import { setupOKXWallet } from '@near-wallet-selector/okx-wallet';
import { setupModal } from '@near-wallet-selector/modal-ui';
import '@near-wallet-selector/modal-ui/styles.css';

export async function initWalletSelector(network: 'mainnet' | 'testnet' = 'mainnet') {
  const selector = await setupWalletSelector({
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
  const modal = setupModal(selector, {
    contractId: '', // TODO: Укажите contractId вашего смарт-контракта
    theme: 'auto',
  });
  return { selector, modal };
}
