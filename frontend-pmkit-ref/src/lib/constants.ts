// Shared constants for the application
import { Abi } from 'viem';

// Contract addresses on Base Sepolia
export const USDL_ADDRESS = '0xeA2d0cb43E1a8462C4958657Dd13f300A73574f7' as const;
export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_BET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';

// Bridge service URL for automated resolution
export const BRIDGE_SERVICE_URL = process.env.NEXT_PUBLIC_BRIDGE_SERVICE_URL || 'http://localhost:3001';

// Standard ERC20 ABI (minimal - only functions we need)
export const ERC20_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address', internalType: 'address' },
            { name: 'spender', type: 'address', internalType: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
    }
] as const satisfies Abi;

// USDL token configuration
export const USDL_DECIMALS = 6;
export const USDL_MULTIPLIER = 1_000_000; // 10^6 for 6 decimals

// MockUSDL ABI (includes drip function)
export const MOCK_USDL_ABI = [
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
    },
    {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address', internalType: 'address' },
            { name: 'amount', type: 'uint256', internalType: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
    },
    {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address', internalType: 'address' },
            { name: 'spender', type: 'address', internalType: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
    },
    {
        type: 'function',
        name: 'drip',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: []
    },
    {
        type: 'function',
        name: 'decimals',
        stateMutability: 'pure',
        inputs: [],
        outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }]
    }
] as const satisfies Abi;

