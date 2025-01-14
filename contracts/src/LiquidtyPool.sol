// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract LiquidtyPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ERC20 variables
    string public constant name = 'LiquidtyPool';
    string public constant symbol = 'LP';
    uint8 public constant decimals = 18;
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    // Constants for calculations
    uint public constant MINIMUM_LIQUIDITY = 10**3;
    uint private constant PRECISION = 1e18;

    // Token addresses
    address public immutable token0;
    address public immutable token1;

    // Reserve tracking
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;


    uint public kLast; // Reserve0 * Reserve1, as of immediately after the last liquidity event

    // Protocol fee configuration
    uint8 public constant protocolFee = 3; // 0.3%
    uint private constant FEE_DENOMINATOR = 1000;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    // ERC20 functions
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(_balances[from] >= amount, "ERC20: transfer amount exceeds balance");

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        // Removed zero address check to allow minting to address(0)
        unchecked {
            _totalSupply += amount;
            _balances[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "ERC20: burn from the zero address");
        require(_balances[from] >= amount, "ERC20: burn amount exceeds balance");

        unchecked {
            _balances[from] -= amount;
            _totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }

    

    // View Functions
    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
    }

    // Internal price calculation
    function _getCurrentPrice(uint inputReserve, uint outputReserve) private pure returns (uint) {
        require(inputReserve > 0 && outputReserve > 0, "INSUFFICIENT_LIQUIDITY");
        return (inputReserve * PRECISION) / outputReserve;
    }

    // Add liquidity
    function mint(uint amount0Desired, uint amount1Desired, address to) external nonReentrant returns (uint liquidity) {
        require(amount0Desired > 0 && amount1Desired > 0, "INSUFFICIENT_INPUT_AMOUNT");
        
        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        uint amount0;
        uint amount1;

        if (_reserve0 == 0 && _reserve1 == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
        } else {
            uint amount1Optimal = (amount0Desired * _reserve1) / _reserve0;
            if (amount1Optimal <= amount1Desired) {
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                uint amount0Optimal = (amount1Desired * _reserve0) / _reserve1;
                assert(amount0Optimal <= amount0Desired);
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }
        }

        // Transfer tokens to the pool
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        // Calculate liquidity
        if (_reserve0 == 0 && _reserve1 == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0), MINIMUM_LIQUIDITY); // Now possible with custom ERC20 implementation
        } else {
            liquidity = Math.min(
                (amount0 * totalSupply()) / _reserve0,
                (amount1 * totalSupply()) / _reserve1
            );
        }

        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        kLast = uint(reserve0) * uint(reserve1);
        emit Mint(msg.sender, amount0, amount1);
    }

    // Remove liquidity
    function burn(uint liquidity, address to) external nonReentrant  returns (uint amount0, uint amount1) {
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY");
        
        // Transfer LP tokens to contract
        _transfer(msg.sender, address(this), liquidity);

        // Calculate amounts
        uint _totalSupply = totalSupply();
        amount0 = (liquidity * IERC20(token0).balanceOf(address(this))) / _totalSupply;
        amount1 = (liquidity * IERC20(token1).balanceOf(address(this))) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(address(this), liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);

        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        kLast = uint(reserve0) * uint(reserve1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // Swap tokens
    function swap(uint amountIn, address tokenIn, uint amountOutMin, address to) external nonReentrant  {
        // to avoid stack too deep error 
        uint amountin = amountIn;
        address tokenin = tokenIn;

        require(amountin > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(tokenin == token0 || tokenin == token1, "INVALID_TOKEN");
        require(to != token0 && to != token1, "INVALID_TO");

        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        require(_reserve0 > 0 && _reserve1 > 0, "INSUFFICIENT_LIQUIDITY");

        bool isToken0 = tokenin == token0;
        (uint reserveIn, uint reserveOut) = isToken0 ? (_reserve0, _reserve1) : (_reserve1, _reserve0);
        
        // Transfer input tokens to the contract
        IERC20(tokenin).safeTransferFrom(msg.sender, address(this), amountin);

        // Calculate output amount
        uint amountInWithFee = amountin * (1000 - protocolFee);
        uint amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
        require(amountOut >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        // Transfer output tokens to recipient
        IERC20(isToken0 ? token1 : token0).safeTransfer(to, amountOut);

        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
    }

    // Calculate the amount of tokens to be received in a swap
    function getAmountOut(uint amountIn, address tokenIn) external view returns (uint amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(tokenIn == token0 || tokenIn == token1, "INVALID_TOKEN");

        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        require(_reserve0 > 0 && _reserve1 > 0, "INSUFFICIENT_LIQUIDITY");

        uint amountInWithFee = amountIn * (1000 - protocolFee);
        
        if (tokenIn == token0) {
            amountOut = (amountInWithFee * _reserve1) / (_reserve0 * 1000 + amountInWithFee);
        } else {
            amountOut = (amountInWithFee * _reserve0) / (_reserve1 * 1000 + amountInWithFee);
        }
    }

    // Internal functions
    function _update(uint balance0, uint balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(uint112(balance0), uint112(balance1));
    }
}