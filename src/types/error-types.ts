/**
 * Enhanced Error Types for Ultra-Fast Arbitrage System
 * Provides specific error categorization for better error handling
 */

export enum ErrorCategory {
  NETWORK = 'network',
  SIMULATION = 'simulation', 
  TRANSACTION = 'transaction',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  GAS = 'gas',
  SECURITY = 'security',
  PRICE = 'price',
  MEMPOOL = 'mempool',
  CONTRACT = 'contract',
  SYSTEM = 'system'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class CategorizedError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly timestamp: number;
  public readonly metadata: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    context: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'CategorizedError';
    this.category = context.category;
    this.severity = context.severity;
    this.retryable = context.retryable;
    this.timestamp = context.timestamp;
    this.metadata = context.metadata || {};
    this.originalError = originalError;
  }
}

// Network-related errors
export class NetworkError extends CategorizedError {
  constructor(message: string, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Simulation-related errors
export class SimulationError extends CategorizedError {
  constructor(message: string, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.SIMULATION,
      severity: ErrorSeverity.LOW,
      retryable: false,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Transaction-related errors
export class TransactionError extends CategorizedError {
  constructor(message: string, severity: ErrorSeverity = ErrorSeverity.MEDIUM, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.TRANSACTION,
      severity,
      retryable: severity === ErrorSeverity.LOW || severity === ErrorSeverity.MEDIUM,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Timeout-related errors
export class TimeoutError extends CategorizedError {
  constructor(message: string, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Gas-related errors
export class GasError extends CategorizedError {
  constructor(message: string, severity: ErrorSeverity = ErrorSeverity.MEDIUM, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.GAS,
      severity,
      retryable: true,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Security-related errors
export class SecurityError extends CategorizedError {
  constructor(message: string, severity: ErrorSeverity = ErrorSeverity.HIGH, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.SECURITY,
      severity,
      retryable: false,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Price-related errors
export class PriceError extends CategorizedError {
  constructor(message: string, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.PRICE,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Validation-related errors
export class ValidationError extends CategorizedError {
  constructor(message: string, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      retryable: false,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// Contract-related errors
export class ContractError extends CategorizedError {
  constructor(message: string, severity: ErrorSeverity = ErrorSeverity.HIGH, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.CONTRACT,
      severity,
      retryable: severity !== ErrorSeverity.CRITICAL,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

// System-related errors
export class SystemError extends CategorizedError {
  constructor(message: string, severity: ErrorSeverity = ErrorSeverity.HIGH, metadata?: Record<string, any>, originalError?: Error) {
    super(message, {
      category: ErrorCategory.SYSTEM,
      severity,
      retryable: severity !== ErrorSeverity.CRITICAL,
      timestamp: Date.now(),
      metadata
    }, originalError);
  }
}

/**
 * Error classifier utility
 */
export class ErrorClassifier {
  static classifyError(error: Error): CategorizedError {
    const message = error.message.toLowerCase();
    const timestamp = Date.now();

    // Network errors
    if (message.includes('network') || message.includes('connection') || 
        message.includes('timeout') || message.includes('econnreset') ||
        message.includes('enotfound') || message.includes('etimedout')) {
      if (message.includes('timeout')) {
        return new TimeoutError(error.message, { originalMessage: message }, error);
      }
      return new NetworkError(error.message, { originalMessage: message }, error);
    }

    // Gas errors
    if (message.includes('gas') || message.includes('out of gas') ||
        message.includes('gas limit') || message.includes('gas price')) {
      const severity = message.includes('out of gas') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      return new GasError(error.message, severity, { originalMessage: message }, error);
    }

    // Transaction errors
    if (message.includes('transaction') || message.includes('nonce') ||
        message.includes('replacement') || message.includes('underpriced')) {
      const severity = message.includes('nonce') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      return new TransactionError(error.message, severity, { originalMessage: message }, error);
    }

    // Simulation errors
    if (message.includes('simulation') || message.includes('revert') ||
        message.includes('execution reverted') || message.includes('call exception')) {
      return new SimulationError(error.message, { originalMessage: message }, error);
    }

    // Security errors
    if (message.includes('unauthorized') || message.includes('access denied') ||
        message.includes('permission') || message.includes('security')) {
      return new SecurityError(error.message, ErrorSeverity.HIGH, { originalMessage: message }, error);
    }

    // Price errors
    if (message.includes('price') || message.includes('oracle') ||
        message.includes('slippage') || message.includes('liquidity')) {
      return new PriceError(error.message, { originalMessage: message }, error);
    }

    // Contract errors
    if (message.includes('contract') || message.includes('abi') ||
        message.includes('function') || message.includes('method')) {
      return new ContractError(error.message, ErrorSeverity.HIGH, { originalMessage: message }, error);
    }

    // Default to system error
    return new SystemError(error.message, ErrorSeverity.MEDIUM, { originalMessage: message }, error);
  }

  static isRetryable(error: Error | CategorizedError): boolean {
    if (error instanceof CategorizedError) {
      return error.retryable;
    }
    
    const classified = this.classifyError(error);
    return classified.retryable;
  }

  static getSeverity(error: Error | CategorizedError): ErrorSeverity {
    if (error instanceof CategorizedError) {
      return error.severity;
    }
    
    const classified = this.classifyError(error);
    return classified.severity;
  }

  static getCategory(error: Error | CategorizedError): ErrorCategory {
    if (error instanceof CategorizedError) {
      return error.category;
    }
    
    const classified = this.classifyError(error);
    return classified.category;
  }
}