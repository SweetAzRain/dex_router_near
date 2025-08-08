// client/src/components/swap/swap-interface.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowUpDown, Settings, History, ChevronDown, TrendingUp, AlertTriangle } from "lucide-react";
import { TokenSelectModal } from "./token-select-modal";
import { useWallet } from "@/hooks/use-wallet";
import { useRoutes } from "@/hooks/use-routes";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { TokenInfo } from "@/types/near";
import { RouteInfo } from "@/types/near";
import { intearAPI } from "@/services/intear-api";
import { nearIntents } from "@/services/near-intents";
import { OneClickService, OpenAPI, QuoteRequest } from "@defuse-protocol/one-click-sdk-typescript";
// Use enums from QuoteRequest namespace for type safety
// Инициализация 1click SDK (можно вынести в отдельный модуль)
OpenAPI.BASE = "https://1click.chaindefuser.com";
const ONECLICK_API_TOKEN = import.meta.env.VITE_ONECLICK_API_TOKEN || "";
OpenAPI.TOKEN = ONECLICK_API_TOKEN;
console.log('[DEBUG] VITE_ONECLICK_API_TOKEN:', ONECLICK_API_TOKEN);
console.log('[DEBUG] OpenAPI.TOKEN:', OpenAPI.TOKEN);
import { useToast } from "@/hooks/use-toast";

// Типы для Near Intents
interface IntentPublication {
  quote_hashes: string[];
  signed_data: {
    standard: string;
    payload: any;
    signature: string;
    public_key: string;
  };
}

const DEFAULT_TOKENS: TokenInfo[] = [
  {
    id: "wrap.near",
    symbol: "NEAR",
    name: "NEAR Protocol",
    decimals: 24,
    isNative: true,
    balance: "0",
    usdValue: "0.00",
  },
  {
    id: "usdt.tether-token.near",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    contractId: "usdt.tether-token.near",
    isNative: false,
    balance: "0",
    usdValue: "0.00",
  },
  {
    id: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    contractId: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    isNative: false,
    balance: "0",
    usdValue: "0.00",
  },
];

