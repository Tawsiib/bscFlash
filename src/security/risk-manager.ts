/**
 * Enhanced Risk Management Module
 * Implements comprehensive risk controls for arbitrage operations
 */

import { Address, parseEther, formatEther } from 'viem';
import { SecurityConfig } from '../../config/security-config';

export interface RiskMetrics {
    totalExposure: bigint;
    tokenExposures: Map<Address, bigint>;
    dexExposures: Map<Address, bigint>;
    dailyVolume: bigint;
    hourlyTrades: number;
    consecutiveFailures: number;
    lastFailureTime: number;
    profitLoss: bigint;
    maxDrawdown: bigint;
    sharpeRatio: number;
    volatility: number;
}

export interface RiskAlert {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    type: string;
    message: string;
    timestamp: number;
    data?: any;
}

export interface TradeRisk {
    approved: boolean;
    riskScore: number;
    warnings: string[];
    maxAllowedAmount: bigint;
    recommendedSlippage: number;
}

export class RiskManager {
    private config: SecurityConfig;
    private metrics: RiskMetrics;
    private alerts: RiskAlert[] = [];
    private tradeHistory: any[] = [];
    private blacklistedTokens: Set<Address> = new Set();
    private whitelistedTokens: Set<Address> = new Set();
    private circuitBreakerTripped: boolean = false;
    private lastResetTime: number = Date.now();

    constructor(config: SecurityConfig) {
        this.config = config;
        this.metrics = this.initializeMetrics();
        this.loadTokenLists();
    }

    /**
     * Initialize risk metrics
     */
    private initializeMetrics(): RiskMetrics {
        return {
            totalExposure: BigInt(0),
            tokenExposures: new Map(),
            dexExposures: new Map(),
            dailyVolume: BigInt(0),
            hourlyTrades: 0,
            consecutiveFailures: 0,
            lastFailureTime: 0,
            profitLoss: BigInt(0),
            maxDrawdown: BigInt(0),
            sharpeRatio: 0,
            volatility: 0
        };
    }

    /**
     * Load token blacklist and whitelist
     */
    private loadTokenLists(): void {
        this.config.riskManagement.blacklistedTokens.forEach(token => {
            this.blacklistedTokens.add(token as Address);
        });

        this.config.riskManagement.whitelistedTokens.forEach(token => {
            this.whitelistedTokens.add(token as Address);
        });
    }

    /**
     * Assess risk for a potential trade
     */
    async assessTradeRisk(params: {
        tokenIn: Address;
        tokenOut: Address;
        amountIn: bigint;
        router1: Address;
        router2: Address;
        expectedProfit: bigint;
        priceImpact: number;
        liquidity: bigint;
    }): Promise<TradeRisk> {
        const warnings: string[] = [];
        let riskScore = 0;
        let approved = true;

        // Check circuit breaker
        if (this.circuitBreakerTripped) {
            return {
                approved: false,
                riskScore: 100,
                warnings: ['Circuit breaker is active'],
                maxAllowedAmount: BigInt(0),
                recommendedSlippage: 0
            };
        }

        // Token validation
        const tokenRisk = this.assessTokenRisk(params.tokenIn, params.tokenOut);
        riskScore += tokenRisk.score;
        warnings.push(...tokenRisk.warnings);

        if (tokenRisk.blocked) {
            approved = false;
        }

        // Amount validation
        const amountRisk = this.assessAmountRisk(params.amountIn, params.tokenIn);
        riskScore += amountRisk.score;
        warnings.push(...amountRisk.warnings);

        if (amountRisk.blocked) {
            approved = false;
        }

        // Liquidity validation
        const liquidityRisk = this.assessLiquidityRisk(params.liquidity, params.amountIn);
        riskScore += liquidityRisk.score;
        warnings.push(...liquidityRisk.warnings);

        // Price impact validation
        const priceImpactRisk = this.assessPriceImpactRisk(params.priceImpact);
        riskScore += priceImpactRisk.score;
        warnings.push(...priceImpactRisk.warnings);

        if (priceImpactRisk.blocked) {
            approved = false;
        }

        // DEX exposure validation
        const dexRisk = this.assessDEXRisk(params.router1, params.router2, params.amountIn);
        riskScore += dexRisk.score;
        warnings.push(...dexRisk.warnings);

        // Trading frequency validation
        const frequencyRisk = this.assessTradingFrequency();
        riskScore += frequencyRisk.score;
        warnings.push(...frequencyRisk.warnings);

        if (frequencyRisk.blocked) {
            approved = false;
        }

        // Calculate maximum allowed amount
        const maxAllowedAmount = this.calculateMaxAllowedAmount(params.tokenIn, params.amountIn);

        // Calculate recommended slippage
        const recommendedSlippage = this.calculateRecommendedSlippage(params.priceImpact, riskScore);

        // Generate alerts if necessary
        if (riskScore > 70) {
            this.generateAlert('HIGH', 'High Risk Trade', 
                `Trade risk score: ${riskScore}. Warnings: ${warnings.join(', ')}`, 
                { params, riskScore, warnings });
        }

        return {
            approved,
            riskScore,
            warnings: warnings.filter(w => w.length > 0),
            maxAllowedAmount,
            recommendedSlippage
        };
    }

