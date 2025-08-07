/**
 * Ultra-Fast Executor
 * High-performance transaction execution engine
 */

import { 
  type Hash, 
  type Address, 
  type PublicClient, 
  type WalletClient,
  parseEther,
  formatEther
} from 'viem';
import chalk from 'chalk';
import { UltraFastGasOptimizer, type OptimizationResult } from './ultra-gas-optimizer.js';

export interface ExecutorConfig {
  maxConcurrentExecutions: number;
  executionTimeout: number;
  retryAttempts: number;
  gasOptimizer: UltraFastGasOptimizer;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export interface TransactionRequest {
  to: Address;
  value?: bigint;
  data?: string;
  gasLimit?: bigint;
  gasPrice?: bigint;
  priority?: number;
  deadline?: number;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  transactionHash?: Hash;
  gasUsed?: bigint;
  executionTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ExecutorStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalGasUsed: bigint;
  isRunning: boolean;
}

export class UltraFastExecutor {
  private config: ExecutorConfig;
  private isRunning: boolean = false;
  private executionQueue: TransactionRequest[] = [];
  private activeExecutions: Map<string, Promise<ExecutionResult>> = new Map();
  private stats: ExecutorStats;

  constructor(config: ExecutorConfig) {
    this.config = config;
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalGasUsed: 0n,
      isRunning: false
    };
  }

  /**
   * Start the executor
   */
  startExecutor(): void {
    this.isRunning = true;
    this.stats.isRunning = true;
    console.log(chalk.green('⚡ Ultra-Fast Executor: Started'));
  }

  /**
   * Stop the executor
   */
  stopExecutor(): void {
    this.isRunning = false;
    this.stats.isRunning = false;
    console.log(chalk.yellow('⚡ Ultra-Fast Executor: Stopped'));
  }

  /**
   * Execute a single transaction
   */
  async executeTransaction(request: TransactionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.stats.totalExecutions++;

      // Check if we're at max concurrent executions
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
        throw new Error('Maximum concurrent executions reached');
      }

      // Optimize gas if not provided
      let gasLimit = request.gasLimit;
      let gasPrice = request.gasPrice;

      if (!gasLimit || !gasPrice) {
        const optimization = await this.config.gasOptimizer.optimizeGas({
          to: request.to,
          value: request.value || 0n,
          data: request.data || '0x'
        });

        gasLimit = gasLimit || optimization.gasLimit;
        gasPrice = gasPrice || optimization.gasPrice;
      }

      // Create execution promise
      const executionPromise = this.performExecution({
        ...request,
        gasLimit,
        gasPrice
      });

      this.activeExecutions.set(executionId, executionPromise);

      // Execute with timeout
      const result = await Promise.race([
        executionPromise,
        this.createTimeoutPromise(this.config.executionTimeout)
      ]);

      // Clean up
      this.activeExecutions.delete(executionId);

      // Update stats
      const executionTime = Date.now() - startTime;
      this.updateStats(result, executionTime);

      return result;

    } catch (error) {
      this.activeExecutions.delete(executionId);
      const executionTime = Date.now() - startTime;
      
      const errorResult: ExecutionResult = {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionId, ...request.metadata }
      };

      this.updateStats(errorResult, executionTime);
      return errorResult;
    }
  }

  /**
   * Execute multiple transactions in batch
   */
  async executeBatch(requests: TransactionRequest[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const batchPromises: Promise<ExecutionResult>[] = [];

    for (const request of requests) {
      batchPromises.push(this.executeTransaction(request));
    }

    try {
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            executionTime: 0,
            error: result.reason?.message || 'Batch execution failed'
          });
        }
      }

    } catch (error) {
      console.error(chalk.red('Batch execution error:'), error);
    }

    return results;
  }

  /**
   * Get executor statistics
   */
  getStats(): ExecutorStats {
    return { ...this.stats };
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.executionQueue.length;
  }

  /**
   * Get active executions count
   */
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Perform the actual transaction execution
   */
  private async performExecution(request: TransactionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Prepare transaction
      const txRequest = {
        to: request.to,
        value: request.value || 0n,
        data: request.data as `0x${string}` || '0x',
        gas: request.gasLimit,
        gasPrice: request.gasPrice
      };

      // Send transaction
      const hash = await this.config.walletClient.sendTransaction(txRequest);

      // Wait for confirmation
      const receipt = await this.config.publicClient.waitForTransactionReceipt({
        hash,
        timeout: this.config.executionTimeout
      });

      const executionTime = Date.now() - startTime;

      return {
        success: receipt.status === 'success',
        transactionHash: hash,
        gasUsed: receipt.gasUsed,
        executionTime,
        metadata: {
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          ...request.metadata
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Execution failed',
        metadata: request.metadata
      };
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<ExecutionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Update execution statistics
   */
  private updateStats(result: ExecutionResult, executionTime: number): void {
    if (result.success) {
      this.stats.successfulExecutions++;
      if (result.gasUsed) {
        this.stats.totalGasUsed += result.gasUsed;
      }
    } else {
      this.stats.failedExecutions++;
    }

    // Update average execution time
    const totalTime = this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime;
    this.stats.averageExecutionTime = totalTime / this.stats.totalExecutions;
  }
}