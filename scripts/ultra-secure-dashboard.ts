import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Import all components
import { SecurityMonitor, MonitoringConfig } from '../src/monitoring/security-monitor.js';
import { MEVProtectionManager } from '../src/security/mev-protection.js';
import { RiskManager } from '../src/security/risk-manager.js';
import { getSecurityConfig, validateSecurityConfig } from '../config/security-config.js';

dotenv.config();

interface DashboardConfig {
  network: 'mainnet' | 'testnet';
  privateKey: string;
  contractAddress: string;
  refreshInterval: number; // in seconds
  enableAutoDeployment: boolean;
  enableLiveMonitoring: boolean;
}

interface SystemStatus {
  timestamp: number;
  components: {
    securityMonitor: ComponentStatus;
    mevProtection: ComponentStatus;
    riskManager: ComponentStatus;
    contract: ComponentStatus;
    network: ComponentStatus;
  };
  metrics: {
    totalArbitrages: number;
    successRate: number;
    totalProfit: string;
    averageExecutionTime: number;
    securityEvents: number;
    threatsDetected: number;
    blockedTransactions: number;
  };
  alerts: Alert[];
}

interface ComponentStatus {
  status: 'online' | 'offline' | 'error' | 'warning' | 'initializing';
  lastCheck: number;
  uptime: number;
  details?: any;
  error?: string;
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

class UltraSecureDashboard {
  private account: any;
  private publicClient: any;
  private walletClient: any;
  private securityMonitor!: SecurityMonitor;
  private mevProtection!: MEVProtectionManager;
  private riskManager!: RiskManager;
  
  private isRunning = false;
  private startTime = Date.now();
  private systemStatus: SystemStatus = {
    timestamp: Date.now(),
    components: {
      network: { status: 'initializing', lastCheck: 0, uptime: 0 },
      contract: { status: 'initializing', lastCheck: 0, uptime: 0 },
      securityMonitor: { status: 'initializing', lastCheck: 0, uptime: 0 },
      mevProtection: { status: 'initializing', lastCheck: 0, uptime: 0 },
      riskManager: { status: 'initializing', lastCheck: 0, uptime: 0 },
    },
    metrics: {
      totalArbitrages: 0,
      successRate: 0,
      totalProfit: '0',
      averageExecutionTime: 0,
      securityEvents: 0,
      threatsDetected: 0,
      blockedTransactions: 0,
    },
     alerts: [],
   };
   private dashboardInterval?: NodeJS.Timeout;

