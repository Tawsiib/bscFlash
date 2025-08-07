import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-verify";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      viaIR: true,
      metadata: {
        bytecodeHash: "none"
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      forking: process.env.BSC_RPC_URL ? {
        url: process.env.BSC_RPC_URL,
        blockNumber: undefined
      } : undefined,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20,
        accountsBalance: "10000000000000000000000"
      },
      gas: "auto",
      gasPrice: "auto",
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      loggingEnabled: false
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.2,
      timeout: 60000,
      httpHeaders: {}
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.2,
      timeout: 60000,
      httpHeaders: {}
    }
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 5,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "BNB",
    gasPriceApi: "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice",
    showTimeSpent: true,
    showMethodSig: true,
    maxMethodDiff: 10,
    excludeContracts: ["Mock", "Test"],
    src: "./contracts",
    outputFile: "./gas-report.txt",
    noColors: false,
    rstTitle: "Gas Usage Report",
    rstFile: "./gas-report.rst"
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: ["FlashLoan", "Ultra"],
    except: ["Mock", "Test"]
  },
  mocha: {
    timeout: 120000,
    bail: false,
    allowUncaught: false,
    reporter: "spec",
    slow: 10000,
    grep: undefined,
    invert: false
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    discriminateTypes: true,
    tsNocheck: false
  }
};

export default config;