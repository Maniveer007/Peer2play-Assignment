import React, { useState, useEffect } from "react";
import { ArrowDownUp, Plus, Wallet } from "lucide-react";
import Faucet from "./Faucet";
import { contractService } from "./contractService";

type Mode = "trade" | "liquidity" | "faucet";
type Token = "BNB" | "USDC";

interface TokenInfo {
  symbol: Token;
  logo: string;
}

function App() {
  const [mode, setMode] = useState<Mode>("trade");
  const [token1Amount, setToken1Amount] = useState("");
  const [token2Amount, setToken2Amount] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [account, setAccount] = useState("");
  const [balances, setBalances] = useState({ bnb: "0.0", usdc: "0.0" });
  const [isLoading, setIsLoading] = useState(false);

  const [token1, setToken1] = useState<TokenInfo>({
    symbol: "BNB",
    logo: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
  });
  const [token2, setToken2] = useState<TokenInfo>({
    symbol: "USDC",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  });

  useEffect(() => {
    setToken1Amount("");
    setToken2Amount("");
  }, [mode]);

  // Update balances when wallet is connected
  useEffect(() => {
    if (isWalletConnected && account) {
      console.log(isWalletConnected, account);

      updateBalances();
    }
  }, [isWalletConnected, account]);

  const updateBalances = async () => {
    try {
      const newBalances = await contractService.getBalances(account);
      setBalances(newBalances);
    } catch (error) {
      console.error("Failed to update balances:", error);
    }
  };

  const calculatePrice = async (value: string, isToken1: boolean) => {
    if (!value || isNaN(Number(value))) {
      setToken1Amount("");
      setToken2Amount("");
      return;
    }

    setIsCalculating(true);
    try {
      if (isToken1) {
        const amountOut = await contractService.getAmountOut(
          value,
          token1.symbol as "BNB" | "USDC"
        );
        setToken2Amount(amountOut);
        setToken1Amount(value);
      } else {
        const amountOut = await contractService.getAmountOut(
          value,
          token2.symbol as "BNB" | "USDC"
        );
        setToken1Amount(amountOut);
        setToken2Amount(value);
      }
    } catch (error) {
      console.error("Error calculating price:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleToken1Change = (value: string) => {
    setToken1Amount(value);
    calculatePrice(value, true);
  };

  const handleToken2Change = (value: string) => {
    setToken2Amount(value);
    calculatePrice(value, false);
  };

  const handleSwapTokens = () => {
    if (mode === "trade") {
      const tempToken = token1;
      setToken1(token2);
      setToken2(tempToken);
      setToken1Amount(token2Amount);
      setToken2Amount(token1Amount);
    }
  };

  const handleConnectWallet = async () => {
    try {
      const address = await contractService.connectWallet();
      setAccount(address);
      setIsWalletConnected(true);

      // Get initial balances
      const balances = await contractService.getBalances(address);
      setBalances(balances);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const handleSwap = async () => {
    if (!isWalletConnected || !token1Amount || !token2Amount) return;

    setIsLoading(true);
    try {
      await contractService.swap(
        token1Amount,
        token1.symbol as "BNB" | "USDC",
        token2Amount
      );

      // Refresh balances
      await updateBalances();

      // Clear inputs
      setToken1Amount("");
      setToken2Amount("");
    } catch (error) {
      console.error("Swap failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!isWalletConnected || !token1Amount || !token2Amount) return;

    setIsLoading(true);
    try {
      // Always send in BNB/USDC order regardless of display order
      const [bnbAmount, usdcAmount] =
        token1.symbol === "BNB"
          ? [token1Amount, token2Amount]
          : [token2Amount, token1Amount];

      await contractService.addLiquidity(bnbAmount, usdcAmount);

      // Refresh balances
      await updateBalances();

      // Clear inputs
      setToken1Amount("");
      setToken2Amount("");
    } catch (error) {
      console.error("Failed to add liquidity:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMainContent = () => {
    if (mode === "faucet") {
      return <Faucet onSuccess={updateBalances} />;
    }

    return (
      <div className="space-y-4">
        {/* First Token Input */}
        <div className="bg-violet-800/50 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <label className="text-violet-200 text-sm">
              {mode === "trade" ? "You pay" : "Token 1"}
            </label>
            <span className="text-violet-200 text-sm">
              Balance: {token1.symbol === "BNB" ? balances.bnb : balances.usdc}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <input
              type="number"
              className="bg-transparent text-2xl text-white outline-none w-1/2"
              placeholder="0"
              value={token1Amount}
              onChange={(e) => handleToken1Change(e.target.value)}
              disabled={!isWalletConnected || isLoading}
            />
            <div className="flex items-center bg-violet-700 rounded-xl px-3 py-1.5 text-white">
              <img
                src={token1.logo}
                alt={token1.symbol}
                className="w-5 h-5 mr-2"
              />
              {token1.symbol}
            </div>
          </div>
        </div>

        {/* Middle Button */}
        {mode === "trade" ? (
          <div className="flex justify-center -my-2 z-10">
            <button
              onClick={handleSwapTokens}
              className="bg-violet-800 p-2 rounded-xl hover:bg-violet-700 text-violet-200 transition-colors"
              disabled={isLoading}
            >
              <ArrowDownUp size={20} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center -my-2 z-10">
            <div className="bg-violet-800 p-2 rounded-xl text-violet-200">
              <Plus size={20} />
            </div>
          </div>
        )}

        {/* Second Token Input */}
        <div className="bg-violet-800/50 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <label className="text-violet-200 text-sm">
              {mode === "trade" ? "You receive" : "Token 2"}
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-violet-200 text-sm">
                Balance:{" "}
                {token2.symbol === "BNB" ? balances.bnb : balances.usdc}
              </span>
              {mode === "trade" && token2Amount && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isCalculating
                      ? "bg-violet-700/50 text-violet-300/50"
                      : "bg-violet-700 text-violet-200"
                  }`}
                >
                  Estimated
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <input
              type="number"
              className={`bg-transparent text-2xl outline-none w-1/2 transition-opacity duration-200 ${
                isCalculating ? "text-white/50" : "text-white"
              }`}
              placeholder="0"
              value={token2Amount}
              onChange={(e) => handleToken2Change(e.target.value)}
              disabled={!isWalletConnected || isLoading}
            />
            <div className="flex items-center bg-violet-700 rounded-xl px-3 py-1.5 text-white">
              <img
                src={token2.logo}
                alt={token2.symbol}
                className="w-5 h-5 mr-2"
              />
              {token2.symbol}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={mode === "trade" ? handleSwap : handleAddLiquidity}
          disabled={
            !isWalletConnected || isLoading || !token1Amount || !token2Amount
          }
        >
          {isLoading
            ? "Loading..."
            : mode === "trade"
            ? "Swap"
            : "Add Liquidity"}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-violet-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-4">
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === "trade"
                  ? "bg-violet-800 text-white"
                  : "text-violet-300"
              }`}
              onClick={() => setMode("trade")}
            >
              Trade
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === "liquidity"
                  ? "bg-violet-800 text-white"
                  : "text-violet-300"
              }`}
              onClick={() => {
                setMode("liquidity");
                setToken1({
                  symbol: "BNB",
                  logo: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
                });
                setToken2({
                  symbol: "USDC",
                  logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
                });
              }}
            >
              Add Liquidity
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === "faucet"
                  ? "bg-violet-800 text-white"
                  : "text-violet-300"
              }`}
              onClick={() => setMode("faucet")}
            >
              Faucet
            </button>
          </div>
          <button
            onClick={handleConnectWallet}
            className="flex items-center space-x-2 bg-violet-800 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Wallet size={18} />
            <span>
              {isWalletConnected
                ? `${account.slice(0, 6)}...${account.slice(-4)}`
                : "Connect Wallet"}
            </span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-violet-900 rounded-2xl p-4 shadow-xl">
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
