import { 
  createPublicClient, 
  http, 
  webSocket,
  formatEther, 
  parseEther,
  formatGwei,
  parseGwei,
  Block,
  FeeHistory
} from 'viem';
import { bsc } from 'viem/chains';
import chalk from 'chalk';

// Configuration interfaces
export interface UltraGasConfig {
  network: {
    chainId: number;
    name: string;
  };
  rpc: {
    http: string[];
    websocket: string[];
  };
  optimization: {
    enabled: boolean;
    strategy: 'aggressive' | 'balanced' | 'conservative' | 'adaptive';
    targetConfirmationTime: number; // seconds
    maxGasPrice: bigint;
    minGasPrice: bigint;
    gasPriceBuffer: number; // percentage
  };
  prediction: {
    enabled: boolean;
    historyBlocks: number;
    updateInterval: number; // ms
    predictionWindow: number; // seconds
    confidenceThreshold: number; // 0-1
  };
  monitoring: {
    enabled: boolean;
    trackingWindow: number; // seconds
    alertThresholds: {
      highGasPrice: bigint;
      lowConfirmationRate: number;
      networkCongestion: number;
    };
  };
  performance: {
    maxConcurrentRequests: number;
    requestTimeout: number;
    cacheSize: number;
    cacheTTL: number; // ms
  };
}

// Gas data interfaces
export interface GasPrice {
  slow: bigint;
  standard: bigint;
  fast: bigint;
  instant: bigint;
  timestamp: number;
  confidence: number;
}

export interface GasPrediction {
  nextBlock: GasPrice;
  next5Blocks: GasPrice;
  next10Blocks: GasPrice;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  factors: string[];
}

export interface OptimizedGasParams {
  gasPrice: bigint;
  gasLimit: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  estimatedConfirmationTime: number;
  confidence: number;
  strategy: string;
}

export interface GasMetrics {
  currentGasPrice: bigint;
  averageGasPrice: bigint;
  medianGasPrice: bigint;
  gasPriceVolatility: number;
  networkCongestion: number;
  confirmationRate: number;
  totalOptimizations: number;
  successfulOptimizations: number;
  averageSavings: number; // percentage
  lastUpdate: number;
}

export interface NetworkConditions {
  congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
  averageBlockTime: number;
  pendingTransactions: number;
  gasUsageRate: number;
  priceVolatility: number;
}

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Ultra-fast gas optimizer class
export class UltraFastGasOptimizer {
  private config: UltraGasConfig;
  private publicClient: any;
  private wsClient: any;
  
  // Gas data storage
  private gasPriceHistory: GasPrice[] = [];
  private currentGasPrice: GasPrice | null = null;
  private gasPrediction: GasPrediction | null = null;
  private networkConditions: NetworkConditions | null = null;
  
  // Performance tracking
  private metrics: GasMetrics = {
    currentGasPrice: 0n,
    averageGasPrice: 0n,
    medianGasPrice: 0n,
    gasPriceVolatility: 0,
    networkCongestion: 0,
    confirmationRate: 0,
    totalOptimizations: 0,
    successfulOptimizations: 0,
    averageSavings: 0,
    lastUpdate: Date.now(),
  };
  
  // Cache for expensive operations
  private cache = new Map<string, CacheEntry<any>>();
  
  // Monitoring state
  private isMonitoring = false;
  private monitoringIntervals: NodeJS.Timeout[] = [];
  
  constructor(config: UltraGasConfig) {
    this.config = config;
    this.setupClients();
  }
  
