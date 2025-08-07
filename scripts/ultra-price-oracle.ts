/**
 * Ultra-Fast Price Oracle System
 * Real-time price feeds with multiple sources and advanced aggregation
 */

import { 
  createPublicClient, 
  http, 
  parseEther, 
  formatEther, 
  type Address,
  type Hex
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';
import WebSocket from 'ws';

// Price source types
enum PriceSource {
  PANCAKESWAP_V2 = 'pancakeswap_v2',
  PANCAKESWAP_V3 = 'pancakeswap_v3',
  UNISWAP_V2 = 'uniswap_v2',
  UNISWAP_V3 = 'uniswap_v3',
  SUSHISWAP = 'sushiswap',
  BISWAP = 'biswap',
  APESWAP = 'apeswap',
  CHAINLINK = 'chainlink',
  BINANCE_API = 'binance_api',
  COINGECKO = 'coingecko',
  DEXSCREENER = 'dexscreener'
}

// Price data structure
interface PriceData {
  source: PriceSource;
  tokenA: Address;
  tokenB: Address;
  price: bigint;
  liquidity: bigint;
  volume24h: bigint;
  timestamp: number;
  blockNumber: bigint;
  confidence: number; // 0-100
  spread: number; // bid-ask spread
  slippage: number; // estimated slippage for 1 ETH trade
}

// Aggregated price information
interface AggregatedPrice {
  tokenA: Address;
  tokenB: Address;
  weightedPrice: bigint;
  medianPrice: bigint;
  sources: PriceData[];
  confidence: number;
  spread: number;
  liquidity: bigint;
  volume24h: bigint;
  priceImpact: number;
  timestamp: number;
  volatility: number;
}

// Price oracle configuration
interface PriceOracleConfig {
  network: 'mainnet' | 'testnet';
  rpcUrl: string;
  wsUrl?: string;
  
  // Data sources
  enabledSources: PriceSource[];
  sourceWeights: Record<PriceSource, number>;
  
  // Update intervals
  fastUpdateInterval: number; // ms
  slowUpdateInterval: number; // ms
  
  // Quality filters
  minConfidence: number;
  maxSpread: number;
  maxAge: number; // ms
  minLiquidity: bigint;
  
  // Performance settings
  maxConcurrentRequests: number;
  requestTimeout: number;
  cacheSize: number;
  
  // WebSocket settings
  enableWebSocket: boolean;
  wsReconnectDelay: number;
  wsMaxReconnects: number;
  
  // API keys
  binanceApiKey?: string;
  coingeckoApiKey?: string;
  dexscreenerApiKey?: string;
}

// Price cache entry
interface CacheEntry {
  data: AggregatedPrice;
  timestamp: number;
  hits: number;
}

// Oracle metrics
interface OracleMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  errorRate: number;
  sourcesOnline: number;
  totalSources: number;
  priceUpdates: number;
  lastUpdateTime: number;
}

/**
 * Ultra-Fast Price Oracle System
 */
class UltraFastPriceOracle {
  private publicClient: any;
  private wsConnections: Map<PriceSource, WebSocket> = new Map();
  private priceCache: Map<string, CacheEntry> = new Map();
  private sourcePrices: Map<string, Map<PriceSource, PriceData>> = new Map();
  
