import React, { useState } from "react";
import { Droplets } from "lucide-react";
import { contractService } from "./contractService";

const tokens = [
  {
    name: "BNB",
    logo: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
    amount: "0.1",
    timeLimit: "24 hours",
  },
  {
    name: "USDC",
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
    amount: "100",
    timeLimit: "24 hours",
  },
];

interface FaucetProps {
  onSuccess?: () => void;
}

function Faucet({ onSuccess }: FaucetProps) {
  const [requestingToken, setRequestingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRequest = async (tokenName: string) => {
    setRequestingToken(tokenName);
    setError(null);
    setSuccess(null);

    try {
      if (tokenName === "BNB") {
        await contractService.claimBNBFaucet();
        setSuccess(`Successfully claimed ${tokens[0].amount} BNB!`);
      } else if (tokenName === "USDC") {
        await contractService.claimUSDCFaucet();
        setSuccess(`Successfully claimed ${tokens[1].amount} USDC!`);
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to request tokens");
    } finally {
      setRequestingToken(null);
    }
  };

  const handleRequestAll = async () => {
    setRequestingToken("all");
    setError(null);
    setSuccess(null);

    try {
      await contractService.claimAllFaucets();
      setSuccess("Successfully claimed both BNB and USDC!");

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to request tokens");
    } finally {
      setRequestingToken(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Testnet Faucet</h2>
        <p className="text-violet-300">
          Request testnet tokens for development
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {tokens.map((token) => (
          <div key={token.name} className="bg-violet-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img src={token.logo} alt={token.name} className="w-8 h-8" />
                <div>
                  <h3 className="text-white font-medium">{token.name}</h3>
                  <p className="text-violet-300 text-sm">
                    {token.amount} {token.name} per {token.timeLimit}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRequest(token.name)}
                disabled={requestingToken !== null}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors
                  ${
                    requestingToken !== null
                      ? "bg-violet-700/50 text-violet-300 cursor-not-allowed"
                      : "bg-violet-600 hover:bg-violet-500 text-white"
                  }`}
              >
                <Droplets size={18} />
                <span>
                  {requestingToken === token.name ? "Requesting..." : "Request"}
                </span>
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleRequestAll}
          disabled={requestingToken !== null}
          className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors
            ${
              requestingToken !== null
                ? "bg-violet-700/50 text-violet-300 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }`}
        >
          <Droplets size={18} />
          <span>
            {requestingToken === "all"
              ? "Requesting All..."
              : "Request All Tokens"}
          </span>
        </button>
      </div>

      <div className="bg-violet-800/30 rounded-xl p-4 text-sm text-violet-300">
        <h4 className="font-medium text-white mb-2">Important Notes:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Tokens are for testnet development only</li>
          <li>Limited to one request per token per day</li>
          <li>Connect your wallet before requesting tokens</li>
          <li>Tokens will be sent to your connected wallet address</li>
        </ul>
      </div>
    </div>
  );
}

export default Faucet;
