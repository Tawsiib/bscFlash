import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Import security components
import { SecurityMonitor, MonitoringConfig } from '../src/monitoring/security-monitor.ts';
import { MEVProtectionManager } from '../src/security/mev-protection.ts';
import { RiskManager } from '../src/security/risk-manager.ts';
import { getSecurityConfig, validateSecurityConfig } from '../config/security-config.ts';

dotenv.config();

export interface TestConfig {
  network: 'mainnet' | 'testnet';
  privateKey: string;
  contractAddress: string;
  testDuration: number; // in seconds
  enableRealTransactions: boolean;
}

export interface TestResult {
  component: string;
  test: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class UltraSecureIntegrationTester {
  private account: any;
  private publicClient: any;
  private config: TestConfig;
  private walletClient: any;
  private securityMonitor?: SecurityMonitor;
  private mevProtectionManager?: MEVProtectionManager;
  private riskManager?: RiskManager;
  private testResults: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
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

  async runComprehensiveTests(): Promise<void> {
    console.log(chalk.bold.blue('🧪 Starting Ultra-Secure Arbitrage Integration Tests'));
    console.log(chalk.blue(`Network: ${this.config.network}`));
    console.log(chalk.blue(`Test Duration: ${this.config.testDuration}s`));
    console.log(chalk.blue(`Real Transactions: ${this.config.enableRealTransactions ? 'Enabled' : 'Disabled'}`));
    console.log('─'.repeat(80));

    try {
      // Initialize all components
      await this.initializeComponents();
      
      // Run component tests
      await this.testSecurityMonitor();
      await this.testMEVProtectionManager();
      await this.testRiskManager();
      
      // Run integration tests
      await this.testComponentIntegration();
      await this.testSecurityEventFlow();
      await this.testAlertingSystem();
      
      // Run stress tests
      await this.testHighVolumeScenario();
      await this.testFailureRecovery();
      
      // Generate report
      this.generateTestReport();
      
    } catch (error) {
      console.error(chalk.red('❌ Test suite failed:'), error);
    } finally {
      await this.cleanup();
    }
  }

  private async initializeComponents(): Promise<void> {
    console.log(chalk.yellow('🔧 Initializing security components...'));
    
    try {
      // Get security configuration
      const securityConfig = getSecurityConfig(this.config.network);
      validateSecurityConfig(securityConfig);
      
      // Initialize MEV Protection Manager
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
      
      // Initialize Risk Manager
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
      
      // Initialize Security Monitor
      const monitoringConfig: MonitoringConfig = {
        contractAddress: this.config.contractAddress,
        rpcUrl: process.env.RPC_URL!,
        wsUrl: process.env.WS_URL,
        enableEventMonitoring: true,
        enableMetricsCollection: true,
        enableAlerting: true,
        alertChannels: {
          webhook: process.env.TEST_WEBHOOK_URL,
        },
        alertThresholds: {
          gasAnomalyThreshold: 150,
          mevAttackThreshold: 3,
          lowProfitThreshold: 0.01,
          failureRateThreshold: 0.1,
          responseTimeThreshold: 5000,
        },
        metricsRetentionDays: 1,
        alertRateLimit: {
          maxAlertsPerHour: 100,
          cooldownMinutes: 1,
        },
      };
      
      this.securityMonitor = new SecurityMonitor(monitoringConfig);
      await this.securityMonitor.start();
      
      console.log(chalk.green('✅ All components initialized successfully'));
      
    } catch (error) {
      throw new Error(`Component initialization failed: ${error}`);
    }
  }

  private async testSecurityMonitor(): Promise<void> {
    console.log(chalk.yellow('🔍 Testing Security Monitor...'));
    
    const tests = [
      {
        name: 'Event Logging',
        test: async () => {
          await this.securityMonitor!.logSecurityEvent({
            type: 'test_event',
            severity: 'info',
            timestamp: Date.now(),
            details: { test: 'security monitor' },
            metadata: { component: 'integration_test' },
          });
        }
      },
      {
        name: 'Metrics Collection',
        test: async () => {
          const metrics = await this.securityMonitor!.getMetrics();
          if (!metrics || typeof metrics !== 'object') {
            throw new Error('Invalid metrics response');
          }
        }
      },
      {
        name: 'Health Check',
        test: async () => {
          const health = await this.securityMonitor!.performHealthCheck();
          if (!health.contractAccessible || !health.networkConnected) {
            throw new Error('Health check failed');
          }
        }
      }
    ];

    for (const { name, test } of tests) {
      await this.runTest('SecurityMonitor', name, test);
    }
  }

  private async testMEVProtectionManager(): Promise<void> {
    console.log(chalk.yellow('🛡️ Testing MEV Protection Manager...'));
    
    const tests = [
      {
        name: 'MEV Threat Detection',
        test: async () => {
          const threat = await this.mevProtectionManager!.detectMEVThreats(
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
            '0x55d398326f99059fF775485246999027B3197955', // USDT
            parseEther('1')
          );
          
          if (typeof threat.frontrunningRisk !== 'number' || typeof threat.sandwichRisk !== 'number') {
            throw new Error('Invalid threat detection response');
          }
        }
      },
      {
        name: 'MEV Protection Application',
        test: async () => {
          const protection = await this.mevProtectionManager!.applyMEVProtection({
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            tokenB: '0x55d398326f99059fF775485246999027B3197955',
            amountIn: parseEther('1'),
            minAmountOut: parseEther('300'),
            deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
            slippageTolerance: 500,
          });
          
          if (typeof protection.shouldDelay !== 'boolean') {
            throw new Error('Invalid protection response');
          }
        }
      }
    ];

    for (const { name, test } of tests) {
      await this.runTest('MEVProtectionManager', name, test);
    }
  }

  private async testRiskManager(): Promise<void> {
    console.log(chalk.yellow('📊 Testing Risk Manager...'));
    
    const tests = [
      {
        name: 'Risk Assessment',
        test: async () => {
          const assessment = await this.riskManager!.assessTradeRisk({
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            tokenB: '0x55d398326f99059fF775485246999027B3197955',
            amountUsd: 1000,
            liquidityUsd: 1000000,
            priceImpactBps: 50,
            dexName: 'pancakeswap',
            tradingFrequency: 10,
          });
          
          if (typeof assessment.riskScore !== 'number' || !assessment.reason) {
            throw new Error('Invalid risk assessment response');
          }
        }
      },
      {
        name: 'Trade Recording',
        test: async () => {
          this.riskManager!.recordTradeExecution({
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            tokenB: '0x55d398326f99059fF775485246999027B3197955',
            amountUsd: 1000,
            liquidityUsd: 1000000,
            priceImpactBps: 50,
            dexName: 'pancakeswap',
            tradingFrequency: 10,
          }, true, 50);
        }
      },
      {
        name: 'Circuit Breaker',
        test: async () => {
          // Simulate multiple failures to trigger circuit breaker
          for (let i = 0; i < 6; i++) {
            this.riskManager!.recordTradeExecution({
              tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
              tokenB: '0x55d398326f99059fF775485246999027B3197955',
              amountUsd: 1000,
              liquidityUsd: 1000000,
              priceImpactBps: 50,
              dexName: 'pancakeswap',
              tradingFrequency: 10,
            }, false, -100);
          }
          
          const assessment = await this.riskManager!.assessTradeRisk({
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            tokenB: '0x55d398326f99059fF775485246999027B3197955',
            amountUsd: 1000,
            liquidityUsd: 1000000,
            priceImpactBps: 50,
            dexName: 'pancakeswap',
            tradingFrequency: 10,
          });
          
          if (assessment.riskScore < 90) {
            throw new Error('Circuit breaker not triggered');
          }
        }
      }
    ];

    for (const { name, test } of tests) {
      await this.runTest('RiskManager', name, test);
    }
  }

  private async testComponentIntegration(): Promise<void> {
    console.log(chalk.yellow('🔗 Testing Component Integration...'));
    
    const tests = [
      {
        name: 'Security Event Chain',
        test: async () => {
          // Simulate a complete arbitrage execution with all security checks
          const startTime = Date.now();
          
          // 1. Risk assessment
          const riskAssessment = await this.riskManager!.assessTradeRisk({
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            tokenB: '0x55d398326f99059fF775485246999027B3197955',
            amountUsd: 1000,
            liquidityUsd: 1000000,
            priceImpactBps: 50,
            dexName: 'pancakeswap',
            tradingFrequency: 10,
          });
          
          // 2. MEV threat detection
          const mevThreat = await this.mevProtectionManager!.detectMEVThreats(
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            '0x55d398326f99059fF775485246999027B3197955',
            parseEther('1')
          );
          
          // 3. Log security event
          await this.securityMonitor!.logSecurityEvent({
            type: 'integration_test',
            severity: 'info',
            timestamp: Date.now(),
            details: {
              riskScore: riskAssessment.riskScore,
              mevRisk: Math.max(mevThreat.frontrunningRisk, mevThreat.sandwichRisk),
              executionTime: Date.now() - startTime,
            },
            metadata: {
              test: 'component_integration',
            },
          });
          
          // 4. Record trade execution
          this.riskManager!.recordTradeExecution({
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            tokenB: '0x55d398326f99059fF775485246999027B3197955',
            amountUsd: 1000,
            liquidityUsd: 1000000,
            priceImpactBps: 50,
            dexName: 'pancakeswap',
            tradingFrequency: 10,
          }, true, 50);
        }
      }
    ];

    for (const { name, test } of tests) {
      await this.runTest('Integration', name, test);
    }
  }

  private async testSecurityEventFlow(): Promise<void> {
    console.log(chalk.yellow('🔄 Testing Security Event Flow...'));
    
    const eventTypes = [
      'arbitrage_executed',
      'arbitrage_failed',
      'mev_attack_detected',
      'risk_threshold_exceeded',
      'circuit_breaker_triggered',
      'gas_anomaly_detected'
    ];

    for (const eventType of eventTypes) {
      await this.runTest('EventFlow', `Event: ${eventType}`, async () => {
        await this.securityMonitor!.logSecurityEvent({
          type: eventType,
          severity: eventType.includes('failed') || eventType.includes('attack') ? 'error' : 'info',
          timestamp: Date.now(),
          details: {
            test: true,
            eventType,
          },
          metadata: {
            source: 'integration_test',
          },
        });
      });
    }
  }

  private async testAlertingSystem(): Promise<void> {
    console.log(chalk.yellow('🚨 Testing Alerting System...'));
    
    const tests = [
      {
        name: 'High Severity Alert',
        test: async () => {
          await this.securityMonitor!.logSecurityEvent({
            type: 'critical_security_breach',
            severity: 'critical',
            timestamp: Date.now(),
            details: {
              test: true,
              breach: 'simulated_attack',
            },
            metadata: {
              alertTest: true,
            },
          });
        }
      },
      {
        name: 'Rate Limiting',
        test: async () => {
          // Send multiple alerts to test rate limiting
          for (let i = 0; i < 5; i++) {
            await this.securityMonitor!.logSecurityEvent({
              type: 'rate_limit_test',
              severity: 'warning',
              timestamp: Date.now(),
              details: {
                test: true,
                iteration: i,
              },
              metadata: {
                rateLimitTest: true,
              },
            });
          }
        }
      }
    ];

    for (const { name, test } of tests) {
      await this.runTest('Alerting', name, test);
    }
  }

  private async testHighVolumeScenario(): Promise<void> {
    console.log(chalk.yellow('📈 Testing High Volume Scenario...'));
    
    await this.runTest('HighVolume', 'Concurrent Operations', async () => {
      const promises = [];
      
      // Simulate 10 concurrent arbitrage operations
      for (let i = 0; i < 10; i++) {
        promises.push(this.simulateArbitrageExecution(i));
      }
      
      await Promise.all(promises);
    });
  }

  private async testFailureRecovery(): Promise<void> {
    console.log(chalk.yellow('🔄 Testing Failure Recovery...'));
    
    const tests = [
      {
        name: 'Network Disconnection',
        test: async () => {
          // Simulate network issues by testing with invalid RPC
          try {
            const invalidClient = createPublicClient({
              chain: bsc,
              transport: http('http://invalid-rpc-url'),
            });
            
            await invalidClient.getBlockNumber();
            throw new Error('Should have failed with invalid RPC');
          } catch (error) {
            // Expected to fail
            if ((error as Error).message.includes('Should have failed')) {
              throw error;
            }
          }
        }
      },
      {
        name: 'Component Restart',
        test: async () => {
          // Stop and restart security monitor
          await this.securityMonitor!.stop();
          await this.securityMonitor!.start();
          
          // Verify it's working
          await this.securityMonitor!.logSecurityEvent({
            type: 'restart_test',
            severity: 'info',
            timestamp: Date.now(),
            details: { test: 'component_restart' },
            metadata: { restartTest: true },
          });
        }
      }
    ];

    for (const { name, test } of tests) {
      await this.runTest('FailureRecovery', name, test);
    }
  }

  private async simulateArbitrageExecution(id: number): Promise<void> {
    const startTime = Date.now();
    
    // Risk assessment
    const riskAssessment = await this.riskManager!.assessTradeRisk({
      tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      tokenB: '0x55d398326f99059fF775485246999027B3197955',
      amountUsd: 1000 + (id * 100),
      liquidityUsd: 1000000,
      priceImpactBps: 50 + id,
      dexName: ['pancakeswap', 'uniswap', 'sushiswap'][id % 3],
      tradingFrequency: 10 + id,
    });
    
    // MEV protection
    const mevThreat = await this.mevProtectionManager!.detectMEVThreats(
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      '0x55d398326f99059fF775485246999027B3197955',
      parseEther((1 + id * 0.1).toString())
    );
    
    // Log execution
    await this.securityMonitor!.logSecurityEvent({
      type: 'simulated_arbitrage',
      severity: 'info',
      timestamp: Date.now(),
      details: {
        id,
        riskScore: riskAssessment.riskScore,
        mevRisk: Math.max(mevThreat.frontrunningRisk, mevThreat.sandwichRisk),
        executionTime: Date.now() - startTime,
      },
      metadata: {
        simulation: true,
        concurrentTest: true,
      },
    });
    
    // Record trade
    this.riskManager!.recordTradeExecution({
      tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      tokenB: '0x55d398326f99059fF775485246999027B3197955',
      amountUsd: 1000 + (id * 100),
      liquidityUsd: 1000000,
      priceImpactBps: 50 + id,
      dexName: ['pancakeswap', 'uniswap', 'sushiswap'][id % 3],
      tradingFrequency: 10 + id,
    }, Math.random() > 0.1, Math.random() * 100 - 10);
  }

  private async runTest(component: string, testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        component,
        test: testName,
        success: true,
        duration,
      });
      
