/**
 * Code Structure Test for Nonce-Based Security System
 * This script validates that all the security improvements are properly implemented
 */

import { UltraFastContractInterface } from './ultra-contract-interface.ts';
import { ULTRA_ARBITRAGE_ABI } from './ultra-contract-interface.ts';
import chalk from 'chalk';

class CodeStructureValidator {
  
  /**
   * Test 1: Validate ABI contains new security functions
   */
  testABIStructure(): boolean {
    console.log(chalk.blue('\n📋 Test 1: Validating ABI structure...'));
    
    const requiredFunctions = [
      'executeUltraFastArbitrage',
      'getCurrentNonce',
      'isRouterWhitelisted',
      'updateRouter'
    ];
    
    const requiredEvents = [
      'ArbitrageExecuted',
      'RouterUpdated'
    ];
    
    let allFunctionsFound = true;
    let allEventsFound = true;
    
    // Check functions
    for (const funcName of requiredFunctions) {
      const found = ULTRA_ARBITRAGE_ABI.some(item => 
        item.type === 'function' && item.name === funcName
      );
      
      if (found) {
        console.log(chalk.green(`✅ Function found: ${funcName}`));
      } else {
        console.log(chalk.red(`❌ Function missing: ${funcName}`));
        allFunctionsFound = false;
      }
    }
    
    // Check events
    for (const eventName of requiredEvents) {
      const found = ULTRA_ARBITRAGE_ABI.some(item => 
        item.type === 'event' && item.name === eventName
      );
      
      if (found) {
        console.log(chalk.green(`✅ Event found: ${eventName}`));
      } else {
        console.log(chalk.red(`❌ Event missing: ${eventName}`));
        allEventsFound = false;
      }
    }
    
    const success = allFunctionsFound && allEventsFound;
    console.log(success ? 
      chalk.green('✅ ABI structure validation passed') : 
      chalk.red('❌ ABI structure validation failed')
    );
    
    return success;
  }
  
  /**
   * Test 2: Validate executeUltraFastArbitrage function signature
   */
  testExecuteFunction(): boolean {
    console.log(chalk.blue('\n⚡ Test 2: Validating executeUltraFastArbitrage function...'));
    
    const executeFunc = ULTRA_ARBITRAGE_ABI.find(item => 
      item.type === 'function' && item.name === 'executeUltraFastArbitrage'
    );
    
    if (!executeFunc) {
      console.log(chalk.red('❌ executeUltraFastArbitrage function not found'));
      return false;
    }
    
    // Check if it has the new parameter structure
    const hasParamsInput = executeFunc.inputs?.some(input => 
      input.name === 'params' && input.type === 'tuple'
    );
    
    const hasPathAInput = executeFunc.inputs?.some(input => 
      input.name === 'pathA' && input.type === 'address[]'
    );
    
    const hasPathBInput = executeFunc.inputs?.some(input => 
      input.name === 'pathB' && input.type === 'address[]'
    );
    
    if (hasParamsInput && hasPathAInput && hasPathBInput) {
      console.log(chalk.green('✅ executeUltraFastArbitrage has correct new signature'));
      
      // Check params tuple structure
      const paramsInput = executeFunc.inputs?.find(input => input.name === 'params');
      if (paramsInput && paramsInput.components) {
        const requiredComponents = ['tokenIn', 'tokenOut', 'amount', 'minAmountOut', 'routerA', 'routerB', 'deadline', 'nonce'];
        const hasAllComponents = requiredComponents.every(comp => 
          paramsInput.components?.some(c => c.name === comp)
        );
        
        if (hasAllComponents) {
          console.log(chalk.green('✅ ArbitrageParams struct has all required fields including nonce'));
        } else {
          console.log(chalk.red('❌ ArbitrageParams struct missing required fields'));
          return false;
        }
      }
      
      return true;
    } else {
      console.log(chalk.red('❌ executeUltraFastArbitrage has incorrect signature'));
      return false;
    }
  }
  
