/**
 * Enhanced Error Handler for Ultra-Fast Arbitrage System
 * Provides centralized error handling with retry logic and monitoring
 */

import chalk from 'chalk';
import { 
  CategorizedError, 
  ErrorClassifier, 
  ErrorCategory, 
  ErrorSeverity,
  NetworkError,
  TimeoutError,
  SimulationError,
  TransactionError,
  GasError,
  SecurityError,
  PriceError,
  ValidationError,
  ContractError,
  SystemError
} from '../types/error-types.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableCategories: ErrorCategory[];
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  retryAttempts: number;
  successfulRetries: number;
  lastErrorTime: number;
}

export class EnhancedErrorHandler {
  private metrics: ErrorMetrics;
  private retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableCategories: [
        ErrorCategory.NETWORK,
        ErrorCategory.TIMEOUT,
        ErrorCategory.GAS,
        ErrorCategory.PRICE
      ],
      ...retryConfig
    };

    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      retryAttempts: 0,
      successfulRetries: 0,
      lastErrorTime: 0
    };

    // Initialize metrics
    Object.values(ErrorCategory).forEach(category => {
      this.metrics.errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      this.metrics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * Handle error with classification and logging
   */
  handleError(error: Error, context?: string): CategorizedError {
    const categorizedError = ErrorClassifier.classifyError(error);
    this.logError(categorizedError, context);
    this.updateMetrics(categorizedError);
    return categorizedError;
  }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: string,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: CategorizedError | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.metrics.retryAttempts++;
          const delay = this.calculateDelay(attempt, config);
          console.log(chalk.yellow(`🔄 Retry attempt ${attempt}/${config.maxRetries} after ${delay}ms delay`));
          await this.sleep(delay);
        }

        const result = await fn();
        
        if (attempt > 0) {
          this.metrics.successfulRetries++;
          console.log(chalk.green(`✅ Retry successful after ${attempt} attempts`));
        }
        
        return result;

      } catch (error) {
        lastError = this.handleError(error as Error, context);
        
        // Check if error is retryable
        if (!this.isRetryable(lastError, config) || attempt === config.maxRetries) {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Log error with appropriate formatting
   */
  private logError(error: CategorizedError, context?: string): void {
    const timestamp = new Date(error.timestamp).toISOString();
    const contextStr = context ? ` [${context}]` : '';
    
    let colorFn = chalk.red;
    let icon = '❌';
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        colorFn = chalk.yellow;
        icon = '⚠️';
        break;
      case ErrorSeverity.MEDIUM:
        colorFn = chalk.orange;
        icon = '🔶';
        break;
      case ErrorSeverity.HIGH:
        colorFn = chalk.red;
        icon = '🔴';
        break;
      case ErrorSeverity.CRITICAL:
        colorFn = chalk.bgRed.white;
        icon = '🚨';
        break;
    }

    console.log(colorFn(`${icon} [${error.category.toUpperCase()}] ${error.severity.toUpperCase()}${contextStr}: ${error.message}`));
    
    if (error.metadata && Object.keys(error.metadata).length > 0) {
      console.log(chalk.gray(`   Metadata: ${JSON.stringify(error.metadata, null, 2)}`));
    }
    
    if (error.originalError && error.originalError.stack) {
      console.log(chalk.gray(`   Stack: ${error.originalError.stack}`));
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: CategorizedError): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByCategory[error.category]++;
    this.metrics.errorsBySeverity[error.severity]++;
    this.metrics.lastErrorTime = error.timestamp;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: CategorizedError, config: RetryConfig): boolean {
    return error.retryable && config.retryableCategories.includes(error.category);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      retryAttempts: 0,
      successfulRetries: 0,
      lastErrorTime: 0
    };

    Object.values(ErrorCategory).forEach(category => {
      this.metrics.errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      this.metrics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * Create specific error handlers for different contexts
   */
  static createNetworkErrorHandler(context: string) {
    return (error: Error) => {
      if (error.message.includes('timeout')) {
        throw new TimeoutError(`Network timeout in ${context}: ${error.message}`, { context });
      }
      throw new NetworkError(`Network error in ${context}: ${error.message}`, { context });
    };
  }

  static createSimulationErrorHandler(context: string) {
    return (error: Error) => {
      throw new SimulationError(`Simulation failed in ${context}: ${error.message}`, { context });
    };
  }

  static createTransactionErrorHandler(context: string) {
    return (error: Error) => {
      const severity = error.message.includes('nonce') || error.message.includes('gas') 
        ? ErrorSeverity.HIGH 
        : ErrorSeverity.MEDIUM;
      throw new TransactionError(`Transaction error in ${context}: ${error.message}`, severity, { context });
    };
  }

  static createGasErrorHandler(context: string) {
    return (error: Error) => {
      const severity = error.message.includes('out of gas') 
        ? ErrorSeverity.HIGH 
        : ErrorSeverity.MEDIUM;
      throw new GasError(`Gas error in ${context}: ${error.message}`, severity, { context });
    };
  }

  static createSecurityErrorHandler(context: string) {
    return (error: Error) => {
      throw new SecurityError(`Security error in ${context}: ${error.message}`, ErrorSeverity.HIGH, { context });
    };
  }

  static createPriceErrorHandler(context: string) {
    return (error: Error) => {
      throw new PriceError(`Price error in ${context}: ${error.message}`, { context });
    };
  }

  static createValidationErrorHandler(context: string) {
    return (error: Error) => {
      throw new ValidationError(`Validation error in ${context}: ${error.message}`, { context });
    };
  }

  static createContractErrorHandler(context: string) {
    return (error: Error) => {
      const severity = error.message.includes('revert') || error.message.includes('execution reverted')
        ? ErrorSeverity.MEDIUM
        : ErrorSeverity.HIGH;
      throw new ContractError(`Contract error in ${context}: ${error.message}`, severity, { context });
    };
  }
}

// Global error handler instance
export const globalErrorHandler = new EnhancedErrorHandler();

// Utility functions for common error handling patterns
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  retryConfig?: Partial<RetryConfig>
) => {
  return async (...args: T): Promise<R> => {
    return globalErrorHandler.executeWithRetry(() => fn(...args), context, retryConfig);
  };
};

export const handleSpecificError = (error: Error, context: string): never => {
  const categorizedError = globalErrorHandler.handleError(error, context);
  throw categorizedError;
};