  /**
   * Setup optimized Viem clients
   */
  private setupClients(): void {
    // Public client with load balancing
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http(this.config.rpc.http[0], {
        batch: true,
        timeout: this.config.performance.requestTimeout,
      }),
    });
    
    // WebSocket client for real-time monitoring
    if (this.config.rpc.websocket.length > 0) {
      this.wsClient = createPublicClient({
        chain: bsc,
        transport: webSocket(this.config.rpc.websocket[0], {
          timeout: this.config.performance.requestTimeout,
        }),
      });
    }
  }
  
  /**
   * Start gas optimization monitoring
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log(chalk.yellow('⚠️ Gas optimizer already running'));
      return;
    }
    
    console.log(chalk.blue('🚀 Starting ultra-fast gas optimizer...'));
    
    try {
      // Initialize with current gas prices
      await this.updateGasPrices();
      
      // Start monitoring intervals
      this.startGasPriceMonitoring();
      this.startPredictionUpdates();
      this.startNetworkMonitoring();
      this.startCacheCleanup();
      
      this.isMonitoring = true;
      console.log(chalk.green('✅ Gas optimizer started successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start gas optimizer:'), error);
      throw error;
    }
  }
  
  /**
   * Stop gas optimization monitoring
   */
  async stop(): Promise<void> {
    if (!this.isMonitoring) return;
    
    console.log(chalk.blue('🛑 Stopping gas optimizer...'));
    
    // Clear intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];
    
    this.isMonitoring = false;
    console.log(chalk.green('✅ Gas optimizer stopped'));
  }
  
  /**
   * Optimize gas parameters for a transaction
   */
  async optimizeGasPrice(
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    customGasLimit?: bigint
  ): Promise<OptimizedGasParams> {
    const startTime = Date.now();
    
    try {
      // Get current gas prices
      const gasPrice = await this.getCurrentGasPrice();
      if (!gasPrice) {
        throw new Error('Unable to get current gas price');
      }
      
      // Determine optimal gas price based on strategy and urgency
      const optimizedGasPrice = this.calculateOptimalGasPrice(gasPrice, urgency);
      
      // Estimate gas limit if not provided
      const gasLimit = customGasLimit || await this.estimateOptimalGasLimit();
      
      // Calculate EIP-1559 parameters if supported
      const eip1559Params = await this.calculateEIP1559Params(optimizedGasPrice);
      
      // Estimate confirmation time
      const estimatedConfirmationTime = this.estimateConfirmationTime(optimizedGasPrice);
      
      // Calculate confidence based on network conditions
      const confidence = this.calculateOptimizationConfidence(optimizedGasPrice);
      
      const result: OptimizedGasParams = {
        gasPrice: optimizedGasPrice,
        gasLimit,
        maxFeePerGas: eip1559Params.maxFeePerGas,
        maxPriorityFeePerGas: eip1559Params.maxPriorityFeePerGas,
        estimatedConfirmationTime,
        confidence,
        strategy: this.config.optimization.strategy,
      };
      
      // Update metrics
      this.metrics.totalOptimizations++;
      const optimizationTime = Date.now() - startTime;
      
      console.log(chalk.cyan(`⚡ Gas optimized in ${optimizationTime}ms`));
      console.log(chalk.white(`   Gas Price: ${formatGwei(optimizedGasPrice)} Gwei`));
      console.log(chalk.white(`   Est. Confirmation: ${estimatedConfirmationTime}s`));
      console.log(chalk.white(`   Confidence: ${(confidence * 100).toFixed(1)}%`));
      
      return result;
      
    } catch (error) {
      console.error(chalk.red('❌ Gas optimization failed:'), error);
      throw error;
    }
  }
  
  /**
   * Get current gas price with caching
   */
  async getCurrentGasPrice(): Promise<GasPrice | null> {
    const cacheKey = 'current_gas_price';
    const cached = this.getFromCache<GasPrice>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    try {
      const gasPrice = await this.fetchCurrentGasPrice();
      this.setCache(cacheKey, gasPrice, 5000); // Cache for 5 seconds
      return gasPrice;
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to get current gas price:'), error);
      return this.currentGasPrice;
    }
  }
  
  /**
   * Fetch current gas price from network
   */
  private async fetchCurrentGasPrice(): Promise<GasPrice> {
    try {
      // Get base gas price
      const baseGasPrice = await this.publicClient.getGasPrice();
      
      // Get fee history for better estimates
      const feeHistory = await this.publicClient.getFeeHistory({
        blockCount: 10,
        rewardPercentiles: [10, 25, 50, 75, 90],
      });
      
      // Calculate different speed tiers
      const gasPrice: GasPrice = {
        slow: this.calculateSlowGasPrice(baseGasPrice, feeHistory),
        standard: baseGasPrice,
        fast: this.calculateFastGasPrice(baseGasPrice, feeHistory),
        instant: this.calculateInstantGasPrice(baseGasPrice, feeHistory),
        timestamp: Date.now(),
        confidence: this.calculateGasPriceConfidence(feeHistory),
      };
      
      this.currentGasPrice = gasPrice;
      return gasPrice;
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Error fetching gas price:'), error);
      
      // Fallback to basic gas price
      const baseGasPrice = await this.publicClient.getGasPrice();
      return {
        slow: baseGasPrice * 80n / 100n,
        standard: baseGasPrice,
        fast: baseGasPrice * 120n / 100n,
        instant: baseGasPrice * 150n / 100n,
        timestamp: Date.now(),
        confidence: 0.5,
      };
    }
  }
  
  /**
   * Calculate optimal gas price based on strategy and urgency
   */
  private calculateOptimalGasPrice(gasPrice: GasPrice, urgency: string): bigint {
    let basePrice: bigint;
    
    // Select base price based on urgency
    switch (urgency) {
      case 'low':
        basePrice = gasPrice.slow;
        break;
      case 'medium':
        basePrice = gasPrice.standard;
        break;
      case 'high':
        basePrice = gasPrice.fast;
        break;
      case 'critical':
        basePrice = gasPrice.instant;
        break;
      default:
        basePrice = gasPrice.standard;
    }
    
    // Apply strategy adjustments
    switch (this.config.optimization.strategy) {
      case 'aggressive':
        basePrice = basePrice * 110n / 100n; // +10%
        break;
      case 'conservative':
        basePrice = basePrice * 90n / 100n; // -10%
        break;
      case 'adaptive':
        basePrice = this.applyAdaptiveStrategy(basePrice);
        break;
      // 'balanced' uses base price as-is
    }
    
    // Apply buffer
    const buffer = BigInt(this.config.optimization.gasPriceBuffer);
    basePrice = basePrice * (100n + buffer) / 100n;
    
    // Ensure within limits
    basePrice = this.clampGasPrice(basePrice);
    
    return basePrice;
  }
  
  /**
   * Apply adaptive strategy based on network conditions
   */
  private applyAdaptiveStrategy(basePrice: bigint): bigint {
    if (!this.networkConditions) return basePrice;
    
    const conditions = this.networkConditions;
    let multiplier = 100n; // 100% = no change
    
    // Adjust based on congestion
    switch (conditions.congestionLevel) {
      case 'low':
        multiplier = 90n; // -10%
        break;
      case 'medium':
        multiplier = 100n; // No change
        break;
      case 'high':
        multiplier = 110n; // +10%
        break;
      case 'extreme':
        multiplier = 125n; // +25%
        break;
    }
    
    // Adjust based on volatility
    if (conditions.priceVolatility > 0.2) {
      multiplier += 5n; // +5% for high volatility
    }
    
    return basePrice * multiplier / 100n;
  }
  
  /**
   * Calculate EIP-1559 parameters
   */
  private async calculateEIP1559Params(gasPrice: bigint): Promise<{
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    try {
      // Get latest block for base fee
      const latestBlock = await this.publicClient.getBlock({ blockTag: 'latest' });
      const baseFee = latestBlock.baseFeePerGas || 0n;
      
      // Calculate priority fee (tip)
      const maxPriorityFeePerGas = gasPrice / 10n; // 10% of gas price as tip
      
      // Calculate max fee (base fee + priority fee + buffer)
      const maxFeePerGas = baseFee + maxPriorityFeePerGas + (baseFee / 10n); // +10% buffer
      
      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
      };
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ EIP-1559 calculation failed:'), error);
      
      // Fallback to legacy gas price
      return {
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: gasPrice / 20n, // 5% as priority fee
      };
    }
  }
  
  /**
   * Estimate optimal gas limit
   */
  private async estimateOptimalGasLimit(): Promise<bigint> {
    // Default gas limit for arbitrage transactions
    // In production, this would be estimated based on transaction type
    return 300000n;
  }
  
  /**
   * Estimate confirmation time based on gas price
   */
  private estimateConfirmationTime(gasPrice: bigint): number {
    if (!this.currentGasPrice) return 30; // Default 30 seconds
    
    const current = this.currentGasPrice;
    
    // Estimate based on gas price tier
    if (gasPrice >= current.instant) return 5; // 5 seconds
    if (gasPrice >= current.fast) return 15; // 15 seconds
    if (gasPrice >= current.standard) return 30; // 30 seconds
    return 60; // 60 seconds for slow
  }
  
  /**
   * Calculate optimization confidence
   */
  private calculateOptimizationConfidence(gasPrice: bigint): number {
    let confidence = 0.8; // Base confidence
    
    // Adjust based on gas price confidence
    if (this.currentGasPrice) {
      confidence *= this.currentGasPrice.confidence;
    }
    
    // Adjust based on network conditions
    if (this.networkConditions) {
      const conditions = this.networkConditions;
      
      // Lower confidence for high volatility
      if (conditions.priceVolatility > 0.3) {
        confidence *= 0.8;
      }
      
      // Lower confidence for extreme congestion
      if (conditions.congestionLevel === 'extreme') {
        confidence *= 0.7;
      }
    }
    
    // Adjust based on prediction availability
    if (this.gasPrediction && this.gasPrediction.confidence > 0.7) {
      confidence *= 1.1; // Boost confidence with good predictions
    }
    
    return Math.min(1, Math.max(0, confidence));
  }
  
  /**
   * Clamp gas price within configured limits
   */
  private clampGasPrice(gasPrice: bigint): bigint {
    return gasPrice > this.config.optimization.maxGasPrice 
      ? this.config.optimization.maxGasPrice
      : gasPrice < this.config.optimization.minGasPrice
      ? this.config.optimization.minGasPrice
      : gasPrice;
  }
  
  /**
   * Start gas price monitoring
   */
  private startGasPriceMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        await this.updateGasPrices();
      } catch (error) {
        console.warn(chalk.yellow('⚠️ Gas price monitoring error:'), error);
      }
    }, 5000); // Update every 5 seconds
    
    this.monitoringIntervals.push(interval);
  }
  
  /**
   * Start prediction updates
   */
  private startPredictionUpdates(): void {
    if (!this.config.prediction.enabled) return;
    
    const interval = setInterval(async () => {
      try {
        await this.updateGasPredictions();
      } catch (error) {
        console.warn(chalk.yellow('⚠️ Prediction update error:'), error);
      }
    }, this.config.prediction.updateInterval);
    
    this.monitoringIntervals.push(interval);
  }
  
  /**
   * Start network monitoring
   */
  private startNetworkMonitoring(): void {
    if (!this.config.monitoring.enabled) return;
    
    const interval = setInterval(async () => {
      try {
        await this.updateNetworkConditions();
      } catch (error) {
        console.warn(chalk.yellow('⚠️ Network monitoring error:'), error);
      }
    }, 10000); // Update every 10 seconds
    
    this.monitoringIntervals.push(interval);
  }
  
  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    const interval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
    
    this.monitoringIntervals.push(interval);
  }
  
  /**
   * Update gas prices and history
   */
  private async updateGasPrices(): Promise<void> {
    try {
      const gasPrice = await this.fetchCurrentGasPrice();
      
      // Add to history
      this.gasPriceHistory.push(gasPrice);
      
      // Keep only recent history
      const maxHistory = this.config.prediction.historyBlocks;
      if (this.gasPriceHistory.length > maxHistory) {
        this.gasPriceHistory = this.gasPriceHistory.slice(-maxHistory);
      }
      
      // Update metrics
      this.updateGasMetrics();
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to update gas prices:'), error);
    }
  }
  
  /**
   * Update gas predictions
   */
  private async updateGasPredictions(): Promise<void> {
    if (this.gasPriceHistory.length < 10) return; // Need sufficient history
    
    try {
      this.gasPrediction = this.generateGasPrediction();
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to update predictions:'), error);
    }
  }
  
  /**
   * Generate gas price prediction
   */
  private generateGasPrediction(): GasPrediction {
    const recent = this.gasPriceHistory.slice(-10);
    const trend = this.calculateTrend(recent);
    
    // Simple prediction based on trend and moving average
    const avgGasPrice = this.calculateAverageGasPrice(recent);
    const trendMultiplier = trend === 'increasing' ? 1.05 : trend === 'decreasing' ? 0.95 : 1.0;
    
    const nextBlock: GasPrice = {
      slow: BigInt(Math.floor(Number(avgGasPrice.slow) * trendMultiplier * 0.9)),
      standard: BigInt(Math.floor(Number(avgGasPrice.standard) * trendMultiplier)),
      fast: BigInt(Math.floor(Number(avgGasPrice.fast) * trendMultiplier * 1.1)),
      instant: BigInt(Math.floor(Number(avgGasPrice.instant) * trendMultiplier * 1.2)),
      timestamp: Date.now() + 3000, // Next block (~3 seconds)
      confidence: 0.7,
    };
    
    return {
      nextBlock,
      next5Blocks: this.extrapolatePrediction(nextBlock, 5),
      next10Blocks: this.extrapolatePrediction(nextBlock, 10),
      trend,
      confidence: 0.7,
      factors: this.identifyPriceFactors(),
    };
  }
  
  /**
   * Update network conditions
   */
  private async updateNetworkConditions(): Promise<void> {
    try {
      const latestBlock = await this.publicClient.getBlock({ blockTag: 'latest' });
      const previousBlock = await this.publicClient.getBlock({ 
        blockNumber: latestBlock.number - 1n 
      });
      
      // Calculate metrics
      const blockTime = Number(latestBlock.timestamp - previousBlock.timestamp);
      const gasUsageRate = Number(latestBlock.gasUsed) / Number(latestBlock.gasLimit);
      const volatility = this.calculatePriceVolatility();
      
      // Determine congestion level
      let congestionLevel: NetworkConditions['congestionLevel'] = 'low';
      if (gasUsageRate > 0.9) congestionLevel = 'extreme';
      else if (gasUsageRate > 0.7) congestionLevel = 'high';
      else if (gasUsageRate > 0.5) congestionLevel = 'medium';
      
      this.networkConditions = {
        congestionLevel,
        averageBlockTime: blockTime,
        pendingTransactions: 0, // Would need mempool access
        gasUsageRate,
        priceVolatility: volatility,
      };
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Failed to update network conditions:'), error);
    }
  }
  
  /**
   * Utility functions
   */
  private calculateSlowGasPrice(basePrice: bigint, feeHistory: FeeHistory): bigint {
    // Use 10th percentile from fee history
    const rewards = feeHistory.reward?.[0];
    if (rewards && rewards[0]) {
      return rewards[0];
    }
    return basePrice * 80n / 100n;
  }
  
  private calculateFastGasPrice(basePrice: bigint, feeHistory: FeeHistory): bigint {
    // Use 75th percentile from fee history
    const rewards = feeHistory.reward?.[0];
    if (rewards && rewards[3]) {
      return rewards[3];
    }
    return basePrice * 120n / 100n;
  }
  
  private calculateInstantGasPrice(basePrice: bigint, feeHistory: FeeHistory): bigint {
    // Use 90th percentile from fee history
    const rewards = feeHistory.reward?.[0];
    if (rewards && rewards[4]) {
      return rewards[4];
    }
    return basePrice * 150n / 100n;
  }
  
  private calculateGasPriceConfidence(feeHistory: FeeHistory): number {
    // Higher confidence with more consistent fee history
    if (!feeHistory.reward || feeHistory.reward.length < 5) return 0.5;
    
    // Calculate variance in rewards
    const allRewards = feeHistory.reward.flat().filter(r => r !== null);
    if (allRewards.length === 0) return 0.5;
    
    const avg = allRewards.reduce((sum, r) => sum + Number(r), 0) / allRewards.length;
    const variance = allRewards.reduce((sum, r) => sum + Math.pow(Number(r) - avg, 2), 0) / allRewards.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    const confidence = Math.max(0.3, Math.min(1, 1 - (stdDev / avg)));
    return confidence;
  }
  
  private calculateTrend(history: GasPrice[]): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 3) return 'stable';
    
    const recent = history.slice(-3);
    const prices = recent.map(h => Number(h.standard));
    
    const trend = (prices[2] - prices[0]) / prices[0];
    
    if (trend > 0.05) return 'increasing';
    if (trend < -0.05) return 'decreasing';
    return 'stable';
  }
  
  private calculateAverageGasPrice(history: GasPrice[]): GasPrice {
    const count = BigInt(history.length);
    
    return {
      slow: history.reduce((sum, h) => sum + h.slow, 0n) / count,
      standard: history.reduce((sum, h) => sum + h.standard, 0n) / count,
      fast: history.reduce((sum, h) => sum + h.fast, 0n) / count,
      instant: history.reduce((sum, h) => sum + h.instant, 0n) / count,
      timestamp: Date.now(),
      confidence: history.reduce((sum, h) => sum + h.confidence, 0) / history.length,
    };
  }
  
  private extrapolatePrediction(basePrice: GasPrice, blocks: number): GasPrice {
    const factor = 1 + (blocks * 0.01); // 1% change per block
    
    return {
      slow: BigInt(Math.floor(Number(basePrice.slow) * factor)),
      standard: BigInt(Math.floor(Number(basePrice.standard) * factor)),
      fast: BigInt(Math.floor(Number(basePrice.fast) * factor)),
      instant: BigInt(Math.floor(Number(basePrice.instant) * factor)),
      timestamp: basePrice.timestamp + (blocks * 3000), // 3 seconds per block
      confidence: Math.max(0.3, basePrice.confidence - (blocks * 0.05)),
    };
  }
  
  private identifyPriceFactors(): string[] {
    const factors: string[] = [];
    
    if (this.networkConditions) {
      const conditions = this.networkConditions;
      
      if (conditions.congestionLevel === 'high' || conditions.congestionLevel === 'extreme') {
        factors.push('High network congestion');
      }
      
      if (conditions.priceVolatility > 0.2) {
        factors.push('High price volatility');
      }
      
      if (conditions.gasUsageRate > 0.8) {
        factors.push('High gas usage');
      }
    }
    
    if (factors.length === 0) {
      factors.push('Normal market conditions');
    }
    
    return factors;
  }
  
  private calculatePriceVolatility(): number {
    if (this.gasPriceHistory.length < 10) return 0;
    
    const recent = this.gasPriceHistory.slice(-10);
    const prices = recent.map(h => Number(h.standard));
    
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / avg; // Coefficient of variation
  }
  
  private updateGasMetrics(): void {
    if (!this.currentGasPrice) return;
    
    this.metrics.currentGasPrice = this.currentGasPrice.standard;
    this.metrics.lastUpdate = Date.now();
    
    if (this.gasPriceHistory.length > 0) {
      const prices = this.gasPriceHistory.map(h => h.standard);
      
      // Calculate average
      this.metrics.averageGasPrice = prices.reduce((sum, p) => sum + p, 0n) / BigInt(prices.length);
      
      // Calculate median
      const sortedPrices = [...prices].sort((a, b) => Number(a - b));
      const mid = Math.floor(sortedPrices.length / 2);
      this.metrics.medianGasPrice = sortedPrices.length % 2 === 0
        ? (sortedPrices[mid - 1] + sortedPrices[mid]) / 2n
        : sortedPrices[mid];
      
      // Calculate volatility
      this.metrics.gasPriceVolatility = this.calculatePriceVolatility();
    }
    
    // Update network congestion
    if (this.networkConditions) {
      this.metrics.networkCongestion = this.networkConditions.gasUsageRate * 100;
    }
  }
  
  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
    
    // Limit cache size
    if (this.cache.size > this.config.performance.cacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toDelete = entries.slice(0, this.cache.size - this.config.performance.cacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
  
  /**
   * Stop optimization (alias for stop method)
   */
  async stopOptimization(): Promise<void> {
    return this.stop();
  }

  /**
   * Public API methods
   */
  getMetrics(): GasMetrics {
    return { ...this.metrics };
  }
  
  getNetworkConditions(): NetworkConditions | null {
    return this.networkConditions ? { ...this.networkConditions } : null;
  }
  
  getGasPrediction(): GasPrediction | null {
    return this.gasPrediction ? { ...this.gasPrediction } : null;
  }
  
  /**
   * Display real-time dashboard
   */
  displayDashboard(): void {
    console.clear();
    console.log(chalk.bold.blue('⚡ ULTRA-FAST GAS OPTIMIZER DASHBOARD ⚡'));
    console.log(chalk.gray('='.repeat(60)));
    
    // Current gas prices
    if (this.currentGasPrice) {
      console.log(chalk.bold.cyan('\n💰 CURRENT GAS PRICES:'));
      console.log(chalk.white(`   Slow: ${formatGwei(this.currentGasPrice.slow)} Gwei`));
      console.log(chalk.yellow(`   Standard: ${formatGwei(this.currentGasPrice.standard)} Gwei`));
      console.log(chalk.green(`   Fast: ${formatGwei(this.currentGasPrice.fast)} Gwei`));
      console.log(chalk.red(`   Instant: ${formatGwei(this.currentGasPrice.instant)} Gwei`));
      console.log(chalk.gray(`   Confidence: ${(this.currentGasPrice.confidence * 100).toFixed(1)}%`));
    }
    
    // Network conditions
    if (this.networkConditions) {
      console.log(chalk.bold.cyan('\n🌐 NETWORK CONDITIONS:'));
      console.log(chalk.white(`   Congestion: ${this.networkConditions.congestionLevel.toUpperCase()}`));
      console.log(chalk.white(`   Gas Usage: ${(this.networkConditions.gasUsageRate * 100).toFixed(1)}%`));
      console.log(chalk.white(`   Block Time: ${this.networkConditions.averageBlockTime}s`));
      console.log(chalk.white(`   Volatility: ${(this.networkConditions.priceVolatility * 100).toFixed(1)}%`));
    }
    
    // Predictions
    if (this.gasPrediction) {
      console.log(chalk.bold.cyan('\n🔮 PREDICTIONS:'));
      console.log(chalk.white(`   Trend: ${this.gasPrediction.trend.toUpperCase()}`));
      console.log(chalk.white(`   Next Block: ${formatGwei(this.gasPrediction.nextBlock.standard)} Gwei`));
      console.log(chalk.white(`   Confidence: ${(this.gasPrediction.confidence * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Factors: ${this.gasPrediction.factors.join(', ')}`));
    }
    
    // Metrics
    console.log(chalk.bold.cyan('\n📊 METRICS:'));
    console.log(chalk.white(`   Total Optimizations: ${this.metrics.totalOptimizations.toLocaleString()}`));
    console.log(chalk.green(`   Successful: ${this.metrics.successfulOptimizations.toLocaleString()}`));
    console.log(chalk.white(`   Average Savings: ${this.metrics.averageSavings.toFixed(1)}%`));
    console.log(chalk.white(`   Cache Size: ${this.cache.size}`));
    
    console.log(chalk.gray('\n' + '='.repeat(60)));
    console.log(chalk.gray(`Last Update: ${new Date(this.metrics.lastUpdate).toLocaleTimeString()}`));
  }
}

// Default configuration
export const defaultGasConfig: UltraGasConfig = {
  network: {
    chainId: 56,
    name: 'BSC Mainnet',
  },
  rpc: {
    http: [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
    ],
    websocket: [
      'wss://bsc-ws-node.nariox.org:443',
    ],
  },
  optimization: {
    enabled: true,
    strategy: 'adaptive',
    targetConfirmationTime: 15, // 15 seconds
    maxGasPrice: parseGwei('20'), // 20 Gwei max
    minGasPrice: parseGwei('3'), // 3 Gwei min
    gasPriceBuffer: 5, // 5% buffer
  },
  prediction: {
    enabled: true,
    historyBlocks: 100,
    updateInterval: 10000, // 10 seconds
    predictionWindow: 300, // 5 minutes
    confidenceThreshold: 0.7,
  },
  monitoring: {
    enabled: true,
    trackingWindow: 3600, // 1 hour
    alertThresholds: {
      highGasPrice: parseGwei('50'), // 50 Gwei
      lowConfirmationRate: 0.8, // 80%
      networkCongestion: 0.9, // 90%
    },
  },
  performance: {
    maxConcurrentRequests: 20,
    requestTimeout: 5000,
    cacheSize: 1000,
    cacheTTL: 30000, // 30 seconds
  },
};

// Demo function
async function main() {
  const gasOptimizer = new UltraFastGasOptimizer(defaultGasConfig);
  
  try {
    await gasOptimizer.start();
    
    // Display dashboard every 5 seconds
    const dashboardInterval = setInterval(() => {
      gasOptimizer.displayDashboard();
    }, 5000);
    
    // Demo optimization
    setTimeout(async () => {
      console.log(chalk.blue('\n🧪 Testing gas optimization...'));
      
      const optimized = await gasOptimizer.optimizeGasPrice('high');
      console.log(chalk.green('✅ Optimization result:'), optimized);
    }, 10000);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down gas optimizer...'));
      clearInterval(dashboardInterval);
      await gasOptimizer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start gas optimizer:'), error);
    process.exit(1);
  }
}

// Export everything
export default UltraFastGasOptimizer;

// Run demo if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}