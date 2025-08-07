/**
 * Ultra-Fast Smart Contract Interface
 * Optimized for maximum performance and minimal gas usage
 */

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  formatEther, 
  parseUnits,
  formatUnits,
  encodeFunctionData,
  decodeFunctionResult,
  type Hash,
  type Address,
  type Hex,
  type TransactionReceipt
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';

// Ultra-optimized ABI for gas efficiency - Updated for new security model
const ULTRA_ARBITRAGE_ABI = [
  // Core arbitrage function with ArbitrageParams struct
  {
    name: 'executeUltraFastArbitrage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { 
        name: 'params', 
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'minAmountOut', type: 'uint256' },
          { name: 'routerA', type: 'address' },
          { name: 'routerB', type: 'address' },
          { name: 'deadline', type: 'uint32' },
          { name: 'nonce', type: 'uint32' }
        ]
      },
      { name: 'pathA', type: 'address[]' },
      { name: 'pathB', type: 'address[]' }
    ],
    outputs: []
  },
  
  // Get current nonce for caller - CRITICAL for security
  {
    name: 'getCurrentNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'caller', type: 'address' }
    ],
    outputs: [
      { name: 'nonce', type: 'uint256' }
    ]
  },
  
  // Check if router is whitelisted
  {
    name: 'isRouterWhitelisted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'router', type: 'address' }
    ],
    outputs: [
      { name: 'isWhitelisted', type: 'bool' }
    ]
  },
  
  // Router management functions
  {
    name: 'updateRouter',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_router', type: 'address' },
      { name: '_isWhitelisted', type: 'bool' }
    ],
    outputs: []
  },
  
  // Batch arbitrage for multiple opportunities
  {
    name: 'executeBatchArbitrage',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'trades', type: 'tuple[]', components: [
        { name: 'tokenA', type: 'address' },
        { name: 'tokenB', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'minAmountOut', type: 'uint256' },
        { name: 'exchanges', type: 'uint8[]' },
        { name: 'data', type: 'bytes' }
      ]}
    ],
    outputs: [
      { name: 'totalProfit', type: 'uint256' },
      { name: 'successCount', type: 'uint256' }
    ]
  },
  
  // Flash loan arbitrage
  {
    name: 'executeFlashArbitrage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'params', type: 'bytes' }
    ],
    outputs: [
      { name: 'profit', type: 'uint256' }
    ]
  },
  
  // Gas-optimized profit calculation
  {
    name: 'calculateProfitUltraFast',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'exchanges', type: 'uint8[]' }
    ],
    outputs: [
      { name: 'expectedProfit', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
      { name: 'confidence', type: 'uint256' }
    ]
  },
  
  // Batch profit calculation
  {
    name: 'batchCalculateProfit',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'trades', type: 'tuple[]', components: [
        { name: 'tokenA', type: 'address' },
        { name: 'tokenB', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'exchanges', type: 'uint8[]' }
      ]}
    ],
    outputs: [
      { name: 'profits', type: 'uint256[]' },
      { name: 'gasEstimates', type: 'uint256[]' },
      { name: 'confidences', type: 'uint256[]' }
    ]
  },
  
  // MEV protection functions
  {
    name: 'executeWithMEVProtection',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' }
    ],
    outputs: [
      { name: 'profit', type: 'uint256' }
    ]
  },
  
  // Emergency functions
  {
    name: 'emergencyStop',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  
  {
    name: 'emergencyWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  
  // Statistics and monitoring
  {
    name: 'getUltraFastStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalTrades', type: 'uint256' },
      { name: 'totalProfit', type: 'uint256' },
      { name: 'totalGasUsed', type: 'uint256' },
      { name: 'averageExecutionTime', type: 'uint256' },
      { name: 'successRate', type: 'uint256' }
    ]
  },
  
  // Configuration functions
  {
    name: 'updateGasOptimization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'enabled', type: 'bool' },
      { name: 'gasLimit', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' }
    ],
    outputs: []
  },
  
  // Events for monitoring - Updated for new contract
  {
    name: 'ArbitrageExecuted',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
      { name: 'profit', type: 'uint256' },
      { name: 'gasUsed', type: 'uint256' },
      { name: 'executor', type: 'address', indexed: true }
    ]
  },
  
  {
    name: 'RouterUpdated',
    type: 'event',
    inputs: [
      { name: 'router', type: 'address', indexed: true },
      { name: 'isWhitelisted', type: 'bool' }
    ]
  },
  
  {
    name: 'BatchArbitrageExecuted',
    type: 'event',
    inputs: [
      { name: 'trader', type: 'address', indexed: true },
      { name: 'batchSize', type: 'uint256' },
      { name: 'totalProfit', type: 'uint256' },
      { name: 'successCount', type: 'uint256' },
      { name: 'gasUsed', type: 'uint256' }
    ]
  },
  
  {
    name: 'MEVProtectionTriggered',
    type: 'event',
    inputs: [
      { name: 'trader', type: 'address', indexed: true },
      { name: 'threatType', type: 'string' },
      { name: 'blockNumber', type: 'uint256' }
    ]
  }
] as const;

