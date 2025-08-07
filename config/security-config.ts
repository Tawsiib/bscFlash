/**
 * Enhanced Security Configuration for Ultra-Fast Arbitrage System
 * Implements best practices for secure DeFi operations
 */

export interface SecurityConfig {
    // Multi-signature configuration
    multiSig: {
        enabled: boolean;
        threshold: number;
        owners: string[];
        requireAllForEmergency: boolean;
    };

    // Time-lock configuration
    timeLock: {
        enabled: boolean;
        delay: number; // seconds
        emergencyDelay: number; // seconds for emergency actions
        adminDelay: number; // seconds for admin actions
    };

    // MEV Protection
    mevProtection: {
        enabled: boolean;
        commitRevealScheme: boolean;
        commitBlocks: number;
        revealBlocks: number;
        maxSlippageProtection: number; // basis points
        frontrunningDetection: boolean;
        sandwichProtection: boolean;
    };

    // Circuit Breaker
    circuitBreaker: {
        enabled: boolean;
        maxConsecutiveFailures: number;
        failureRateThreshold: number; // percentage
        timeWindow: number; // seconds
        autoRecovery: boolean;
        recoveryDelay: number; // seconds
    };

    // Trading Limits
    tradingLimits: {
        maxSingleTrade: bigint;
        maxDailyVolume: bigint;
        maxHourlyTrades: number;
        minProfitThreshold: bigint;
        maxSlippage: number; // basis points
        maxGasPrice: bigint;
        minBlockDelay: number;
    };

    // Emergency Controls
    emergency: {
        pauseEnabled: boolean;
        emergencyPausers: string[];
        maxPauseDuration: number; // seconds
        autoUnpauseEnabled: boolean;
        emergencyWithdrawEnabled: boolean;
    };

    // Access Control
    accessControl: {
        roleBasedAccess: boolean;
        adminRole: string;
        operatorRole: string;
        emergencyRole: string;
        maxOperators: number;
    };

    // Monitoring & Alerts
    monitoring: {
        realTimeAlerts: boolean;
        profitThresholdAlert: bigint;
        lossThresholdAlert: bigint;
        gasUsageAlert: bigint;
        slippageAlert: number; // basis points
        webhookUrl?: string;
        telegramConfig?: {
            botToken: string;
            chatId: string;
        };
    };

    // Risk Management
    riskManagement: {
        maxExposurePerToken: bigint;
        maxExposurePerDEX: bigint;
        blacklistedTokens: string[];
        whitelistedTokens: string[];
        minLiquidityThreshold: bigint;
        maxPriceImpact: number; // basis points
    };
}

// Production Security Configuration
export const PRODUCTION_SECURITY_CONFIG: SecurityConfig = {
    multiSig: {
        enabled: true,
        threshold: 2,
        owners: [
            process.env.OWNER_1 || '',
            process.env.OWNER_2 || '',
            process.env.OWNER_3 || ''
        ].filter(Boolean),
        requireAllForEmergency: true
    },

    timeLock: {
        enabled: true,
        delay: 24 * 60 * 60, // 24 hours
        emergencyDelay: 1 * 60 * 60, // 1 hour
        adminDelay: 12 * 60 * 60 // 12 hours
    },

    mevProtection: {
        enabled: true,
        commitRevealScheme: true,
        commitBlocks: 2,
        revealBlocks: 1,
        maxSlippageProtection: 50, // 0.5%
        frontrunningDetection: true,
        sandwichProtection: true
    },

    circuitBreaker: {
        enabled: true,
        maxConsecutiveFailures: 3,
        failureRateThreshold: 20, // 20%
        timeWindow: 60 * 60, // 1 hour
        autoRecovery: true,
        recoveryDelay: 30 * 60 // 30 minutes
    },

    tradingLimits: {
        maxSingleTrade: BigInt('10000000000000000000'), // 10 BNB
        maxDailyVolume: BigInt('100000000000000000000'), // 100 BNB
        maxHourlyTrades: 50,
        minProfitThreshold: BigInt('10000000000000000'), // 0.01 BNB
        maxSlippage: 100, // 1%
        maxGasPrice: BigInt(20 * 1e9), // 20 gwei
        minBlockDelay: 2
    },

    emergency: {
        pauseEnabled: true,
        emergencyPausers: [
            process.env.EMERGENCY_PAUSER_1 || '',
            process.env.EMERGENCY_PAUSER_2 || ''
        ].filter(Boolean),
        maxPauseDuration: 7 * 24 * 60 * 60, // 7 days
        autoUnpauseEnabled: false,
        emergencyWithdrawEnabled: true
    },

    accessControl: {
        roleBasedAccess: true,
        adminRole: 'ADMIN_ROLE',
        operatorRole: 'OPERATOR_ROLE',
        emergencyRole: 'EMERGENCY_ROLE',
        maxOperators: 5
    },

    monitoring: {
        realTimeAlerts: true,
        profitThresholdAlert: BigInt('1000000000000000000'), // 1 BNB
        lossThresholdAlert: BigInt('100000000000000000'), // 0.1 BNB
        gasUsageAlert: BigInt(500000), // 500k gas
        slippageAlert: 200, // 2%
        webhookUrl: process.env.DISCORD_WEBHOOK_URL,
        telegramConfig: {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || ''
        }
    },

    riskManagement: {
        maxExposurePerToken: BigInt('50000000000000000000'), // 50 BNB
        maxExposurePerDEX: BigInt('100000000000000000000'), // 100 BNB
        blacklistedTokens: [
            // Add known scam tokens
        ],
        whitelistedTokens: [
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
            '0x55d398326f99059fF775485246999027B3197955', // USDT
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
            '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'  // BTCB
        ],
        minLiquidityThreshold: BigInt('1000000000000000000000'), // 1000 BNB
        maxPriceImpact: 300 // 3%
    }
};

