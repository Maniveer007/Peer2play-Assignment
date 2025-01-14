import { ethers } from "ethers";
import UniswapV2Pool from "./abi.json";

declare global {
  interface Window {
    ethereum: any;
  }
}

// Contract addresses (replace with your deployed contract addresses)
const POOL_ADDRESS = "0xF6166E528078d659f13C0e7C5C81118ef8754d68";
const BNB_ADDRESS = "0xE46c46a057CdFda1D0c3A66E4B6849ee4B1682B8";
const USDC_ADDRESS = "0x851D9fd3a459db40F04EFe54A85c99CA7C55c88A";

// Hardcoded faucet amounts - both using 18 decimals
const BNB_FAUCET_AMOUNT = ethers.utils.parseEther("0.1"); // 100 BNB
const USDC_FAUCET_AMOUNT = ethers.utils.parseEther("100"); // 10,000 USDC

// ABI for ERC20 tokens
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address account) public view returns (uint256)",
  "function mint(address to, uint256 amount) external",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export class ContractService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private poolContract: ethers.Contract | null = null;
  private bnbContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;

  async connectWallet(): Promise<string> {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    this.provider = new ethers.providers.Web3Provider(window.ethereum);

    // Request account access first
    await this.provider.send("eth_requestAccounts", []);

    // Get the current network
    const network = await this.provider.getNetwork();

    // Sepolia chainId is 11155111 (0xaa36a7)
    if (network.chainId !== 11155111) {
      try {
        // Request network switch to Sepolia
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
        // Reinitialize provider after network switch
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
      } catch (error: any) {
        throw new Error("Please switch to Sepolia network in MetaMask");
      }
    }

    // Now that we're on the right network, get the signer and initialize contracts
    this.signer = this.provider.getSigner();

    this.poolContract = new ethers.Contract(
      POOL_ADDRESS,
      UniswapV2Pool,
      this.signer
    );
    this.bnbContract = new ethers.Contract(BNB_ADDRESS, ERC20_ABI, this.signer);
    this.usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      ERC20_ABI,
      this.signer
    );

    const address = await this.signer.getAddress();
    return address;
  }

  async getBalances(address: string) {
    if (!this.bnbContract || !this.usdcContract)
      throw new Error("Contracts not initialized");

    const bnbBalance = await this.bnbContract.balanceOf(address);
    const usdcBalance = await this.usdcContract.balanceOf(address);

    return {
      bnb: ethers.utils.formatEther(bnbBalance),
      usdc: ethers.utils.formatEther(usdcBalance), // Using formatEther for USDC too
    };
  }

  // New function to claim BNB using mint
  async claimBNBFaucet() {
    if (!this.bnbContract || !this.signer)
      throw new Error("BNB contract not initialized");

    const address = await this.signer.getAddress();
    const tx = await this.bnbContract.mint(address, BNB_FAUCET_AMOUNT);
    return tx.wait();
  }

  // New function to claim USDC using mint
  async claimUSDCFaucet() {
    if (!this.usdcContract || !this.signer)
      throw new Error("USDC contract not initialized");

    const address = await this.signer.getAddress();
    const tx = await this.usdcContract.mint(address, USDC_FAUCET_AMOUNT);
    return tx.wait();
  }

  // Function to claim both tokens
  async claimAllFaucets() {
    if (!this.signer) throw new Error("Wallet not connected");

    try {
      // Claim both tokens
      await Promise.all([this.claimBNBFaucet(), this.claimUSDCFaucet()]);

      // Get updated balances
      const address = await this.signer.getAddress();
      return await this.getBalances(address);
    } catch (error) {
      throw new Error(`Failed to claim tokens: ${error.message}`);
    }
  }

  private async approveToken(token: string, amount: ethers.BigNumber) {
    const contract = token === "BNB" ? this.bnbContract : this.usdcContract;
    if (!contract || !this.signer) throw new Error("Contract not initialized");

    const address = await this.signer.getAddress();
    const allowance = await contract.allowance(address, POOL_ADDRESS);

    if (allowance.lt(amount)) {
      const tx = await contract.approve(POOL_ADDRESS, amount);
      await tx.wait();
    }
  }

  async swap(amountIn: string, tokenIn: "BNB" | "USDC", minAmountOut: string) {
    if (!this.poolContract || !this.signer)
      throw new Error("Contract not initialized");

    // Both tokens use 18 decimals now
    const amountInWei = ethers.utils.parseEther(amountIn);
    const minAmountOutWei = ethers.utils.parseEther(minAmountOut);

    // Approve token
    await this.approveToken(tokenIn, amountInWei);

    // Execute swap
    const tx = await this.poolContract.swap(
      amountInWei,
      tokenIn === "BNB" ? BNB_ADDRESS : USDC_ADDRESS,
      minAmountOutWei,
      await this.signer.getAddress()
    );

    return tx.wait();
  }

  async addLiquidity(bnbAmount: string, usdcAmount: string) {
    if (!this.poolContract || !this.signer)
      throw new Error("Contract not initialized");

    const bnbAmountWei = ethers.utils.parseEther(bnbAmount);
    const usdcAmountWei = ethers.utils.parseEther(usdcAmount); // Using parseEther for USDC too

    // Approve both tokens
    await this.approveToken("BNB", bnbAmountWei);
    await this.approveToken("USDC", usdcAmountWei);

    // Add liquidity
    const tx = await this.poolContract.mint(
      bnbAmountWei,
      usdcAmountWei,
      await this.signer.getAddress()
    );

    return tx.wait();
  }

  async getAmountOut(
    amountIn: string,
    tokenIn: "BNB" | "USDC"
  ): Promise<string> {
    if (!this.poolContract) throw new Error("Contract not initialized");

    // Both tokens use 18 decimals now
    const amountInWei = ethers.utils.parseEther(amountIn);

    const amountOutWei = await this.poolContract.getAmountOut(
      amountInWei,
      tokenIn === "BNB" ? BNB_ADDRESS : USDC_ADDRESS
    );

    return ethers.utils.formatEther(amountOutWei); // Using formatEther for both tokens
  }
}

export const contractService = new ContractService();
