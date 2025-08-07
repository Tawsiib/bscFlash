// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title FlashLoanArbUltraSecure
 * @dev Ultra-secure flash loan arbitrage contract with advanced MEV protection and risk management
 */
contract FlashLoanArbUltraSecure is ReentrancyGuard, Ownable, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

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
    
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
        function approve(address spender, uint256 amount) external returns (bool);
    }

    // ============ STRUCTS ============
    
    struct ArbitrageParams {
        address tokenA;
        address tokenB;
        uint256 amountIn;
        uint256 minAmountOut;
        uint8 exchangeA;
        uint8 exchangeB;
        uint256 deadline;
        uint256 maxSlippage;
        bytes32 commitment; // For commit-reveal scheme
        uint256 nonce;
    }
    
    struct SecurityLimits {
        uint256 maxSingleTrade;
        uint256 maxDailyVolume;
        uint256 maxSlippageBps;
        uint256 maxGasPrice;
        uint256 minBlockDelay;
        uint256 maxConsecutiveFailures;
    }
    
    struct RiskMetrics {
        uint256 totalVolume24h;
        uint256 failureCount;
        uint256 lastFailureBlock;
        uint256 consecutiveFailures;
        bool circuitBreakerTripped;
        uint256 circuitBreakerUntil;
    }
    
    struct MEVProtection {
        mapping(bytes32 => uint256) commitments; // commitment => block number
        mapping(address => uint256) lastExecutionBlock;
        mapping(address => uint256) executionCount;
        uint256 commitRevealDelay;
        uint256 maxExecutionsPerBlock;
        bool enableCommitReveal;
        bool enableSlippageProtection;
    }
    
    struct RouterInfo {
        address router;
        bool isActive;
        uint256 successRate;
        uint256 totalExecutions;
        uint256 lastUpdateBlock;
    }

    // ============ STATE VARIABLES ============
    
    IEqualizerFlashLoan public immutable equalizerPool;
    
    // Security and access control
    mapping(address => bool) public authorizedCallers;
    mapping(address => bool) public emergencyOperators;
    mapping(bytes32 => bool) public executedTxs; // Replay protection
    
    // Router management
    mapping(uint8 => RouterInfo) public routerInfo;
    uint8 public routerCount;
    
    // Security limits and metrics
    SecurityLimits public limits;
    RiskMetrics public riskMetrics;
    MEVProtection public mevProtection;
    
    // Circuit breaker
    bool public circuitBreakerEnabled = true;
    uint256 public circuitBreakerThreshold = 5; // failures
    uint256 public circuitBreakerCooldown = 1 hours;
    
    // Multi-signature support
    mapping(bytes32 => uint256) public multiSigProposals;
    mapping(bytes32 => mapping(address => bool)) public multiSigVotes;
    uint256 public requiredSignatures = 2;
    address[] public signers;
    
    // Time-lock for critical operations
    mapping(bytes32 => uint256) public timelockProposals;
    uint256 public timelockDelay = 24 hours;
    
    // Emergency controls
    bool public emergencyPaused = false;
    uint256 public emergencyPausedUntil;
    
    // Constants
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant DEADLINE_BUFFER = 300; // 5 minutes
    uint256 private constant MAX_SLIPPAGE_BPS = 500; // 5%
    uint256 private constant MIN_PROFIT_THRESHOLD = 1e15; // 0.001 ETH
    uint256 private constant GAS_OVERHEAD = 50000;

    // ============ EVENTS ============
    
    event ArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        uint8 exchangeA,
        uint8 exchangeB,
        uint256 gasUsed,
        bytes32 txHash
    );
    
    event CircuitBreakerTripped(
        address indexed trigger,
        uint256 failureCount,
        uint256 cooldownUntil
    );
    
    event EmergencyPause(
        address indexed operator,
        uint256 pausedUntil,
        string reason
    );
    
    event RouterUpdated(
        uint8 indexed routerId,
        address indexed router,
        bool isActive
    );
    
    event SecurityLimitsUpdated(
        uint256 maxSingleTrade,
        uint256 maxDailyVolume,
        uint256 maxSlippageBps
    );
    
    event MEVProtectionEnabled(
        bool commitReveal,
        bool slippageProtection,
        uint256 commitRevealDelay
    );
    
    event RiskAlert(
        address indexed token,
        uint256 riskScore,
        string alertType,
        uint256 timestamp
    );

    // ============ MODIFIERS ============
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Unauthorized");
        _;
    }
    
    modifier onlyEmergencyOperator() {
        require(emergencyOperators[msg.sender] || msg.sender == owner(), "Not emergency operator");
        _;
    }
    
    modifier notPaused() {
        require(!paused() && !emergencyPaused, "Contract paused");
        if (emergencyPaused) {
            require(block.timestamp > emergencyPausedUntil, "Emergency pause active");
        }
        _;
    }
    
    modifier circuitBreakerCheck() {
        if (circuitBreakerEnabled && riskMetrics.circuitBreakerTripped) {
            require(block.timestamp > riskMetrics.circuitBreakerUntil, "Circuit breaker active");
            // Reset circuit breaker
            riskMetrics.circuitBreakerTripped = false;
            riskMetrics.consecutiveFailures = 0;
        }
        _;
    }
    
    modifier validCommitment(bytes32 commitment, uint256 nonce) {
        if (mevProtection.enableCommitReveal) {
            require(commitment != bytes32(0), "Invalid commitment");
            require(
                mevProtection.commitments[commitment] > 0 &&
                block.number >= mevProtection.commitments[commitment] + mevProtection.commitRevealDelay,
                "Invalid or premature reveal"
            );
            // Clean up used commitment
            delete mevProtection.commitments[commitment];
        }
        _;
    }
    
    modifier rateLimit() {
        if (mevProtection.maxExecutionsPerBlock > 0) {
            require(
                mevProtection.executionCount[msg.sender] < mevProtection.maxExecutionsPerBlock,
                "Rate limit exceeded"
            );
            mevProtection.executionCount[msg.sender]++;
        }
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor(address _equalizerPool) {
        equalizerPool = IEqualizerFlashLoan(_equalizerPool);
        
        // Initialize security limits
        limits = SecurityLimits({
            maxSingleTrade: 1000 ether,
            maxDailyVolume: 10000 ether,
            maxSlippageBps: 300, // 3%
            maxGasPrice: 50 gwei,
            minBlockDelay: 1,
            maxConsecutiveFailures: 3
        });
        
        // Initialize MEV protection
        mevProtection.commitRevealDelay = 2; // 2 blocks
        mevProtection.maxExecutionsPerBlock = 5;
        mevProtection.enableCommitReveal = true;
        mevProtection.enableSlippageProtection = true;
        
        // Authorize contract owner
        authorizedCallers[msg.sender] = true;
        emergencyOperators[msg.sender] = true;
        signers.push(msg.sender);
    }

    // ============ MAIN ARBITRAGE FUNCTION ============
    
    /**
     * @dev Execute ultra-secure arbitrage with comprehensive protection
     */
    function executeUltraSecureArbitrage(
        ArbitrageParams calldata params
    ) external 
        onlyAuthorized 
        notPaused 
        nonReentrant 
        circuitBreakerCheck
        validCommitment(params.commitment, params.nonce)
        rateLimit
    {
        uint256 startGas = gasleft();
        
        // Replay protection
        bytes32 txHash = keccak256(abi.encodePacked(
            params.tokenA,
            params.tokenB,
            params.amountIn,
            params.nonce,
            block.number,
            msg.sender
        ));
        require(!executedTxs[txHash], "Transaction already executed");
        executedTxs[txHash] = true;
        
        // Security validations
        _validateArbitrageParams(params);
        _checkSecurityLimits(params);
        _updateRiskMetrics(params.amountIn);
        
        // Execute flash loan arbitrage
        bytes memory data = abi.encode(params, msg.sender, startGas, txHash);
        
        try equalizerPool.flashLoan(params.tokenA, params.amountIn, data) {
            // Success - update metrics
            riskMetrics.consecutiveFailures = 0;
            
            // Update router success rates
            _updateRouterMetrics(params.exchangeA, true);
            _updateRouterMetrics(params.exchangeB, true);
            
        } catch Error(string memory reason) {
            // Handle failure
            _handleExecutionFailure(reason);
            revert(reason);
        }
    }
    
    /**
     * @dev Flash loan callback with enhanced security
     */
    function receiveFlashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external {
        require(msg.sender == address(equalizerPool), "Invalid flash loan caller");
        
        (ArbitrageParams memory params, address executor, uint256 startGas, bytes32 txHash) = 
            abi.decode(data, (ArbitrageParams, address, uint256, bytes32));
        
        // Execute arbitrage logic
        uint256 profit = _executeArbitrageLogic(params, amount);
        
        // Ensure minimum profit after gas costs
        uint256 gasUsed = startGas - gasleft() + GAS_OVERHEAD;
        uint256 gasCost = gasUsed * tx.gasprice;
        require(profit > gasCost + MIN_PROFIT_THRESHOLD, "Insufficient profit");
        
        // Repay flash loan
        IERC20(token).transfer(address(equalizerPool), amount);
        
        // Transfer profit to executor
        uint256 netProfit = profit - gasCost;
        IERC20(token).transfer(executor, netProfit);
        
        emit ArbitrageExecuted(
            executor,
            params.tokenA,
            params.tokenB,
            params.amountIn,
            netProfit,
            params.exchangeA,
            params.exchangeB,
            gasUsed,
            txHash
        );
    }

    // ============ SECURITY FUNCTIONS ============
    
    /**
     * @dev Commit to future arbitrage execution (MEV protection)
     */
    function commitArbitrage(bytes32 commitment) external onlyAuthorized {
        require(mevProtection.enableCommitReveal, "Commit-reveal disabled");
        require(commitment != bytes32(0), "Invalid commitment");
        
        mevProtection.commitments[commitment] = block.number;
    }
    
    /**
     * @dev Update security limits (time-locked)
     */
    function updateSecurityLimits(
        uint256 maxSingleTrade,
        uint256 maxDailyVolume,
        uint256 maxSlippageBps
    ) external onlyOwner {
        bytes32 proposalId = keccak256(abi.encodePacked(
            "updateSecurityLimits",
            maxSingleTrade,
            maxDailyVolume,
            maxSlippageBps,
            block.timestamp
        ));
        
        if (timelockDelay > 0) {
            require(
                timelockProposals[proposalId] > 0 &&
                block.timestamp >= timelockProposals[proposalId] + timelockDelay,
                "Timelock not satisfied"
            );
            delete timelockProposals[proposalId];
        }
        
        require(maxSlippageBps <= MAX_SLIPPAGE_BPS, "Slippage too high");
        
        limits.maxSingleTrade = maxSingleTrade;
        limits.maxDailyVolume = maxDailyVolume;
        limits.maxSlippageBps = maxSlippageBps;
        
        emit SecurityLimitsUpdated(maxSingleTrade, maxDailyVolume, maxSlippageBps);
    }
    
    /**
     * @dev Enable MEV protection features
     */
    function enableMEVProtection(
        bool commitReveal,
        bool slippageProtection,
        uint256 commitRevealDelay
    ) external onlyOwner {
        mevProtection.enableCommitReveal = commitReveal;
        mevProtection.enableSlippageProtection = slippageProtection;
        mevProtection.commitRevealDelay = commitRevealDelay;
        
        emit MEVProtectionEnabled(commitReveal, slippageProtection, commitRevealDelay);
    }
    
    /**
     * @dev Configure circuit breaker
     */
    function configureCircuitBreaker(
        bool enabled,
        uint256 threshold,
        uint256 cooldown
    ) external onlyOwner {
        circuitBreakerEnabled = enabled;
        circuitBreakerThreshold = threshold;
        circuitBreakerCooldown = cooldown;
    }
    
    /**
     * @dev Emergency pause with reason
     */
    function emergencyPause(string calldata reason, uint256 duration) external onlyEmergencyOperator {
        emergencyPaused = true;
        emergencyPausedUntil = block.timestamp + duration;
        
        emit EmergencyPause(msg.sender, emergencyPausedUntil, reason);
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

    // ============ INTERNAL FUNCTIONS ============
    
    function _validateArbitrageParams(ArbitrageParams calldata params) internal view {
        require(params.tokenA != address(0) && params.tokenB != address(0), "Invalid tokens");
        require(params.amountIn > 0, "Invalid amount");
        require(params.deadline > block.timestamp, "Expired deadline");
        require(params.maxSlippage <= limits.maxSlippageBps, "Slippage too high");
        require(routerInfo[params.exchangeA].isActive, "Exchange A inactive");
        require(routerInfo[params.exchangeB].isActive, "Exchange B inactive");
    }
    
    function _checkSecurityLimits(ArbitrageParams calldata params) internal view {
        require(params.amountIn <= limits.maxSingleTrade, "Trade too large");
        require(tx.gasprice <= limits.maxGasPrice, "Gas price too high");
        
        // Check daily volume limit
        require(
            riskMetrics.totalVolume24h + params.amountIn <= limits.maxDailyVolume,
            "Daily volume exceeded"
        );
        
        // Check minimum block delay
        require(
            block.number >= mevProtection.lastExecutionBlock[msg.sender] + limits.minBlockDelay,
            "Block delay not satisfied"
        );
    }
    
    function _updateRiskMetrics(uint256 amount) internal {
        // Update daily volume (simplified - should use time windows)
        riskMetrics.totalVolume24h += amount;
        
        // Update last execution block
        mevProtection.lastExecutionBlock[msg.sender] = block.number;
    }
    
    function _executeArbitrageLogic(
        ArbitrageParams memory params,
        uint256 amount
    ) internal returns (uint256 profit) {
        // Get router addresses
        address routerA = routerInfo[params.exchangeA].router;
        address routerB = routerInfo[params.exchangeB].router;
        
        // Approve tokens
        IERC20(params.tokenA).approve(routerA, amount);
        
        // Execute first swap
        address[] memory pathA = new address[](2);
        pathA[0] = params.tokenA;
        pathA[1] = params.tokenB;
        
        uint256[] memory amountsA = IDEXRouter(routerA).swapExactTokensForTokens(
            amount,
            params.minAmountOut,
            pathA,
            address(this),
            params.deadline
        );
        
        uint256 intermediateAmount = amountsA[1];
        
        // Approve for second swap
        IERC20(params.tokenB).approve(routerB, intermediateAmount);
        
        // Execute second swap
        address[] memory pathB = new address[](2);
        pathB[0] = params.tokenB;
        pathB[1] = params.tokenA;
        
        uint256[] memory amountsB = IDEXRouter(routerB).swapExactTokensForTokens(
            intermediateAmount,
            amount, // Must get back at least the flash loan amount
            pathB,
            address(this),
            params.deadline
        );
        
        uint256 finalAmount = amountsB[1];
        require(finalAmount > amount, "No profit");
        
        profit = finalAmount - amount;
        
        // Additional slippage protection
        if (mevProtection.enableSlippageProtection) {
            uint256 expectedProfit = (amount * params.maxSlippage) / MAX_BPS;
            require(profit >= expectedProfit, "Slippage protection triggered");
        }
    }
    
    function _handleExecutionFailure(string memory reason) internal {
        riskMetrics.failureCount++;
        riskMetrics.consecutiveFailures++;
        riskMetrics.lastFailureBlock = block.number;
        
        // Trip circuit breaker if threshold reached
        if (circuitBreakerEnabled && 
            riskMetrics.consecutiveFailures >= circuitBreakerThreshold) {
            riskMetrics.circuitBreakerTripped = true;
            riskMetrics.circuitBreakerUntil = block.timestamp + circuitBreakerCooldown;
            
            emit CircuitBreakerTripped(
                msg.sender,
                riskMetrics.consecutiveFailures,
                riskMetrics.circuitBreakerUntil
            );
        }
        
        emit RiskAlert(
            address(0),
            riskMetrics.consecutiveFailures * 20, // Simple risk score
            reason,
            block.timestamp
        );
    }
    
    function _updateRouterMetrics(uint8 routerId, bool success) internal {
        RouterInfo storage router = routerInfo[routerId];
        router.totalExecutions++;
        
        if (success) {
            router.successRate = (router.successRate * (router.totalExecutions - 1) + 100) / router.totalExecutions;
        } else {
            router.successRate = (router.successRate * (router.totalExecutions - 1)) / router.totalExecutions;
        }
        
        router.lastUpdateBlock = block.number;
    }

    // ============ VIEW FUNCTIONS ============
    
    function getUltraSecureStats() external view returns (
        uint256 totalVolume24h,
        uint256 failureCount,
        uint256 consecutiveFailures,
        bool circuitBreakerActive,
        bool emergencyPauseActive,
        uint256 authorizedCallersCount
    ) {
        totalVolume24h = riskMetrics.totalVolume24h;
        failureCount = riskMetrics.failureCount;
        consecutiveFailures = riskMetrics.consecutiveFailures;
        circuitBreakerActive = riskMetrics.circuitBreakerTripped;
        emergencyPauseActive = emergencyPaused && block.timestamp <= emergencyPausedUntil;
        
        // Count authorized callers (simplified)
        authorizedCallersCount = signers.length;
    }
    
    function getRouterInfo(uint8 routerId) external view returns (RouterInfo memory) {
        return routerInfo[routerId];
    }
    
    function getSecurityLimits() external view returns (SecurityLimits memory) {
        return limits;
    }
    
    function getMEVProtectionStatus() external view returns (
        bool commitRevealEnabled,
        bool slippageProtectionEnabled,
        uint256 commitRevealDelay,
        uint256 maxExecutionsPerBlock
    ) {
        commitRevealEnabled = mevProtection.enableCommitReveal;
        slippageProtectionEnabled = mevProtection.enableSlippageProtection;
        commitRevealDelay = mevProtection.commitRevealDelay;
        maxExecutionsPerBlock = mevProtection.maxExecutionsPerBlock;
    }

    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(emergencyPaused, "Emergency pause required");
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @dev Reset circuit breaker (emergency operator)
     */
    function resetCircuitBreaker() external onlyEmergencyOperator {
        riskMetrics.circuitBreakerTripped = false;
        riskMetrics.consecutiveFailures = 0;
        riskMetrics.circuitBreakerUntil = 0;
    }
    
    /**
     * @dev Disable emergency pause
     */
    function disableEmergencyPause() external onlyOwner {
        emergencyPaused = false;
        emergencyPausedUntil = 0;
    }
}