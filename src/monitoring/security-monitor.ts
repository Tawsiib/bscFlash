import { createPublicClient, http, parseAbiItem, formatEther, getAddress } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';

interface SecurityEvent {
  id: string;
  type: 'circuit_breaker' | 'emergency_pause' | 'mev_attack' | 'high_risk_trade' | 'unauthorized_access' | 'gas_anomaly' | 'slippage_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  blockNumber: bigint;
  transactionHash?: string;
  contractAddress: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
}

interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  highRiskTrades: number;
  mevAttacks: number;
  circuitBreakerTrips: number;
  emergencyPauses: number;
  averageResponseTime: number;
  securityScore: number;
  lastUpdate: number;
}

interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
  telegramChatId?: string;
  discordWebhook?: string;
  minSeverity: 'low' | 'medium' | 'high' | 'critical';
  rateLimitMinutes: number;
}

interface MonitoringConfig {
  contractAddress: string;
  network: 'mainnet' | 'testnet';
  rpcUrl: string;
  wsUrl?: string;
  pollingInterval: number;
  alertConfig: AlertConfig;
  thresholds: {
    maxGasPrice: bigint;
    maxSlippageBps: number;
    maxFailureRate: number;
    maxResponseTimeMs: number;
  };
}

class SecurityMonitor {
  private publicClient: any;
  private config: MonitoringConfig;
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics;
  private isMonitoring = false;
  private alertCooldowns = new Map<string, number>();
  private lastAlertTimes = new Map<string, number>();

  // Contract events to monitor
  private readonly EVENT_SIGNATURES = {
    ArbitrageExecuted: parseAbiItem('event ArbitrageExecuted(address indexed executor, address indexed tokenA, address indexed tokenB, uint256 amountIn, uint256 profit, uint8 exchangeA, uint8 exchangeB, uint256 gasUsed, bytes32 txHash)'),
    CircuitBreakerTripped: parseAbiItem('event CircuitBreakerTripped(address indexed trigger, uint256 failureCount, uint256 cooldownUntil)'),
    EmergencyPause: parseAbiItem('event EmergencyPause(address indexed operator, uint256 pausedUntil, string reason)'),
    SecurityLimitsUpdated: parseAbiItem('event SecurityLimitsUpdated(uint256 maxSingleTrade, uint256 maxDailyVolume, uint256 maxSlippageBps)'),
    MEVProtectionEnabled: parseAbiItem('event MEVProtectionEnabled(bool commitReveal, bool slippageProtection, uint256 commitRevealDelay)'),
    RiskAlert: parseAbiItem('event RiskAlert(address indexed token, uint256 riskScore, string alertType, uint256 timestamp)')
  };