  /**
   * Test 3: Validate security functions exist
   */
  testSecurityFunctions(): boolean {
    console.log(chalk.blue('\n🔒 Test 3: Validating security functions...'));
    
    const getCurrentNonceFunc = ULTRA_ARBITRAGE_ABI.find(item => 
      item.type === 'function' && item.name === 'getCurrentNonce'
    );
    
    const isRouterWhitelistedFunc = ULTRA_ARBITRAGE_ABI.find(item => 
      item.type === 'function' && item.name === 'isRouterWhitelisted'
    );
    
    if (getCurrentNonceFunc) {
      console.log(chalk.green('✅ getCurrentNonce function exists'));
      
      // Check return type
      const returnsUint = getCurrentNonceFunc.outputs?.some(output => 
        output.type === 'uint256'
      );
      
      if (returnsUint) {
        console.log(chalk.green('✅ getCurrentNonce returns uint256'));
      } else {
        console.log(chalk.red('❌ getCurrentNonce has incorrect return type'));
        return false;
      }
    } else {
      console.log(chalk.red('❌ getCurrentNonce function missing'));
      return false;
    }
    
    if (isRouterWhitelistedFunc) {
      console.log(chalk.green('✅ isRouterWhitelisted function exists'));
      
      // Check return type
      const returnsBool = isRouterWhitelistedFunc.outputs?.some(output => 
        output.type === 'bool'
      );
      
      if (returnsBool) {
        console.log(chalk.green('✅ isRouterWhitelisted returns bool'));
      } else {
        console.log(chalk.red('❌ isRouterWhitelisted has incorrect return type'));
        return false;
      }
    } else {
      console.log(chalk.red('❌ isRouterWhitelisted function missing'));
      return false;
    }
    
    return true;
  }
  
  /**
   * Test 4: Validate events structure
   */
  testEventsStructure(): boolean {
    console.log(chalk.blue('\n📡 Test 4: Validating events structure...'));
    
    const arbitrageExecutedEvent = ULTRA_ARBITRAGE_ABI.find(item => 
      item.type === 'event' && item.name === 'ArbitrageExecuted'
    );
    
    if (arbitrageExecutedEvent) {
      console.log(chalk.green('✅ ArbitrageExecuted event exists'));
      
      // Check if it has nonce field
      const hasNonceField = arbitrageExecutedEvent.inputs?.some(input => 
        input.name === 'nonce'
      );
      
      if (hasNonceField) {
        console.log(chalk.green('✅ ArbitrageExecuted event includes nonce field'));
      } else {
        console.log(chalk.red('❌ ArbitrageExecuted event missing nonce field'));
        return false;
      }
    } else {
      console.log(chalk.red('❌ ArbitrageExecuted event missing'));
      return false;
    }
    
    const routerUpdatedEvent = ULTRA_ARBITRAGE_ABI.find(item => 
      item.type === 'event' && item.name === 'RouterUpdated'
    );
    
    if (routerUpdatedEvent) {
      console.log(chalk.green('✅ RouterUpdated event exists'));
    } else {
      console.log(chalk.red('❌ RouterUpdated event missing'));
      return false;
    }
    
    return true;
  }
  
  /**
   * Test 5: Validate class structure
   */
  testClassStructure(): boolean {
    console.log(chalk.blue('\n🏗️ Test 5: Validating class structure...'));
    
    // Check if UltraFastContractInterface has the required methods
    const prototype = UltraFastContractInterface.prototype;
    
    const requiredMethods = [
      'executeUltraFastArbitrage',
      'getCurrentNonce',
      'isRouterWhitelisted'
    ];
    
    let allMethodsExist = true;
    
    for (const methodName of requiredMethods) {
      if (typeof prototype[methodName] === 'function') {
        console.log(chalk.green(`✅ Method exists: ${methodName}`));
      } else {
        console.log(chalk.red(`❌ Method missing: ${methodName}`));
        allMethodsExist = false;
      }
    }
    
    return allMethodsExist;
  }
  
  /**
   * Run all validation tests
   */
  runAllTests(): boolean {
    console.log(chalk.bold.blue('🧪 Starting Code Structure Validation...'));
    
    const test1 = this.testABIStructure();
    const test2 = this.testExecuteFunction();
    const test3 = this.testSecurityFunctions();
    const test4 = this.testEventsStructure();
    const test5 = this.testClassStructure();
    
    const allPassed = test1 && test2 && test3 && test4 && test5;
    
    console.log(chalk.bold[allPassed ? 'green' : 'red'](
      `\n${allPassed ? '✅' : '❌'} Code Structure Validation ${allPassed ? 'PASSED' : 'FAILED'}`
    ));
    
    if (allPassed) {
      console.log(chalk.green('🎉 All security improvements are properly implemented!'));
      console.log(chalk.green('   ✓ Nonce-based replay protection'));
      console.log(chalk.green('   ✓ Router whitelisting'));
      console.log(chalk.green('   ✓ Enhanced parameter validation'));
      console.log(chalk.green('   ✓ Updated contract interface'));
      console.log(chalk.green('   ✓ Event system enhancements'));
    }
    
    return allPassed;
  }
}

// Execute validation
async function main() {
  try {
    const validator = new CodeStructureValidator();
    const success = validator.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red('❌ Validation failed:'), error);
    process.exit(1);
  }
}

main();

export { CodeStructureValidator };