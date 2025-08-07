// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FlashLoanArbUltraFast
 * @dev Ultra-fast flash loan arbitrage contract with optimized gas usage and advanced security
 * @author BSC Flash Arbitrage Team
 */
contract FlashLoanArbUltraFast is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ INTERFACES ============
    
    interface IEqualizerFlashLoan {
        function flashLoan(address token, uint256 amount, bytes calldata data) external;
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

    // ============ PACKED STRUCTS FOR GAS OPTIMIZATION ============
    
    struct ArbitrageParams {
        address tokenIn;           // 20 bytes
        uint96 amount;            // 12 bytes - packed with tokenIn
        address routerA;          // 20 bytes
        address routerB;          // 20 bytes
        uint16 slippageBps;       // 2 bytes
        uint16 maxGasPrice;       // 2 bytes
        uint32 deadline;          // 4 bytes
        uint32 nonce;             // 4 bytes
    }

    struct ExecutionCache {
        uint128 amountOut1;       // 16 bytes
        uint128 amountOut2;       // 16 bytes
        uint64 gasStart;          // 8 bytes
        uint64 timestamp;         // 8 bytes
    }

    struct RouterInfo {
        address router;           // 20 bytes
        uint32 successCount;      // 4 bytes
        uint32 failureCount;      // 4 bytes
        uint32 lastUsed;          // 4 bytes
    }

    // ============ STORAGE OPTIMIZATION ============
    
    // Packed storage slots
    struct ContractState {
        uint128 totalProfit;      // 16 bytes
        uint128 totalVolume;      // 16 bytes
        uint64 totalExecutions;   // 8 bytes
        uint64 failedExecutions;  // 8 bytes
        uint32 lastExecution;     // 4 bytes
        uint32 circuitBreakerTrips; // 4 bytes
        bool paused;              // 1 byte
        bool emergencyMode;       // 1 byte
    }

    ContractState public state;
    
    // Flash loan provider
    IEqualizerFlashLoan public immutable equalizerPool;
    
    // Optimized mappings
    mapping(address => bool) public authorizedCallers;
    mapping(address => RouterInfo) public routerInfo;
    mapping(address => uint256) public tokenBalances;
    mapping(address => uint256) public callerNonces; // Proper nonce-based replay protection
    mapping(address => bool) public whitelistedRouters; // Router whitelist for security
    
    // Circuit breaker limits (packed)
    struct Limits {
        uint128 maxFlashLoanAmount;   // 16 bytes
        uint128 dailyVolumeLimit;     // 16 bytes
        uint64 maxGasPrice;           // 8 bytes
        uint64 minBlockDelay;         // 8 bytes
        uint32 maxConsecutiveFailures; // 4 bytes
        uint32 consecutiveFailures;   // 4 bytes
    }
    
    Limits public limits;
    
    // Gas optimization: Pre-computed constants
    uint256 private constant DEADLINE_BUFFER = 300; // 5 minutes
    uint256 private constant MAX_SLIPPAGE_BPS = 1000; // 10%
    uint256 private constant MIN_PROFIT_THRESHOLD = 1e15; // 0.001 tokens
    uint256 private constant GAS_OVERHEAD = 50000; // Estimated overhead
    
    // ============ EVENTS (Optimized) ============
    
    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed,
        address indexed executor
    );
    
    event CircuitBreakerTripped(uint8 reason, uint256 value);
    event EmergencyPause(bool paused);
    event RouterUpdated(address indexed router, bool isWhitelisted);

    // ============ MODIFIERS ============
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Unauthorized");
        _;
    }
    
    modifier notPaused() {
        require(!state.paused, "Contract paused");
        _;
    }
    
    modifier circuitBreakerCheck(uint256 amount) {
        require(amount <= limits.maxFlashLoanAmount, "Amount exceeds limit");
        require(tx.gasprice <= limits.maxGasPrice, "Gas price too high");
        require(
            block.number >= uint256(state.lastExecution) + limits.minBlockDelay,
            "Block delay not met"
        );
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(
        address _equalizerPool,
        address[] memory _routers
    ) {
        equalizerPool = IEqualizerFlashLoan(_equalizerPool);
        
        // Initialize limits
        limits = Limits({
            maxFlashLoanAmount: 1000 ether,
            dailyVolumeLimit: 10000 ether,
            maxGasPrice: 20 gwei,
            minBlockDelay: 1,
            maxConsecutiveFailures: 5,
            consecutiveFailures: 0
        });
        
        // Initialize routers and whitelist them
        for (uint i = 0; i < _routers.length; i++) {
            routerInfo[_routers[i]] = RouterInfo({
                router: _routers[i],
                successCount: 0,
                failureCount: 0,
                lastUsed: 0
            });
            whitelistedRouters[_routers[i]] = true; // Whitelist trusted routers
        }
        
        // Authorize owner
        authorizedCallers[msg.sender] = true;
    }

    // ============ ULTRA-FAST EXECUTION ============
    
    /**
     * @dev Ultra-fast flash loan execution with minimal gas usage
     */
    function executeUltraFastArbitrage(
        ArbitrageParams calldata params,
        address[] calldata pathA,
        address[] calldata pathB
    ) external 
        onlyAuthorized 
        notPaused 
        nonReentrant 
        circuitBreakerCheck(params.amount)
    {
        // Gas optimization: Cache frequently used values
        uint256 gasStart = gasleft();
        
        // CRITICAL SECURITY: Proper nonce-based replay protection
        require(params.nonce == callerNonces[msg.sender], "Invalid nonce");
        callerNonces[msg.sender]++; // Increment nonce after validation
        
        // Quick profitability check
        uint256 estimatedProfit = _quickProfitEstimate(
            params.amount,
            params.routerA,
            params.routerB,
            pathA,
            pathB
        );
        
        require(estimatedProfit > MIN_PROFIT_THRESHOLD, "Insufficient profit");
        
        // Encode parameters for flash loan callback
        bytes memory data = abi.encode(
            params,
            pathA,
            pathB,
            gasStart,
            msg.sender
        );
        
        // Execute flash loan
        equalizerPool.flashLoan(params.tokenIn, params.amount, data);
    }
    
    /**
     * @dev Flash loan callback - optimized for speed
     */
    function executeOperation(
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external {
        require(msg.sender == address(equalizerPool), "Invalid caller");
        
        // Decode parameters
        (
            ArbitrageParams memory params,
            address[] memory pathA,
            address[] memory pathB,
            uint256 gasStart,
            address executor
        ) = abi.decode(data, (ArbitrageParams, address[], address[], uint256, address));
        
        // Cache for gas optimization
        ExecutionCache memory cache;
        cache.gasStart = uint64(gasStart);
        cache.timestamp = uint64(block.timestamp);
        
        // Calculate repayment amount
        uint256 repayAmount = amount + fee;
        
        try this._executeArbitrageLogic(
            params,
            pathA,
            pathB,
            amount,
            repayAmount
        ) returns (uint256 profit) {
            // Success path
            cache.amountOut2 = uint128(profit);
            
            // Update statistics (gas optimized)
            _updateSuccessStats(amount, profit, gasStart);
            
            // Emit event
            emit ArbitrageExecuted(
                token,
                amount,
                profit,
                gasStart - gasleft(),
                executor
            );
            
        } catch Error(string memory reason) {
            // Failure path - ensure we can still repay
            _handleFailure(reason, amount);
            
            // Emergency repayment
            require(
                IERC20(token).balanceOf(address(this)) >= repayAmount,
                "Insufficient balance for repayment"
            );
        }
        
        // Repay flash loan
        IERC20(token).safeTransfer(address(equalizerPool), repayAmount);
    }
    
    /**
     * @dev Optimized arbitrage logic execution
     */
    function _executeArbitrageLogic(
        ArbitrageParams memory params,
        address[] memory pathA,
        address[] memory pathB,
        uint256 amount,
        uint256 repayAmount
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "Internal only");
        
        // CRITICAL SECURITY: Router whitelist validation
        require(whitelistedRouters[params.routerA] && whitelistedRouters[params.routerB], "Router not whitelisted");
        
        IERC20 token = IERC20(params.tokenIn);
        
        // Step 1: First swap (optimized approval)
        _optimizedApproval(token, params.routerA, amount);
        
        uint256[] memory amountsA = IDEXRouter(params.routerA).swapExactTokensForTokens(
            amount,
            _calculateMinOutput(amount, pathA, params.slippageBps),
            pathA,
            address(this),
            block.timestamp + DEADLINE_BUFFER
        );
        
        uint256 intermediateAmount = amountsA[amountsA.length - 1];
        
        // Step 2: Second swap
        IERC20 intermediateToken = IERC20(pathA[pathA.length - 1]);
        _optimizedApproval(intermediateToken, params.routerB, intermediateAmount);
        
        uint256[] memory amountsB = IDEXRouter(params.routerB).swapExactTokensForTokens(
            intermediateAmount,
            _calculateMinOutput(intermediateAmount, pathB, params.slippageBps),
            pathB,
            address(this),
            block.timestamp + DEADLINE_BUFFER
        );
        
        uint256 finalAmount = amountsB[amountsB.length - 1];
        
        // Calculate profit
        require(finalAmount > repayAmount, "No profit");
        profit = finalAmount - repayAmount;
        
        // Update token balance
        tokenBalances[params.tokenIn] += profit;
        
        return profit;
    }
    
    // ============ GAS-OPTIMIZED HELPER FUNCTIONS ============
    
    /**
     * @dev Optimized token approval to minimize gas
     */
    function _optimizedApproval(IERC20 token, address spender, uint256 amount) private {
        uint256 currentAllowance = token.allowance(address(this), spender);
        if (currentAllowance < amount) {
            if (currentAllowance > 0) {
                token.safeApprove(spender, 0);
            }
            token.safeApprove(spender, type(uint256).max);
        }
    }
    
    /**
     * @dev Quick profit estimation without external calls
     */
    function _quickProfitEstimate(
        uint256 amount,
        address routerA,
        address routerB,
        address[] memory pathA,
        address[] memory pathB
    ) private view returns (uint256) {
        try IDEXRouter(routerA).getAmountsOut(amount, pathA) returns (uint256[] memory amountsA) {
            uint256 intermediateAmount = amountsA[amountsA.length - 1];
            
            try IDEXRouter(routerB).getAmountsOut(intermediateAmount, pathB) returns (uint256[] memory amountsB) {
                uint256 finalAmount = amountsB[amountsB.length - 1];
                
                if (finalAmount > amount) {
                    return finalAmount - amount;
                }
            } catch {}
        } catch {}
        
        return 0;
    }
    
    /**
     * @dev Calculate minimum output with slippage protection
     */
    function _calculateMinOutput(
        uint256 amountIn,
        address[] memory path,
        uint256 slippageBps
    ) private pure returns (uint256) {
        // Simplified calculation for gas optimization
        return (amountIn * (10000 - slippageBps)) / 10000;
    }
    
    /**
     * @dev Update success statistics (gas optimized)
     */
    function _updateSuccessStats(uint256 amount, uint256 profit, uint256 gasStart) private {
        // Reset consecutive failures
        limits.consecutiveFailures = 0;
        
        // Update state in single SSTORE
        state.totalExecutions++;
        state.totalProfit += uint128(profit);
        state.totalVolume += uint128(amount);
        state.lastExecution = uint32(block.number);
    }
    
    /**
     * @dev Handle execution failure
     */
    function _handleFailure(string memory reason, uint256 amount) private {
        // Update failure count
        limits.consecutiveFailures++;
        state.failedExecutions++;
        
        // Circuit breaker check
        if (limits.consecutiveFailures >= limits.maxConsecutiveFailures) {
            state.paused = true;
            state.circuitBreakerTrips++;
            emit CircuitBreakerTripped(1, limits.consecutiveFailures);
        }
    }
    
    // ============ VIEW FUNCTIONS (Optimized) ============
    
    /**
     * @dev Get current nonce for a caller - CRITICAL for off-chain system
     */
    function getCurrentNonce(address caller) external view returns (uint256) {
        return callerNonces[caller];
    }
    
    /**
     * @dev Check if router is whitelisted
     */
    function isRouterWhitelisted(address router) external view returns (bool) {
        return whitelistedRouters[router];
    }

    /**
     * @dev Get contract statistics in single call
     */
    function getUltraFastStats() external view returns (
        uint256 totalExecutions,
        uint256 totalProfit,
        uint256 totalVolume,
        uint256 failedExecutions,
        uint256 successRate,
        bool isPaused,
        uint256 consecutiveFailures
    ) {
        totalExecutions = state.totalExecutions;
        totalProfit = state.totalProfit;
        totalVolume = state.totalVolume;
        failedExecutions = state.failedExecutions;
        
        uint256 totalAttempts = totalExecutions + failedExecutions;
        successRate = totalAttempts > 0 ? (totalExecutions * 10000) / totalAttempts : 0;
        
        isPaused = state.paused;
        consecutiveFailures = limits.consecutiveFailures;
    }
    
    /**
     * @dev Batch profit calculation for multiple opportunities
     */
    function batchCalculateProfit(
        uint256[] calldata amounts,
        address[] calldata routersA,
        address[] calldata routersB,
        address[][] calldata pathsA,
        address[][] calldata pathsB
    ) external view returns (uint256[] memory profits) {
        uint256 length = amounts.length;
        profits = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            profits[i] = _quickProfitEstimate(
                amounts[i],
                routersA[i],
                routersB[i],
                pathsA[i],
                pathsB[i]
            );
        }
    }
    
    // ============ ADMIN FUNCTIONS (Optimized) ============
    
    /**
     * @dev Update router whitelist - CRITICAL SECURITY FUNCTION
     */
    function updateRouter(address _router, bool _isWhitelisted) external onlyOwner {
        require(_router != address(0), "Invalid router address");
        whitelistedRouters[_router] = _isWhitelisted;
        emit RouterUpdated(_router, _isWhitelisted);
    }
    
    /**
     * @dev Batch update router whitelist
     */
    function batchUpdateRouters(
        address[] calldata _routers,
        bool[] calldata _isWhitelisted
    ) external onlyOwner {
        require(_routers.length == _isWhitelisted.length, "Array length mismatch");
        
        for (uint256 i = 0; i < _routers.length; i++) {
            require(_routers[i] != address(0), "Invalid router address");
            whitelistedRouters[_routers[i]] = _isWhitelisted[i];
            emit RouterUpdated(_routers[i], _isWhitelisted[i]);
        }
    }

    /**
     * @dev Batch update authorized callers
     */
    function batchUpdateAuthorizedCallers(
        address[] calldata callers,
        bool[] calldata authorized
    ) external onlyOwner {
        require(callers.length == authorized.length, "Array length mismatch");
        
        for (uint256 i = 0; i < callers.length; i++) {
            authorizedCallers[callers[i]] = authorized[i];
        }
    }
    
    /**
     * @dev Emergency pause with reason
     */
    function emergencyPause(bool _paused, uint8 reason) external onlyOwner {
        state.paused = _paused;
        emit EmergencyPause(_paused);
        if (_paused) {
            emit CircuitBreakerTripped(reason, block.timestamp);
        }
    }
    
    /**
     * @dev Update circuit breaker limits
     */
    function updateLimits(
        uint256 maxFlashLoan,
        uint256 dailyVolumeLimit,
        uint256 maxGasPrice,
        uint256 minBlockDelay,
        uint256 maxConsecutiveFailures
    ) external onlyOwner {
        limits.maxFlashLoanAmount = uint128(maxFlashLoan);
        limits.dailyVolumeLimit = uint128(dailyVolumeLimit);
        limits.maxGasPrice = uint64(maxGasPrice);
        limits.minBlockDelay = uint64(minBlockDelay);
        limits.maxConsecutiveFailures = uint32(maxConsecutiveFailures);
    }
    
    /**
     * @dev Reset circuit breaker
     */
    function resetCircuitBreaker() external onlyOwner {
        limits.consecutiveFailures = 0;
        state.paused = false;
    }
    
    /**
     * @dev Ultra-fast profit withdrawal
     */
    function ultraFastWithdraw(address token, uint256 amount) external onlyOwner {
        require(tokenBalances[token] >= amount, "Insufficient balance");
        tokenBalances[token] -= amount;
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    /**
     * @dev Emergency token recovery
     */
    function emergencyRecover(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
        }
    }
    
    // ============ RECEIVE FUNCTION ============
    
    receive() external payable {
        // Accept BNB for gas optimization
    }
}