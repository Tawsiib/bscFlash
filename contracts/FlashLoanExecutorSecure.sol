// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FlashLoanExecutorSecure
 * @dev Enhanced flash loan arbitrage contract with security improvements
 * @notice Implements reentrancy protection, proper slippage handling, and secure token approvals
 */

interface IEqualizer {
    function flashLoan(
        uint256 amount,
        address token,
        address receiver,
        bytes calldata data
    ) external;
}

interface IDEXRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

contract FlashLoanExecutorSecure is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ STATE VARIABLES ============
    IEqualizer public immutable equalizer;
    address public immutable router1;
    address public immutable router2;
    
    // Security configuration
    uint256 public maxSlippageBps = 300; // 3% default slippage tolerance
    uint256 public minProfitBps = 50;    // 0.5% minimum profit requirement
    uint256 public constant MAX_BPS = 10000;
    uint256 public constant MAX_SLIPPAGE_BPS = 1000; // 10% maximum allowed slippage
    
    // Router whitelisting
    mapping(address => bool) public whitelistedRouters;
    address[] public routerList;
    
    // Flash loan fee configuration
    uint256 public flashLoanFeeBps = 9; // 0.09% default fee
    uint256 public constant MAX_FLASH_LOAN_FEE_BPS = 100; // 1% maximum fee
    
    // Gas refund configuration
    bool public gasRefundEnabled = false;
    uint256 public gasRefundPercentage = 50; // 50% of gas cost refunded
    uint256 public constant MAX_GAS_REFUND_PERCENTAGE = 100;
    address public gasRefundToken; // Token used for gas refunds (e.g., WBNB)
    
    // Rate limiting
    mapping(address => uint256) public lastExecutionTime;
    uint256 public rateLimitDelay = 60; // 60 seconds between executions per user
    bool public rateLimitEnabled = false;
    
    // Statistics tracking
    uint256 public totalArbitragesExecuted;
    uint256 public totalProfitGenerated;
    uint256 public failedArbitrages;
    uint256 public totalGasRefunded;

    // ============ EVENTS ============
    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed
    );
    
    event ArbitrageFailed(
        address indexed token,
        uint256 amount,
        string reason
    );
    
    event SlippageConfigUpdated(uint256 newMaxSlippageBps);
    event ProfitConfigUpdated(uint256 newMinProfitBps);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    
    // New events for enhanced features
    event RouterWhitelisted(address indexed router, bool status);
    event FlashLoanFeeUpdated(uint256 newFeeBps);
    event GasRefundConfigUpdated(bool enabled, uint256 percentage, address token);
    event GasRefunded(address indexed user, uint256 amount, address token);
    event RateLimitConfigUpdated(bool enabled, uint256 delay);

    // ============ MODIFIERS ============
    modifier validSlippage(uint256 slippageBps) {
        require(slippageBps <= MAX_SLIPPAGE_BPS, "Slippage too high");
        _;
    }

    modifier validProfit(uint256 profitBps) {
        require(profitBps <= 1000, "Profit requirement too high"); // Max 10%
        _;
    }
    
    modifier onlyWhitelistedRouter(address router) {
        require(whitelistedRouters[router], "Router not whitelisted");
        _;
    }
    
    modifier rateLimited() {
        if (rateLimitEnabled) {
            require(
                block.timestamp >= lastExecutionTime[msg.sender] + rateLimitDelay,
                "Rate limit exceeded"
            );
            lastExecutionTime[msg.sender] = block.timestamp;
        }
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(
        address _equalizer,
        address _router1,
        address _router2,
        address _gasRefundToken
    ) {
        require(_equalizer != address(0), "Invalid Equalizer address");
        require(_router1 != address(0), "Invalid router1 address");
        require(_router2 != address(0), "Invalid router2 address");
        require(_router1 != _router2, "Routers must be different");

        equalizer = IEqualizer(_equalizer);
        router1 = _router1;
        router2 = _router2;
        gasRefundToken = _gasRefundToken;
        
        // Whitelist the initial routers
        whitelistedRouters[_router1] = true;
        whitelistedRouters[_router2] = true;
        routerList.push(_router1);
        routerList.push(_router2);
        
        emit RouterWhitelisted(_router1, true);
        emit RouterWhitelisted(_router2, true);
    }

    // ============ MAIN FUNCTIONS ============

    /**
     * @dev Initiate arbitrage with enhanced security checks
     * @param amount Flash loan amount
     * @param token Token to flash loan
     * @param path1 Trading path for first DEX
     * @param path2 Trading path for second DEX
     * @param customSlippageBps Custom slippage tolerance (optional, 0 = use default)
     */
    function initiateArbitrage(
        uint256 amount,
        address token,
        address[] calldata path1,
        address[] calldata path2,
        uint256 customSlippageBps
    ) external onlyOwner nonReentrant rateLimited {
        require(amount > 0, "Invalid amount");
        require(token != address(0), "Invalid token");
        require(path1.length >= 2, "Invalid path1");
        require(path2.length >= 2, "Invalid path2");
        require(path1[0] == token, "Path1 must start with loan token");
        require(path2[path2.length - 1] == token, "Path2 must end with loan token");

        // Use custom slippage or default
        uint256 slippageToUse = customSlippageBps > 0 ? customSlippageBps : maxSlippageBps;
        require(slippageToUse <= MAX_SLIPPAGE_BPS, "Slippage too high");

        // Pre-validate arbitrage opportunity
        require(_validateArbitrageOpportunity(amount, path1, path2, slippageToUse), "No profitable arbitrage");

        // Encode parameters for flash loan callback
        bytes memory data = abi.encode(token, path1, path2, slippageToUse, block.timestamp);
        
        // Execute flash loan
        equalizer.flashLoan(amount, token, address(this), data);
    }

    /**
     * @dev Flash loan callback with enhanced security
     * @param token Flash loan token
     * @param amount Flash loan amount
     * @param fee Flash loan fee
     * @param data Encoded arbitrage parameters
     */
    function executeOperation(
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external nonReentrant {
        require(msg.sender == address(equalizer), "Unauthorized caller");

        uint256 gasStart = gasleft();
        
        // Decode parameters
        (
            address arbToken,
            address[] memory path1,
            address[] memory path2,
            uint256 slippageBps,
            uint256 initiationTime
        ) = abi.decode(data, (address, address[], address[], uint256, uint256));

        // Validate parameters
        require(arbToken == token, "Token mismatch");
        require(block.timestamp <= initiationTime + 300, "Transaction expired"); // 5 min max

        bool success = false;
        uint256 profit = 0;

        try this._executeArbitrageLogic(amount, path1, path2, slippageBps) returns (uint256 finalAmount) {
            uint256 totalRepayment = amount + fee;
            
            if (finalAmount > totalRepayment) {
                // Repay flash loan
                IERC20(token).safeTransfer(address(equalizer), totalRepayment);
                
                profit = finalAmount - totalRepayment;
                totalProfitGenerated += profit;
                totalArbitragesExecuted++;
                success = true;
                
                uint256 gasUsed = gasStart - gasleft();
                
                // Handle gas refund if enabled
                if (gasRefundEnabled && gasRefundToken != address(0)) {
                    _processGasRefund(gasUsed, tx.origin);
                }
                
                emit ArbitrageExecuted(token, amount, profit, gasUsed);
            } else {
                failedArbitrages++;
                emit ArbitrageFailed(token, amount, "Insufficient profit after execution");
            }
        } catch Error(string memory reason) {
            failedArbitrages++;
            emit ArbitrageFailed(token, amount, reason);
        } catch {
            failedArbitrages++;
            emit ArbitrageFailed(token, amount, "Unknown error during execution");
        }

        // Ensure flash loan is repaid even if arbitrage fails
        if (!success) {
            uint256 totalRepayment = amount + fee;
            uint256 currentBalance = IERC20(token).balanceOf(address(this));
            require(currentBalance >= totalRepayment, "Insufficient balance for repayment");
            IERC20(token).safeTransfer(address(equalizer), totalRepayment);
        }
    }

    /**
     * @dev Execute arbitrage logic with proper slippage protection
     * @param amount Initial amount
     * @param path1 First DEX path
     * @param path2 Second DEX path
     * @param slippageBps Slippage tolerance in basis points
     * @return finalAmount Final amount after both swaps
     */
    function _executeArbitrageLogic(
        uint256 amount,
        address[] memory path1,
        address[] memory path2,
        uint256 slippageBps
    ) external returns (uint256 finalAmount) {
        require(msg.sender == address(this), "Internal function only");

        // Step 1: Execute first swap with slippage protection
        uint256 intermediateAmount = _executeSwapWithSlippage(
            router1,
            amount,
            path1,
            slippageBps
        );

        require(intermediateAmount > 0, "First swap failed");

        // Step 2: Execute second swap with slippage protection
        finalAmount = _executeSwapWithSlippage(
            router2,
            intermediateAmount,
            path2,
            slippageBps
        );

        require(finalAmount > 0, "Second swap failed");
    }

    /**
     * @dev Execute swap with proper slippage protection and secure approvals
     * @param router DEX router address
     * @param amountIn Input amount
     * @param path Trading path
     * @param slippageBps Slippage tolerance
     * @return amountOut Output amount
     */
    function _executeSwapWithSlippage(
        address router,
        uint256 amountIn,
        address[] memory path,
        uint256 slippageBps
    ) internal onlyWhitelistedRouter(router) returns (uint256 amountOut) {
        address tokenIn = path[0];
        
        // Get expected output amount
        uint256[] memory expectedAmounts = IDEXRouter(router).getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        
        // Calculate minimum output with slippage protection
        uint256 minAmountOut = expectedOut - (expectedOut * slippageBps) / MAX_BPS;
        require(minAmountOut > 0, "Invalid minimum output");

        // Enhanced approval safety: approve 0 first, then exact amount
        IERC20 tokenContract = IERC20(tokenIn);
        tokenContract.safeApprove(router, 0);
        tokenContract.safeApprove(router, amountIn);

        try IDEXRouter(router).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        ) returns (uint256[] memory amounts) {
            amountOut = amounts[amounts.length - 1];
        } catch {
            // Reset approval on failure (security + gas optimization)
            tokenContract.safeApprove(router, 0);
            revert("Swap execution failed");
        }

        // Reset approval after successful use (security + gas optimization)
        tokenContract.safeApprove(router, 0);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Validate arbitrage opportunity before execution
     * @param amount Flash loan amount
     * @param path1 First DEX path
     * @param path2 Second DEX path
     * @param slippageBps Slippage tolerance
     * @return profitable Whether arbitrage is profitable
     */
    function _validateArbitrageOpportunity(
        uint256 amount,
        address[] memory path1,
        address[] memory path2,
        uint256 slippageBps
    ) internal view returns (bool profitable) {
        try this.calculateArbitrageProfit(amount, path1, path2, slippageBps) returns (uint256 profit) {
            uint256 minProfit = (amount * minProfitBps) / MAX_BPS;
            return profit >= minProfit;
        } catch {
            return false;
        }
    }

    /**
     * @dev Calculate potential arbitrage profit
     * @param amount Flash loan amount
     * @param path1 First DEX path
     * @param path2 Second DEX path
     * @param slippageBps Slippage tolerance
     * @return profit Estimated profit after fees and slippage
     */
    function calculateArbitrageProfit(
        uint256 amount,
        address[] memory path1,
        address[] memory path2,
        uint256 slippageBps
    ) external view returns (uint256 profit) {
        // Get amounts from first DEX
        uint256[] memory amounts1 = IDEXRouter(router1).getAmountsOut(amount, path1);
        uint256 intermediateAmount = amounts1[amounts1.length - 1];
        
        // Apply slippage to intermediate amount
        intermediateAmount = intermediateAmount - (intermediateAmount * slippageBps) / MAX_BPS;

        // Get amounts from second DEX
        uint256[] memory amounts2 = IDEXRouter(router2).getAmountsOut(intermediateAmount, path2);
        uint256 finalAmount = amounts2[amounts2.length - 1];
        
        // Apply slippage to final amount
        finalAmount = finalAmount - (finalAmount * slippageBps) / MAX_BPS;

        // Calculate profit using configurable flash loan fee
        uint256 flashLoanFee = (amount * flashLoanFeeBps) / MAX_BPS;
        uint256 totalCost = amount + flashLoanFee;
        
        if (finalAmount > totalCost) {
            profit = finalAmount - totalCost;
        } else {
            profit = 0;
        }
    }

    /**
     * @dev Get contract statistics
     * @return stats Array containing [totalExecuted, totalProfit, failedCount, successRate]
     */
    function getContractStats() external view returns (uint256[4] memory stats) {
        uint256 totalAttempts = totalArbitragesExecuted + failedArbitrages;
        uint256 successRate = totalAttempts > 0 ? (totalArbitragesExecuted * 100) / totalAttempts : 0;
        
        stats[0] = totalArbitragesExecuted;
        stats[1] = totalProfitGenerated;
        stats[2] = failedArbitrages;
        stats[3] = successRate;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Update slippage configuration
     * @param newMaxSlippageBps New maximum slippage in basis points
     */
    function updateSlippageConfig(uint256 newMaxSlippageBps) 
        external 
        onlyOwner 
        validSlippage(newMaxSlippageBps) 
    {
        maxSlippageBps = newMaxSlippageBps;
        emit SlippageConfigUpdated(newMaxSlippageBps);
    }

    /**
     * @dev Update profit requirement configuration
     * @param newMinProfitBps New minimum profit requirement in basis points
     */
    function updateProfitConfig(uint256 newMinProfitBps) 
        external 
        onlyOwner 
        validProfit(newMinProfitBps) 
    {
        minProfitBps = newMinProfitBps;
        emit ProfitConfigUpdated(newMinProfitBps);
    }

    /**
     * @dev Emergency withdraw function with enhanced security
     * @param token Token to withdraw (address(0) for ETH)
     * @param amount Amount to withdraw (0 for full balance)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            // Withdraw ETH/BNB
            uint256 balance = address(this).balance;
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "Insufficient ETH balance");
            require(withdrawAmount > 0, "No ETH to withdraw");
            
            payable(owner()).transfer(withdrawAmount);
            emit EmergencyWithdraw(address(0), withdrawAmount);
        } else {
            // Withdraw ERC20 token
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "Insufficient token balance");
            require(withdrawAmount > 0, "No tokens to withdraw");
            
            tokenContract.safeTransfer(owner(), withdrawAmount);
            emit EmergencyWithdraw(token, withdrawAmount);
        }
    }

    /**
     * @dev Standard withdraw function (for backward compatibility)
     * @param token Token to withdraw
     */
    function withdraw(address token) external onlyOwner {
        this.emergencyWithdraw(token, 0); // Withdraw full balance
    }

    // ============ ENHANCED ADMIN FUNCTIONS ============

    /**
     * @dev Whitelist or blacklist a router
     * @param router Router address
     * @param status Whitelist status
     */
    function setRouterWhitelist(address router, bool status) external onlyOwner {
        require(router != address(0), "Invalid router address");
        
        bool currentStatus = whitelistedRouters[router];
        whitelistedRouters[router] = status;
        
        if (status && !currentStatus) {
            // Adding to whitelist
            routerList.push(router);
        } else if (!status && currentStatus) {
            // Removing from whitelist - find and remove from array
            for (uint256 i = 0; i < routerList.length; i++) {
                if (routerList[i] == router) {
                    routerList[i] = routerList[routerList.length - 1];
                    routerList.pop();
                    break;
                }
            }
        }
        
        emit RouterWhitelisted(router, status);
    }

    /**
     * @dev Update flash loan fee configuration
     * @param newFeeBps New flash loan fee in basis points
     */
    function updateFlashLoanFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FLASH_LOAN_FEE_BPS, "Fee too high");
        flashLoanFeeBps = newFeeBps;
        emit FlashLoanFeeUpdated(newFeeBps);
    }

    /**
     * @dev Configure gas refund settings
     * @param enabled Whether gas refunds are enabled
     * @param percentage Percentage of gas cost to refund (0-100)
     * @param token Token to use for gas refunds
     */
    function configureGasRefund(
        bool enabled,
        uint256 percentage,
        address token
    ) external onlyOwner {
        require(percentage <= MAX_GAS_REFUND_PERCENTAGE, "Percentage too high");
        if (enabled) {
            require(token != address(0), "Invalid gas refund token");
        }
        
        gasRefundEnabled = enabled;
        gasRefundPercentage = percentage;
        gasRefundToken = token;
        
        emit GasRefundConfigUpdated(enabled, percentage, token);
    }

    /**
     * @dev Configure rate limiting
     * @param enabled Whether rate limiting is enabled
     * @param delay Minimum delay between executions in seconds
     */
    function configureRateLimit(bool enabled, uint256 delay) external onlyOwner {
        require(delay <= 3600, "Delay too long"); // Max 1 hour
        
        rateLimitEnabled = enabled;
        rateLimitDelay = delay;
        
        emit RateLimitConfigUpdated(enabled, delay);
    }

    // ============ VIEW FUNCTIONS FOR ENHANCED FEATURES ============

    /**
     * @dev Get all whitelisted routers
     * @return Array of whitelisted router addresses
     */
    function getWhitelistedRouters() external view returns (address[] memory) {
        return routerList;
    }

    /**
     * @dev Check if a router is whitelisted
     * @param router Router address to check
     * @return Whether the router is whitelisted
     */
    function isRouterWhitelisted(address router) external view returns (bool) {
        return whitelistedRouters[router];
    }

    /**
     * @dev Get gas refund configuration
     * @return enabled Whether gas refunds are enabled
     * @return percentage Percentage of gas cost refunded
     * @return token Token used for gas refunds
     */
    function getGasRefundConfig() external view returns (bool enabled, uint256 percentage, address token) {
        return (gasRefundEnabled, gasRefundPercentage, gasRefundToken);
    }

    /**
     * @dev Get rate limit configuration
     * @return enabled Whether rate limiting is enabled
     * @return delay Minimum delay between executions
     */
    function getRateLimitConfig() external view returns (bool enabled, uint256 delay) {
        return (rateLimitEnabled, rateLimitDelay);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Process gas refund for keeper bots
     * @param gasUsed Amount of gas used
     * @param recipient Address to receive the refund
     */
    function _processGasRefund(uint256 gasUsed, address recipient) internal {
        if (!gasRefundEnabled || gasRefundToken == address(0) || recipient == address(0)) {
            return;
        }
        
        // Calculate refund amount (gas used * gas price * refund percentage)
        uint256 gasCost = gasUsed * tx.gasprice;
        uint256 refundAmount = (gasCost * gasRefundPercentage) / 100;
        
        // Check if contract has enough tokens for refund
        IERC20 refundToken = IERC20(gasRefundToken);
        uint256 contractBalance = refundToken.balanceOf(address(this));
        
        if (contractBalance >= refundAmount && refundAmount > 0) {
            // Use low-level call to avoid reverting main transaction on gas refund failure
            bytes memory data = abi.encodeWithSelector(
                IERC20.transfer.selector,
                recipient,
                refundAmount
            );
            
            (bool success, ) = gasRefundToken.call(data);
            if (success) {
                totalGasRefunded += refundAmount;
                emit GasRefunded(recipient, refundAmount, gasRefundToken);
            }
            // Silently fail gas refund to not affect main arbitrage
        }
    }

    // ============ FALLBACK FUNCTIONS ============

    /**
     * @dev Receive ETH/BNB
     */
    receive() external payable {}

    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}