  constructor(config: MonitoringConfig) {
    this.config = config;
    
    const chain = config.network === 'mainnet' ? bsc : bscTestnet;
    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl)
    });

    this.metrics = {
      totalEvents: 0,
      criticalEvents: 0,
      highRiskTrades: 0,
      mevAttacks: 0,
      circuitBreakerTrips: 0,
      emergencyPauses: 0,
      averageResponseTime: 0,
      securityScore: 100,
      lastUpdate: Date.now()
    };
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log(chalk.yellow('⚠️ Monitoring already active'));
      return;
    }

    console.log(chalk.blue('🔍 Starting Security Monitoring...'));
    console.log(chalk.gray(`Contract: ${this.config.contractAddress}`));
    console.log(chalk.gray(`Network: ${this.config.network}`));
    console.log(chalk.gray(`Polling Interval: ${this.config.pollingInterval}ms`));

    this.isMonitoring = true;

    // Start event monitoring
    this.startEventMonitoring();

    // Start periodic health checks
    this.startHealthChecks();

    // Start metrics collection
    this.startMetricsCollection();

    console.log(chalk.green('✅ Security monitoring started'));
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    console.log(chalk.yellow('🛑 Security monitoring stopped'));
  }

  private async startEventMonitoring(): Promise<void> {
    const monitorEvents = async () => {
      if (!this.isMonitoring) return;

      try {
        // Get latest block
        const latestBlock = await this.publicClient.getBlockNumber();
        const fromBlock = latestBlock - BigInt(100); // Monitor last 100 blocks

        // Monitor each event type
        await Promise.all([
          this.monitorArbitrageEvents(fromBlock, latestBlock),
          this.monitorCircuitBreakerEvents(fromBlock, latestBlock),
          this.monitorEmergencyEvents(fromBlock, latestBlock),
          this.monitorRiskAlerts(fromBlock, latestBlock)
        ]);

        // Schedule next monitoring cycle
        setTimeout(monitorEvents, this.config.pollingInterval);

      } catch (error) {
        console.error(chalk.red('❌ Event monitoring error:'), error);
        
        // Create error event
        await this.createSecurityEvent({
          type: 'unauthorized_access',
          severity: 'medium',
          details: {
            error: error instanceof Error ? error.message : String(error),
            source: 'event_monitoring'
          }
        });

        // Retry after delay
        setTimeout(monitorEvents, this.config.pollingInterval * 2);
      }
    };

    monitorEvents();
  }

  private async monitorArbitrageEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(this.config.contractAddress),
      event: this.EVENT_SIGNATURES.ArbitrageExecuted,
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { args } = log;
      
      // Check for suspicious patterns
      await this.analyzeArbitrageExecution({
        executor: args.executor,
        tokenA: args.tokenA,
        tokenB: args.tokenB,
        amountIn: args.amountIn,
        profit: args.profit,
        gasUsed: args.gasUsed,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!
      });
    }
  }

  private async monitorCircuitBreakerEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(this.config.contractAddress),
      event: this.EVENT_SIGNATURES.CircuitBreakerTripped,
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { args } = log;
      
      await this.createSecurityEvent({
        type: 'circuit_breaker',
        severity: 'high',
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        details: {
          trigger: args.trigger,
          failureCount: args.failureCount.toString(),
          cooldownUntil: args.cooldownUntil.toString()
        }
      });

      this.metrics.circuitBreakerTrips++;
    }
  }

  private async monitorEmergencyEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(this.config.contractAddress),
      event: this.EVENT_SIGNATURES.EmergencyPause,
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { args } = log;
      
      await this.createSecurityEvent({
        type: 'emergency_pause',
        severity: 'critical',
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        details: {
          operator: args.operator,
          pausedUntil: args.pausedUntil.toString(),
          reason: args.reason
        }
      });

      this.metrics.emergencyPauses++;
    }
  }

  private async monitorRiskAlerts(fromBlock: bigint, toBlock: bigint): Promise<void> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(this.config.contractAddress),
      event: this.EVENT_SIGNATURES.RiskAlert,
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { args } = log;
      
      const severity = this.calculateRiskSeverity(Number(args.riskScore));
      
      await this.createSecurityEvent({
        type: 'high_risk_trade',
        severity,
        blockNumber: log.blockNumber!,
        transactionHash: log.transactionHash!,
        details: {
          token: args.token,
          riskScore: args.riskScore.toString(),
          alertType: args.alertType,
          timestamp: args.timestamp.toString()
        }
      });

      if (severity === 'high' || severity === 'critical') {
        this.metrics.highRiskTrades++;
      }
    }
  }

  private async analyzeArbitrageExecution(execution: any): Promise<void> {
    const gasPrice = await this.getTransactionGasPrice(execution.transactionHash);
    
    // Check for gas price anomalies
    if (gasPrice > this.config.thresholds.maxGasPrice) {
      await this.createSecurityEvent({
        type: 'gas_anomaly',
        severity: 'medium',
        blockNumber: execution.blockNumber,
        transactionHash: execution.transactionHash,
        details: {
          gasPrice: gasPrice.toString(),
          threshold: this.config.thresholds.maxGasPrice.toString(),
          executor: execution.executor
        }
      });
    }

    // Check for MEV attack patterns
    if (await this.detectMEVPattern(execution)) {
      await this.createSecurityEvent({
        type: 'mev_attack',
        severity: 'high',
        blockNumber: execution.blockNumber,
        transactionHash: execution.transactionHash,
        details: {
          pattern: 'sandwich_attack',
          executor: execution.executor,
          profit: formatEther(execution.profit)
        }
      });

      this.metrics.mevAttacks++;
    }

    // Check profit-to-gas ratio
    const profitToGasRatio = Number(execution.profit) / Number(execution.gasUsed);
    if (profitToGasRatio < 0.001) { // Suspicious low profit
      await this.createSecurityEvent({
        type: 'high_risk_trade',
        severity: 'medium',
        blockNumber: execution.blockNumber,
        transactionHash: execution.transactionHash,
        details: {
          profitToGasRatio,
          executor: execution.executor,
          suspiciousActivity: 'low_profit_execution'
        }
      });
    }
  }

  private async detectMEVPattern(execution: any): Promise<boolean> {
    try {
      // Get block transactions
      const block = await this.publicClient.getBlock({
        blockNumber: execution.blockNumber,
        includeTransactions: true
      });

      const transactions = block.transactions as any[];
      const executionIndex = transactions.findIndex(tx => tx.hash === execution.transactionHash);

      if (executionIndex === -1) return false;

      // Check for sandwich attack pattern
      const prevTx = transactions[executionIndex - 1];
      const nextTx = transactions[executionIndex + 1];

      if (prevTx && nextTx) {
        // Simple heuristic: same from address in prev/next transactions
        if (prevTx.from === nextTx.from && prevTx.from !== execution.executor) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('MEV detection error:', error);
      return false;
    }
  }

  private async getTransactionGasPrice(txHash: string): Promise<bigint> {
    try {
      const tx = await this.publicClient.getTransaction({ hash: txHash as `0x${string}` });
      return tx.gasPrice || BigInt(0);
    } catch (error) {
      return BigInt(0);
    }
  }

  private calculateRiskSeverity(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 90) return 'critical';
    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  private async createSecurityEvent(eventData: Partial<SecurityEvent>): Promise<void> {
    const event: SecurityEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventData.type!,
      severity: eventData.severity!,
      timestamp: Date.now(),
      blockNumber: eventData.blockNumber || BigInt(0),
      transactionHash: eventData.transactionHash,
      contractAddress: this.config.contractAddress,
      details: eventData.details || {},
      resolved: false
    };

    this.events.push(event);
    this.metrics.totalEvents++;

    if (event.severity === 'critical') {
      this.metrics.criticalEvents++;
    }

    // Update security score
    this.updateSecurityScore(event);

    // Send alerts
    await this.sendAlert(event);

    console.log(chalk.red(`🚨 Security Event: ${event.type} (${event.severity})`));
    console.log(chalk.gray(`Details: ${JSON.stringify(event.details, null, 2)}`));
  }

  private updateSecurityScore(event: SecurityEvent): void {
    const severityPenalty = {
      low: 1,
      medium: 3,
      high: 7,
      critical: 15
    };

    const penalty = severityPenalty[event.severity];
    this.metrics.securityScore = Math.max(0, this.metrics.securityScore - penalty);

    // Gradual recovery over time
    const timeSinceLastUpdate = Date.now() - this.metrics.lastUpdate;
    const recoveryRate = 0.1; // 0.1 points per minute
    const recovery = (timeSinceLastUpdate / 60000) * recoveryRate;
    
    this.metrics.securityScore = Math.min(100, this.metrics.securityScore + recovery);
    this.metrics.lastUpdate = Date.now();
  }

  private async sendAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.alertConfig.enabled) return;

    // Check severity threshold
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const eventLevel = severityLevels.indexOf(event.severity);
    const minLevel = severityLevels.indexOf(this.config.alertConfig.minSeverity);
    
    if (eventLevel < minLevel) return;

    // Check rate limiting
    const alertKey = `${event.type}-${event.severity}`;
    const lastAlert = this.lastAlertTimes.get(alertKey) || 0;
    const rateLimitMs = this.config.alertConfig.rateLimitMinutes * 60 * 1000;
    
    if (Date.now() - lastAlert < rateLimitMs) return;

    this.lastAlertTimes.set(alertKey, Date.now());

    // Send to configured channels
    const alertMessage = this.formatAlertMessage(event);

    try {
      if (this.config.alertConfig.webhookUrl) {
        await this.sendWebhookAlert(alertMessage);
      }

      if (this.config.alertConfig.slackChannel) {
        await this.sendSlackAlert(alertMessage);
      }

      if (this.config.alertConfig.discordWebhook) {
        await this.sendDiscordAlert(alertMessage);
      }

      console.log(chalk.blue('📢 Alert sent successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to send alert:'), error);
    }
  }

  private formatAlertMessage(event: SecurityEvent): string {
    const emoji = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨'
    };

    return `${emoji[event.severity]} **Security Alert**

**Type:** ${event.type.replace(/_/g, ' ').toUpperCase()}
**Severity:** ${event.severity.toUpperCase()}
**Contract:** ${event.contractAddress}
**Block:** ${event.blockNumber}
**Time:** ${new Date(event.timestamp).toISOString()}

**Details:**
${JSON.stringify(event.details, null, 2)}

**Security Score:** ${this.metrics.securityScore.toFixed(1)}/100
`;
  }

  private async sendWebhookAlert(message: string): Promise<void> {
    if (!this.config.alertConfig.webhookUrl) return;

    const response = await fetch(this.config.alertConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      throw new Error(`Webhook alert failed: ${response.statusText}`);
    }
  }

  private async sendSlackAlert(message: string): Promise<void> {
    // Slack integration would go here
    console.log('Slack alert:', message);
  }

  private async sendDiscordAlert(message: string): Promise<void> {
    if (!this.config.alertConfig.discordWebhook) return;

    const response = await fetch(this.config.alertConfig.discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });

    if (!response.ok) {
      throw new Error(`Discord alert failed: ${response.statusText}`);
    }
  }

  private async startHealthChecks(): Promise<void> {
    const healthCheck = async () => {
      if (!this.isMonitoring) return;

      try {
        // Check contract health
        await this.checkContractHealth();

        // Check network health
        await this.checkNetworkHealth();

        // Schedule next health check
        setTimeout(healthCheck, 60000); // Every minute
      } catch (error) {
        console.error(chalk.red('❌ Health check error:'), error);
        setTimeout(healthCheck, 120000); // Retry after 2 minutes
      }
    };

    healthCheck();
  }

  private async checkContractHealth(): Promise<void> {
    try {
      // Check if contract is still deployed
      const code = await this.publicClient.getBytecode({
        address: getAddress(this.config.contractAddress)
      });

      if (!code || code === '0x') {
        await this.createSecurityEvent({
          type: 'unauthorized_access',
          severity: 'critical',
          details: {
            issue: 'contract_not_found',
            address: this.config.contractAddress
          }
        });
      }
    } catch (error) {
      console.error('Contract health check failed:', error);
    }
  }

  private async checkNetworkHealth(): Promise<void> {
    try {
      const startTime = Date.now();
      await this.publicClient.getBlockNumber();
      const responseTime = Date.now() - startTime;

      if (responseTime > this.config.thresholds.maxResponseTimeMs) {
        await this.createSecurityEvent({
          type: 'gas_anomaly',
          severity: 'medium',
          details: {
            issue: 'slow_network_response',
            responseTime,
            threshold: this.config.thresholds.maxResponseTimeMs
          }
        });
      }

      this.metrics.averageResponseTime = (this.metrics.averageResponseTime + responseTime) / 2;
    } catch (error) {
      console.error('Network health check failed:', error);
    }
  }

  private async startMetricsCollection(): Promise<void> {
    const collectMetrics = async () => {
      if (!this.isMonitoring) return;

      try {
        // Update metrics
        this.metrics.lastUpdate = Date.now();

        // Log metrics periodically
        console.log(chalk.blue('\n📊 Security Metrics:'));
        console.log(chalk.gray(`Total Events: ${this.metrics.totalEvents}`));
        console.log(chalk.gray(`Critical Events: ${this.metrics.criticalEvents}`));
        console.log(chalk.gray(`High Risk Trades: ${this.metrics.highRiskTrades}`));
        console.log(chalk.gray(`MEV Attacks: ${this.metrics.mevAttacks}`));
        console.log(chalk.gray(`Circuit Breaker Trips: ${this.metrics.circuitBreakerTrips}`));
        console.log(chalk.gray(`Emergency Pauses: ${this.metrics.emergencyPauses}`));
        console.log(chalk.gray(`Security Score: ${this.metrics.securityScore.toFixed(1)}/100`));
        console.log(chalk.gray(`Avg Response Time: ${this.metrics.averageResponseTime.toFixed(0)}ms`));

        // Schedule next collection
        setTimeout(collectMetrics, 300000); // Every 5 minutes
      } catch (error) {
        console.error('Metrics collection error:', error);
        setTimeout(collectMetrics, 300000);
      }
    };

    collectMetrics();
  }

  // Public methods for external access
  getEvents(filter?: { type?: string; severity?: string; resolved?: boolean }): SecurityEvent[] {
    let filteredEvents = [...this.events];

    if (filter) {
      if (filter.type) {
        filteredEvents = filteredEvents.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        filteredEvents = filteredEvents.filter(e => e.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.resolved === filter.resolved);
      }
    }

    return filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
  }

  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  async resolveEvent(eventId: string): Promise<boolean> {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = Date.now();

    console.log(chalk.green(`✅ Security event ${eventId} resolved`));
    return true;
  }

  getSecurityScore(): number {
    return this.metrics.securityScore;
  }

  isHealthy(): boolean {
    return this.metrics.securityScore > 70 && 
           this.metrics.criticalEvents === 0 &&
           this.metrics.averageResponseTime < this.config.thresholds.maxResponseTimeMs;
  }

  async logSecurityEvent(eventData: Partial<SecurityEvent>): Promise<void> {
    await this.createSecurityEvent(eventData);
  }
}

export { SecurityMonitor };
export type { SecurityEvent, SecurityMetrics, AlertConfig, MonitoringConfig };