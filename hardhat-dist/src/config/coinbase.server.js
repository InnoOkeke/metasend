"use strict";
/**
 * Server-safe Coinbase configuration
 * Contains only constants that don't require Expo/React Native
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMASTER_API_URL = exports.USDC_DECIMALS = exports.USDC_TOKEN_ADDRESS = exports.BASE_RPC_URL = exports.BASE_CHAIN_ID = void 0;
// Base Network Constants - Using Sepolia Testnet
exports.BASE_CHAIN_ID = 84532; // Base Sepolia Testnet
exports.BASE_RPC_URL = "https://sepolia.base.org";
exports.USDC_TOKEN_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // USDC on Base Sepolia
exports.USDC_DECIMALS = 6;
// Coinbase Paymaster API
exports.PAYMASTER_API_URL = "https://api.developer.coinbase.com/rpc/v1/base-sepolia";