// Exchange identifiers for gas optimization
enum ExchangeId {
  PANCAKESWAP_V2 = 0,
  PANCAKESWAP_V3 = 1,
  UNISWAP_V2 = 2,
  UNISWAP_V3 = 3,
  SUSHISWAP = 4,
  BISWAP = 5,
  APESWAP = 6,
  BABYSWAP = 7,
  MDEX = 8,
  BAKERYSWAP = 9
}

// Trade parameters for batch operations
interface TradeParams {
  tokenA: Address;
  tokenB: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  exchanges: number[];
  data: Hex;
}

// Batch trade parameters
interface BatchTradeParams {
  tokenA: Address;
  tokenB: Address;
  amountIn: bigint;
  exchanges: number[];
}

// Execution result
interface ExecutionResult {
  success: boolean;
  transactionHash?: Hash;
  profit?: bigint;
  gasUsed?: bigint;
  executionTime?: number;
  error?: string;
}

// Batch execution result
interface BatchExecutionResult {
  success: boolean;
  transactionHash?: Hash;
  totalProfit?: bigint;
  successCount?: bigint;
  gasUsed?: bigint;
  executionTime?: number;
  error?: string;
}

// Profit calculation result
interface ProfitCalculationResult {
  expectedProfit: bigint;
  gasEstimate: bigint;
  confidence: bigint;
}

// Contract statistics
interface ContractStats {
  totalTrades: bigint;
  totalProfit: bigint;
  totalGasUsed: bigint;
  averageExecutionTime: bigint;
  successRate: bigint;
}

// Configuration for the contract interface
interface ContractConfig {
  network: 'mainnet' | 'testnet';
  contractAddress: Address;
  privateKey: string;
  rpcUrl: string;
  wsUrl?: string;
  
  // Gas optimization
  enableGasOptimization: boolean;
  gasLimit: bigint;
  gasPrice: bigint;
  
  // MEV protection
  enableMEVProtection: boolean;
  mevProtectionDelay: number;
  
  // Batch settings
  maxBatchSize: number;
  batchTimeout: number;
  
  // Performance settings
  maxRetries: number;
  retryDelay: number;
  confirmationBlocks: number;
}

/**
 * Ultra-Fast Smart Contract Interface
 * Optimized for maximum performance and minimal gas usage
 */
class UltraFastContractInterface {
  private publicClient: any;
  private walletClient: any;
  private account: any;
  
  // Performance tracking
  private executionTimes: number[] = [];
  private gasUsages: bigint[] = [];
  private profits: bigint[] = [];
  
  // Batch queue
  private batchQueue: TradeParams[] = [];
  private batchTimer?: NodeJS.Timeout;
  
  constructor(private config: ContractConfig) {
    this.setupClients();
  }

