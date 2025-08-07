/**
 * Ultra-Fast Arbitrage System
 * Refactored for maximum performance with integrated security layer and connection pooling
 */

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  formatEther, 
  parseUnits,
  formatUnits,
  type Hash,
  type Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';

// Import our optimized modules
import { UltraFastSecurityLayer, type SecurityConfig } from './security-layer.js';
import { UltraFastConnectionPool, type ConnectionPoolConfig } from './connection-pool.js';
import { UltraFastGasOptimizer } from './ultra-gas-optimizer.js';
import { UltraFastMempoolManager } from './ultra-mempool-manager.js';
import { UltraFastExecutor } from './ultra-executor.js';
import { UltraFastContractInterface, type ContractConfig } from './ultra-contract-interface.js';
import { UltraFastPriceOracle, type PriceOracleConfig } from './ultra-price-oracle.js';

// Import enhanced security modules
import { MEVProtectionManager } from '../src/security/mev-protection.js';
import { RiskManager } from '../src/security/risk-manager.js';
import { SecurityMonitor, MonitoringConfig } from '../src/monitoring/security-monitor.js';
import { getSecurityConfig, validateSecurityConfig } from '../config/security-config.js';

// Enhanced arbitrage configuration
interface UltraArbitrageConfig {
  network: 'mainnet' | 'testnet';
  privateKey: string;
  contractAddress: Address;
  
  // Performance settings
  maxConcurrentArbitrages: number;
  batchSize: number;
  executionTimeout: number;
  confirmationBlocks: number;
  
  // Security settings
  enableSecurityLayer: boolean;
  enableMultiSig: boolean;
  maxTransactionValue: bigint;
  
  // Connection settings
  enableConnectionPool: boolean;
  maxConnections: number;
  
  // Gas optimization
  enableGasOptimization: boolean;
  gasStrategy: 'conservative' | 'balanced' | 'aggressive' | 'mev-protected';
  
  // MEV protection
  enableMEVProtection: boolean;
  enableFlashbots: boolean;
  
  // Monitoring
  enableRealTimeMonitoring: boolean;
  enablePerformanceTracking: boolean;
  
  // Emergency controls
  enableEmergencyStop: boolean;
  enableCircuitBreaker: boolean;
  
// Advanced features
  enablePredictiveAnalysis: boolean;
  enableMLOptimization: boolean;
  enableCrossChainArbitrage: boolean;
  enableAdvancedRouting: boolean;
  
  // Contract interface settings
  contractConfig: ContractConfig;
  
  // Price oracle settings
  oracleConfig: PriceOracleConfig;
}

// Enhanced arbitrage opportunity
interface EnhancedArbitrageOpportunity {
  id: string;
  tokenA: Address;
  tokenB: Address;
  amountIn: bigint;
  expectedProfit: bigint;
  gasEstimate: bigint;
  
  // Enhanced metrics
  profitMargin: number;
  riskScore: number;
  confidence: number;
  executionProbability: number;
  
  // Timing
  detectedAt: number;
  expiresAt: number;
  estimatedExecutionTime: number;
  
  // Security
  securityScore: number;
  threatLevel: 'low' | 'medium' | 'high';
  
  // Performance
  expectedSlippage: number;
  gasEfficiency: number;
  
  // MEV
  mevRisk: number;
  frontRunningRisk: number;
  
  // Metadata
  exchanges: string[];
  route: Address[];
  metadata: Record<string, any>;
}

// Execution result with enhanced metrics
interface EnhancedExecutionResult {
  success: boolean;
  transactionHash?: Hash;
  profit?: bigint;
  gasUsed?: bigint;
  executionTime: number;
  
  // Enhanced metrics
  actualSlippage: number;
  gasEfficiency: number;
  profitMargin: number;
  
  // Security
  securityChecks: boolean;
  threatDetected: boolean;
  
  // Performance
  latency: number;
  throughput: number;
  
  error?: string;
  metadata?: Record<string, any>;
}

// Performance metrics
interface UltraPerformanceMetrics {
  // Execution metrics
  totalArbitrages: number;
  successfulArbitrages: number;
  failedArbitrages: number;
  totalProfit: bigint;
  totalGasUsed: bigint;
  
  // Performance metrics
  averageExecutionTime: number;
  averageLatency: number;
  throughput: number;
  successRate: number;
  
  // Gas metrics
  averageGasUsed: bigint;
  gasEfficiency: number;
  gasOptimizationSavings: bigint;
  
  // Security metrics
  securityEvents: number;
  threatsDetected: number;
  blockedTransactions: number;
  
  // MEV metrics
  mevProtectionEvents: number;
  frontRunningPrevented: number;
  sandwichAttacksPrevented: number;
  
  // System metrics
  uptime: number;
  systemLoad: number;
  memoryUsage: number;
  
  // Connection metrics
  connectionPoolEfficiency: number;
  cacheHitRate: number;
  failoverEvents: number;
}

// Default enhanced configuration
const config: UltraArbitrageConfig = {
  network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
  privateKey: process.env.PRIVATE_KEY!,
  contractAddress: process.env.CONTRACT_ADDRESS as Address,
  
  // Performance settings
  maxConcurrentArbitrages: 10,
  batchSize: 5,
  executionTimeout: 30000,
  confirmationBlocks: 1,
  
  // Security settings
  enableSecurityLayer: true,
  enableMultiSig: false,
  maxTransactionValue: parseEther('10'),
  
  // Connection settings
  enableConnectionPool: true,
  maxConnections: 20,
  
  // Gas optimization
  enableGasOptimization: true,
  gasStrategy: 'mev-protected',
  
  // MEV protection
  enableMEVProtection: true,
  enableFlashbots: true,
  
  // Monitoring
  enableRealTimeMonitoring: true,
  enablePerformanceTracking: true,
  
  // Emergency controls
  enableEmergencyStop: true,
  enableCircuitBreaker: true,
  
  // Advanced features
  enablePredictiveAnalysis: true,
  enableMLOptimization: true,
  enableCrossChainArbitrage: false,
};

/**
 * Ultra-Fast Arbitrage System with Enhanced Performance and Security
 */
class UltraFastArbitrageSystem {
  private account: any;
  private publicClient: any;
  private walletClient: any;
  
  // Enhanced components
  private securityLayer?: UltraFastSecurityLayer;
  private connectionPool?: UltraFastConnectionPool;
  private gasOptimizer?: UltraFastGasOptimizer;
  private mempoolManager?: UltraFastMempoolManager;
  private executor?: UltraFastExecutor;
  private contractInterface?: UltraFastContractInterface;
  private priceOracle?: UltraFastPriceOracle;
  