// Testnet Security Configuration (more relaxed for testing)
export const TESTNET_SECURITY_CONFIG: SecurityConfig = {
    ...PRODUCTION_SECURITY_CONFIG,
    
    multiSig: {
        ...PRODUCTION_SECURITY_CONFIG.multiSig,
        enabled: false // Disable for easier testing
    },

    timeLock: {
        ...PRODUCTION_SECURITY_CONFIG.timeLock,
        enabled: false,
        delay: 5 * 60, // 5 minutes
        emergencyDelay: 1 * 60, // 1 minute
        adminDelay: 2 * 60 // 2 minutes
    },

    tradingLimits: {
        ...PRODUCTION_SECURITY_CONFIG.tradingLimits,
        maxSingleTrade: BigInt('1000000000000000000'), // 1 BNB
        maxDailyVolume: BigInt('10000000000000000000'), // 10 BNB
        minProfitThreshold: BigInt('1000000000000000'), // 0.001 BNB
        maxGasPrice: BigInt(50 * 1e9) // 50 gwei for testnet
    },

    circuitBreaker: {
        ...PRODUCTION_SECURITY_CONFIG.circuitBreaker,
        maxConsecutiveFailures: 5,
        failureRateThreshold: 30,
        timeWindow: 10 * 60 // 10 minutes
    }
};

// Development Security Configuration (minimal security for local testing)
export const DEVELOPMENT_SECURITY_CONFIG: SecurityConfig = {
    ...TESTNET_SECURITY_CONFIG,
    
    mevProtection: {
        ...TESTNET_SECURITY_CONFIG.mevProtection,
        enabled: false
    },

    circuitBreaker: {
        ...TESTNET_SECURITY_CONFIG.circuitBreaker,
        enabled: false
    },

    emergency: {
        ...TESTNET_SECURITY_CONFIG.emergency,
        pauseEnabled: false
    },

    monitoring: {
        ...TESTNET_SECURITY_CONFIG.monitoring,
        realTimeAlerts: false
    }
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
        case 'production':
            return PRODUCTION_SECURITY_CONFIG;
        case 'testnet':
            return TESTNET_SECURITY_CONFIG;
        case 'development':
        default:
            return DEVELOPMENT_SECURITY_CONFIG;
    }
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): boolean {
    // Validate multi-sig configuration
    if (config.multiSig.enabled) {
        if (config.multiSig.owners.length < config.multiSig.threshold) {
            throw new Error('Multi-sig threshold cannot exceed number of owners');
        }
        if (config.multiSig.threshold < 2) {
            throw new Error('Multi-sig threshold must be at least 2 for production');
        }
    }

    // Validate trading limits
    if (config.tradingLimits.maxSingleTrade > config.tradingLimits.maxDailyVolume) {
        throw new Error('Max single trade cannot exceed max daily volume');
    }

    // Validate time-lock delays
    if (config.timeLock.enabled && config.timeLock.delay < 60) {
        throw new Error('Time-lock delay must be at least 1 minute');
    }

    // Validate circuit breaker
    if (config.circuitBreaker.enabled) {
        if (config.circuitBreaker.failureRateThreshold > 100) {
            throw new Error('Failure rate threshold cannot exceed 100%');
        }
    }

    return true;
}