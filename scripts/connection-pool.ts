/**
 * Ultra-Fast Connection Pool
 * Manages multiple RPC connections for optimal performance
 */

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';

export interface ConnectionPoolConfig {
  network: 'mainnet' | 'testnet';
  rpcUrls: string[];
  maxConnections: number;
  healthCheckInterval: number;
  retryAttempts: number;
  timeoutMs: number;
  privateKey?: string;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  averageLatency: number;
  requestCount: number;
  errorRate: number;
}

interface Connection {
  id: string;
  url: string;
  client: PublicClient;
  walletClient?: WalletClient;
  isHealthy: boolean;
  latency: number;
  requestCount: number;
  errorCount: number;
  lastUsed: number;
}

export class UltraFastConnectionPool {
  private config: ConnectionPoolConfig;
  private connections: Connection[] = [];
  private currentIndex: number = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private stats: PoolStats;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      averageLatency: 0,
      requestCount: 0,
      errorRate: 0
    };
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    console.log(chalk.blue('🔗 Initializing connection pool...'));

    const chain = this.config.network === 'mainnet' ? bsc : bscTestnet;
    const account = this.config.privateKey ? privateKeyToAccount(this.config.privateKey as `0x${string}`) : undefined;

    // Create connections for each RPC URL
    for (let i = 0; i < Math.min(this.config.rpcUrls.length, this.config.maxConnections); i++) {
      const url = this.config.rpcUrls[i];
      
      try {
        const client = createPublicClient({
          chain,
          transport: http(url, {
            timeout: this.config.timeoutMs,
            retryCount: this.config.retryAttempts
          })
        });

        const walletClient = account ? createWalletClient({
          account,
          chain,
          transport: http(url, {
            timeout: this.config.timeoutMs,
            retryCount: this.config.retryAttempts
          })
        }) : undefined;

        const connection: Connection = {
          id: `conn_${i}`,
          url,
          client,
          walletClient,
          isHealthy: true,
          latency: 0,
          requestCount: 0,
          errorCount: 0,
          lastUsed: Date.now()
        };

        // Test connection
        await this.testConnection(connection);
        this.connections.push(connection);
        this.stats.totalConnections++;

      } catch (error) {
        console.log(chalk.red(`❌ Failed to create connection to ${url}: ${error}`));
        this.stats.failedConnections++;
      }
    }

    this.stats.activeConnections = this.connections.filter(c => c.isHealthy).length;

    if (this.stats.activeConnections === 0) {
      throw new Error('No healthy connections available');
    }

    console.log(chalk.green(`✅ Connection pool initialized with ${this.stats.activeConnections} healthy connections`));

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Get the best available client
   */
  getClient(): PublicClient {
    const healthyConnections = this.connections.filter(c => c.isHealthy);
    
    if (healthyConnections.length === 0) {
      throw new Error('No healthy connections available');
    }

    // Round-robin with latency consideration
    const connection = this.selectBestConnection(healthyConnections);
    connection.lastUsed = Date.now();
    connection.requestCount++;
    this.stats.requestCount++;

    return connection.client;
  }

  /**
   * Get wallet client
   */
  getWalletClient(): WalletClient {
    const healthyConnections = this.connections.filter(c => c.isHealthy && c.walletClient);
    
    if (healthyConnections.length === 0) {
      throw new Error('No healthy wallet connections available');
    }

    const connection = this.selectBestConnection(healthyConnections);
    connection.lastUsed = Date.now();
    connection.requestCount++;
    this.stats.requestCount++;

    return connection.walletClient!;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): PoolStats {
    const totalRequests = this.connections.reduce((sum, c) => sum + c.requestCount, 0);
    const totalErrors = this.connections.reduce((sum, c) => sum + c.errorCount, 0);
    const totalLatency = this.connections.reduce((sum, c) => sum + c.latency, 0);

    return {
      ...this.stats,
      activeConnections: this.connections.filter(c => c.isHealthy).length,
      averageLatency: this.connections.length > 0 ? totalLatency / this.connections.length : 0,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    console.log(chalk.yellow('🔗 Shutting down connection pool...'));

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.connections = [];
    this.stats.activeConnections = 0;

    console.log(chalk.green('✅ Connection pool shutdown complete'));
  }

  /**
   * Select the best connection based on latency and load
   */
  private selectBestConnection(connections: Connection[]): Connection {
    // Sort by latency and request count
    return connections.sort((a, b) => {
      const scoreA = a.latency + (a.requestCount * 0.1);
      const scoreB = b.latency + (b.requestCount * 0.1);
      return scoreA - scoreB;
    })[0];
  }

  /**
   * Test connection health
   */
  private async testConnection(connection: Connection): Promise<void> {
    const startTime = Date.now();
    
    try {
      await connection.client.getBlockNumber();
      connection.latency = Date.now() - startTime;
      connection.isHealthy = true;
    } catch (error) {
      connection.isHealthy = false;
      connection.errorCount++;
      throw error;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const connection of this.connections) {
        try {
          await this.testConnection(connection);
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Connection ${connection.id} health check failed`));
        }
      }

      this.stats.activeConnections = this.connections.filter(c => c.isHealthy).length;
    }, this.config.healthCheckInterval);
  }
}