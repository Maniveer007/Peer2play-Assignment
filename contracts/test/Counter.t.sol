// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/LiquidtyPool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract LiquidityPoolTest is Test {
    LiquidtyPool public pool;
    MockERC20 public token0;
    MockERC20 public token1;
    
    address public owner;
    address public user1;
    address public user2;
    
    uint256 constant INITIAL_MINT_AMOUNT = 1000000e18;
    uint256 constant MINIMUM_LIQUIDITY = 1000;
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy mock tokens
        token0 = new MockERC20("Token0", "TK0");
        token1 = new MockERC20("Token1", "TK1");
        
        // Ensure token0 address is less than token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }
        
        // Deploy pool
        pool = new LiquidtyPool(address(token0), address(token1));
        
        // Mint initial tokens
        token0.mint(owner, INITIAL_MINT_AMOUNT);
        token1.mint(owner, INITIAL_MINT_AMOUNT);
        token0.mint(user1, INITIAL_MINT_AMOUNT);
        token1.mint(user1, INITIAL_MINT_AMOUNT);
    }
    
    function test_Deployment() public {
        assertEq(pool.token0(), address(token0));
        assertEq(pool.token1(), address(token1));
        
        (uint112 reserve0, uint112 reserve1) = pool.getReserves();
        assertEq(reserve0, 0);
        assertEq(reserve1, 0);
    }
    
    function test_InitialLiquidityProvision() public {
        uint256 amount0 = 10e18;
        uint256 amount1 = 20e18;
        
        token0.approve(address(pool), amount0);
        token1.approve(address(pool), amount1);
        
        pool.mint(amount0, amount1, owner);
        
        (uint112 reserve0, uint112 reserve1) = pool.getReserves();
        assertEq(reserve0, amount0);
        assertEq(reserve1, amount1);
        
        // Expected liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY
        uint256 expectedLiquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
        assertEq(pool.balanceOf(owner), expectedLiquidity);
        assertEq(pool.balanceOf(address(0)), MINIMUM_LIQUIDITY);
    }
    
    function test_SubsequentLiquidityProvision() public {
        uint256 amount0 = 10e18;
        uint256 amount1 = 20e18;
        
        // Initial liquidity
        token0.approve(address(pool), amount0);
        token1.approve(address(pool), amount1);
        pool.mint(amount0, amount1, owner);
        
        // User1 adds liquidity
        vm.startPrank(user1);
        token0.approve(address(pool), amount0);
        token1.approve(address(pool), amount1);
        pool.mint(amount0, amount1, user1);
        vm.stopPrank();
        
        uint256 user1Balance = pool.balanceOf(user1);
        uint256 ownerBalance = pool.balanceOf(owner);
        
        // User1's LP tokens should be approximately equal to owner's
        assertApproxEqRel(user1Balance, ownerBalance, 1e15); // 0.1% tolerance
    }
    
    function test_Swap() public {
        // Add initial liquidity
        uint256 initialLiquidity0 = 100e18;
        uint256 initialLiquidity1 = 100e18;
        
        token0.approve(address(pool), initialLiquidity0);
        token1.approve(address(pool), initialLiquidity1);
        pool.mint(initialLiquidity0, initialLiquidity1, owner);
        
        // Prepare for swap
        uint256 swapAmount = 1e18;
        vm.startPrank(user1);
        token0.approve(address(pool), swapAmount);
        
        uint256 expectedOutput = pool.getAmountOut(swapAmount, address(token0));
        uint256 initialBalance = token1.balanceOf(user1);
        
        // Execute swap
        pool.swap(
            swapAmount,
            address(token0),
            expectedOutput * 99 / 100, // 1% slippage
            user1
        );
        
        uint256 finalBalance = token1.balanceOf(user1);
        assertEq(finalBalance - initialBalance, expectedOutput);
        vm.stopPrank();
    }
    
    function test_SwapFailInsufficientOutput() public {
        // Add initial liquidity
        uint256 initialLiquidity0 = 100e18;
        uint256 initialLiquidity1 = 100e18;
        
        token0.approve(address(pool), initialLiquidity0);
        token1.approve(address(pool), initialLiquidity1);
        pool.mint(initialLiquidity0, initialLiquidity1, owner);
        
        uint256 swapAmount = 1e18;
        vm.startPrank(user1);
        token0.approve(address(pool), swapAmount);
        
        uint256 expectedOutput = pool.getAmountOut(swapAmount, address(token0));
        
        vm.expectRevert("INSUFFICIENT_OUTPUT_AMOUNT");
        pool.swap(
            swapAmount,
            address(token0),
            expectedOutput * 101 / 100, // Expecting 1% more than possible
            user1
        );
        vm.stopPrank();
    }
    
    function test_RemoveLiquidity() public {
        uint256 initialLiquidity0 = 100e18;
        uint256 initialLiquidity1 = 100e18;
        
        // Add initial liquidity
        token0.approve(address(pool), initialLiquidity0);
        token1.approve(address(pool), initialLiquidity1);
        pool.mint(initialLiquidity0, initialLiquidity1, owner);
        
        uint256 lpTokenAmount = pool.balanceOf(owner);
        uint256 initialToken0Balance = token0.balanceOf(owner);
        uint256 initialToken1Balance = token1.balanceOf(owner);
        
        // Remove liquidity
        pool.burn(lpTokenAmount, owner);
        
        uint256 finalToken0Balance = token0.balanceOf(owner);
        uint256 finalToken1Balance = token1.balanceOf(owner);
        
        // Should receive almost all liquidity back (minus MINIMUM_LIQUIDITY)
        assertApproxEqRel(
            finalToken0Balance - initialToken0Balance,
            initialLiquidity0 - MINIMUM_LIQUIDITY,
            1e15 // 0.1% tolerance
        );
        assertApproxEqRel(
            finalToken1Balance - initialToken1Balance,
            initialLiquidity1 - MINIMUM_LIQUIDITY,
            1e15 // 0.1% tolerance
        );
    }
    
    function test_K_Invariant() public {
        uint256 amount0 = 10e18;
        uint256 amount1 = 20e18;
        
        // Add initial liquidity
        token0.approve(address(pool), amount0);
        token1.approve(address(pool), amount1);
        pool.mint(amount0, amount1, owner);
        
        (uint112 reserve0Before, uint112 reserve1Before) = pool.getReserves();
        uint256 kBefore = uint256(reserve0Before) * uint256(reserve1Before);
        
        // Perform swap
        uint256 swapAmount = 1e18;
        vm.startPrank(user1);
        token0.approve(address(pool), swapAmount);
        uint256 expectedOutput = pool.getAmountOut(swapAmount, address(token0));
        pool.swap(swapAmount, address(token0), expectedOutput * 99 / 100, user1);
        vm.stopPrank();
        
        (uint112 reserve0After, uint112 reserve1After) = pool.getReserves();
        uint256 kAfter = uint256(reserve0After) * uint256(reserve1After);
        
        // K should stay the same or increase slightly due to fees
        assertGe(kAfter, kBefore);
    }
    
    // Helper function to calculate square root
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}