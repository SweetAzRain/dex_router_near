// client/src/hooks/use-near-wallet.tsx
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { initWalletSelector } from "@/lib/wallet-selector";
import { ActivityLogEntry } from "@/types/near-wallet";
import { useToast } from "@/hooks/use-toast";
// Определяем тип для контекста
interface NearWalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  accountId: string | null;
  walletName: string;
  network: "mainnet" | "testnet";
  activityLog: ActivityLogEntry[];
  selector: any | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signAndSendTransaction: (params: any) => Promise<any>;
  signMessage: (params: { message: string; recipient: string; nonce?: Uint8Array }) => Promise<any>; // <-- ДОБАВИЛИ В ИНТЕРФЕЙС
  addActivityLog: (message: string, type?: "info" | "success" | "error" | "warning") => void;
  setNetwork: (network: "mainnet" | "testnet") => void;
}
// Создаем контекст
const NearWalletContext = createContext<NearWalletContextType | undefined>(undefined);
// Провайдер
export function NearWalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("Unknown Wallet");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [selector, setSelector] = useState<any | null>(null); // WalletSelector instance
  // const [modal, setModal] = useState<any | null>(null); // Убираем
  const { toast } = useToast();
  // Функция для добавления записей в лог активности
  const addActivityLog = useCallback((message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => [{ message, type, timestamp }, ...prev.slice(0, 19)]);
  }, []);
  // Функция для очистки сессии
  const clearSession = useCallback(() => {
    localStorage.removeItem("nearConnectSession");
    setIsConnected(false);
    setAccountId(null);
    setWalletName("Unknown Wallet");
  }, []);
  // Функция для обновления состояния подключения
  const updateConnectedState = useCallback(async (connectorInstance: any) => {
    try {
      // Используем wallet() без аргументов для получения уже подключенного кошелька
      const walletInstance = await connectorInstance.wallet();
      if (walletInstance && walletInstance.getAccounts) {
        const accounts = await walletInstance.getAccounts();
        if (accounts && accounts.length > 0) {
          setIsConnected(true);
          setAccountId(accounts[0].accountId);
          // Получаем имя кошелька из манифеста
          setWalletName((walletInstance as any).manifest?.name || "Unknown Wallet");
          addActivityLog(`Wallet connected: ${accounts[0].accountId}`, "success");
          return true;
        }
      }
      clearSession();
      addActivityLog("No accounts found in wallet", "warning");
      return false;
    } catch (err) {
      // Это нормально, если кошелек не подключен - будет ошибка
      // console.error("Error updating connected state:", err);
      clearSession();
      // addActivityLog(`Failed to update connection state: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
      return false;
    }
  }, [addActivityLog, clearSession]);
  // Инициализация wallet-selector
  useEffect(() => {
    const initNearWallet = async () => {
      try {
        addActivityLog("Initializing NEAR wallet...", "info");
        if (typeof window === "undefined") {
          console.warn("use-near-wallet: window is undefined, skipping initialization.");
          return;
        }
        // Инициализация wallet-selector
        const selectorInstance = await initWalletSelector(network);
        setSelector(selectorInstance);
        // Восстанавливаем сессию, если возможно
        try {
          const wallet = await selectorInstance.wallet();
          const accounts = await wallet.getAccounts();
          if (accounts && accounts.length > 0) {
            setIsConnected(true);
            setAccountId(accounts[0].accountId);
            setWalletName((wallet as any).manifest?.name || "Unknown Wallet");
            addActivityLog(`Wallet connected: ${accounts[0].accountId}`, "success");
          } else {
            clearSession();
            addActivityLog("No accounts found in wallet", "warning");
          }
        } catch {
          clearSession();
        }
        // Подписка на события wallet-selector
        selectorInstance.on('signedIn', async ({ accounts }: any) => {
          addActivityLog("Wallet sign-in successful", "success");
          if (accounts && accounts.length > 0) {
            setIsConnected(true);
            setAccountId(accounts[0].accountId);
            setWalletName("Wallet");
            localStorage.setItem("nearConnectSession", JSON.stringify({
              accountId: accounts[0].accountId,
              network,
              timestamp: Date.now(),
            }));
            toast({
              title: "Success",
              description: "Wallet connected successfully!",
            });
          }
          setIsConnecting(false);
        });
        selectorInstance.on('signedOut', () => {
          addActivityLog("Wallet disconnected", "info");
          clearSession();
          setIsConnecting(false);
          toast({
            title: "Disconnected",
            description: "Wallet disconnected",
          });
        });
        addActivityLog("NEAR wallet-selector initialized successfully", "success");
      } catch (err) {
        console.error("Initialization error:", err);
        addActivityLog(`Initialization failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
        toast({
          title: "Initialization Failed",
          description: "Failed to initialize NEAR wallet",
          variant: "destructive",
        });
      }
    };
    initNearWallet();
    // Cleanup function (если необходимо)
    return () => {
      // Отписка от событий, если wallet-selector предоставляет такой метод
      // selector?.off?.("wallet:signIn", ...);
      // selector?.off?.("wallet:signOut", ...);
    };
  }, [network, addActivityLog, clearSession, updateConnectedState, toast]);
  // Функция для подключения кошелька - ИСПРАВЛЕНО
  const connectWallet = useCallback(async () => {
    try {
      if (!selector) {
        toast({
          title: "Error",
          description: "Wallet selector not initialized",
          variant: "destructive",
        });
        return;
      }
      setIsConnecting(true);
      addActivityLog('Opening wallet selector...', 'info');
      await selector.modal.show();
    } catch (error) {
      console.error('Connection error:', error);
      addActivityLog(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      toast({
        title: "Connection Failed",
        description: "Failed to open wallet selector or connect wallet.",
        variant: "destructive",
      });
    }
  }, [selector, addActivityLog, toast]);
  // Функция для отключения кошелька
  const disconnectWallet = useCallback(async () => {
    if (!selector) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive",
      });
      return;
    }
    try {
      await selector.signOut();
      // Событие signedOut обновит состояние
    } catch (error) {
      console.error("Disconnection error:", error);
      clearSession();
      addActivityLog(`Disconnection error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  }, [selector, clearSession, addActivityLog, toast]);
  // Функция для подписания и отправки транзакции
  const signAndSendTransaction = useCallback(async (params: any) => {
    if (!selector) {
      const errorMsg = "Wallet selector not initialized";
      console.error(errorMsg);
      addActivityLog(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    if (!isConnected) {
      const errorMsg = "Wallet not connected";
      console.error(errorMsg);
      addActivityLog(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    try {
      addActivityLog(`Getting wallet instance for transaction to ${params.receiverId}`, 'info');
      // Получаем экземпляр уже подключенного кошелька
      const wallet = await selector.wallet();
      const accounts = await wallet.getAccounts();
      if (!accounts || accounts.length === 0) {
        const errorMsg = 'No accounts found in wallet';
        console.error(errorMsg);
        addActivityLog(errorMsg, 'error');
        throw new Error(errorMsg);
      }
      addActivityLog(`Sending transaction from ${accounts[0].accountId}`, 'info');
      // Выполняем транзакцию
      const result = await wallet.signAndSendTransaction(params);
      addActivityLog('Transaction completed successfully', 'success');
      return result;
    } catch (error: any) {
      console.error('Transaction error:', error);
      const errorMessage = error.message || error.toString() || 'Unknown transaction error';
      addActivityLog(`Transaction error: ${errorMessage}`, 'error');
      toast({
        title: "Transaction Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive",
      });
      throw error;
    }
  }, [selector, isConnected, addActivityLog, toast]);

  // --- НОВАЯ ФУНКЦИЯ signMessage ДОБАВЛЕНА ЗДЕСЬ ---
  // Функция для подписания сообщения
  const signMessage = useCallback(async (params: { message: string; recipient: string; nonce?: Uint8Array }) => {
    if (!selector) {
      const errorMsg = "Wallet selector not initialized";
      console.error(errorMsg);
      addActivityLog(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    if (!isConnected) {
      const errorMsg = "Wallet not connected";
      console.error(errorMsg);
      addActivityLog(errorMsg, 'error');
      throw new Error(errorMsg);
    }
    try {
      addActivityLog(`Signing message for recipient: ${params.recipient}`, 'info');
      console.log("useNearWallet.signMessage called with params:", params); // <-- ЛОГ 1: Входные параметры
      // Получаем экземпляр уже подключенного кошелька
      const wallet = await selector.wallet();
      console.log("useNearWallet.signMessage got wallet instance:", wallet); // <-- ЛОГ 2: Экземпляр кошелька
      console.log("Wallet type/name:", (wallet as any).type, (wallet as any).manifest?.name); // <-- ЛОГ 3: Тип кошелька
      
      // Выполняем подписание сообщения
      const result = await wallet.signMessage(params);
      console.log("useNearWallet.signMessage raw result from wallet.signMessage:", result); // <-- ЛОГ 4: Результат от кошелька

      if (!result) {
       const errorMsg = "signMessage returned null or undefined. Wallet might not support this feature or user cancelled.";
       console.error(errorMsg);
       addActivityLog(errorMsg, 'error');
       throw new Error(errorMsg);
      }

      addActivityLog('Message signed successfully', 'success');
      return result;
    } catch (error: any) {
      console.error('Sign message error:', error);
      const errorMessage = error.message || error.toString() || 'Unknown message signing error';
      addActivityLog(`Sign message error: ${errorMessage}`, 'error');
      toast({
        title: "Message Signing Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive",
      });
      throw error;
    }
  }, [selector, isConnected, addActivityLog, toast]);
  // --- КОНЕЦ НОВОЙ ФУНКЦИИ ---

  // Значения контекста
  const contextValue: NearWalletContextType = {
    isConnected,
    isConnecting,
    accountId,
    walletName,
    network,
    activityLog,
    selector,
    // modal, // Убираем
    connectWallet,
    disconnectWallet,
    signAndSendTransaction,
    signMessage, // <-- ДОБАВИЛИ В КОНТЕКСТ
    addActivityLog,
    setNetwork,
  };
  return (
    <NearWalletContext.Provider value={contextValue}>
      {children}
    </NearWalletContext.Provider>
  );
}
// Хук для использования контекста
export function useNearWallet() {
  const context = useContext(NearWalletContext);
  if (context === undefined) {
    throw new Error("useNearWallet must be used within a NearWalletProvider");
  }
  return context;
}