      console.log(chalk.green(`  ✅ ${testName} (${duration}ms)`));
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        component,
        test: testName,
        success: false,
        duration,
        error: (error as Error).message,
      });
      
      console.log(chalk.red(`  ❌ ${testName} (${duration}ms): ${(error as Error).message}`));
    }
  }

  private generateTestReport(): void {
    console.log('\n' + '═'.repeat(80));
    console.log(chalk.bold.blue('📊 ULTRA-SECURE ARBITRAGE INTEGRATION TEST REPORT'));
    console.log('═'.repeat(80));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log(chalk.cyan(`Total Tests: ${totalTests}`));
    console.log(chalk.green(`Passed: ${passedTests}`));
    console.log(chalk.red(`Failed: ${failedTests}`));
    console.log(chalk.yellow(`Success Rate: ${successRate.toFixed(1)}%`));
    
    // Group by component
    const componentResults = this.testResults.reduce((acc, result) => {
      if (!acc[result.component]) {
        acc[result.component] = [];
      }
      acc[result.component].push(result);
      return acc;
    }, {} as Record<string, TestResult[]>);
    
    console.log('\n' + chalk.bold('Component Breakdown:'));
    for (const [component, results] of Object.entries(componentResults)) {
      const componentPassed = results.filter(r => r.success).length;
      const componentTotal = results.length;
      const componentRate = (componentPassed / componentTotal) * 100;
      
      console.log(chalk.blue(`\n${component}:`));
      console.log(`  Tests: ${componentTotal}, Passed: ${componentPassed}, Rate: ${componentRate.toFixed(1)}%`);
      
      // Show failed tests
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.log(chalk.red('  Failed Tests:'));
        failed.forEach(test => {
          console.log(chalk.red(`    - ${test.test}: ${test.error}`));
        });
      }
    }
    
    // Performance metrics
    const avgDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    const maxDuration = Math.max(...this.testResults.map(r => r.duration));
    const minDuration = Math.min(...this.testResults.map(r => r.duration));
    
    console.log('\n' + chalk.bold('Performance Metrics:'));
    console.log(`Average Duration: ${avgDuration.toFixed(1)}ms`);
    console.log(`Max Duration: ${maxDuration}ms`);
    console.log(`Min Duration: ${minDuration}ms`);
    
    console.log('\n' + '═'.repeat(80));
    
    if (successRate >= 90) {
      console.log(chalk.bold.green('🎉 INTEGRATION TESTS PASSED - SYSTEM READY FOR DEPLOYMENT'));
    } else if (successRate >= 70) {
      console.log(chalk.bold.yellow('⚠️ INTEGRATION TESTS PARTIALLY PASSED - REVIEW FAILURES'));
    } else {
      console.log(chalk.bold.red('❌ INTEGRATION TESTS FAILED - SYSTEM NOT READY'));
    }
  }

  private async cleanup(): Promise<void> {
    console.log(chalk.yellow('\n🧹 Cleaning up test environment...'));
    
    if (this.securityMonitor) {
      await this.securityMonitor.stop();
    }
    
    console.log(chalk.green('✅ Cleanup completed'));
  }
}

// Main execution
async function main() {
  const config: TestConfig = {
    network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
    privateKey: process.env.PRIVATE_KEY!,
    contractAddress: process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
    testDuration: parseInt(process.env.TEST_DURATION || '300'), // 5 minutes default
    enableRealTransactions: process.env.ENABLE_REAL_TRANSACTIONS === 'true',
  };
  
  if (!config.privateKey) {
    console.error(chalk.red('❌ PRIVATE_KEY environment variable is required'));
    process.exit(1);
  }
  
  const tester = new UltraSecureIntegrationTester(config);
  await tester.runComprehensiveTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { UltraSecureIntegrationTester };