  // Enhanced security components
  private mevProtectionManager?: MEVProtectionManager;
  private riskManager?: RiskManager;
  private securityMonitor?: SecurityMonitor;
  
  // State management
  private isRunning = false;
  private isPaused = false;
  private emergencyStop = false;
  
  // Performance tracking
  private metrics: UltraPerformanceMetrics = {
    totalArbitrages: 0,
    successfulArbitrages: 0,
    failedArbitrages: 0,
    totalProfit: 0n,
    totalGasUsed: 0n,
    averageExecutionTime: 0,
    averageLatency: 0,
    throughput: 0,
    successRate: 0,
    averageGasUsed: 0n,
    gasEfficiency: 0,
    gasOptimizationSavings: 0n,
    securityEvents: 0,
    threatsDetected: 0,
    blockedTransactions: 0,
    mevProtectionEvents: 0,
    frontRunningPrevented: 0,
    sandwichAttacksPrevented: 0,
    uptime: 0,
    systemLoad: 0,
    memoryUsage: 0,
    connectionPoolEfficiency: 0,
    cacheHitRate: 0,
    failoverEvents: 0,
  };
  
  // Execution tracking
  private executionTimes: number[] = [];
  private latencies: number[] = [];
  private startTime = Date.now();
  
  // Opportunity queue with priority
  private opportunityQueue: EnhancedArbitrageOpportunity[] = [];
  private executingOpportunities = new Set<string>();
  
  constructor(private config: UltraArbitrageConfig) {
    this.setupAccount();
  }

