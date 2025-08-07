import { createPublicClient, createWalletClient, http, formatEther, parseEther, encodeFunctionData, decodeFunctionResult } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

interface ExecutionConfig {
  network: 'mainnet' | 'testnet';
  privateKey: string;
  contractAddress: string;
  maxGasPrice: bigint;
  gasMultiplier: number;
  maxConcurrentExecutions: number;
  executionTimeout: number;
  retryAttempts: number;
  enableBatching: boolean;
  enableParallelExecution: boolean;
}

interface ExecutionRequest {
  id: string;
  type: 'arbitrage' | 'flashloan' | 'swap';
  target: string;
  data: string;
  value: bigint;
  gasLimit: bigint;
  priority: number;
  deadline: number;
  metadata?: any;
}

interface ExecutionResult {
  id: string;
  success: boolean;
  txHash?: string;
  gasUsed?: bigint;
  executionTime: number;
  profit?: bigint;
  error?: string;
  blockNumber?: bigint;
}

interface BatchExecution {
  requests: ExecutionRequest[];
  totalGasLimit: bigint;
  estimatedProfit: bigint;
  priority: number;
}

class UltraExecutionEngine {
  private account: any;
  private publicClient: any;
  private walletClient: any;
  private executionQueue: ExecutionRequest[] = [];
  private activeExecutions = new Map<string, Promise<ExecutionResult>>();
  private executionHistory: ExecutionResult[] = [];
  private isRunning = false;
  private metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalGasUsed: 0n,
    totalProfit: 0n,
    averageExecutionTime: 0,
  };

  constructor(private config: ExecutionConfig) {
    this.setupClients();
  }

  private setupClients(): void {
    this.account = privateKeyToAccount(this.config.privateKey as `0x${string}`);
    const chain = this.config.network === 'mainnet' ? bsc : bscTestnet;
    
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

  async start(): Promise<void> {
    console.log(chalk.blue('🚀 Starting Ultra Execution Engine'));
    this.isRunning = true;
    this.processExecutionQueue();
  }

  async stop(): Promise<void> {
    console.log(chalk.yellow('⏹️ Stopping Ultra Execution Engine'));
    this.isRunning = false;
    
    // Wait for active executions to complete
    if (this.activeExecutions.size > 0) {
      console.log(chalk.yellow(`Waiting for ${this.activeExecutions.size} active executions...`));
      await Promise.allSettled(Array.from(this.activeExecutions.values()));
    }
    
    console.log(chalk.green('✅ Execution Engine stopped'));
  }

  async executeRequest(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateRequest(request);
      
      // Estimate gas
      const gasEstimate = await this.estimateGas(request);
      const gasLimit = gasEstimate * BigInt(Math.ceil(this.config.gasMultiplier));
      
      // Get current gas price
      const gasPrice = await this.getOptimalGasPrice();
      
      // Execute transaction
      const txHash = await this.walletClient.sendTransaction({
        to: request.target as `0x${string}`,
        data: request.data as `0x${string}`,
        value: request.value,
        gas: gasLimit,
        gasPrice,
      });
      
      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: this.config.executionTimeout,
      });
      
      const executionTime = Date.now() - startTime;
      
      // Calculate profit if applicable
      let profit = 0n;
      if (request.type === 'arbitrage' && receipt.logs.length > 0) {
        profit = this.calculateProfit(receipt.logs);
      }
      
      const result: ExecutionResult = {
        id: request.id,
        success: receipt.status === 'success',
        txHash,
        gasUsed: receipt.gasUsed,
        executionTime,
        profit,
        blockNumber: receipt.blockNumber,
      };
      
      this.updateMetrics(result);
      this.executionHistory.push(result);
      
      console.log(chalk.green(`✅ Execution ${request.id} completed: ${txHash}`));
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: ExecutionResult = {
        id: request.id,
        success: false,
        executionTime,
        error: (error as Error).message,
      };
      
      this.updateMetrics(result);
      this.executionHistory.push(result);
      
      console.log(chalk.red(`❌ Execution ${request.id} failed: ${error}`));
      return result;
    }
  }

  async executeBatch(batch: BatchExecution): Promise<ExecutionResult[]> {
    console.log(chalk.blue(`🔄 Executing batch of ${batch.requests.length} requests`));
    
    if (this.config.enableParallelExecution) {
      return this.executeParallel(batch.requests);
    } else {
      return this.executeSequential(batch.requests);
    }
  }

  private async executeParallel(requests: ExecutionRequest[]): Promise<ExecutionResult[]> {
    const promises = requests.map(request => this.executeRequest(request));
    return Promise.all(promises);
  }

  private async executeSequential(requests: ExecutionRequest[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const request of requests) {
      const result = await this.executeRequest(request);
      results.push(result);
      
      // Stop if execution failed and it's critical
      if (!result.success && request.priority > 8) {
        console.log(chalk.red('🛑 Critical execution failed, stopping batch'));
        break;
      }
    }
    
    return results;
  }

  addToQueue(request: ExecutionRequest): void {
    this.executionQueue.push(request);
    this.executionQueue.sort((a, b) => b.priority - a.priority);
    console.log(chalk.blue(`📝 Added request ${request.id} to queue (${this.executionQueue.length} pending)`));
  }

  private async processExecutionQueue(): Promise<void> {
    while (this.isRunning) {
      if (this.executionQueue.length === 0) {
        await this.sleep(100);
        continue;
      }
      
      // Check if we can execute more requests
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
        await this.sleep(50);
        continue;
      }
      
      const request = this.executionQueue.shift()!;
      
      // Check deadline
      if (Date.now() > request.deadline) {
        console.log(chalk.yellow(`⏰ Request ${request.id} expired`));
        continue;
      }
      
      // Start execution
      const executionPromise = this.executeRequest(request);
      this.activeExecutions.set(request.id, executionPromise);
      
      // Clean up when done
      executionPromise.finally(() => {
        this.activeExecutions.delete(request.id);
      });
    }
  }

  private validateRequest(request: ExecutionRequest): void {
    if (!request.id || !request.target || !request.data) {
      throw new Error('Invalid execution request');
    }
    
    if (Date.now() > request.deadline) {
      throw new Error('Request deadline exceeded');
    }
    
    if (request.gasLimit > parseEther('0.1')) {
      throw new Error('Gas limit too high');
    }
  }

  private async estimateGas(request: ExecutionRequest): Promise<bigint> {
    try {
      return await this.publicClient.estimateGas({
        to: request.target as `0x${string}`,
        data: request.data as `0x${string}`,
        value: request.value,
        account: this.account.address,
      });
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Gas estimation failed for ${request.id}, using default`));
      return request.gasLimit || 500000n;
    }
  }

  private async getOptimalGasPrice(): Promise<bigint> {
    try {
      const gasPrice = await this.publicClient.getGasPrice();
      const maxGasPrice = this.config.maxGasPrice;
      
      return gasPrice > maxGasPrice ? maxGasPrice : gasPrice;
    } catch (error) {
      console.log(chalk.yellow('⚠️ Failed to get gas price, using default'));
      return parseEther('0.000000005'); // 5 gwei
    }
  }

  private calculateProfit(logs: any[]): bigint {
    // Simple profit calculation from logs
    // This should be customized based on your contract events
    try {
      for (const log of logs) {
        if (log.topics[0] === '0x...') { // Your profit event signature
          // Decode profit from log data
          return BigInt(log.data);
        }
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Failed to calculate profit from logs'));
    }
    
    return 0n;
  }

  private updateMetrics(result: ExecutionResult): void {
    this.metrics.totalExecutions++;
    
    if (result.success) {
      this.metrics.successfulExecutions++;
      if (result.gasUsed) this.metrics.totalGasUsed += result.gasUsed;
      if (result.profit) this.metrics.totalProfit += result.profit;
    } else {
      this.metrics.failedExecutions++;
    }
    
    // Update average execution time
    const totalTime = this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0);
    this.metrics.averageExecutionTime = totalTime / this.executionHistory.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for monitoring
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecutions > 0 
        ? this.metrics.successfulExecutions / this.metrics.totalExecutions 
        : 0,
      queueLength: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size,
    };
  }

  getExecutionHistory(limit = 100): ExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  clearQueue(): void {
    this.executionQueue = [];
    console.log(chalk.yellow('🗑️ Execution queue cleared'));
  }

  // Utility methods for creating requests
  createArbitrageRequest(
    id: string,
    contractAddress: string,
    calldata: string,
    priority = 5,
    deadline = Date.now() + 30000
  ): ExecutionRequest {
    return {
      id,
      type: 'arbitrage',
      target: contractAddress,
      data: calldata,
      value: 0n,
      gasLimit: 500000n,
      priority,
      deadline,
    };
  }

  createFlashLoanRequest(
    id: string,
    contractAddress: string,
    amount: bigint,
    calldata: string,
    priority = 7,
    deadline = Date.now() + 20000
  ): ExecutionRequest {
    return {
      id,
      type: 'flashloan',
      target: contractAddress,
      data: calldata,
      value: 0n,
      gasLimit: 800000n,
      priority,
      deadline,
      metadata: { amount },
    };
  }

  createSwapRequest(
    id: string,
    routerAddress: string,
    calldata: string,
    value: bigint = 0n,
    priority = 3,
    deadline = Date.now() + 60000
  ): ExecutionRequest {
    return {
      id,
      type: 'swap',
      target: routerAddress,
      data: calldata,
      value,
      gasLimit: 300000n,
      priority,
      deadline,
    };
  }
}

// Main execution
async function main() {
  const config: ExecutionConfig = {
    network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
    privateKey: process.env.PRIVATE_KEY!,
    contractAddress: process.env.CONTRACT_ADDRESS!,
    maxGasPrice: parseEther(process.env.MAX_GAS_PRICE_GWEI || '20') / 1000000000n,
    gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER || '1.1'),
    maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '5'),
    executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    enableBatching: process.env.ENABLE_BATCHING === 'true',
    enableParallelExecution: process.env.ENABLE_PARALLEL_EXECUTION !== 'false',
  };

  if (!config.privateKey || !config.contractAddress) {
    console.error(chalk.red('❌ Missing required environment variables'));
    process.exit(1);
  }

  const engine = new UltraExecutionEngine(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n⏹️ Shutting down execution engine...'));
    await engine.stop();
    process.exit(0);
  });

  await engine.start();

  // Example usage
  const arbitrageRequest = engine.createArbitrageRequest(
    'arb_001',
    config.contractAddress,
    '0x...',
    8,
    Date.now() + 15000
  );

  engine.addToQueue(arbitrageRequest);

  // Keep running
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const metrics = engine.getMetrics();
    if (metrics.totalExecutions > 0) {
      console.log(chalk.blue(`📊 Executions: ${metrics.totalExecutions}, Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`));
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { UltraExecutionEngine, ExecutionConfig, ExecutionRequest, ExecutionResult, BatchExecution };