  /**
   * Setup optimized clients
   */
  private setupClients(): void {
    this.account = privateKeyToAccount(this.config.privateKey as `0x${string}`);
    const chain = this.config.network === 'mainnet' ? bsc : bscTestnet;
    
    // Optimized public client
    this.publicClient = createPublicClient({
      chain,
      transport: http(this.config.rpcUrl, {
        batch: true,
        fetchOptions: {
          timeout: 10000,
        },
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
    
    // Optimized wallet client
    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(this.config.rpcUrl, {
        batch: true,
        fetchOptions: {
          timeout: 10000,
        },
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
  }

  /**
   * Execute ultra-fast arbitrage with new security model
   */
  async executeUltraFastArbitrage(
    tokenIn: Address,
    tokenOut: Address,
    amount: bigint,
    minAmountOut: bigint,
    routerA: Address,
    routerB: Address,
    pathA: Address[],
    pathB: Address[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue(`⚡ Executing ultra-fast arbitrage with new security model...`));
      console.log(chalk.cyan(`   Token In: ${tokenIn}`));
      console.log(chalk.cyan(`   Token Out: ${tokenOut}`));
      console.log(chalk.cyan(`   Amount: ${formatEther(amount)} BNB`));
      console.log(chalk.cyan(`   Min Amount Out: ${formatEther(minAmountOut)} BNB`));
      console.log(chalk.cyan(`   Router A: ${routerA}`));
      console.log(chalk.cyan(`   Router B: ${routerB}`));
      
      // CRITICAL: Get current nonce for proper replay protection
      const currentNonce = await this.getCurrentNonce(this.account.address);
      console.log(chalk.yellow(`   Current Nonce: ${currentNonce}`));
      
      // Verify routers are whitelisted
      const [routerAWhitelisted, routerBWhitelisted] = await Promise.all([
        this.isRouterWhitelisted(routerA),
        this.isRouterWhitelisted(routerB)
      ]);
      
      if (!routerAWhitelisted || !routerBWhitelisted) {
        throw new Error(`Router not whitelisted: A=${routerAWhitelisted}, B=${routerBWhitelisted}`);
      }
      
      // Build ArbitrageParams struct
      const params = {
        tokenIn,
        tokenOut,
        amount,
        minAmountOut,
        routerA,
        routerB,
        deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        nonce: currentNonce
      };
      
      // Encode function call with new structure
      const calldata = encodeFunctionData({
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'executeUltraFastArbitrage',
        args: [params, pathA, pathB]
      });
      
      // Get optimized gas parameters
      const gasPrice = this.config.enableGasOptimization 
        ? this.config.gasPrice 
        : await this.publicClient.getGasPrice();
      
      const gasLimit = this.config.enableGasOptimization
        ? this.config.gasLimit
        : await this.estimateGas(calldata);
      
      // Execute transaction with MEV protection
      let transactionHash: Hash;
      
      if (this.config.enableMEVProtection) {
        // Add delay to prevent front-running
        await new Promise(resolve => setTimeout(resolve, this.config.mevProtectionDelay));
      }
      
      // Direct execution with new contract
      transactionHash = await this.walletClient.sendTransaction({
        to: this.config.contractAddress,
        data: calldata,
        gas: gasLimit,
        gasPrice,
      });
      
      console.log(chalk.yellow(`   Transaction Hash: ${transactionHash}`));
      
      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: this.config.confirmationBlocks,
        timeout: 30000,
      });
      
      // Decode result
      const result = await this.decodeExecutionResult(receipt);
      const executionTime = Date.now() - startTime;
      
      // Update performance tracking
      this.executionTimes.push(executionTime);
      if (result.profit) this.profits.push(result.profit);
      if (result.gasUsed) this.gasUsages.push(result.gasUsed);
      
      // Keep only recent data
      if (this.executionTimes.length > 1000) {
        this.executionTimes = this.executionTimes.slice(-500);
        this.profits = this.profits.slice(-500);
        this.gasUsages = this.gasUsages.slice(-500);
      }
      
      console.log(chalk.green(`✅ Arbitrage executed successfully`));
      console.log(chalk.cyan(`   Profit: ${result.profit ? formatEther(result.profit) : '0'} BNB`));
      console.log(chalk.cyan(`   Gas Used: ${result.gasUsed || 0n}`));
      console.log(chalk.cyan(`   Execution Time: ${executionTime}ms`));
      console.log(chalk.cyan(`   Next Nonce: ${currentNonce + 1}`));
      
      return {
        success: true,
        transactionHash,
        profit: result.profit,
        gasUsed: result.gasUsed,
        executionTime,
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.log(chalk.red(`❌ Arbitrage execution failed: ${(error as Error).message}`));
      
      return {
        success: false,
        executionTime,
        error: (error as Error).message,
      };
    }
  }
  
  /**
   * Get current nonce for caller - CRITICAL for security
   */
  async getCurrentNonce(caller: Address): Promise<number> {
    try {
      const nonce = await this.publicClient.readContract({
        address: this.config.contractAddress,
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'getCurrentNonce',
        args: [caller]
      });
      return Number(nonce);
    } catch (error) {
      console.error(chalk.red('❌ Error getting current nonce:'), error);
      throw error;
    }
  }
  
  /**
   * Check if router is whitelisted
   */
  async isRouterWhitelisted(router: Address): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.config.contractAddress,
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'isRouterWhitelisted',
        args: [router]
      });
    } catch (error) {
      console.error(chalk.red('❌ Error checking router whitelist:'), error);
      return false;
    }
  }

