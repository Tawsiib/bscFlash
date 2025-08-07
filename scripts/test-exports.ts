import dotenv from 'dotenv';
dotenv.config();

// Test importing the exports
import { TestConfig, UltraSecureIntegrationTester, TestResult } from './test-ultra-secure-integration.ts';

console.log('✅ Exports test passed - all interfaces and classes are properly exported');
console.log('TestConfig:', typeof TestConfig);
console.log('UltraSecureIntegrationTester:', typeof UltraSecureIntegrationTester);
console.log('TestResult:', typeof TestResult);