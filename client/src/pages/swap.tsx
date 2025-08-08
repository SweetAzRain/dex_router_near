// swap.tsx
import { SwapInterface } from "../components/swap-interface";
import { WalletConnection } from "../components/wallet-connection";
import { useRoutes } from "../hooks/use-routes";
import { useWallet } from "../hooks/use-wallet";
import { useState } from "react";

export default function SwapPage() {
  const { wallet } = useWallet();
  return (
    <div className="min-h-screen bg-blue-50 dark:bg-blue-950 text-gray-900 dark:text-blue-100">
      {/* Header */}
      <header className="bg-white dark:bg-blue-900 shadow-sm border-b border-gray-200 dark:border-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">DEX</span>
                </div>
                <h1 className="text-xl font-bold text-blue-700 dark:text-blue-200">Miquel SWAP</h1>
              </div>
              <div className="hidden md:flex items-center space-x-6 ml-8">
                <a href="#" className="text-blue-500 hover:text-blue-700 font-semibold bg-blue-100 dark:bg-blue-900 rounded-lg px-4 py-2 transition-colors" style={{pointerEvents:'none',opacity:0.7}}>easy-mint (coming soon)</a>
              </div>
            </div>
            <WalletConnection />
          </div>
        </div>
      </header>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Swap Interface */}
          <div className="lg:col-span-2">
            <SwapInterface />
          </div>
          {/* Route Comparison удалён */}
        </div>
        {/* Transaction History удалён */}
      </div>
    </div>
  );
}
// Улучшение поддержки тёмной темы и мягко-синей палитры для всей страницы
// (добавить классы dark:bg-blue-950, dark:text-blue-100, bg-blue-50 и т.д. по месту)