  /**
   * Execute batch arbitrage for multiple opportunities
   */
  async executeBatchArbitrage(trades: TradeParams[]): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue(`⚡ Executing batch arbitrage with ${trades.length} trades...`));
      
      // Validate batch size
      if (trades.length > this.config.maxBatchSize) {
        throw new Error(`Batch size ${trades.length} exceeds maximum ${this.config.maxBatchSize}`);
      }
      
      // Encode function call
      const calldata = encodeFunctionData({
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'executeBatchArbitrage',
        args: [trades]
      });
      
      // Get optimized gas parameters
      const gasPrice = this.config.enableGasOptimization 
        ? this.config.gasPrice 
        : await this.publicClient.getGasPrice();
      
      const gasLimit = this.config.enableGasOptimization
        ? this.config.gasLimit * BigInt(trades.length)
        : await this.estimateGas(calldata);
      
      // Execute transaction
      const transactionHash = await this.walletClient.sendTransaction({
        to: this.config.contractAddress,
        data: calldata,
        gas: gasLimit,
        gasPrice,
      });
      
      console.log(chalk.yellow(`   Transaction Hash: ${transactionHash}`));
      
      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: this.config.confirmationBlocks,
        timeout: 60000, // Longer timeout for batch
      });
      
      // Decode result
      const result = await this.decodeBatchExecutionResult(receipt);
      const executionTime = Date.now() - startTime;
      
      console.log(chalk.green(`✅ Batch arbitrage executed successfully`));
      console.log(chalk.cyan(`   Total Profit: ${result.totalProfit ? formatEther(result.totalProfit) : '0'} BNB`));
      console.log(chalk.cyan(`   Success Count: ${result.successCount || 0n}/${trades.length}`));
      console.log(chalk.cyan(`   Gas Used: ${result.gasUsed || 0n}`));
      console.log(chalk.cyan(`   Execution Time: ${executionTime}ms`));
      
      return {
        success: true,
        transactionHash,
        totalProfit: result.totalProfit,
        successCount: result.successCount,
        gasUsed: result.gasUsed,
        executionTime,
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.log(chalk.red(`❌ Batch arbitrage execution failed: ${(error as Error).message}`));
      
      return {
        success: false,
        executionTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Add trade to batch queue
   */
  addToBatchQueue(trade: TradeParams): void {
    this.batchQueue.push(trade);
    
    // Auto-execute when batch is full
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      this.executeBatchQueue();
    } else {
      // Set timer for batch execution
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      this.batchTimer = setTimeout(() => {
        this.executeBatchQueue();
      }, this.config.batchTimeout);
    }
  }

  /**
   * Execute queued batch trades
   */
  private async executeBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const trades = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    await this.executeBatchArbitrage(trades);
  }

  /**
   * Calculate profit for a single trade
   */
  async calculateProfit(
    tokenA: Address,
    tokenB: Address,
    amountIn: bigint,
    exchanges: ExchangeId[]
  ): Promise<ProfitCalculationResult> {
    try {
      const result = await this.publicClient.readContract({
        address: this.config.contractAddress,
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'calculateProfitUltraFast',
        args: [tokenA, tokenB, amountIn, exchanges]
      });
      
      return {
        expectedProfit: result[0],
        gasEstimate: result[1],
        confidence: result[2],
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Error calculating profit:'), error);
      throw error;
    }
  }

  /**
   * Calculate profits for multiple trades
   */
  async batchCalculateProfit(trades: BatchTradeParams[]): Promise<ProfitCalculationResult[]> {
    try {
      const result = await this.publicClient.readContract({
        address: this.config.contractAddress,
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'batchCalculateProfit',
        args: [trades]
      });
      
      const profits = result[0] as bigint[];
      const gasEstimates = result[1] as bigint[];
      const confidences = result[2] as bigint[];
      
      return profits.map((profit, index) => ({
        expectedProfit: profit,
        gasEstimate: gasEstimates[index],
        confidence: confidences[index],
      }));
      
    } catch (error) {
      console.error(chalk.red('❌ Error calculating batch profits:'), error);
      throw error;
    }
  }

  /**
   * Execute with MEV protection
   */
  private async executeWithMEVProtection(
    tokenA: Address,
    tokenB: Address,
    amountIn: bigint,
    minAmountOut: bigint,
    exchanges: ExchangeId[],
    data: Hex
  ): Promise<Hash> {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes
    const nonce = BigInt(Date.now());
    
    // Create signature for commit-reveal scheme
    const signature = await this.createMEVProtectionSignature(
      tokenA, tokenB, amountIn, minAmountOut, deadline, nonce
    );
    
    // Execute with MEV protection
    return await this.walletClient.sendTransaction({
      to: this.config.contractAddress,
      data: encodeFunctionData({
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'executeWithMEVProtection',
        args: [tokenA, tokenB, amountIn, minAmountOut, deadline, nonce, signature]
      }),
      gas: this.config.gasLimit,
      gasPrice: this.config.gasPrice,
    });
  }

  /**
   * Create MEV protection signature
   */
  private async createMEVProtectionSignature(
    tokenA: Address,
    tokenB: Address,
    amountIn: bigint,
    minAmountOut: bigint,
    deadline: bigint,
    nonce: bigint
  ): Promise<Hex> {
    // Simplified signature creation - implement proper EIP-712 signing
    const message = `${tokenA}${tokenB}${amountIn}${minAmountOut}${deadline}${nonce}`;
    return `0x${'0'.repeat(130)}` as Hex; // Mock signature
  }

  /**
   * Estimate gas for transaction
   */
  private async estimateGas(data: Hex): Promise<bigint> {
    try {
      return await this.publicClient.estimateGas({
        account: this.account,
        to: this.config.contractAddress,
        data,
      });
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Gas estimation failed, using default'));
      return this.config.gasLimit;
    }
  }

  /**
   * Decode execution result from transaction receipt
   */
  private async decodeExecutionResult(receipt: TransactionReceipt): Promise<{
    profit?: bigint;
    gasUsed?: bigint;
  }> {
    // Look for ArbitrageExecuted event
    const event = receipt.logs.find(log => {
      try {
        const decoded = this.publicClient.decodeEventLog({
          abi: ULTRA_ARBITRAGE_ABI,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'ArbitrageExecuted';
      } catch {
        return false;
      }
    });
    
    if (event) {
      const decoded = this.publicClient.decodeEventLog({
        abi: ULTRA_ARBITRAGE_ABI,
        data: event.data,
        topics: event.topics,
      });
      
      return {
        profit: decoded.args.profit as bigint,
        gasUsed: decoded.args.gasUsed as bigint,
      };
    }
    
    return {
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Decode batch execution result from transaction receipt
   */
  private async decodeBatchExecutionResult(receipt: TransactionReceipt): Promise<{
    totalProfit?: bigint;
    successCount?: bigint;
    gasUsed?: bigint;
  }> {
    // Look for BatchArbitrageExecuted event
    const event = receipt.logs.find(log => {
      try {
        const decoded = this.publicClient.decodeEventLog({
          abi: ULTRA_ARBITRAGE_ABI,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'BatchArbitrageExecuted';
      } catch {
        return false;
      }
    });
    
    if (event) {
      const decoded = this.publicClient.decodeEventLog({
        abi: ULTRA_ARBITRAGE_ABI,
        data: event.data,
        topics: event.topics,
      });
      
      return {
        totalProfit: decoded.args.totalProfit as bigint,
        successCount: decoded.args.successCount as bigint,
        gasUsed: decoded.args.gasUsed as bigint,
      };
    }
    
    return {
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Get contract statistics
   */
  async getContractStats(): Promise<ContractStats> {
    try {
      const result = await this.publicClient.readContract({
        address: this.config.contractAddress,
        abi: ULTRA_ARBITRAGE_ABI,
        functionName: 'getUltraFastStats',
      });
      
      return {
        totalTrades: result[0],
        totalProfit: result[1],
        totalGasUsed: result[2],
        averageExecutionTime: result[3],
        successRate: result[4],
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Error getting contract stats:'), error);
      throw error;
    }
  }

  /**
   * Update gas optimization settings
   */
  async updateGasOptimization(
    enabled: boolean,
    gasLimit: bigint,
    gasPrice: bigint
  ): Promise<Hash> {
    try {
      return await this.walletClient.sendTransaction({
        to: this.config.contractAddress,
        data: encodeFunctionData({
          abi: ULTRA_ARBITRAGE_ABI,
          functionName: 'updateGasOptimization',
          args: [enabled, gasLimit, gasPrice]
        }),
        gas: 100000n,
        gasPrice: await this.publicClient.getGasPrice(),
      });
    } catch (error) {
      console.error(chalk.red('❌ Error updating gas optimization:'), error);
      throw error;
    }
  }

  /**
   * Emergency stop
   */
  async emergencyStop(): Promise<Hash> {
    try {
      return await this.walletClient.sendTransaction({
        to: this.config.contractAddress,
        data: encodeFunctionData({
          abi: ULTRA_ARBITRAGE_ABI,
          functionName: 'emergencyStop',
        }),
        gas: 100000n,
        gasPrice: await this.publicClient.getGasPrice(),
      });
    } catch (error) {
      console.error(chalk.red('❌ Error triggering emergency stop:'), error);
      throw error;
    }
  }

  /**
   * Emergency withdraw
   */
  async emergencyWithdraw(token: Address, amount: bigint): Promise<Hash> {
    try {
      return await this.walletClient.sendTransaction({
        to: this.config.contractAddress,
        data: encodeFunctionData({
          abi: ULTRA_ARBITRAGE_ABI,
          functionName: 'emergencyWithdraw',
          args: [token, amount]
        }),
        gas: 150000n,
        gasPrice: await this.publicClient.getGasPrice(),
      });
    } catch (error) {
      console.error(chalk.red('❌ Error in emergency withdraw:'), error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageExecutionTime: number;
    averageGasUsage: bigint;
    averageProfit: bigint;
    totalExecutions: number;
  } {
    const avgExecutionTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
      : 0;
    
    const avgGasUsage = this.gasUsages.length > 0
      ? this.gasUsages.reduce((sum, gas) => sum + gas, 0n) / BigInt(this.gasUsages.length)
      : 0n;
    
    const avgProfit = this.profits.length > 0
      ? this.profits.reduce((sum, profit) => sum + profit, 0n) / BigInt(this.profits.length)
      : 0n;
    
    return {
      averageExecutionTime: avgExecutionTime,
      averageGasUsage: avgGasUsage,
      averageProfit: avgProfit,
      totalExecutions: this.executionTimes.length,
    };
  }

  /**
   * Display performance dashboard
   */
  displayPerformanceDashboard(): void {
    const metrics = this.getPerformanceMetrics();
    
    console.clear();
    console.log(chalk.bold.blue('🚀 ULTRA-FAST CONTRACT INTERFACE DASHBOARD'));
    console.log(chalk.gray('═'.repeat(60)));
    
    console.log(chalk.bold.green('\n📊 Performance Metrics:'));
    console.log(`Total Executions: ${chalk.cyan(metrics.totalExecutions)}`);
    console.log(`Average Execution Time: ${chalk.yellow(metrics.averageExecutionTime.toFixed(2))}ms`);
    console.log(`Average Gas Usage: ${chalk.red(metrics.averageGasUsage.toString())}`);
    console.log(`Average Profit: ${chalk.green(formatEther(metrics.averageProfit))} BNB`);
    
    console.log(chalk.bold.blue('\n⚙️ Configuration:'));
    console.log(`Network: ${chalk.cyan(this.config.network)}`);
    console.log(`Contract: ${chalk.magenta(this.config.contractAddress)}`);
    console.log(`Gas Optimization: ${this.config.enableGasOptimization ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    console.log(`MEV Protection: ${this.config.enableMEVProtection ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    console.log(`Max Batch Size: ${chalk.yellow(this.config.maxBatchSize)}`);
    
    console.log(chalk.bold.yellow('\n🔄 Batch Queue:'));
    console.log(`Queued Trades: ${chalk.cyan(this.batchQueue.length)}`);
    console.log(`Batch Timeout: ${chalk.yellow(this.config.batchTimeout)}ms`);
    
    console.log(chalk.gray('\n' + '═'.repeat(60)));
    console.log(chalk.dim(`Last updated: ${new Date().toLocaleTimeString()}`));
  }
}

// Export types and classes
export {
  UltraFastContractInterface,
  ULTRA_ARBITRAGE_ABI,
  ExchangeId,
  type TradeParams,
  type BatchTradeParams,
  type ExecutionResult,
  type BatchExecutionResult,
  type ProfitCalculationResult,
  type ContractStats,
  type ContractConfig,
};

// Default configuration
export const defaultContractConfig: ContractConfig = {
  network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
  contractAddress: process.env.CONTRACT_ADDRESS as Address,
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
  wsUrl: process.env.WS_URL,
  
  enableGasOptimization: true,
  gasLimit: 300000n,
  gasPrice: parseEther('0.000005'), // 5 gwei
  
  enableMEVProtection: true,
  mevProtectionDelay: 1000,
  
  maxBatchSize: 10,
  batchTimeout: 5000,
  
  maxRetries: 3,
  retryDelay: 1000,
  confirmationBlocks: 1,
};