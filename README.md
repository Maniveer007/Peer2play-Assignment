# Automated Market Maker (AMM) Liquidity Pool

This project implements an automated market maker (AMM) liquidity pool that enables decentralized token swapping and liquidity provision. The implementation uses the constant product formula and includes features for swapping tokens, adding liquidity, and removing liquidity.

Website : [https://peer2play-sigma.vercel.app/](https://peer2play-sigma.vercel.app/)

## Core Features

### 1. Token Swapping
The swap function enables users to exchange one token for another based on the constant product formula:
```solidity
function swap(uint amountIn, address tokenIn, uint amountOutMin, address to) external nonReentrant update
```

The swap pricing follows the formula:
```
(X - a)(Y + (1-φ)b) = X*Y = k
```
where:
- X, Y are the current pool reserves
- a is the input amount
- b is the output amount
- φ (phi) is the protocol fee
- k is the constant product

### 2. Liquidity Provision (Mint)
```solidity
function mint(uint amount0Desired, uint amount1Desired, address to) external nonReentrant update returns (uint liquidity)
```

The mint function allows users to provide liquidity to the pool. The implementation handles two scenarios:

#### Initial Liquidity (Empty Pool)
When the pool is empty (reserve0 = reserve1 = 0):
- Accepts the exact amounts desired by the user
- Liquidity tokens minted = √(amount0 * amount1) - MINIMUM_LIQUIDITY
- MINIMUM_LIQUIDITY is permanently locked to prevent the pool from being drained

#### Subsequent Liquidity
For subsequent deposits:
- Calculates optimal amounts to maintain the current price ratio
- Uses the formula: amount1Optimal = (amount0Desired * reserve1) / reserve0
- If amount1Optimal ≤ amount1Desired:
  - Uses amount0Desired and amount1Optimal
- Otherwise:
  - Calculates amount0Optimal = (amount1Desired * reserve0) / reserve1
  - Uses amount0Optimal and amount1Desired
- Liquidity tokens minted = min((amount0 * totalSupply) / reserve0, (amount1 * totalSupply) / reserve1)

### 3. Liquidity Removal (Burn)
```solidity
function burn(uint liquidity, address to) external nonReentrant update returns (uint amount0, uint amount1)
```

The burn function allows liquidity providers to withdraw their tokens:
- Transfers liquidity tokens from the user to the contract
- Calculates withdrawal amounts proportional to the share of liquidity:
  - amount0 = (liquidity * pool_balance0) / totalSupply
  - amount1 = (liquidity * pool_balance1) / totalSupply
- Burns the liquidity tokens
- Transfers both tokens to the specified recipient



## Safety Features

1. Reentrancy Protection
   - Uses nonReentrant modifier to prevent reentrant attacks

2. Minimum Liquidity Lock
   - Permanently locks a small amount of liquidity tokens
   - Prevents division by zero and total drain of the pool

3. Optimal Amount Calculation
   - Ensures fair pricing when adding liquidity
   - Maintains price stability

# How to Interact with the Liquidity Pool Frontend

## Initial Setup
1. Connect your MetaMask wallet to the website
2. Switch to Sepolia testnet network

![Image 5](https://i.ibb.co/ByHJbhL/Screenshot-from-2025-01-14-12-23-40.png)

## Trading Tokens
Our intuitive trading interface offers two ways to swap tokens:

### Input-Based Swap
1. Select the token you want to swap from
2. Enter the amount you wish to trade
3. The interface automatically calculates how many tokens you'll receive

![Image 4](https://i.ibb.co/fMRJfnh/Screenshot-from-2025-01-14-12-23-59.png)

### Output-Based Swap
1. Select the token you want to receive
2. Enter your desired output amount
3. The interface will calculate how many input tokens you need

![Image 3](https://i.ibb.co/583sHsP/Screenshot-from-2025-01-14-12-24-08.png)

## Adding Liquidity
The Add Liquidity feature allows you to become a liquidity provider:

1. Click the "Add Liquidity" button
2. Select the token pair
3. Enter the amount for one token
4. The interface automatically calculates the required amount of the second token based on the current pool ratio

> **Important Note:** Liquidity must be provided in a specific ratio to maintain pool balance. This ratio is determined by the current state of the pool.

![Image 2](https://i.ibb.co/4s3NwtW/Screenshot-from-2025-01-14-12-24-20.png)

## Getting Test Tokens
If you're experiencing issues with swapping or providing liquidity:
1. Use our faucet feature to get test tokens
2. Click on the "Faucet" button
3. Select the token you need
4. Request tokens for testing

![Image 1](https://i.ibb.co/xqSwQC3/Screenshot-from-2025-01-14-12-24-31.png)