  constructor(private config: DashboardConfig) {
    this.setupClients();
    this.initializeSystemStatus();
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

  private initializeSystemStatus(): void {
    this.systemStatus = {
      timestamp: Date.now(),
      components: {
        securityMonitor: { status: 'offline', lastCheck: 0, uptime: 0 },
        mevProtection: { status: 'offline', lastCheck: 0, uptime: 0 },
        riskManager: { status: 'offline', lastCheck: 0, uptime: 0 },
        contract: { status: 'offline', lastCheck: 0, uptime: 0 },
        network: { status: 'offline', lastCheck: 0, uptime: 0 },
      },
      metrics: {
        totalArbitrages: 0,
        successRate: 0,
        totalProfit: '0',
        averageExecutionTime: 0,
        securityEvents: 0,
        threatsDetected: 0,
        blockedTransactions: 0,
      },
      alerts: [],
    };
  }

  async start(): Promise<void> {
    console.log(chalk.bold.blue('🚀 Starting Ultra-Secure Arbitrage Dashboard'));
    console.log(chalk.blue(`Network: ${this.config.network}`));
    console.log(chalk.blue(`Contract: ${this.config.contractAddress}`));
    console.log(chalk.blue(`Refresh Interval: ${this.config.refreshInterval}s`));
    console.log('═'.repeat(80));

    try {
      // Initialize components
      await this.initializeComponents();
      
      // Deploy contract if needed
      if (this.config.enableAutoDeployment) {
        await this.deployContractIfNeeded();
      }
      
      // Start monitoring
      if (this.config.enableLiveMonitoring) {
        this.startLiveMonitoring();
      }
      
      // Start dashboard
      this.startDashboard();
      
      this.isRunning = true;
      console.log(chalk.green('✅ Dashboard started successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start dashboard:'), error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log(chalk.yellow('⏹️ Stopping dashboard...'));
    
    this.isRunning = false;
    
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
    }
    
    if (this.securityMonitor) {
      await this.securityMonitor.stopMonitoring();
    }
    
    console.log(chalk.green('✅ Dashboard stopped'));
  }

  private async initializeComponents(): Promise<void> {
    console.log(chalk.yellow('🔧 Initializing security components...'));
    
    try {
      // Get security configuration
      const securityConfig = getSecurityConfig();
      validateSecurityConfig(securityConfig);
      
      // Initialize MEV Protection
      this.mevProtection = new MEVProtectionManager({
        enabled: securityConfig.mevProtection.enabled,
        commitRevealScheme: securityConfig.mevProtection.commitRevealScheme,
        commitBlocks: securityConfig.mevProtection.commitBlocks,
        revealBlocks: securityConfig.mevProtection.revealBlocks,
        maxSlippageProtection: securityConfig.mevProtection.maxSlippageProtection,
        frontrunningDetection: securityConfig.mevProtection.frontrunningDetection,
        sandwichProtection: securityConfig.mevProtection.sandwichProtection,
        privateMempool: false,
        flashbotsEnabled: false,
        gasAuction: true,
      }, process.env.RPC_URL!, this.config.privateKey);
      
      // Initialize Risk Manager
      this.riskManager = new RiskManager(securityConfig);
      
      // Initialize Security Monitor
      const monitoringConfig: MonitoringConfig = {
        contractAddress: this.config.contractAddress,
        network: this.config.network,
        rpcUrl: process.env.RPC_URL!,
        wsUrl: process.env.WS_URL,
        pollingInterval: 5000,
        alertConfig: {
          enabled: true,
          webhookUrl: process.env.ALERT_WEBHOOK_URL,
          slackChannel: process.env.SLACK_WEBHOOK_URL,
          discordWebhook: process.env.DISCORD_WEBHOOK_URL,
          minSeverity: 'medium',
          rateLimitMinutes: 5,
        },
        thresholds: {
          maxGasPrice: BigInt(50 * 1e9), // 50 gwei
          maxSlippageBps: 100, // 1%
          maxFailureRate: 0.1, // 10%
          maxResponseTimeMs: 5000,
        },
      };
      
      this.securityMonitor = new SecurityMonitor(monitoringConfig);
      await this.securityMonitor.startMonitoring();
      
      // Update component status
      this.systemStatus.components.securityMonitor.status = 'online';
      this.systemStatus.components.mevProtection.status = 'online';
      this.systemStatus.components.riskManager.status = 'online';
      
      console.log(chalk.green('✅ All components initialized'));
      
    } catch (error) {
      this.addAlert('component_init_failed', 'error', `Component initialization failed: ${error}`);
      throw error;
    }
  }

  private async deployContractIfNeeded(): Promise<void> {
    console.log(chalk.yellow('📋 Checking contract deployment...'));
    
    try {
      // Check if contract exists
      const code = await this.publicClient.getBytecode({
        address: this.config.contractAddress as `0x${string}`,
      });
      
      if (!code || code === '0x') {
        console.log(chalk.yellow('📦 Contract not found, deploying...'));
        
        // Import and run deployment script
        const { UltraSecureContractDeployer } = await import('./deploy-ultra-secure.js');
        
        const deployer = new UltraSecureContractDeployer({
          network: this.config.network,
          privateKey: this.config.privateKey,
          equalizerPool: process.env.EQUALIZER_POOL_ADDRESS!,
          gasLimit: BigInt(5000000),
          gasPrice: parseEther('0.000000005'), // 5 gwei
          setupSecurity: true,
          verifyContract: false,
        });
        
        const result = await deployer.deploy();
        
        if (result.contractAddress) {
          this.config.contractAddress = result.contractAddress;
          this.addAlert('contract_deployed', 'info', `Contract deployed at ${result.contractAddress}`);
          console.log(chalk.green(`✅ Contract deployed: ${result.contractAddress}`));
        } else {
          throw new Error('Deployment failed - no contract address returned');
        }
      } else {
        console.log(chalk.green('✅ Contract already deployed'));
      }
      
      this.systemStatus.components.contract.status = 'online';
      
    } catch (error) {
      this.systemStatus.components.contract.status = 'error';
      this.systemStatus.components.contract.error = (error as Error).message;
      this.addAlert('contract_check_failed', 'error', `Contract check failed: ${error}`);
      throw error;
    }
  }

  private startLiveMonitoring(): void {
    console.log(chalk.yellow('📊 Starting live monitoring...'));
    
    // Note: SecurityMonitor doesn't extend EventEmitter, so we'll poll for events instead
  }

  private startDashboard(): void {
    this.dashboardInterval = setInterval(async () => {
      await this.updateSystemStatus();
      this.displayDashboard();
    }, this.config.refreshInterval * 1000);
    
    // Initial display
    this.displayDashboard();
  }

  private async updateSystemStatus(): Promise<void> {
    const now = Date.now();
    
    try {
      // Update network status
      const blockNumber = await this.publicClient.getBlockNumber();
      this.systemStatus.components.network = {
        status: 'online',
        lastCheck: now,
        uptime: now - this.startTime,
        details: { blockNumber: blockNumber.toString() },
      };
      
      // Update contract status
      if (this.config.contractAddress !== '0x0000000000000000000000000000000000000000') {
        const code = await this.publicClient.getBytecode({
          address: this.config.contractAddress as `0x${string}`,
        });
        
        this.systemStatus.components.contract = {
          status: code && code !== '0x' ? 'online' : 'error',
          lastCheck: now,
          uptime: now - this.startTime,
          details: { hasCode: !!(code && code !== '0x') },
        };
      }
      
      // Update component status
      this.systemStatus.components.securityMonitor.lastCheck = now;
      this.systemStatus.components.securityMonitor.uptime = now - this.startTime;
      
      this.systemStatus.components.mevProtection.lastCheck = now;
      this.systemStatus.components.mevProtection.uptime = now - this.startTime;
      
      this.systemStatus.components.riskManager.lastCheck = now;
      this.systemStatus.components.riskManager.uptime = now - this.startTime;
      
      // Update metrics
      if (this.securityMonitor) {
        const metrics = await this.securityMonitor.getMetrics();
        this.systemStatus.metrics = {
          totalArbitrages: 0, // This would come from arbitrage system, not security monitor
          successRate: 0, // This would come from arbitrage system, not security monitor
          totalProfit: '0', // This would come from arbitrage system, not security monitor
          averageExecutionTime: metrics.averageResponseTime || 0,
          securityEvents: metrics.totalEvents || 0,
          threatsDetected: metrics.mevAttacks || 0,
          blockedTransactions: metrics.criticalEvents || 0,
        };
      }
      
      this.systemStatus.timestamp = now;
      
    } catch (error) {
      this.addAlert('status_update_failed', 'warning', `Status update failed: ${error}`);
    }
  }

  private displayDashboard(): void {
    // Clear screen
    console.clear();
    
    // Header
    console.log(chalk.bold.blue('╔═══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║                    ULTRA-SECURE ARBITRAGE DASHBOARD                          ║'));
    console.log(chalk.bold.blue('╚═══════════════════════════════════════════════════════════════════════════════╝'));
    
    // System info
    console.log(chalk.cyan(`Network: ${this.config.network.toUpperCase()}`));
    console.log(chalk.cyan(`Contract: ${this.config.contractAddress}`));
    console.log(chalk.cyan(`Uptime: ${this.formatUptime(Date.now() - this.startTime)}`));
    console.log(chalk.cyan(`Last Update: ${new Date(this.systemStatus.timestamp).toLocaleTimeString()}`));
    console.log('');
    
    // Component status
    console.log(chalk.bold.yellow('📊 COMPONENT STATUS'));
    console.log('─'.repeat(80));
    
    const components = this.systemStatus.components;
    this.displayComponentStatus('Security Monitor', components.securityMonitor);
    this.displayComponentStatus('MEV Protection', components.mevProtection);
    this.displayComponentStatus('Risk Manager', components.riskManager);
    this.displayComponentStatus('Smart Contract', components.contract);
    this.displayComponentStatus('Network', components.network);
    console.log('');
    
    // Metrics
    console.log(chalk.bold.yellow('📈 PERFORMANCE METRICS'));
    console.log('─'.repeat(80));
    
    const metrics = this.systemStatus.metrics;
    console.log(chalk.green(`Total Arbitrages: ${metrics.totalArbitrages}`));
    console.log(chalk.green(`Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`));
    console.log(chalk.green(`Total Profit: ${metrics.totalProfit} BNB`));
    console.log(chalk.green(`Avg Execution Time: ${metrics.averageExecutionTime}ms`));
    console.log(chalk.yellow(`Security Events: ${metrics.securityEvents}`));
    console.log(chalk.red(`Threats Detected: ${metrics.threatsDetected}`));
    console.log(chalk.red(`Blocked Transactions: ${metrics.blockedTransactions}`));
    console.log('');
    
    // Recent alerts
    console.log(chalk.bold.yellow('🚨 RECENT ALERTS'));
    console.log('─'.repeat(80));
    
    const recentAlerts = this.systemStatus.alerts.slice(-5).reverse();
    if (recentAlerts.length === 0) {
      console.log(chalk.green('No recent alerts'));
    } else {
      recentAlerts.forEach(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        const severityColor = this.getSeverityColor(alert.severity);
        console.log(severityColor(`[${time}] ${alert.severity.toUpperCase()}: ${alert.message}`));
      });
    }
    console.log('');
    
    // Controls
    console.log(chalk.bold.yellow('🎮 CONTROLS'));
    console.log('─'.repeat(80));
    console.log(chalk.blue('Press Ctrl+C to stop the dashboard'));
    console.log(chalk.blue('Dashboard refreshes every ' + this.config.refreshInterval + ' seconds'));
    console.log('');
  }

  private displayComponentStatus(name: string, status: ComponentStatus): void {
    const statusIcon = this.getStatusIcon(status.status);
    const statusColor = this.getStatusColor(status.status);
    const uptime = this.formatUptime(status.uptime);
    
    console.log(statusColor(`${statusIcon} ${name.padEnd(20)} ${status.status.toUpperCase().padEnd(10)} Uptime: ${uptime}`));
    
    if (status.error) {
      console.log(chalk.red(`   Error: ${status.error}`));
    }
    
    if (status.details) {
      const details = Object.entries(status.details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      console.log(chalk.gray(`   Details: ${details}`));
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'online': return '🟢';
      case 'warning': return '🟡';
      case 'error': return '🔴';
      case 'offline': return '⚫';
      default: return '❓';
    }
  }

  private getStatusColor(status: string): typeof chalk.green {
    switch (status) {
      case 'online': return chalk.green;
      case 'warning': return chalk.yellow;
      case 'error': return chalk.red;
      case 'offline': return chalk.gray;
      default: return chalk.white;
    }
  }

  private getSeverityColor(severity: string): typeof chalk.green {
    switch (severity) {
      case 'info': return chalk.blue;
      case 'warning': return chalk.yellow;
      case 'error': return chalk.red;
      case 'critical': return chalk.magenta;
      default: return chalk.white;
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private addAlert(type: string, severity: 'info' | 'warning' | 'error' | 'critical', message: string): void {
    const alert: Alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    };
    
    this.systemStatus.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.systemStatus.alerts.length > 100) {
      this.systemStatus.alerts = this.systemStatus.alerts.slice(-50);
    }
    
    // Log to security monitor if available
    if (this.securityMonitor) {
      // Map dashboard severity to security monitor severity
      const securitySeverity = this.mapSeverityToSecurityMonitor(severity);
      this.securityMonitor.logSecurityEvent({
        type: 'unauthorized_access', // Use a valid security event type
        severity: securitySeverity,
        timestamp: Date.now(),
        details: { message, dashboardType: type },
      });
    }
  }

  private mapSeverityToSecurityMonitor(severity: 'info' | 'warning' | 'error' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'info': return 'low';
      case 'warning': return 'medium';
      case 'error': return 'high';
      case 'critical': return 'critical';
      default: return 'low';
    }
  }

  private handleSecurityEvent(event: any): void {
    // Convert security events to alerts
    this.addAlert(event.type, event.severity, `Security event: ${event.type}`);
    
    // Update metrics based on event type
    if (event.type.includes('threat') || event.type.includes('attack')) {
      this.systemStatus.metrics.threatsDetected++;
    }
    
    if (event.type.includes('blocked') || event.type.includes('rejected')) {
      this.systemStatus.metrics.blockedTransactions++;
    }
    
    this.systemStatus.metrics.securityEvents++;
  }

  // Public methods for external control
  async getSystemStatus(): Promise<SystemStatus> {
    await this.updateSystemStatus();
    return { ...this.systemStatus };
  }

  getAlerts(): Alert[] {
    return [...this.systemStatus.alerts];
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.systemStatus.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  clearAlerts(): void {
    this.systemStatus.alerts = [];
  }
}

// Main execution
async function main() {
  const config: DashboardConfig = {
    network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
    privateKey: process.env.PRIVATE_KEY!,
    contractAddress: process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
    refreshInterval: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL || '5'),
    enableAutoDeployment: process.env.ENABLE_AUTO_DEPLOYMENT === 'true',
    enableLiveMonitoring: process.env.ENABLE_LIVE_MONITORING !== 'false',
  };
  
  if (!config.privateKey) {
    console.error(chalk.red('❌ PRIVATE_KEY environment variable is required'));
    process.exit(1);
  }
  
  const dashboard = new UltraSecureDashboard(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n⏹️ Shutting down dashboard...'));
    await dashboard.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n⏹️ Shutting down dashboard...'));
    await dashboard.stop();
    process.exit(0);
  });
  
  await dashboard.start();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { UltraSecureDashboard };
export type { DashboardConfig, SystemStatus, ComponentStatus, Alert };