    /**
     * Assess token-specific risks
     */
    private assessTokenRisk(tokenIn: Address, tokenOut: Address): {
        score: number;
        warnings: string[];
        blocked: boolean;
    } {
        const warnings: string[] = [];
        let score = 0;
        let blocked = false;

        // Check blacklist
        if (this.blacklistedTokens.has(tokenIn) || this.blacklistedTokens.has(tokenOut)) {
            warnings.push('Token is blacklisted');
            blocked = true;
            score += 100;
        }

        // Check whitelist (if enabled)
        if (this.whitelistedTokens.size > 0) {
            if (!this.whitelistedTokens.has(tokenIn) || !this.whitelistedTokens.has(tokenOut)) {
                warnings.push('Token not in whitelist');
                score += 30;
            }
        }

        // Check token exposure
        const tokenInExposure = this.metrics.tokenExposures.get(tokenIn) || BigInt(0);
        const tokenOutExposure = this.metrics.tokenExposures.get(tokenOut) || BigInt(0);

        if (tokenInExposure > this.config.riskManagement.maxExposurePerToken) {
            warnings.push(`Token ${tokenIn} exposure limit exceeded`);
            score += 40;
        }

        if (tokenOutExposure > this.config.riskManagement.maxExposurePerToken) {
            warnings.push(`Token ${tokenOut} exposure limit exceeded`);
            score += 40;
        }

        return { score, warnings, blocked };
    }

    /**
     * Assess amount-specific risks
     */
    private assessAmountRisk(amount: bigint, token: Address): {
        score: number;
        warnings: string[];
        blocked: boolean;
    } {
        const warnings: string[] = [];
        let score = 0;
        let blocked = false;

        // Check single trade limit
        if (amount > this.config.tradingLimits.maxSingleTrade) {
            warnings.push(`Amount exceeds single trade limit: ${formatEther(amount)} > ${formatEther(this.config.tradingLimits.maxSingleTrade)}`);
            blocked = true;
            score += 100;
        }

        // Check daily volume limit
        const projectedDailyVolume = this.metrics.dailyVolume + amount;
        if (projectedDailyVolume > this.config.tradingLimits.maxDailyVolume) {
            warnings.push(`Would exceed daily volume limit`);
            blocked = true;
            score += 100;
        }

        // Risk scoring based on amount size
        const singleTradeLimit = this.config.tradingLimits.maxSingleTrade;
        const amountRatio = Number(amount * 100n / singleTradeLimit);

        if (amountRatio > 80) {
            warnings.push('Large trade size');
            score += 30;
        } else if (amountRatio > 50) {
            warnings.push('Medium trade size');
            score += 15;
        }

        return { score, warnings, blocked };
    }

    /**
     * Assess liquidity risks
     */
    private assessLiquidityRisk(liquidity: bigint, tradeAmount: bigint): {
        score: number;
        warnings: string[];
    } {
        const warnings: string[] = [];
        let score = 0;

        // Check minimum liquidity threshold
        if (liquidity < this.config.riskManagement.minLiquidityThreshold) {
            warnings.push('Low liquidity detected');
            score += 50;
        }

        // Check trade size vs liquidity ratio
        const liquidityRatio = Number(tradeAmount * 100n / liquidity);

        if (liquidityRatio > 10) {
            warnings.push('Trade size too large relative to liquidity');
            score += 40;
        } else if (liquidityRatio > 5) {
            warnings.push('Moderate liquidity impact');
            score += 20;
        }

        return { score, warnings };
    }