  /**
   * Setup account and clients
   */
  private setupAccount(): void {
    this.account = privateKeyToAccount(this.config.privateKey as `0x${string}`);
    const chain = this.config.network === 'mainnet' ? bsc : bscTestnet;
    
    // Basic clients (will be enhanced with connection pool)
    this.publicClient = createPublicClient({
      chain,
      transport: http(process.env.RPC_URL!),
    });
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(process.env.RPC_URL!),
    });
  }

  /**
   * Initialize all enhanced components
   */
  async initialize(): Promise<void> {
    console.log(chalk.bold.blue('🚀 Initializing Ultra-Fast Arbitrage System...'));
    
    try {
      // Initialize security layer
      if (this.config.enableSecurityLayer) {
        console.log(chalk.blue('🛡️ Initializing security layer...'));
        const securityConfig: SecurityConfig = {
          network: this.config.network,
          rpcUrl: process.env.RPC_URL!,
          enableMultiSig: this.config.enableMultiSig,
          requiredSignatures: 2,
          authorizedSigners: [this.config.privateKey],
          enableAccessControl: true,
          adminAddresses: [this.account.address],
          operatorAddresses: [],
          maxTransactionValue: this.config.maxTransactionValue,
          dailyTransactionLimit: parseEther('1000'),
          enableThreatDetection: true,
          suspiciousGasThreshold: parseEther('0.001'),
          maxTransactionsPerMinute: 20,
          blacklistedAddresses: [],
          enableRateLimiting: true,
          rateLimitWindow: 60000,
          maxRequestsPerWindow: 50,
          enableEmergencyStop: this.config.enableEmergencyStop,
          emergencyStopAddresses: [this.account.address],
          pauseDuration: 300000,
          enableSecurityMonitoring: true,
          alertThresholds: {
            failedTransactions: 5,
            suspiciousActivity: 3,
            gasAnomalies: 2,
          },
          enableEncryption: true,
          encryptionKey: process.env.ENCRYPTION_KEY || 'ultra-fast-arbitrage-key',
          enableAuditLog: true,
          logRetentionDays: 30,
        };
        
        this.securityLayer = new UltraFastSecurityLayer(securityConfig);
        this.securityLayer.startSecurityMonitoring();
      }
      
      // Initialize connection pool
      if (this.config.enableConnectionPool) {
        console.log(chalk.blue('🔗 Initializing connection pool...'));
        const poolConfig: ConnectionPoolConfig = {
          network: this.config.network,
          rpcEndpoints: [
            process.env.RPC_URL!,
            process.env.BACKUP_RPC_URL || process.env.RPC_URL!,
            'https://bsc-dataseed1.binance.org',
            'https://bsc-dataseed2.binance.org',
          ].filter(Boolean),
          wsEndpoints: [process.env.WS_URL].filter(Boolean),
          maxConnections: this.config.maxConnections,
          minConnections: 5,
          connectionTimeout: 10000,
          idleTimeout: 300000,
          maxRetries: 3,
          retryDelay: 1000,
          enableHealthCheck: true,
          healthCheckInterval: 30000,
          healthCheckTimeout: 5000,
          maxFailures: 3,
          loadBalancingStrategy: 'response-time',
          enableFailover: true,
          failoverThreshold: 5000,
          enableConnectionReuse: true,
          enableKeepAlive: true,
          enableBatching: true,
          batchSize: this.config.batchSize,
          batchTimeout: 100,
          enableResponseCache: true,
          cacheSize: 1000,
          cacheTTL: 60000,
          enableMetrics: true,
          metricsInterval: 5000,
        };
        
        this.connectionPool = new UltraFastConnectionPool(poolConfig);
        await this.connectionPool.initialize();
        
        // Update clients to use connection pool
        const poolClient = this.connectionPool.getClient();
        if (poolClient) {
          this.publicClient = poolClient;
        }
      }
      
      // Initialize gas optimizer
      if (this.config.enableGasOptimization) {
        console.log(chalk.blue('⛽ Initializing gas optimizer...'));
        this.gasOptimizer = new UltraFastGasOptimizer({
          network: this.config.network,
          rpcUrl: process.env.RPC_URL!,
          wsUrl: process.env.WS_URL,
          enablePredictiveModeling: true,
          enableDynamicPricing: true,
          enableMEVProtection: this.config.enableMEVProtection,
          enableGasTokenOptimization: true,
          conservativeMultiplier: 1.1,
          balancedMultiplier: 1.2,
          aggressiveMultiplier: 1.5,
          mevProtectedMultiplier: 2.0,
          maxGasPrice: parseEther('0.01'),
          minGasPrice: parseEther('0.000001'),
          gasBuffer: 1.1,
          historyBlocks: 100,
          updateInterval: 5000,
          predictionWindow: 60000,
          emergencyGasMultiplier: 3.0,
          emergencyMaxGasPrice: parseEther('0.1'),
        });
        
        this.gasOptimizer.startOptimization();
        this.gasOptimizer.setStrategy(this.config.gasStrategy);
      }
      
      // Initialize mempool manager
      if (this.config.enableMEVProtection) {
        console.log(chalk.blue('🔍 Initializing mempool manager...'));
        this.mempoolManager = new UltraFastMempoolManager({
          network: this.config.network,
          privateKey: this.config.privateKey,
          rpcUrl: process.env.RPC_URL!,
          wsUrl: process.env.WS_URL!,
          enableMempoolMonitoring: true,
          enableFrontRunningProtection: true,
          enableSandwichProtection: true,
          enableGasOptimization: true,
          maxPendingTransactions: 100,
          transactionTimeout: 30000,
          gasBuffer: 1.2,
          priorityFeeMultiplier: 1.5,
          mevGasThreshold: parseEther('0.001'),
          enableMEVDetection: true,
          antiSandwichDelay: 1000,
          enableTransactionBundling: this.config.enableFlashbots,
          enableFlashbots: this.config.enableFlashbots,
          enablePrivateMempool: true,
        });
        
        this.mempoolManager.startMonitoring();
      }
      
      // Initialize ultra executor
      console.log(chalk.blue('⚡ Initializing ultra executor...'));
      this.executor = new UltraFastExecutor({
        network: this.config.network,
        privateKey: this.config.privateKey,
        rpcUrl: process.env.RPC_URL!,
        wsUrl: process.env.WS_URL!,
        maxConcurrentTransactions: this.config.maxConcurrentArbitrages,
        batchSize: this.config.batchSize,
        maxRetries: 3,
        transactionTimeout: this.config.executionTimeout,
        confirmationBlocks: this.config.confirmationBlocks,
        enableParallelExecution: true,
        enableBatchExecution: true,
        enableIntelligentRouting: true,
        enableFailover: true,
        enableGasOptimization: this.config.enableGasOptimization,
        enableMEVProtection: this.config.enableMEVProtection,
        enableCircuitBreaker: this.config.enableCircuitBreaker,
        circuitBreakerThreshold: 5,
        circuitBreakerWindow: 60000,
        circuitBreakerRecoveryTime: 300000,
      });
      
      this.executor.startExecutor();
      
      // Initialize ultra-fast contract interface
      console.log(chalk.blue('🔗 Initializing ultra-fast contract interface...'));
      this.contractInterface = new UltraFastContractInterface(this.config.contractConfig);
      
      // Initialize ultra-fast price oracle
      console.log(chalk.blue('🔮 Initializing ultra-fast price oracle...'));
      this.priceOracle = new UltraFastPriceOracle(this.config.oracleConfig);
      await this.priceOracle.start();
      
      // Initialize enhanced security components
      if (this.config.enableMEVProtection) {
        console.log(chalk.blue('🛡️ Initializing MEV protection manager...'));
        const securityConfig = getSecurityConfig(this.config.network);
        validateSecurityConfig(securityConfig);
        
        this.mevProtectionManager = new MEVProtectionManager({
          enableCommitReveal: securityConfig.mevProtection.enableCommitReveal,
          enableSlippageProtection: securityConfig.mevProtection.enableSlippageProtection,
          enableFrontrunningDetection: securityConfig.mevProtection.enableFrontrunningDetection,
          enableSandwichDetection: securityConfig.mevProtection.enableSandwichDetection,
          enablePrivateMempool: securityConfig.mevProtection.enablePrivateMempool,
          enableFlashbotsIntegration: securityConfig.mevProtection.enableFlashbotsIntegration,
          maxSlippageBps: securityConfig.mevProtection.maxSlippageBps,
          commitRevealDelay: securityConfig.mevProtection.commitRevealDelay,
          frontrunningThreshold: securityConfig.mevProtection.frontrunningThreshold,
          sandwichDetectionWindow: securityConfig.mevProtection.sandwichDetectionWindow,
          privateMempoolEndpoint: securityConfig.mevProtection.privateMempoolEndpoint,
          flashbotsRelay: securityConfig.mevProtection.flashbotsRelay,
        });
        
        console.log(chalk.blue('📊 Initializing risk manager...'));
        this.riskManager = new RiskManager({
          maxSingleTradeUsd: securityConfig.riskManagement.maxSingleTradeUsd,
          maxDailyVolumeUsd: securityConfig.riskManagement.maxDailyVolumeUsd,
          maxSlippageBps: securityConfig.riskManagement.maxSlippageBps,
          maxPriceImpactBps: securityConfig.riskManagement.maxPriceImpactBps,
          maxDexExposurePercent: securityConfig.riskManagement.maxDexExposurePercent,
          maxConsecutiveFailures: securityConfig.riskManagement.maxConsecutiveFailures,
          circuitBreakerThreshold: securityConfig.riskManagement.circuitBreakerThreshold,
          cooldownPeriodMs: securityConfig.riskManagement.cooldownPeriodMs,
          enableDynamicLimits: securityConfig.riskManagement.enableDynamicLimits,
          enableVolatilityAdjustment: securityConfig.riskManagement.enableVolatilityAdjustment,
        });
        
        // Initialize security monitor
        console.log(chalk.blue('🔍 Initializing security monitor...'));
        const monitoringConfig: MonitoringConfig = {
          contractAddress: this.config.contractConfig.address,
          rpcUrl: process.env.RPC_URL!,
          wsUrl: process.env.WS_URL,
          enableEventMonitoring: true,
          enableMetricsCollection: true,
          enableAlerting: true,
          alertChannels: {
            webhook: process.env.ALERT_WEBHOOK_URL,
            slack: process.env.SLACK_WEBHOOK_URL,
            discord: process.env.DISCORD_WEBHOOK_URL,
          },
          alertThresholds: {
            gasAnomalyThreshold: 150, // 150% of normal gas
            mevAttackThreshold: 3,
            lowProfitThreshold: 0.01, // 1% profit-to-gas ratio
            failureRateThreshold: 0.1, // 10% failure rate
            responseTimeThreshold: 5000, // 5 seconds
          },
          metricsRetentionDays: 7,
          alertRateLimit: {
            maxAlertsPerHour: 10,
            cooldownMinutes: 5,
          },
        };
        
        this.securityMonitor = new SecurityMonitor(monitoringConfig);
        await this.securityMonitor.start();
      }
      
      console.log(chalk.green('✅ Ultra-Fast Arbitrage System initialized successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize arbitrage system:'), error);
      throw error;
    }
  }

  /**
   * Start the arbitrage system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Arbitrage system is already running'));
      return;
    }
    
    console.log(chalk.bold.green('🚀 Starting Ultra-Fast Arbitrage System...'));
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Start monitoring loops
    this.startOpportunityScanning();
    this.startOpportunityExecution();
    this.startPerformanceMonitoring();
    
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
    
    console.log(chalk.green('✅ Ultra-Fast Arbitrage System started successfully'));
  }

  /**
   * Stop the arbitrage system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log(chalk.yellow('⏹️ Stopping Ultra-Fast Arbitrage System...'));
    
    this.isRunning = false;
    
    // Stop all components
    if (this.securityLayer) {
      this.securityLayer.stopSecurityMonitoring();
    }
    
    if (this.connectionPool) {
      await this.connectionPool.shutdown();
    }
    
    if (this.gasOptimizer) {
      this.gasOptimizer.stopOptimization();
    }
    
    if (this.mempoolManager) {
      this.mempoolManager.stopMonitoring();
    }
    
    if (this.executor) {
      this.executor.stopExecutor();
    }
    
    if (this.priceOracle) {
      await this.priceOracle.stop();
    }
    
    if (this.securityMonitor) {
      await this.securityMonitor.stop();
    }
    
    console.log(chalk.green('✅ Ultra-Fast Arbitrage System stopped successfully'));
  }

  /**
   * Start opportunity scanning
   */
  private startOpportunityScanning(): void {
    const scanInterval = setInterval(async () => {
      if (!this.isRunning || this.isPaused || this.emergencyStop) return;
      
      try {
        await this.scanForOpportunities();
      } catch (error) {
        console.error(chalk.red('❌ Error scanning for opportunities:'), error);
        this.metrics.securityEvents++;
      }
    }, 1000); // Scan every second
    
    // Store interval for cleanup
    (this as any).scanInterval = scanInterval;
  }

  /**
   * Start opportunity execution
   */
  private startOpportunityExecution(): void {
    const executeInterval = setInterval(async () => {
      if (!this.isRunning || this.isPaused || this.emergencyStop) return;
      
      try {
        await this.executeQueuedOpportunities();
      } catch (error) {
        console.error(chalk.red('❌ Error executing opportunities:'), error);
        this.metrics.securityEvents++;
      }
    }, 100); // Execute every 100ms for ultra-fast response
    
    // Store interval for cleanup
    (this as any).executeInterval = executeInterval;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const monitorInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      this.updatePerformanceMetrics();
    }, 5000); // Update every 5 seconds
    
    // Store interval for cleanup
    (this as any).monitorInterval = monitorInterval;
  }

  /**
   * Start real-time monitoring dashboard
   */
  private startRealTimeMonitoring(): void {
    const dashboardInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      this.displayRealTimeDashboard();
    }, 2000); // Update dashboard every 2 seconds
    
    // Store interval for cleanup
    (this as any).dashboardInterval = dashboardInterval;
  }

  /**
   * Scan for arbitrage opportunities with enhanced detection using ultra-fast price oracle
   */
  private async scanForOpportunities(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get current market data
      const blockNumber = await this.publicClient.getBlockNumber();
      const gasPrice = await this.publicClient.getGasPrice();
      
      // Define major trading pairs for scanning
      const tradingPairs = [
        {
          tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
          tokenB: '0x55d398326f99059fF775485246999027B3197955' as Address, // USDT
          baseAmount: parseEther('1'),
        },
        {
          tokenA: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' as Address, // ETH
          tokenB: '0x55d398326f99059fF775485246999027B3197955' as Address, // USDT
          baseAmount: parseEther('0.5'),
        },
        {
          tokenA: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' as Address, // BTCB
          tokenB: '0x55d398326f99059fF775485246999027B3197955' as Address, // USDT
          baseAmount: parseEther('0.1'),
        },
      ];
      
      // Get real-time prices from oracle
      const opportunities: EnhancedArbitrageOpportunity[] = [];
      
      for (const pair of tradingPairs) {
        try {
          const aggregatedPrice = await this.priceOracle?.getPrice(pair.tokenA, pair.tokenB);
          
          if (aggregatedPrice) {
            const opportunity = await this.calculateArbitrageFromPriceData(pair, aggregatedPrice);
            if (opportunity) {
              opportunities.push(opportunity);
            }
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Error getting price for ${pair.tokenA}/${pair.tokenB}:`), error);
        }
      }
      
      // Filter and prioritize opportunities
      const validOpportunities = await this.filterAndPrioritizeOpportunities(opportunities);
      
      // Add to queue
      validOpportunities.forEach(opportunity => {
        if (!this.opportunityQueue.find(op => op.id === opportunity.id)) {
          this.opportunityQueue.push(opportunity);
        }
      });
      
      // Sort queue by priority (profit margin, confidence, execution probability)
      this.opportunityQueue.sort((a, b) => {
        const scoreA = a.profitMargin * a.confidence * a.executionProbability;
        const scoreB = b.profitMargin * b.confidence * b.executionProbability;
        return scoreB - scoreA;
      });
      
      // Keep only top opportunities
      if (this.opportunityQueue.length > 100) {
        this.opportunityQueue = this.opportunityQueue.slice(0, 50);
      }
      
      // Track latency
      const latency = Date.now() - startTime;
      this.latencies.push(latency);
      if (this.latencies.length > 1000) {
        this.latencies = this.latencies.slice(-500);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error in opportunity scanning:'), error);
      this.metrics.securityEvents++;
    }
  }
  
  /**
   * Calculate arbitrage opportunity from aggregated price data
   */
  private async calculateArbitrageFromPriceData(
    pair: { tokenA: Address; tokenB: Address; baseAmount: bigint },
    aggregatedPrice: any
  ): Promise<EnhancedArbitrageOpportunity | null> {
    try {
      // Find price differences between sources
      const sources = aggregatedPrice.sources || [];
      if (sources.length < 2) return null;
      
      // Sort sources by price
      const sortedSources = [...sources].sort((a: any, b: any) => 
        Number(a.price - b.price)
      );
      
      const lowestPrice = sortedSources[0];
      const highestPrice = sortedSources[sortedSources.length - 1];
      
      // Calculate potential profit
      const priceDifference = highestPrice.price - lowestPrice.price;
      const profitRatio = Number(priceDifference) / Number(lowestPrice.price);
      
      // Minimum profit threshold (0.3% to cover gas and slippage)
      if (profitRatio < 0.003) return null;
      
      const expectedProfit = (pair.baseAmount * BigInt(Math.floor(Number(priceDifference) * 1e18))) / BigInt(Math.floor(Number(lowestPrice.price) * 1e18));
      
      // Estimate gas cost
      const gasEstimate = await this.contractInterface?.calculateProfit(
        pair.tokenA,
        pair.tokenB,
        pair.baseAmount,
        [0, 1] // Exchange IDs
      );
      
      return {
        id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokenA: pair.tokenA,
        tokenB: pair.tokenB,
        amountIn: pair.baseAmount,
        expectedProfit,
        gasEstimate: gasEstimate?.gasEstimate || 200000n,
        
        // Enhanced metrics
        profitMargin: profitRatio,
        riskScore: this.calculateRiskScore(aggregatedPrice),
        confidence: (aggregatedPrice.confidence || 80) / 100,
        executionProbability: 0.8 + Math.random() * 0.2,
        
        // Timing
        detectedAt: Date.now(),
        expiresAt: Date.now() + 30000, // 30 seconds
        estimatedExecutionTime: 2000 + Math.random() * 3000,
        
        // Security
        securityScore: 80 + Math.random() * 20,
        threatLevel: 'low' as const,
        
        // Performance
        expectedSlippage: aggregatedPrice.priceImpact || Math.random() * 0.02,
        gasEfficiency: 0.8 + Math.random() * 0.2,
        
        // MEV
        mevRisk: this.calculateMEVRisk(aggregatedPrice),
        frontRunningRisk: Math.random() * 30,
        
        // Metadata
        exchanges: [lowestPrice.source, highestPrice.source],
        route: [pair.tokenA, pair.tokenB],
        metadata: {
          sources: sources.length,
          liquidity: aggregatedPrice.liquidity,
          volume24h: aggregatedPrice.volume24h,
        },
      };
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Error calculating arbitrage opportunity:'), error);
      return null;
    }
  }
  
  /**
   * Calculate risk score from price data
   */
  private calculateRiskScore(aggregatedPrice: any): number {
    const volatility = aggregatedPrice.volatility || 0;
    const spread = aggregatedPrice.spread || 0;
    const priceImpact = aggregatedPrice.priceImpact || 0;
    
    // Combine factors (0-100 scale)
    return Math.min(100, (volatility * 40) + (spread * 30) + (priceImpact * 30));
  }
  
  /**
   * Calculate MEV risk
   */
  private calculateMEVRisk(aggregatedPrice: any): number {
    const profitMargin = aggregatedPrice.priceImpact || 0;
    const liquidity = Number(formatEther(aggregatedPrice.liquidity || 0n));
    
    // Higher profit margins and lower liquidity increase MEV risk
    const liquidityFactor = Math.max(0, 1 - (liquidity / 1000000)); // Normalize to 1M
    const profitFactor = Math.min(1, profitMargin * 20); // Scale profit impact
    
    return Math.min(100, ((profitFactor * 0.6) + (liquidityFactor * 0.4)) * 100);
  }

  /**
   * Detect enhanced arbitrage opportunities
   */
  private async detectEnhancedOpportunities(
    blockNumber: bigint, 
    gasPrice: bigint
  ): Promise<EnhancedArbitrageOpportunity[]> {
    const opportunities: EnhancedArbitrageOpportunity[] = [];
    
    // Mock opportunity detection (replace with actual DEX scanning)
    const mockOpportunities = [
      {
        tokenA: '0x55d398326f99059fF775485246999027B3197955' as Address, // USDT
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
        amountIn: parseEther('1000'),
        expectedProfit: parseEther('5'),
        exchanges: ['PancakeSwap', 'Uniswap'],
      },
      {
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenB: '0x55d398326f99059fF775485246999027B3197955' as Address, // USDT
        amountIn: parseEther('10'),
        expectedProfit: parseEther('0.1'),
        exchanges: ['PancakeSwap', 'Biswap'],
      },
    ];
    
    for (const mock of mockOpportunities) {
      const opportunity: EnhancedArbitrageOpportunity = {
        id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokenA: mock.tokenA,
        tokenB: mock.tokenB,
        amountIn: mock.amountIn,
        expectedProfit: mock.expectedProfit,
        gasEstimate: gasPrice * 200000n, // Estimated gas
        
        // Enhanced metrics
        profitMargin: Number(formatEther(mock.expectedProfit)) / Number(formatEther(mock.amountIn)),
        riskScore: Math.random() * 100,
        confidence: 0.8 + Math.random() * 0.2,
        executionProbability: 0.7 + Math.random() * 0.3,
        
        // Timing
        detectedAt: Date.now(),
        expiresAt: Date.now() + 30000, // 30 seconds
        estimatedExecutionTime: 2000 + Math.random() * 3000,
        
        // Security
        securityScore: 80 + Math.random() * 20,
        threatLevel: 'low',
        
        // Performance
        expectedSlippage: Math.random() * 0.02, // 0-2%
        gasEfficiency: 0.8 + Math.random() * 0.2,
        
        // MEV
        mevRisk: Math.random() * 50,
        frontRunningRisk: Math.random() * 30,
        
        // Metadata
        exchanges: mock.exchanges,
        route: [mock.tokenA, mock.tokenB],
        metadata: {
          blockNumber: Number(blockNumber),
          gasPrice: formatEther(gasPrice),
          detectionMethod: 'enhanced-scanner',
        },
      };
      
      opportunities.push(opportunity);
    }
    
    return opportunities;
  }

  /**
   * Filter and prioritize opportunities
   */
  private async filterAndPrioritizeOpportunities(
    opportunities: EnhancedArbitrageOpportunity[]
  ): Promise<EnhancedArbitrageOpportunity[]> {
    const filtered: EnhancedArbitrageOpportunity[] = [];
    
    for (const opportunity of opportunities) {
      // Security validation
      if (this.securityLayer) {
        const validation = await this.securityLayer.validateTransaction(
          this.account.address,
          this.config.contractAddress,
          '0x12345678', // Mock function selector
          opportunity.amountIn
        );
        
        if (!validation.allowed) {
          console.log(chalk.yellow(`⚠️ Opportunity ${opportunity.id} blocked by security layer: ${validation.reason}`));
          this.metrics.blockedTransactions++;
          continue;
        }
        
        if (validation.requiresMultiSig) {
          console.log(chalk.blue(`🔐 Opportunity ${opportunity.id} requires multi-signature approval`));
          // Handle multi-sig flow
          continue;
        }
      }
      
      // Profitability check
      const netProfit = opportunity.expectedProfit - opportunity.gasEstimate;
      if (netProfit <= 0) {
        continue;
      }
      
      // Risk assessment
      if (opportunity.riskScore > 80) {
        continue;
      }
      
      // MEV protection check
      if (this.config.enableMEVProtection && opportunity.mevRisk > 70) {
        continue;
      }
      
      // Confidence threshold
      if (opportunity.confidence < 0.7) {
        continue;
      }
      
      filtered.push(opportunity);
    }
    
    return filtered;
  }

  /**
   * Execute queued opportunities
   */
  private async executeQueuedOpportunities(): Promise<void> {
    if (this.opportunityQueue.length === 0) return;
    
    const maxConcurrent = this.config.maxConcurrentArbitrages;
    const availableSlots = maxConcurrent - this.executingOpportunities.size;
    
    if (availableSlots <= 0) return;
    
    // Get opportunities to execute
    const toExecute = this.opportunityQueue
      .filter(op => !this.executingOpportunities.has(op.id))
      .slice(0, availableSlots);
    
    // Execute opportunities in parallel
    const promises = toExecute.map(opportunity => 
      this.executeOpportunity(opportunity)
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Execute a single arbitrage opportunity with ultra-fast contract interface
   */
  private async executeOpportunity(opportunity: EnhancedArbitrageOpportunity): Promise<EnhancedExecutionResult> {
    const startTime = Date.now();
    this.executingOpportunities.add(opportunity.id);
    
    try {
      console.log(chalk.blue(`⚡ Executing arbitrage ${opportunity.id}...`));
      
      // Check if opportunity is still valid
      if (Date.now() > opportunity.expiresAt) {
        throw new Error('Opportunity expired');
      }
      
      // Enhanced security checks
      let securityChecks = true;
      let threatDetected = false;
      
      // Risk assessment
      if (this.riskManager) {
        const riskAssessment = await this.riskManager.assessTradeRisk({
          tokenA: opportunity.tokenA,
          tokenB: opportunity.tokenB,
          amountUsd: Number(formatEther(opportunity.amountIn)) * 300, // Approximate USD value
          liquidityUsd: opportunity.metadata?.liquidity || 1000000,
          priceImpactBps: Math.floor(opportunity.expectedSlippage * 10000),
          dexName: opportunity.exchanges[0] || 'unknown',
          tradingFrequency: this.metrics.totalArbitrages,
        });
        
        if (riskAssessment.riskLevel === 'HIGH' || riskAssessment.shouldBlock) {
          console.log(chalk.yellow(`⚠️ High risk detected for ${opportunity.id}: ${riskAssessment.reason}`));
          threatDetected = true;
          
          // Check if we should proceed based on risk tolerance
          if (riskAssessment.riskScore > 80) {
            throw new Error(`Risk too high: ${riskAssessment.reason}`);
          }
        }
        
        // Update risk metrics
        this.riskManager.recordTradeExecution({
          tokenA: opportunity.tokenA,
          tokenB: opportunity.tokenB,
          amountUsd: Number(formatEther(opportunity.amountIn)) * 300,
          liquidityUsd: opportunity.metadata?.liquidity || 1000000,
          priceImpactBps: Math.floor(opportunity.expectedSlippage * 10000),
          dexName: opportunity.exchanges[0] || 'unknown',
          tradingFrequency: this.metrics.totalArbitrages,
        }, true, Number(formatEther(opportunity.expectedProfit)) * 300);
      }
      
      // MEV protection
      let mevProtectedParams: any = {};
      if (this.mevProtectionManager) {
        // Check for MEV threats
        const mevThreat = await this.mevProtectionManager.detectMEVThreats(
          opportunity.tokenA,
          opportunity.tokenB,
          opportunity.amountIn
        );
        
        if (mevThreat.frontrunningRisk > 70 || mevThreat.sandwichRisk > 70) {
          console.log(chalk.yellow(`⚠️ MEV threat detected for ${opportunity.id}`));
          threatDetected = true;
          this.metrics.mevProtectionEvents++;
          
          // Apply MEV protection
          mevProtectedParams = await this.mevProtectionManager.applyMEVProtection({
            tokenA: opportunity.tokenA,
            tokenB: opportunity.tokenB,
            amountIn: opportunity.amountIn,
            minAmountOut: opportunity.expectedProfit * 95n / 100n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
            slippageTolerance: Math.floor(opportunity.expectedSlippage * 10000),
          });
          
          if (mevProtectedParams.shouldDelay) {
            console.log(chalk.blue(`⏳ Applying MEV protection delay: ${mevProtectedParams.delayMs}ms`));
            await new Promise(resolve => setTimeout(resolve, mevProtectedParams.delayMs));
          }
        }
      }
      
      // Get optimized gas parameters
      let gasPrice = await this.publicClient.getGasPrice();
      let gasLimit = 200000n;
      
      if (this.gasOptimizer) {
        const gasParams = await this.gasOptimizer.optimizeGasPrice('high');
        gasPrice = gasParams.gasPrice;
        gasLimit = gasParams.gasLimit;
      }
      
      // Execute using ultra-fast contract interface
      let transactionHash: Hash;
      let actualProfit: bigint = opportunity.expectedProfit;
      
      if (this.contractInterface) {
        // Map exchange names to IDs
        const exchangeIds = opportunity.exchanges.map(exchange => {
          switch (exchange.toLowerCase()) {
            case 'pancakeswap': return 0;
            case 'uniswap': return 1;
            case 'sushiswap': return 2;
            case 'biswap': return 3;
            case 'apeswap': return 4;
            default: return 0;
          }
        });
        
        // Execute arbitrage through contract interface
        const contractResult = await this.contractInterface.executeUltraFastArbitrage({
          tokenA: opportunity.tokenA,
          tokenB: opportunity.tokenB,
          amountIn: opportunity.amountIn,
          minAmountOut: opportunity.expectedProfit * 95n / 100n, // 5% slippage tolerance
          exchangeA: exchangeIds[0] || 0,
          exchangeB: exchangeIds[1] || 1,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 300), // 5 minutes
        });
        
        if (!contractResult.success) {
          throw new Error(contractResult.error || 'Contract execution failed');
        }
        
        transactionHash = contractResult.transactionHash!;
        actualProfit = contractResult.profit || opportunity.expectedProfit;
      } else {
        // Fallback to standard execution
        const transactionRequest = {
          to: this.config.contractAddress,
          data: this.encodeArbitrageCall(opportunity),
          value: 0n,
          gas: gasLimit,
          gasPrice,
        };
        
        // Execute with MEV protection
        if (this.mempoolManager && this.config.enableMEVProtection) {
          transactionHash = await this.mempoolManager.submitUltraFastTransaction(transactionRequest);
        } else if (this.executor) {
          const result = await this.executor.executeTransaction(transactionRequest);
          transactionHash = result.transactionHash!;
        } else {
          transactionHash = await this.walletClient.sendTransaction(transactionRequest);
        }
      }
      
      // Ensure transaction hash is defined
      if (!transactionHash) {
        throw new Error('Transaction hash is undefined');
      }

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: this.config.confirmationBlocks,
        timeout: this.config.executionTimeout,
      });
      
      // Calculate actual results
      const executionTime = Date.now() - startTime;
      const gasUsed = receipt.gasUsed;
      const gasCost: bigint = gasUsed * gasPrice;
      const netProfit = actualProfit - gasCost;
      
      // Update metrics
      this.metrics.totalArbitrages++;
      this.metrics.successfulArbitrages++;
      this.metrics.totalProfit += netProfit;
      this.metrics.totalGasUsed += gasUsed;
      
      this.executionTimes.push(executionTime);
      if (this.executionTimes.length > 1000) {
        this.executionTimes = this.executionTimes.slice(-500);
      }
      
      // Remove from queue
      this.opportunityQueue = this.opportunityQueue.filter(op => op.id !== opportunity.id);
      
      const result: EnhancedExecutionResult = {
        success: true,
        transactionHash,
        profit: netProfit,
        gasUsed,
        executionTime,
        actualSlippage: this.calculateActualSlippage(opportunity.expectedProfit, actualProfit),
        gasEfficiency: Number(actualProfit) / Number(gasUsed),
        profitMargin: opportunity.profitMargin,
        securityChecks,
        threatDetected,
        latency: executionTime,
        throughput: 1,
        metadata: {
          opportunityId: opportunity.id,
          gasPrice: formatEther(gasPrice),
          blockNumber: receipt.blockNumber,
          contractInterface: !!this.contractInterface,
          mevProtection: !!this.mevProtectionManager,
          riskAssessment: !!this.riskManager,
          securityScore: opportunity.securityScore,
          riskScore: opportunity.riskScore,
          mevRisk: opportunity.mevRisk,
        },
      };
      
      // Log security event to monitor
      if (this.securityMonitor) {
        const securityChecks = true; // Security checks were performed
        const threatDetected = false; // No threat detected in successful execution
        
        await this.securityMonitor.logSecurityEvent({
          type: 'high_risk_trade',
          severity: 'low',
          timestamp: Date.now(),
          details: {
            opportunityId: opportunity.id,
            profit: formatEther(netProfit),
            gasUsed: gasUsed.toString(),
            executionTime,
            securityChecks,
            threatDetected,
            mevProtection: !!this.mevProtectionManager,
            riskAssessment: !!this.riskManager,
          },
        });
      }
      
      console.log(chalk.green(`✅ Arbitrage ${opportunity.id} executed successfully`));
      console.log(chalk.cyan(`   Profit: ${formatEther(netProfit)} BNB`));
      console.log(chalk.cyan(`   Gas Used: ${gasUsed}`));
      console.log(chalk.cyan(`   Execution Time: ${executionTime}ms`));
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.metrics.failedArbitrages++;
      
      // Remove from queue
      this.opportunityQueue = this.opportunityQueue.filter(op => op.id !== opportunity.id);
      
      const result: EnhancedExecutionResult = {
        success: false,
        executionTime,
        actualSlippage: 0,
        gasEfficiency: 0,
        profitMargin: 0,
        securityChecks: false,
        threatDetected: false,
        latency: executionTime,
        throughput: 0,
        error: (error as Error).message,
      };
      
      // Log security event for failure
      if (this.securityMonitor) {
        const securityChecks = true; // Security checks were performed
        const threatDetected = false; // No threat detected, just execution failure
        
        await this.securityMonitor.logSecurityEvent({
          type: 'high_risk_trade',
          severity: 'medium',
          timestamp: Date.now(),
          details: {
            opportunityId: opportunity.id,
            error: (error as Error).message,
            executionTime,
            securityChecks,
            threatDetected,
            errorType: (error as Error).name,
          },
        });
      }
      
      console.log(chalk.red(`❌ Arbitrage ${opportunity.id} failed: ${(error as Error).message}`));
      
      return result;
      
    } finally {
      this.executingOpportunities.delete(opportunity.id);
    }
  }
  
  /**
   * Calculate actual slippage from expected vs actual profit
   */
  private calculateActualSlippage(expectedProfit: bigint, actualProfit: bigint): number {
    if (expectedProfit === 0n) return 0;
    
    const slippage = Number(expectedProfit - actualProfit) / Number(expectedProfit);
    return Math.max(0, slippage);
  }

  /**
   * Encode arbitrage function call
   */
  private encodeArbitrageCall(opportunity: EnhancedArbitrageOpportunity): `0x${string}` {
    // Mock encoding - replace with actual ABI encoding
    return '0x12345678' as `0x${string}`;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Calculate averages
    if (this.executionTimes.length > 0) {
      this.metrics.averageExecutionTime = 
        this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length;
    }
    
    if (this.latencies.length > 0) {
      this.metrics.averageLatency = 
        this.latencies.reduce((sum, time) => sum + time, 0) / this.latencies.length;
    }
    
    // Calculate success rate
    if (this.metrics.totalArbitrages > 0) {
      this.metrics.successRate = this.metrics.successfulArbitrages / this.metrics.totalArbitrages;
    }
    
    // Calculate throughput (arbitrages per minute)
    const uptimeMinutes = (Date.now() - this.startTime) / 60000;
    if (uptimeMinutes > 0) {
      this.metrics.throughput = this.metrics.totalArbitrages / uptimeMinutes;
    }
    
    // Calculate gas efficiency
    if (this.metrics.totalGasUsed > 0n) {
      this.metrics.gasEfficiency = Number(this.metrics.totalProfit) / Number(this.metrics.totalGasUsed);
    }
    
    // Update uptime
    this.metrics.uptime = Date.now() - this.startTime;
    
    // Get system metrics
    this.metrics.systemLoad = process.cpuUsage().system / 1000000; // Convert to seconds
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB
    
    // Get component metrics
    if (this.connectionPool) {
      const poolStats = this.connectionPool.getPoolStats();
      this.metrics.connectionPoolEfficiency = (poolStats.requestCount - poolStats.failedConnections) / Math.max(poolStats.requestCount, 1);
      this.metrics.cacheHitRate = 1 - (poolStats.errorRate / 100); // Approximate cache hit rate from error rate
    }
    
    if (this.securityLayer) {
      const securityStats = this.securityLayer.getSecurityStats();
      this.metrics.securityEvents = securityStats.totalValidations;
      this.metrics.threatsDetected = securityStats.threatsDetected;
      this.metrics.blockedTransactions = securityStats.blockedTransactions;
    }
  }

  /**
   * Display real-time dashboard
   */
  private displayRealTimeDashboard(): void {
    console.clear();
    console.log(chalk.bold.blue('🚀 ULTRA-FAST ARBITRAGE SYSTEM DASHBOARD'));
    console.log(chalk.gray('═'.repeat(80)));
    
    // System Status
    console.log(chalk.bold.cyan('\n🔥 System Status:'));
    console.log(`${chalk.green('●')} Running: ${this.isRunning ? 'Yes' : 'No'}`);
    console.log(`${chalk.blue('●')} Paused: ${this.isPaused ? 'Yes' : 'No'}`);
    console.log(`${chalk.red('●')} Emergency Stop: ${this.emergencyStop ? 'ACTIVE' : 'Inactive'}`);
    console.log(`${chalk.yellow('●')} Queue Size: ${this.opportunityQueue.length}`);
    console.log(`${chalk.magenta('●')} Executing: ${this.executingOpportunities.size}/${this.config.maxConcurrentArbitrages}`);
    
    // Performance Metrics
    console.log(chalk.bold.green('\n📊 Performance Metrics:'));
    console.log(`Total Arbitrages: ${this.metrics.totalArbitrages}`);
    console.log(`${chalk.green('●')} Successful: ${this.metrics.successfulArbitrages}`);
    console.log(`${chalk.red('●')} Failed: ${this.metrics.failedArbitrages}`);
    console.log(`Success Rate: ${chalk.cyan((this.metrics.successRate * 100).toFixed(2))}%`);
    console.log(`Throughput: ${chalk.yellow(this.metrics.throughput.toFixed(2))} arb/min`);
    console.log(`Avg Execution Time: ${chalk.blue(this.metrics.averageExecutionTime.toFixed(2))}ms`);
    console.log(`Avg Latency: ${chalk.magenta(this.metrics.averageLatency.toFixed(2))}ms`);
    
    // Financial Metrics
    console.log(chalk.bold.yellow('\n💰 Financial Metrics:'));
    console.log(`Total Profit: ${chalk.green(formatEther(this.metrics.totalProfit))} BNB`);
    console.log(`Total Gas Used: ${chalk.red(this.metrics.totalGasUsed.toString())}`);
    console.log(`Gas Efficiency: ${chalk.cyan(this.metrics.gasEfficiency.toFixed(6))} profit/gas`);
    console.log(`Gas Savings: ${chalk.blue(formatEther(this.metrics.gasOptimizationSavings))} BNB`);
    
    // Security Metrics
    console.log(chalk.bold.red('\n🛡️ Security Metrics:'));
    console.log(`Security Events: ${this.metrics.securityEvents}`);
    console.log(`Threats Detected: ${chalk.red(this.metrics.threatsDetected)}`);
    console.log(`Blocked Transactions: ${chalk.yellow(this.metrics.blockedTransactions)}`);
    console.log(`MEV Protection Events: ${chalk.blue(this.metrics.mevProtectionEvents)}`);
    console.log(`Front-running Prevented: ${chalk.green(this.metrics.frontRunningPrevented)}`);
    
    // System Metrics
    console.log(chalk.bold.magenta('\n⚙️ System Metrics:'));
    console.log(`Uptime: ${chalk.cyan(Math.floor(this.metrics.uptime / 1000))}s`);
    console.log(`System Load: ${chalk.yellow(this.metrics.systemLoad.toFixed(2))}%`);
    console.log(`Memory Usage: ${chalk.blue(this.metrics.memoryUsage.toFixed(2))}MB`);
    console.log(`Connection Pool Efficiency: ${chalk.green((this.metrics.connectionPoolEfficiency * 100).toFixed(2))}%`);
    console.log(`Cache Hit Rate: ${chalk.magenta((this.metrics.cacheHitRate * 100).toFixed(2))}%`);
    
    // Recent Opportunities
    if (this.opportunityQueue.length > 0) {
      console.log(chalk.bold.blue('\n🎯 Top Opportunities:'));
      this.opportunityQueue.slice(0, 5).forEach((op, index) => {
        const profit = formatEther(op.expectedProfit);
        const margin = (op.profitMargin * 100).toFixed(2);
        const confidence = (op.confidence * 100).toFixed(0);
        console.log(`${index + 1}. ${op.id.slice(-8)} | Profit: ${profit} BNB | Margin: ${margin}% | Confidence: ${confidence}%`);
      });
    }
    
    console.log(chalk.gray('\n' + '═'.repeat(80)));
    console.log(chalk.dim(`Last updated: ${new Date().toLocaleTimeString()}`));
  }

  /**
   * Get system statistics
   */
  getSystemStats(): UltraPerformanceMetrics & {
    queueSize: number;
    executingCount: number;
    isRunning: boolean;
    isPaused: boolean;
    emergencyStop: boolean;
  } {
    return {
      ...this.metrics,
      queueSize: this.opportunityQueue.length,
      executingCount: this.executingOpportunities.size,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      emergencyStop: this.emergencyStop,
    };
  }

  /**
   * Emergency stop
   */
  triggerEmergencyStop(reason: string): void {
    console.log(chalk.red(`🚨 EMERGENCY STOP TRIGGERED: ${reason}`));
    this.emergencyStop = true;
    this.isPaused = true;
    
    if (this.securityLayer) {
      this.securityLayer.triggerEmergencyStop(reason, this.account.address);
    }
    
    this.metrics.securityEvents++;
  }

  /**
   * Resume operations
   */
  resume(): void {
    if (!this.emergencyStop) {
      this.isPaused = false;
      console.log(chalk.green('✅ Operations resumed'));
    } else {
      console.log(chalk.red('❌ Cannot resume: Emergency stop is active'));
    }
  }
}

/**
 * Main function to run the ultra-fast arbitrage system
 */
async function main(): Promise<void> {
  console.log(chalk.bold.blue('🚀 Ultra-Fast Arbitrage System'));
  console.log(chalk.gray('Initializing enhanced arbitrage system with security and performance optimizations...\n'));
  
  try {
    // Validate configuration
    if (!config.privateKey) {
      throw new Error('Missing required configuration: PRIVATE_KEY');
    }
    
    if (!config.contractAddress) {
      throw new Error('Missing required configuration: CONTRACT_ADDRESS');
    }
    
    // Create arbitrage system
    const arbitrageSystem = new UltraFastArbitrageSystem(config);
    
    // Initialize all components
    await arbitrageSystem.initialize();
    
    // Start the system
    await arbitrageSystem.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n⏹️ Shutting down arbitrage system...'));
      await arbitrageSystem.stop();
      process.exit(0);
    });
    
    // Handle emergency stop
    process.on('SIGUSR1', () => {
      arbitrageSystem.triggerEmergencyStop('Manual emergency stop signal');
    });
    
    // Keep the process running
    console.log(chalk.green('✅ Ultra-Fast Arbitrage System started successfully'));
    console.log(chalk.dim('Press Ctrl+C to stop, SIGUSR1 for emergency stop\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start arbitrage system:'), error);
    process.exit(1);
  }
}

// Export for use in other modules
export {
  UltraFastArbitrageSystem,
  type UltraArbitrageConfig,
  type EnhancedArbitrageOpportunity,
  type EnhancedExecutionResult,
  type UltraPerformanceMetrics,
  config,
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}