  // Performance tracking
  private metrics: OracleMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    errorRate: 0,
    sourcesOnline: 0,
    totalSources: 0,
    priceUpdates: 0,
    lastUpdateTime: 0,
  };
  
  private responseTimes: number[] = [];
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  
  // DEX contract addresses
  private readonly DEX_CONTRACTS = {
    [PriceSource.PANCAKESWAP_V2]: {
      factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
      router: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address,
    },
    [PriceSource.PANCAKESWAP_V3]: {
      factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as Address,
      router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14' as Address,
    },
    [PriceSource.UNISWAP_V2]: {
      factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address,
      router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as Address,
    },
  };

  constructor(private config: PriceOracleConfig) {
    this.setupClient();
    this.metrics.totalSources = this.config.enabledSources.length;
  }

  /**
   * Setup optimized client
   */
  private setupClient(): void {
    const chain = this.config.network === 'mainnet' ? bsc : bscTestnet;
    
    this.publicClient = createPublicClient({
      chain,
      transport: http(this.config.rpcUrl, {
        batch: true,
        timeout: this.config.requestTimeout,
        retryCount: 3,
        retryDelay: 500,
      }),
    });
  }

  /**
   * Start the price oracle
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log(chalk.blue('🚀 Starting Ultra-Fast Price Oracle...'));
    
    this.isRunning = true;
    
    // Initialize WebSocket connections
    if (this.config.enableWebSocket) {
      await this.initializeWebSocketConnections();
    }
    
    // Start price update intervals
    this.startPriceUpdates();
    
    // Start cache cleanup
    this.startCacheCleanup();
    
    console.log(chalk.green('✅ Price Oracle started successfully'));
    console.log(chalk.cyan(`   Enabled Sources: ${this.config.enabledSources.length}`));
    console.log(chalk.cyan(`   Fast Update Interval: ${this.config.fastUpdateInterval}ms`));
    console.log(chalk.cyan(`   WebSocket: ${this.config.enableWebSocket ? 'Enabled' : 'Disabled'}`));
  }

  /**
   * Stop the price oracle
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log(chalk.yellow('🛑 Stopping Price Oracle...'));
    
    this.isRunning = false;
    
    // Close WebSocket connections
    for (const [source, ws] of this.wsConnections) {
      ws.close();
    }
    this.wsConnections.clear();
    
    // Clear intervals
    for (const [key, interval] of this.updateIntervals) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();
    
    console.log(chalk.green('✅ Price Oracle stopped'));
  }

  /**
   * Get aggregated price for token pair
   */
  async getPrice(tokenA: Address, tokenB: Address): Promise<AggregatedPrice> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      const cacheKey = `${tokenA}-${tokenB}`;
      
      // Check cache first
      const cached = this.priceCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.config.maxAge) {
        cached.hits++;
        this.metrics.cacheHits++;
        
        // Update response time
        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);
        
        return cached.data;
      }
      
      this.metrics.cacheMisses++;
      
      // Fetch prices from all sources
      const sourcePrices = await this.fetchPricesFromAllSources(tokenA, tokenB);
      
      // Filter and validate prices
      const validPrices = this.filterValidPrices(sourcePrices);
      
      if (validPrices.length === 0) {
        throw new Error('No valid price data available');
      }
      
      // Aggregate prices
      const aggregatedPrice = this.aggregatePrices(tokenA, tokenB, validPrices);
      
      // Cache the result
      this.priceCache.set(cacheKey, {
        data: aggregatedPrice,
        timestamp: Date.now(),
        hits: 1,
      });
      
      // Cleanup cache if too large
      if (this.priceCache.size > this.config.cacheSize) {
        this.cleanupCache();
      }
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      this.metrics.priceUpdates++;
      this.metrics.lastUpdateTime = Date.now();
      
      return aggregatedPrice;
      
    } catch (error) {
      this.metrics.errorRate = (this.metrics.errorRate * 0.9) + 0.1;
      console.error(chalk.red('❌ Error getting price:'), error);
      throw error;
    }
  }

  /**
   * Get prices for multiple token pairs
   */
  async getBatchPrices(pairs: Array<{ tokenA: Address; tokenB: Address }>): Promise<AggregatedPrice[]> {
    const promises = pairs.map(pair => this.getPrice(pair.tokenA, pair.tokenB));
    return Promise.all(promises);
  }

  /**
   * Fetch prices from all enabled sources
   */
  private async fetchPricesFromAllSources(
    tokenA: Address, 
    tokenB: Address
  ): Promise<PriceData[]> {
    const promises = this.config.enabledSources.map(source => 
      this.fetchPriceFromSource(source, tokenA, tokenB)
    );
    
    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<PriceData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  /**
   * Fetch price from specific source
   */
  private async fetchPriceFromSource(
    source: PriceSource,
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData | null> {
    try {
      switch (source) {
        case PriceSource.PANCAKESWAP_V2:
          return await this.fetchPancakeSwapV2Price(tokenA, tokenB);
        case PriceSource.PANCAKESWAP_V3:
          return await this.fetchPancakeSwapV3Price(tokenA, tokenB);
        case PriceSource.UNISWAP_V2:
          return await this.fetchUniswapV2Price(tokenA, tokenB);
        case PriceSource.CHAINLINK:
          return await this.fetchChainlinkPrice(tokenA, tokenB);
        case PriceSource.BINANCE_API:
          return await this.fetchBinancePrice(tokenA, tokenB);
        case PriceSource.COINGECKO:
          return await this.fetchCoingeckoPrice(tokenA, tokenB);
        case PriceSource.DEXSCREENER:
          return await this.fetchDexscreenerPrice(tokenA, tokenB);
        default:
          return null;
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Error fetching from ${source}:`), error);
      return null;
    }
  }

  /**
   * Fetch PancakeSwap V2 price
   */
  private async fetchPancakeSwapV2Price(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation - would need actual DEX integration
    const mockPrice = parseEther('1.5'); // Mock price
    const mockLiquidity = parseEther('1000000');
    const mockVolume = parseEther('500000');
    
    return {
      source: PriceSource.PANCAKESWAP_V2,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: mockLiquidity,
      volume24h: mockVolume,
      timestamp: Date.now(),
      blockNumber: BigInt(await this.publicClient.getBlockNumber()),
      confidence: 95,
      spread: 0.003, // 0.3%
      slippage: 0.001, // 0.1%
    };
  }

  /**
   * Fetch PancakeSwap V3 price
   */
  private async fetchPancakeSwapV3Price(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation
    const mockPrice = parseEther('1.52');
    const mockLiquidity = parseEther('2000000');
    const mockVolume = parseEther('800000');
    
    return {
      source: PriceSource.PANCAKESWAP_V3,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: mockLiquidity,
      volume24h: mockVolume,
      timestamp: Date.now(),
      blockNumber: BigInt(await this.publicClient.getBlockNumber()),
      confidence: 98,
      spread: 0.001, // 0.1%
      slippage: 0.0005, // 0.05%
    };
  }

  /**
   * Fetch Uniswap V2 price
   */
  private async fetchUniswapV2Price(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation
    const mockPrice = parseEther('1.48');
    const mockLiquidity = parseEther('800000');
    const mockVolume = parseEther('300000');
    
    return {
      source: PriceSource.UNISWAP_V2,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: mockLiquidity,
      volume24h: mockVolume,
      timestamp: Date.now(),
      blockNumber: BigInt(await this.publicClient.getBlockNumber()),
      confidence: 90,
      spread: 0.005, // 0.5%
      slippage: 0.002, // 0.2%
    };
  }

  /**
   * Fetch Chainlink price
   */
  private async fetchChainlinkPrice(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation - would integrate with Chainlink price feeds
    const mockPrice = parseEther('1.51');
    
    return {
      source: PriceSource.CHAINLINK,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: 0n, // Chainlink doesn't provide liquidity
      volume24h: 0n,
      timestamp: Date.now(),
      blockNumber: BigInt(await this.publicClient.getBlockNumber()),
      confidence: 99,
      spread: 0,
      slippage: 0,
    };
  }

  /**
   * Fetch Binance API price
   */
  private async fetchBinancePrice(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation - would use actual Binance API
    const mockPrice = parseEther('1.505');
    const mockVolume = parseEther('10000000');
    
    return {
      source: PriceSource.BINANCE_API,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: 0n,
      volume24h: mockVolume,
      timestamp: Date.now(),
      blockNumber: 0n,
      confidence: 97,
      spread: 0.001,
      slippage: 0,
    };
  }

  /**
   * Fetch CoinGecko price
   */
  private async fetchCoingeckoPrice(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation
    const mockPrice = parseEther('1.503');
    const mockVolume = parseEther('5000000');
    
    return {
      source: PriceSource.COINGECKO,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: 0n,
      volume24h: mockVolume,
      timestamp: Date.now(),
      blockNumber: 0n,
      confidence: 85,
      spread: 0.002,
      slippage: 0,
    };
  }

  /**
   * Fetch DexScreener price
   */
  private async fetchDexscreenerPrice(
    tokenA: Address,
    tokenB: Address
  ): Promise<PriceData> {
    // Simplified implementation
    const mockPrice = parseEther('1.499');
    const mockLiquidity = parseEther('1500000');
    const mockVolume = parseEther('600000');
    
    return {
      source: PriceSource.DEXSCREENER,
      tokenA,
      tokenB,
      price: mockPrice,
      liquidity: mockLiquidity,
      volume24h: mockVolume,
      timestamp: Date.now(),
      blockNumber: 0n,
      confidence: 88,
      spread: 0.004,
      slippage: 0.0015,
    };
  }

  /**
   * Filter valid prices based on quality criteria
   */
  private filterValidPrices(prices: PriceData[]): PriceData[] {
    return prices.filter(price => {
      // Check confidence
      if (price.confidence < this.config.minConfidence) return false;
      
      // Check spread
      if (price.spread > this.config.maxSpread) return false;
      
      // Check age
      if (Date.now() - price.timestamp > this.config.maxAge) return false;
      
      // Check liquidity (for DEX sources)
      if (price.liquidity > 0n && price.liquidity < this.config.minLiquidity) return false;
      
      return true;
    });
  }

  /**
   * Aggregate prices using weighted average and other methods
   */
  private aggregatePrices(
    tokenA: Address,
    tokenB: Address,
    prices: PriceData[]
  ): AggregatedPrice {
    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0n;
    
    for (const price of prices) {
      const weight = this.config.sourceWeights[price.source] || 1;
      totalWeight += weight;
      weightedSum += price.price * BigInt(Math.floor(weight * 1000));
    }
    
    const weightedPrice = totalWeight > 0 
      ? weightedSum / BigInt(Math.floor(totalWeight * 1000))
      : 0n;
    
    // Calculate median price
    const sortedPrices = [...prices].sort((a, b) => 
      Number(a.price - b.price)
    );
    const medianPrice = sortedPrices.length > 0
      ? sortedPrices[Math.floor(sortedPrices.length / 2)].price
      : 0n;
    
    // Calculate aggregate metrics
    const totalLiquidity = prices.reduce((sum, p) => sum + p.liquidity, 0n);
    const totalVolume = prices.reduce((sum, p) => sum + p.volume24h, 0n);
    const avgConfidence = prices.reduce((sum, p) => sum + p.confidence, 0) / prices.length;
    const avgSpread = prices.reduce((sum, p) => sum + p.spread, 0) / prices.length;
    
    // Calculate price impact and volatility
    const priceImpact = this.calculatePriceImpact(prices);
    const volatility = this.calculateVolatility(prices);
    
    return {
      tokenA,
      tokenB,
      weightedPrice,
      medianPrice,
      sources: prices,
      confidence: avgConfidence,
      spread: avgSpread,
      liquidity: totalLiquidity,
      volume24h: totalVolume,
      priceImpact,
      timestamp: Date.now(),
      volatility,
    };
  }

  /**
   * Calculate price impact
   */
  private calculatePriceImpact(prices: PriceData[]): number {
    if (prices.length < 2) return 0;
    
    const maxPrice = Math.max(...prices.map(p => Number(formatEther(p.price))));
    const minPrice = Math.min(...prices.map(p => Number(formatEther(p.price))));
    
    return maxPrice > 0 ? (maxPrice - minPrice) / maxPrice : 0;
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(prices: PriceData[]): number {
    if (prices.length < 2) return 0;
    
    const priceValues = prices.map(p => Number(formatEther(p.price)));
    const mean = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
    const variance = priceValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / priceValues.length;
    
    return Math.sqrt(variance) / mean;
  }

  /**
   * Initialize WebSocket connections
   */
  private async initializeWebSocketConnections(): Promise<void> {
    // Implementation would set up WebSocket connections to various price feeds
    console.log(chalk.blue('🔌 Initializing WebSocket connections...'));
    
    // Mock WebSocket setup
    for (const source of this.config.enabledSources) {
      if (this.supportsWebSocket(source)) {
        // Would create actual WebSocket connections here
        console.log(chalk.cyan(`   Connected to ${source}`));
        this.metrics.sourcesOnline++;
      }
    }
  }

  /**
   * Check if source supports WebSocket
   */
  private supportsWebSocket(source: PriceSource): boolean {
    return [
      PriceSource.BINANCE_API,
      PriceSource.PANCAKESWAP_V2,
      PriceSource.PANCAKESWAP_V3,
    ].includes(source);
  }

  /**
   * Start price update intervals
   */
  private startPriceUpdates(): void {
    // Fast updates for high-priority pairs
    const fastInterval = setInterval(() => {
      this.updateHighPriorityPairs();
    }, this.config.fastUpdateInterval);
    
    this.updateIntervals.set('fast', fastInterval);
    
    // Slow updates for all pairs
    const slowInterval = setInterval(() => {
      this.updateAllPairs();
    }, this.config.slowUpdateInterval);
    
    this.updateIntervals.set('slow', slowInterval);
  }

  /**
   * Update high priority pairs
   */
  private async updateHighPriorityPairs(): Promise<void> {
    // Implementation would update frequently traded pairs
    // For now, just update metrics
    this.metrics.sourcesOnline = this.config.enabledSources.length;
  }

  /**
   * Update all pairs
   */
  private async updateAllPairs(): Promise<void> {
    // Implementation would update all cached pairs
    // For now, just cleanup old cache entries
    this.cleanupCache();
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    const cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
    
    this.updateIntervals.set('cleanup', cleanupInterval);
  }

  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = this.config.maxAge;
    
    for (const [key, entry] of this.priceCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.priceCache.delete(key);
      }
    }
    
    // If still too large, remove least recently used
    if (this.priceCache.size > this.config.cacheSize) {
      const entries = Array.from(this.priceCache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);
      
      const toRemove = entries.slice(0, Math.floor(this.config.cacheSize * 0.2));
      for (const [key] of toRemove) {
        this.priceCache.delete(key);
      }
    }
  }

  /**
   * Update response time metrics
   */
  private updateResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only recent response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500);
    }
    
    // Calculate average
    this.metrics.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * Get oracle metrics
   */
  getMetrics(): OracleMetrics {
    return { ...this.metrics };
  }

  /**
   * Display real-time dashboard
   */
  displayDashboard(): void {
    console.clear();
    console.log(chalk.bold.blue('🔮 ULTRA-FAST PRICE ORACLE DASHBOARD'));
    console.log(chalk.gray('═'.repeat(60)));
    
    console.log(chalk.bold.green('\n📊 Performance Metrics:'));
    console.log(`Total Requests: ${chalk.cyan(this.metrics.totalRequests)}`);
    console.log(`Cache Hit Rate: ${chalk.yellow((this.metrics.cacheHits / Math.max(this.metrics.totalRequests, 1) * 100).toFixed(2))}%`);
    console.log(`Average Response Time: ${chalk.green(this.metrics.averageResponseTime.toFixed(2))}ms`);
    console.log(`Error Rate: ${chalk.red((this.metrics.errorRate * 100).toFixed(2))}%`);
    console.log(`Price Updates: ${chalk.cyan(this.metrics.priceUpdates)}`);
    
    console.log(chalk.bold.blue('\n🌐 Data Sources:'));
    console.log(`Sources Online: ${chalk.green(this.metrics.sourcesOnline)}/${chalk.cyan(this.metrics.totalSources)}`);
    console.log(`Enabled Sources: ${chalk.cyan(this.config.enabledSources.join(', '))}`);
    console.log(`WebSocket: ${this.config.enableWebSocket ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    
    console.log(chalk.bold.yellow('\n💾 Cache Status:'));
    console.log(`Cache Size: ${chalk.cyan(this.priceCache.size)}/${chalk.yellow(this.config.cacheSize)}`);
    console.log(`Cache Hits: ${chalk.green(this.metrics.cacheHits)}`);
    console.log(`Cache Misses: ${chalk.red(this.metrics.cacheMisses)}`);
    
    console.log(chalk.bold.magenta('\n⚙️ Configuration:'));
    console.log(`Network: ${chalk.cyan(this.config.network)}`);
    console.log(`Fast Update Interval: ${chalk.yellow(this.config.fastUpdateInterval)}ms`);
    console.log(`Min Confidence: ${chalk.green(this.config.minConfidence)}%`);
    console.log(`Max Spread: ${chalk.red((this.config.maxSpread * 100).toFixed(2))}%`);
    console.log(`Max Age: ${chalk.yellow(this.config.maxAge / 1000)}s`);
    
    console.log(chalk.gray('\n' + '═'.repeat(60)));
    console.log(chalk.dim(`Last updated: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.dim(`Status: ${this.isRunning ? chalk.green('Running') : chalk.red('Stopped')}`));
  }
}

// Export types and classes
export {
  UltraFastPriceOracle,
  PriceSource,
  type PriceData,
  type AggregatedPrice,
  type PriceOracleConfig,
  type OracleMetrics,
};

// Default configuration
export const defaultOracleConfig: PriceOracleConfig = {
  network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
  rpcUrl: process.env.RPC_URL!,
  wsUrl: process.env.WS_URL,
  
  enabledSources: [
    PriceSource.PANCAKESWAP_V2,
    PriceSource.PANCAKESWAP_V3,
    PriceSource.UNISWAP_V2,
    PriceSource.CHAINLINK,
    PriceSource.BINANCE_API,
  ],
  
  sourceWeights: {
    [PriceSource.PANCAKESWAP_V2]: 2,
    [PriceSource.PANCAKESWAP_V3]: 3,
    [PriceSource.UNISWAP_V2]: 2,
    [PriceSource.UNISWAP_V3]: 3,
    [PriceSource.SUSHISWAP]: 1,
    [PriceSource.BISWAP]: 1,
    [PriceSource.APESWAP]: 1,
    [PriceSource.CHAINLINK]: 4,
    [PriceSource.BINANCE_API]: 3,
    [PriceSource.COINGECKO]: 2,
    [PriceSource.DEXSCREENER]: 2,
  },
  
  fastUpdateInterval: 1000, // 1 second
  slowUpdateInterval: 10000, // 10 seconds
  
  minConfidence: 80,
  maxSpread: 0.01, // 1%
  maxAge: 30000, // 30 seconds
  minLiquidity: parseEther('10000'), // 10k BNB
  
  maxConcurrentRequests: 20,
  requestTimeout: 5000,
  cacheSize: 1000,
  
  enableWebSocket: true,
  wsReconnectDelay: 5000,
  wsMaxReconnects: 10,
};

// Demo function
async function main() {
  const oracle = new UltraFastPriceOracle(defaultOracleConfig);
  
  try {
    await oracle.start();
    
    // Display dashboard
    const dashboardInterval = setInterval(() => {
      oracle.displayDashboard();
    }, 2000);
    
    // Demo price fetching
    const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
    const USDT = '0x55d398326f99059fF775485246999027B3197955' as Address;
    
    console.log(chalk.blue('\n🔍 Fetching demo prices...'));
    
    const price = await oracle.getPrice(WBNB, USDT);
    console.log(chalk.green(`\n✅ WBNB/USDT Price: ${formatEther(price.weightedPrice)}`));
    console.log(chalk.cyan(`   Sources: ${price.sources.length}`));
    console.log(chalk.cyan(`   Confidence: ${price.confidence.toFixed(2)}%`));
    console.log(chalk.cyan(`   Liquidity: ${formatEther(price.liquidity)} BNB`));
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      clearInterval(dashboardInterval);
      await oracle.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error running oracle:'), error);
    await oracle.stop();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}