    /**
     * Assess price impact risks
     */
    private assessPriceImpactRisk(priceImpact: number): {
        score: number;
        warnings: string[];
        blocked: boolean;
    } {
        const warnings: string[] = [];
        let score = 0;
        let blocked = false;

        const maxPriceImpact = this.config.riskManagement.maxPriceImpact;

        if (priceImpact > maxPriceImpact) {
            warnings.push(`Price impact too high: ${priceImpact}% > ${maxPriceImpact}%`);
            blocked = true;
            score += 100;
        } else if (priceImpact > maxPriceImpact * 0.8) {
            warnings.push('High price impact');
            score += 30;
        } else if (priceImpact > maxPriceImpact * 0.5) {
            warnings.push('Moderate price impact');
            score += 15;
        }

        return { score, warnings, blocked };
    }

    /**
     * Assess DEX exposure risks
     */
    private assessDEXRisk(router1: Address, router2: Address, amount: bigint): {
        score: number;
        warnings: string[];
    } {
        const warnings: string[] = [];
        let score = 0;

        // Check DEX exposure limits
        const dex1Exposure = this.metrics.dexExposures.get(router1) || BigInt(0);
        const dex2Exposure = this.metrics.dexExposures.get(router2) || BigInt(0);

        const maxDEXExposure = this.config.riskManagement.maxExposurePerDEX;

        if (dex1Exposure + amount > maxDEXExposure) {
            warnings.push(`DEX ${router1} exposure limit would be exceeded`);
            score += 25;
        }

        if (dex2Exposure + amount > maxDEXExposure) {
            warnings.push(`DEX ${router2} exposure limit would be exceeded`);
            score += 25;
        }

        return { score, warnings };
    }

    /**
     * Assess trading frequency risks
     */
    private assessTradingFrequency(): {
        score: number;
        warnings: string[];
        blocked: boolean;
    } {
        const warnings: string[] = [];
        let score = 0;
        let blocked = false;

        // Check hourly trade limit
        if (this.metrics.hourlyTrades >= this.config.tradingLimits.maxHourlyTrades) {
            warnings.push('Hourly trade limit reached');
            blocked = true;
            score += 100;
        } else if (this.metrics.hourlyTrades > this.config.tradingLimits.maxHourlyTrades * 0.8) {
            warnings.push('Approaching hourly trade limit');
            score += 20;
        }

        // Check consecutive failures
        if (this.metrics.consecutiveFailures >= this.config.circuitBreaker.maxConsecutiveFailures) {
            warnings.push('Too many consecutive failures');
            blocked = true;
            score += 100;
        }

        return { score, warnings, blocked };
    }

    /**
     * Calculate maximum allowed amount for a trade
     */
    private calculateMaxAllowedAmount(token: Address, requestedAmount: bigint): bigint {
        const limits = [
            this.config.tradingLimits.maxSingleTrade,
            this.config.tradingLimits.maxDailyVolume - this.metrics.dailyVolume,
            this.config.riskManagement.maxExposurePerToken - (this.metrics.tokenExposures.get(token) || BigInt(0))
        ];

        return limits.reduce((min, current) => current < min ? current : min, requestedAmount);
    }

    /**
     * Calculate recommended slippage based on risk factors
     */
    private calculateRecommendedSlippage(priceImpact: number, riskScore: number): number {
        let baseSlippage = this.config.tradingLimits.maxSlippage;

        // Increase slippage for high-risk trades
        if (riskScore > 50) {
            baseSlippage = Math.floor(baseSlippage * 1.5);
        } else if (riskScore > 30) {
            baseSlippage = Math.floor(baseSlippage * 1.2);
        }

        // Adjust for price impact
        const adjustedSlippage = Math.max(baseSlippage, Math.floor(priceImpact * 100 * 1.5));

        return Math.min(adjustedSlippage, 500); // Max 5% slippage
    }

    /**
     * Record trade execution
     */
    recordTrade(params: {
        tokenIn: Address;
        tokenOut: Address;
        amountIn: bigint;
        amountOut: bigint;
        router1: Address;
        router2: Address;
        profit: bigint;
        gasUsed: bigint;
        success: boolean;
    }): void {
        const trade = {
            ...params,
            timestamp: Date.now()
        };

        this.tradeHistory.push(trade);

        // Update metrics
        this.updateMetrics(trade);

        // Check circuit breaker conditions
        this.checkCircuitBreaker();

        // Clean old data
        this.cleanOldData();
    }

