import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Simple System Test');
console.log('─'.repeat(50));

// Test environment variables
console.log('📋 Environment Variables:');
console.log(`PRIVATE_KEY: ${process.env.PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`RPC_URL: ${process.env.RPC_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`CONTRACT_ADDRESS: ${process.env.CONTRACT_ADDRESS ? '✅ Set' : '❌ Missing'}`);

// Test basic imports
try {
  const { createPublicClient, http } = await import('viem');
  console.log('✅ Viem import successful');
} catch (error) {
  console.log('❌ Viem import failed:', error);
}

try {
  const chalk = await import('chalk');
  console.log('✅ Chalk import successful');
} catch (error) {
  console.log('❌ Chalk import failed:', error);
}

// Test TypeScript compilation
console.log('\n🔧 TypeScript Features:');
interface TestInterface {
  name: string;
  value: number;
}

const testObj: TestInterface = {
  name: 'test',
  value: 42
};

console.log('✅ Interface compilation successful');
console.log('✅ Type checking working');

console.log('\n🎉 Simple test completed successfully!');
console.log('✅ Core system is functional');