export function SwapInterface() {
  const { wallet, signTransaction, signMessage } = useWallet();
  const { toast } = useToast();
  
  const [fromToken, setFromToken] = useState<TokenInfo>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<TokenInfo>(DEFAULT_TOKENS[1]);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [slippageType, setSlippageType] = useState<"Auto" | "Fixed">("Auto");
  const [customSlippage, setCustomSlippage] = useState("1.0");
  const [selectedSlippage, setSelectedSlippage] = useState("1.0");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectingToken, setSelectingToken] = useState<"from" | "to">("from");
  const [isSwapping, setIsSwapping] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const { balances, isLoading: balancesLoading, error: balancesError, refetch: refetchBalances } = useTokenBalances(DEFAULT_TOKENS);

  const routeRequest = amountIn && fromToken && toToken ? {
    tokenIn: fromToken.id,
    tokenOut: toToken.id,
    amountIn: intearAPI.parseAmount(amountIn, fromToken.decimals),
    maxWaitMs: 5000,
    slippageConfig: {
      type: slippageType,
      ...(slippageType === "Fixed" 
        ? { slippage: parseFloat(selectedSlippage) / 100 }
        : { maxSlippage: 0.05, minSlippage: 0.001 }
      )
    },
    traderAccountId: wallet.accountId || undefined,
    signingPublicKey: undefined,
  } : null;

  useEffect(() => {
    if (routeRequest) {
      console.log('Route request created:', routeRequest);
    }
  }, [routeRequest]);


  // --- Новый useEffect для dry-котировки через 1click (NearIntents) ---
  const [intentsQuote, setIntentsQuote] = useState<any>(null);
  const [intentsQuoteLoading, setIntentsQuoteLoading] = useState(false);
  const [intentsQuoteError, setIntentsQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchIntentsQuote() {
      setIntentsQuote(null);
      setIntentsQuoteError(null);
      if (!amountIn || !fromToken || !toToken) return;
      setIntentsQuoteLoading(true);
      try {
        // Всегда используем nep141:wrap.near для NEAR
        const originAsset = fromToken.id === 'wrap.near' ? 'nep141:wrap.near' : `nep141:${fromToken.id}`;
        const destinationAsset = toToken.id === 'wrap.near' ? 'nep141:wrap.near' : `nep141:${toToken.id}`;
        const amount = intearAPI.parseAmount(amountIn, fromToken.decimals).toString();
        const slippageTolerance = slippageType === 'Fixed' ? Math.round(parseFloat(selectedSlippage) * 100) : 100; // 1.0% = 100
        const quoteRequest: QuoteRequest = {
          dry: true,
          swapType: QuoteRequest.swapType.EXACT_INPUT,
          slippageTolerance,
          originAsset,
          depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
          destinationAsset,
          amount,
          refundTo: wallet.accountId || '',
          refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
          recipient: wallet.accountId || '',
          recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
          deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          referral: 'miquel',
          quoteWaitingTimeMs: 2000,
          appFees: [
            {
              recipient: wallet.accountId || '',
              fee: 0
            }
          ],
        };
        const quote = await OneClickService.getQuote(quoteRequest);
        if (!ignore) setIntentsQuote(quote);
      } catch (e: any) {
        if (!ignore) setIntentsQuoteError(e.message || e.toString());
      } finally {
        if (!ignore) setIntentsQuoteLoading(false);
      }
    }
    fetchIntentsQuote();
    return () => { ignore = true; };
    // eslint-disable-next-line
  }, [amountIn, fromToken, toToken, slippageType, selectedSlippage, wallet.accountId]);

  // --- Миксуем обычные маршруты и dry-котировку от 1click ---
  const { data: routesDataRaw, isLoading: routesLoading, error: routesError } = useRoutes(routeRequest, !!amountIn);
  let routesData = routesDataRaw;
  if (intentsQuote && intentsQuote.quote && intentsQuote.quote.amountOut) {
    const route: RouteInfo = {
      dex_id: 'NearIntents',
      estimated_amount: { amount_out: intentsQuote.quote.amountOut },
      has_slippage: true,
      execution_instructions: [],
      deadline: intentsQuote.quote.deadline,
      worst_case_amount: { amount_out: intentsQuote.quote.amountOut },
      needs_unwrap: false,
    };
    routesData = [route, ...(Array.isArray(routesDataRaw) ? routesDataRaw.filter((r: RouteInfo) => r.dex_id !== 'NearIntents') : [])];
  }

  useEffect(() => {
    console.log('Routes loading:', routesLoading);
    console.log('Routes data:', routesData);
    console.log('Routes error:', routesError);
  }, [routesData, routesLoading, routesError]);

  useEffect(() => {
    if (!isSwapping && wallet.isConnected) {
       const timer = setTimeout(() => {
         refetchBalances();
       }, 2000);
       return () => clearTimeout(timer);
    }
  }, [isSwapping, wallet.isConnected, refetchBalances]);

  useEffect(() => {
    if (Array.isArray(routesData) && routesData.length > 0) {
      if (!selectedRouteId) {
        const bestRoute = intearAPI.getBestRoute(routesData);
        if (bestRoute) {
          setSelectedRouteId(bestRoute.dex_id);
        }
      }
      const selectedRoute = routesData.find((route: RouteInfo) => route.dex_id === selectedRouteId) || intearAPI.getBestRoute(routesData);
      if (selectedRoute) {
        const formatted = intearAPI.formatAmount(selectedRoute.estimated_amount.amount_out, toToken.decimals);
        setAmountOut(formatted);
        console.log('Setting amountOut:', formatted);
      } else {
        setAmountOut("");
      }
    } else {
      setAmountOut("");
      setSelectedRouteId(null);
    }
  }, [routesData, selectedRouteId, toToken.decimals]);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setAmountIn(amountOut);
    setAmountOut("");
    setSelectedRouteId(null);
  };

  const handleSelectToken = (token: TokenInfo) => {
    if (selectingToken === "from") {
      if (token.id === toToken.id) {
        setToToken(fromToken);
      }
      setFromToken(token);
    } else {
      if (token.id === fromToken.id) {
        setFromToken(toToken);
      }
      setToToken(token);
    }
    setSelectedRouteId(null);
  };

  const handleSelectRoute = (dexId: string) => {
    setSelectedRouteId(dexId);
  };

  // Новый executeSwap: только 1click SDK, только обычный NEP-141 трансфер на depositAddress из квоты
  const executeSwap = async () => {
    if (!wallet.isConnected || !wallet.accountId) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to continue",
        variant: "destructive",
      });
      return;
    }
    setIsSwapping(true);
    try {
      // Получаем свежую квоту с dry: false
      // Всегда используем nep141:wrap.near для NEAR
      const originAsset = fromToken.id === 'wrap.near' ? 'nep141:wrap.near' : `nep141:${fromToken.id}`;
      const destinationAsset = toToken.id === 'wrap.near' ? 'nep141:wrap.near' : `nep141:${toToken.id}`;
      const amount = intearAPI.parseAmount(amountIn, fromToken.decimals).toString();
      const slippageTolerance = slippageType === 'Fixed' ? Math.round(parseFloat(selectedSlippage) * 100) : 100;
      const quoteRequest: QuoteRequest = {
        dry: false,
        swapType: QuoteRequest.swapType.EXACT_INPUT,
        slippageTolerance,
        originAsset,
        depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
        destinationAsset,
        amount,
        refundTo: wallet.accountId || '',
        refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
        recipient: wallet.accountId || '',
        recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
        deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        referral: '1click-miquel',
        quoteWaitingTimeMs: 2000,
        appFees: [
          {
            recipient: 'immiquel.near',
            fee: 0
          }
        ],
      };
      const quote = await OneClickService.getQuote(quoteRequest);
      if (!quote.quote || !quote.quote.depositAddress) {
        toast({
          title: "No deposit address",
          description: "Could not get deposit address from 1click API.",
          variant: "destructive",
        });
        setIsSwapping(false);
        return;
      }
      // Для NEP-141 токенов нужно storage_deposit, если это не native:near
      // Теперь NEAR тоже как nep141:wrap.near, поэтому всегда NEP-141 логика
      // 1. storage_deposit
      const storageDepositTx = {
        receiverId: fromToken.id,
        actions: [
          {
            type: 'FunctionCall',
            methodName: 'storage_deposit',
            args: { account_id: quote.quote.depositAddress },
            gas: '30000000000000',
            deposit: '1250000000000000000000', // 0.00125 NEAR
          }
        ]
      };
      // 2. ft_transfer_call
      const ftTransferCallTx = {
        receiverId: fromToken.id,
        actions: [
          {
            type: 'FunctionCall',
            methodName: 'ft_transfer_call',
            args: {
              receiver_id: quote.quote.depositAddress,
              amount,
              msg: ''
            },
            gas: '90000000000000',
            deposit: '1',
          }
        ]
      };
      // Отправляем обе транзакции (storage_deposit и ft_transfer_call) в одном батче
      const result = await signTransaction([storageDepositTx, ftTransferCallTx]);
      toast({
        title: "Swap submitted",
        description: `Sent ${amountIn} ${fromToken.symbol} to deposit address via ft_transfer_call.`,
      });
      setAmountIn("");
      setAmountOut("");
      setSelectedRouteId(null);
    } catch (e: any) {
      toast({
        title: "Failed to swap",
        description: e.message || e.toString(),
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const getSwapButtonText = () => {
    if (!wallet.isConnected) return "Connect Wallet";
    if (!amountIn) return "Enter an amount";
    if (routesLoading) return "Finding best route...";
    if (isSwapping) return "Swapping...";
    return "Swap Tokens";
  };

  const isSwapDisabled = !wallet.isConnected || !amountIn || routesLoading || isSwapping;

  // Показываем только лучший маршрут NearIntents
  const intentsRoutes: RouteInfo[] = Array.isArray(routesData) ? routesData.filter((r: RouteInfo) => r.dex_id === 'NearIntents') : [];
  const bestRoute = intentsRoutes.length > 0 ? intearAPI.getBestRoute(intentsRoutes) : null;

  return (
    <Card className="w-full max-w-2xl" data-testid="card-swap-interface">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Swap Tokens</h2>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" data-testid="button-settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" data-testid="button-history">
              <History className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          {/* From Token */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium text-gray-700">From</Label>
              <span className="text-sm text-gray-500" data-testid="text-from-balance">
                Balance: {balancesLoading ? 'Loading...' : (balances[fromToken.id] ? parseFloat(balances[fromToken.id]).toFixed(6) : '0.000000')}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectingToken("from");
                  setShowTokenModal(true);
                }}
                className="flex items-center space-x-2 px-3 py-2"
                data-testid="button-select-from-token"
              >
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  {fromToken.iconUrl ? (
                    <img src={fromToken.iconUrl} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                  ) : (
                    <span className="text-xs font-bold">{fromToken.symbol.slice(0, 2)}</span>
                  )}
                </div>
                <span className="font-medium" data-testid="text-from-token-symbol">{fromToken.symbol}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Input
                type="text"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.0"
                className="flex-1 text-2xl font-semibold border-none bg-transparent p-0 h-auto"
                data-testid="input-amount-in"
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-500">≈ $0.00</span>
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2">25%</Button>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2">50%</Button>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2">75%</Button>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2">MAX</Button>
              </div>
            </div>
          </div>
          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwapTokens}
              className="rounded-xl p-2 border-4 border-white bg-gray-100 hover:bg-gray-200"
              data-testid="button-swap-direction"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
          {/* To Token */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium text-gray-700">To</Label>
              <span className="text-sm text-gray-500" data-testid="text-to-balance">
                 Balance: {balancesLoading ? 'Loading...' : (balances[toToken.id] ? parseFloat(balances[toToken.id]).toFixed(6) : '0.000000')}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectingToken("to");
                  setShowTokenModal(true);
                }}
                className="flex items-center space-x-2 px-3 py-2"
                data-testid="button-select-to-token"
              >
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  {toToken.iconUrl ? (
                    <img src={toToken.iconUrl} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                  ) : (
                    <span className="text-xs font-bold">{toToken.symbol.slice(0, 2)}</span>
                  )}
                </div>
                <span className="font-medium" data-testid="text-to-token-symbol">{toToken.symbol}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Input
                type="text"
                value={amountOut}
                readOnly
                placeholder="0.0"
                className="flex-1 text-2xl font-semibold border-none bg-transparent p-0 h-auto"
                data-testid="input-amount-out"
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-500">≈ $0.00</span>
            </div>
          </div>
        </div>
        {/* Slippage Settings */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Slippage Settings</h3>
            <RadioGroup
              value={slippageType}
              onValueChange={(value: "Auto" | "Fixed") => setSlippageType(value)}
              className="flex items-center space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Auto" id="auto" data-testid="radio-slippage-auto" />
                <Label htmlFor="auto" className="text-sm">Auto</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Fixed" id="fixed" data-testid="radio-slippage-fixed" />
                <Label htmlFor="fixed" className="text-sm">Fixed</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["0.1", "0.5", "1.0"].map(percentage => (
              <Button
                key={percentage}
                variant={selectedSlippage === percentage ? "default" : "outline"}
                onClick={() => setSelectedSlippage(percentage)}
                className="py-2 text-sm"
                data-testid={`button-slippage-${percentage}`}
              >
                {percentage}%
              </Button>
            ))}
            <Input
              type="text"
              placeholder="Custom"
              value={customSlippage}
              onChange={(e) => {
                setCustomSlippage(e.target.value);
                setSelectedSlippage(e.target.value);
              }}
              className="text-center"
              data-testid="input-custom-slippage"
            />
          </div>
        </div>
        
        {/* Route Comparison — показываем все маршруты (NearIntents только один) */}
        {amountIn && (
          <div className="mt-6">
            {routesLoading ? (
              <Card>
                <CardContent className="text-center py-4">
                  <p>Finding best routes...</p>
                </CardContent>
              </Card>
            ) : routesError ? (
              <Card>
                <CardContent className="text-center py-4 text-red-500">
                  <AlertCircle className="h-5 w-5 inline mr-2" />
                  <span>Error loading routes: {routesError.message || 'Unknown error'}</span>
                </CardContent>
              </Card>
            ) : Array.isArray(routesData) && routesData.length > 0 ? (
              <Card data-testid="card-route-comparison">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Select Route</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      const intents = routesData.filter((r: RouteInfo) => r.dex_id === 'NearIntents');
                      const otherDexes = routesData.filter((r: RouteInfo) => r.dex_id !== 'NearIntents');
                      const allRoutes = [...(intents.length ? [intents[0]] : []), ...otherDexes];
                      const bestRoute = allRoutes.length > 0 ? intearAPI.getBestRoute(allRoutes) : null;
                      return allRoutes.map((route: RouteInfo, index: number) => {
                        const isSelected = route.dex_id === selectedRouteId;
                        const isBest = bestRoute && route.dex_id === bestRoute.dex_id;
                        return (
                          <div
                            key={`${route.dex_id}-${index}`}
                            onClick={() => handleSelectRoute(route.dex_id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <Badge variant={isBest ? "default" : "secondary"}>
                                  {route.dex_id}
                                  {isBest && (
                                    <span className="ml-1 text-xs">(Best)</span>
                                  )}
                                </Badge>
                                <span className="font-medium">
                                  {intearAPI.formatAmount(route.estimated_amount.amount_out, toToken.decimals)} {toToken.symbol}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Slippage: {route.has_slippage ? 'Yes' : 'No'}
                              </div>
                            </div>
                            {route.deadline && (
                              <div className="text-xs text-gray-400 mt-1">
                                Deadline: {new Date(route.deadline).toLocaleTimeString()}
                              </div>
                            )}
                            {route.worst_case_amount && route.estimated_amount.amount_out !== route.worst_case_amount.amount_out && (
                              <div className="text-xs text-orange-500 mt-1 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Worst case: {intearAPI.formatAmount(route.worst_case_amount.amount_out, toToken.decimals)} {toToken.symbol}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="h-12 w-12 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No routes available</h3>
                    <p className="text-gray-500">Try adjusting your swap amount or token pair</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        {/* Swap Button */}
        <Button
          onClick={executeSwap}
          disabled={isSwapDisabled}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 mt-6 text-lg font-semibold"
          data-testid="button-execute-swap"
        >
          {getSwapButtonText()}
        </Button>
        <TokenSelectModal
          open={showTokenModal}
          onOpenChange={setShowTokenModal}
          onSelectToken={handleSelectToken}
          tokens={DEFAULT_TOKENS}
        />
      </CardContent>
    </Card>
  );
}