    /**
     * Update risk metrics
     */
    private updateMetrics(trade: any): void {
        // Update exposures
        const currentTokenExposure = this.metrics.tokenExposures.get(trade.tokenIn) || BigInt(0);
        this.metrics.tokenExposures.set(trade.tokenIn, currentTokenExposure + trade.amountIn);

        const currentDEXExposure = this.metrics.dexExposures.get(trade.router1) || BigInt(0);
        this.metrics.dexExposures.set(trade.router1, currentDEXExposure + trade.amountIn);

        // Update volume and trade count
        this.metrics.dailyVolume += trade.amountIn;
        this.metrics.hourlyTrades += 1;

        // Update profit/loss
        this.metrics.profitLoss += trade.profit;

        // Update failure tracking
        if (trade.success) {
            this.metrics.consecutiveFailures = 0;
        } else {
            this.metrics.consecutiveFailures += 1;
            this.metrics.lastFailureTime = Date.now();
        }

        // Update total exposure
        this.metrics.totalExposure += trade.amountIn;

        // Calculate drawdown
        if (trade.profit < 0 && (-trade.profit) > this.metrics.maxDrawdown) {
            this.metrics.maxDrawdown = BigInt(-trade.profit);
        }
    }

    /**
     * Check circuit breaker conditions
     */
    private checkCircuitBreaker(): void {
        if (!this.config.circuitBreaker.enabled) return;

        const recentTrades = this.getRecentTrades(this.config.circuitBreaker.timeWindow);
        const failedTrades = recentTrades.filter(t => !t.success);
        const failureRate = recentTrades.length > 0 ? (failedTrades.length / recentTrades.length) * 100 : 0;

        // Check failure rate threshold
        if (failureRate > this.config.circuitBreaker.failureRateThreshold) {
            this.tripCircuitBreaker('High failure rate detected');
            return;
        }

        // Check consecutive failures
        if (this.metrics.consecutiveFailures >= this.config.circuitBreaker.maxConsecutiveFailures) {
            this.tripCircuitBreaker('Too many consecutive failures');
            return;
        }

        // Check maximum drawdown
        const maxDrawdownThreshold = this.config.tradingLimits.maxDailyVolume / 10n; // 10% of daily volume
        if (this.metrics.maxDrawdown > maxDrawdownThreshold) {
            this.tripCircuitBreaker('Maximum drawdown exceeded');
            return;
        }
    }

    /**
     * Trip the circuit breaker
     */
    private tripCircuitBreaker(reason: string): void {
        this.circuitBreakerTripped = true;
        
        this.generateAlert('CRITICAL', 'Circuit Breaker Tripped', reason, {
            consecutiveFailures: this.metrics.consecutiveFailures,
            maxDrawdown: formatEther(this.metrics.maxDrawdown),
            totalExposure: formatEther(this.metrics.totalExposure)
        });

        console.log(`🚨 CIRCUIT BREAKER TRIPPED: ${reason}`);

        // Auto-recovery if enabled
        if (this.config.circuitBreaker.autoRecovery) {
            setTimeout(() => {
                this.resetCircuitBreaker();
            }, this.config.circuitBreaker.recoveryDelay * 1000);
        }
    }

    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void {
        this.circuitBreakerTripped = false;
        this.metrics.consecutiveFailures = 0;
        
        this.generateAlert('MEDIUM', 'Circuit Breaker Reset', 'Circuit breaker has been reset');
        console.log('✅ Circuit breaker reset');
    }

    /**
     * Generate risk alert
     */
    private generateAlert(level: RiskAlert['level'], type: string, message: string, data?: any): void {
        const alert: RiskAlert = {
            level,
            type,
            message,
            timestamp: Date.now(),
            data
        };

        this.alerts.push(alert);

        // Keep only recent alerts
        const maxAlerts = 1000;
        if (this.alerts.length > maxAlerts) {
            this.alerts = this.alerts.slice(-maxAlerts);
        }

        // Log critical alerts
        if (level === 'CRITICAL') {
            console.error(`🚨 CRITICAL ALERT: ${type} - ${message}`);
        } else if (level === 'HIGH') {
            console.warn(`⚠️ HIGH ALERT: ${type} - ${message}`);
        }
    }

    /**
     * Get recent trades within time window
     */
    private getRecentTrades(timeWindowSeconds: number): any[] {
        const cutoff = Date.now() - (timeWindowSeconds * 1000);
        return this.tradeHistory.filter(trade => trade.timestamp > cutoff);
    }

