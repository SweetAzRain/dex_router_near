// near-wallets.ts
import type { WalletSelector, Wallet } from '@near-wallet-selector/core';
import type { Transaction } from '@near-wallet-selector/core';
import { initWalletSelector } from '@/lib/wallet-selector';

// Тип для состояния кошелька в вашем сервисе

interface NearWalletState {
  isConnected: boolean;
  accountId: string | null;
  balance: string;
  publicKey: string | null;
}


class NearWalletService {
  private selector: WalletSelector | null = null;
  private wallet: Wallet | null = null;
  private currentAccountId: string | null = null;


  async initialize(network: 'mainnet' | 'testnet' = 'mainnet') {
    try {
      this.selector = await initWalletSelector(network);
      this.selector.on('signedIn', async ({ accounts }) => {
        this.wallet = await this.selector!.wallet();
        this.currentAccountId = accounts?.[0]?.accountId || null;
      });
      this.selector.on('signedOut', () => {
        this.wallet = null;
        this.currentAccountId = null;
      });
      // Попробуем восстановить сессию
      try {
        this.wallet = await this.selector.wallet();
        const accounts = await this.wallet.getAccounts();
        this.currentAccountId = accounts?.[0]?.accountId || null;
      } catch {
        this.wallet = null;
        this.currentAccountId = null;
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize NEAR wallet-selector:', error);
      return false;
    }
  }


  async connect(network: 'mainnet' | 'testnet' = 'mainnet'): Promise<void> {
    if (!this.selector) {
      const initialized = await this.initialize(network);
      if (!initialized) throw new Error('Failed to initialize wallet selector');
    }
    try {
      // Показываем модальное окно выбора кошелька
      if ((this.selector as any).modal) {
        await (this.selector as any).modal.show();
      } else {
        throw new Error('WalletSelector modal is not available');
      }
    } catch (error) {
      console.error('Failed to show wallet selector modal:', error);
      throw new Error('Failed to open wallet selector dialog');
    }
  }


  async disconnect(): Promise<void> {
    if (this.wallet) {
      try {
        if (typeof this.wallet.signOut === 'function') {
          await this.wallet.signOut();
        }
        this.wallet = null;
        this.currentAccountId = null;
      } catch (error) {
        console.error('Error during disconnect:', error);
        this.wallet = null;
        this.currentAccountId = null;
      }
    } else {
      console.warn('No wallet to disconnect or selector not initialized');
    }
  }


  getWalletState(): NearWalletState {
    return {
      isConnected: !!this.wallet && !!this.currentAccountId,
      accountId: this.currentAccountId,
      balance: '0',
      publicKey: null,
    };
  }


  async getBalance(accountId: string): Promise<string> {
    if (!accountId) {
      console.warn('getBalance called with empty accountId');
      return '0';
    }
    try {
      const response = await fetch('https://rpc.mainnet.near.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'view_account',
            finality: 'final',
            account_id: accountId,
          },
        }),
      });
      const data = await response.json();
      if (data.result?.amount) return data.result.amount;
      return '0';
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }


  async signTransaction(params: { receiverId: string; actions: any[] }): Promise<any> {
    if (!this.wallet) throw new Error('Wallet not connected');
    return await this.wallet.signAndSendTransaction(params);
  }

  async signTransactions(params: { transactions: Transaction[] }): Promise<any[]> {
    if (!this.wallet) throw new Error('Wallet not connected');
    const result = await this.wallet.signAndSendTransactions(params);
    return result || [];
  }

  async signMessage(params: { message: string; recipient: string; nonce?: Uint8Array }): Promise<any> {
    if (!this.wallet) throw new Error('Wallet not connected');
    if (!this.wallet.signMessage) throw new Error('signMessage not supported by this wallet');
    // Приводим nonce к Buffer если требуется (для совместимости с типами некоторых кошельков)
    const { message, recipient, nonce } = params;
    let fixedNonce = nonce;
    if (nonce && typeof Buffer !== 'undefined' && !(nonce instanceof Buffer)) {
      fixedNonce = Buffer.from(nonce);
    }
    const signParams: any = { message, recipient };
    if (fixedNonce) signParams.nonce = fixedNonce;
    return await this.wallet.signMessage(signParams);
  }


  async getPublicKey(): Promise<string | null> {
    if (!this.wallet) return null;
    try {
      const accounts = await this.wallet.getAccounts();
      return accounts[0]?.publicKey || null;
    } catch (error) {
      console.error('Failed to get public key:', error);
      return null;
    }
  }
}

export const nearWalletService = new NearWalletService();