    /**
     * Clean old data to prevent memory leaks
     */
    private cleanOldData(): void {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const oneHourAgo = now - (60 * 60 * 1000);

        // Clean old trade history (keep 24 hours)
        this.tradeHistory = this.tradeHistory.filter(trade => trade.timestamp > oneDayAgo);

        // Reset daily metrics if needed
        if (now - this.lastResetTime > 24 * 60 * 60 * 1000) {
            this.metrics.dailyVolume = BigInt(0);
            this.lastResetTime = now;
        }

        // Reset hourly metrics
        const recentTrades = this.getRecentTrades(3600); // 1 hour
        this.metrics.hourlyTrades = recentTrades.length;

        // Clean old alerts (keep 7 days)
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => alert.timestamp > sevenDaysAgo);
    }

    /**
     * Get current risk status
     */
    getRiskStatus(): {
        circuitBreakerActive: boolean;
        totalExposure: string;
        dailyVolume: string;
        consecutiveFailures: number;
        recentAlerts: RiskAlert[];
        riskScore: number;
    } {
        const recentAlerts = this.alerts.slice(-10);
        const riskScore = this.calculateOverallRiskScore();

        return {
            circuitBreakerActive: this.circuitBreakerTripped,
            totalExposure: formatEther(this.metrics.totalExposure),
            dailyVolume: formatEther(this.metrics.dailyVolume),
            consecutiveFailures: this.metrics.consecutiveFailures,
            recentAlerts,
            riskScore
        };
    }

    /**
     * Calculate overall risk score
     */
    private calculateOverallRiskScore(): number {
        let score = 0;

        // Exposure risk
        const exposureRatio = Number(this.metrics.totalExposure * 100n / this.config.tradingLimits.maxDailyVolume);
        score += Math.min(exposureRatio, 40);

        // Failure risk
        score += this.metrics.consecutiveFailures * 10;

        // Volume risk
        const volumeRatio = Number(this.metrics.dailyVolume * 100n / this.config.tradingLimits.maxDailyVolume);
        score += Math.min(volumeRatio, 30);

        // Alert risk
        const recentCriticalAlerts = this.alerts.filter(a => 
            a.level === 'CRITICAL' && 
            Date.now() - a.timestamp < 60 * 60 * 1000 // Last hour
        ).length;
        score += recentCriticalAlerts * 20;

        return Math.min(score, 100);
    }

    /**
     * Record trade execution for risk tracking
     */
    recordTradeExecution(trade: {
        opportunityId: string;
        tokenIn: Address;
        tokenOut: Address;
        amountIn: bigint;
        profit: bigint;
        gasUsed: bigint;
        success: boolean;
        timestamp?: number;
        executionTime?: number;
        riskScore?: number;
    }): void {
        const tradeRecord = {
            ...trade,
            timestamp: trade.timestamp || Date.now()
        };

        // Add to trade history
        this.tradeHistory.push(tradeRecord);

        // Update metrics
        if (trade.success) {
            this.metrics.consecutiveFailures = 0;
            this.metrics.profitLoss += trade.profit;
            this.metrics.totalExposure += trade.amountIn;
            this.metrics.dailyVolume += trade.amountIn;
        } else {
            this.metrics.consecutiveFailures++;
            this.metrics.lastFailureTime = Date.now();
        }

        // Update token exposure
        const currentExposure = this.metrics.tokenExposures.get(trade.tokenIn) || BigInt(0);
        this.metrics.tokenExposures.set(trade.tokenIn, currentExposure + trade.amountIn);

        // Check circuit breaker conditions
        this.checkCircuitBreaker();

        // Clean old data periodically
        if (this.tradeHistory.length % 100 === 0) {
            this.cleanOldData();
        }
    }

    /**
     * Emergency stop all trading
     */
    emergencyStop(): void {
        this.circuitBreakerTripped = true;
        this.generateAlert('CRITICAL', 'Emergency Stop', 'Manual emergency stop activated');
        console.log('🚨 EMERGENCY STOP ACTIVATED');
    }

    /**
     * Get detailed risk report
     */
    getDetailedRiskReport(): any {
        return {
            metrics: {
                ...this.metrics,
                totalExposure: formatEther(this.metrics.totalExposure),
                dailyVolume: formatEther(this.metrics.dailyVolume),
                profitLoss: formatEther(this.metrics.profitLoss),
                maxDrawdown: formatEther(this.metrics.maxDrawdown)
            },
            status: this.getRiskStatus(),
            config: this.config.riskManagement,
            recentTrades: this.getRecentTrades(3600).slice(-20),
            alerts: this.alerts.slice(-50)
        };
    }
}