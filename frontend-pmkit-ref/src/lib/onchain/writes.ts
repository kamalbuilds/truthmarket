// Centralized write helpers for Base chain integration.
// Replace placeholders with real contract details when ready.

import { Abi, createPublicClient, http } from 'viem';
import { writeContract, switchChain } from '@wagmi/core';
import { baseSepolia } from 'wagmi/chains';
import { wagmiConfig } from './wagmiConfig';
import BetFactoryArtifact from '../contracts/BetFactoryCOFI.json';
import { USDL_ADDRESS, FACTORY_ADDRESS, MOCK_USDL_ABI, USDL_MULTIPLIER } from '../constants';
import BetArtifact from '../contracts/BetCOFI.json';


const FACTORY_ABI = (BetFactoryArtifact as { abi: Abi }).abi as Abi;
const BET_ABI = (BetArtifact as { abi: Abi }).abi as Abi;

// Early return while ABI/address are placeholders to avoid throwing
function isStubbed() {
    const hasAbi = Array.isArray(BET_ABI) && BET_ABI.length > 0;
    return !hasAbi;
}

function isFactoryConfigured() {
    const isZero = FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000';
    const hasAbi = Array.isArray(FACTORY_ABI) && FACTORY_ABI.length > 0;
    return !isZero && hasAbi;
}


function getPublicClient() {
    return createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    });
}

export async function placeBet(betAddress: `0x${string}`, outcome: 'YES' | 'NO', amount: number): Promise<void> {
    if (isStubbed()) {
        return;
    }

    if (!isFactoryConfigured()) {
        throw new Error('Factory address/ABI not configured. Cannot place bet.');
    }

    // Ensure we're on the correct chain
    await switchChain(wagmiConfig, { chainId: baseSepolia.id });

    const amountInUnits = BigInt(Math.floor(amount * USDL_MULTIPLIER));
    await writeContract(wagmiConfig, {
        chainId: baseSepolia.id,
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'placeBet',
        args: [betAddress, outcome === 'YES', amountInUnits]
    });
}

export async function claimRewards(betAddress: `0x${string}`): Promise<void> {
    if (isStubbed()) {
        return;
    }

    // Ensure we're on the correct chain
    await switchChain(wagmiConfig, { chainId: baseSepolia.id });

    await writeContract(wagmiConfig, {
        chainId: baseSepolia.id,
        address: betAddress,
        abi: BET_ABI,
        functionName: 'claim',
        args: []
    });
}

// USDL Token Functions

export async function checkUsdlAllowance(userAddress: `0x${string}`, spenderAddress: `0x${string}`): Promise<bigint> {
    const publicClient = getPublicClient();
    const allowance = await publicClient.readContract({
        address: USDL_ADDRESS as `0x${string}`,
        abi: MOCK_USDL_ABI,
        functionName: 'allowance',
        args: [userAddress, spenderAddress]
    });
    return allowance as bigint;
}

export async function checkUsdlBalance(userAddress: `0x${string}`): Promise<bigint> {
    const publicClient = getPublicClient();
    const balance = await publicClient.readContract({
        address: USDL_ADDRESS as `0x${string}`,
        abi: MOCK_USDL_ABI,
        functionName: 'balanceOf',
        args: [userAddress]
    });
    return balance as bigint;
}

export async function approveUsdlUnlimited(spenderAddress: `0x${string}`): Promise<void> {
    // Ensure we're on the correct chain
    await switchChain(wagmiConfig, { chainId: baseSepolia.id });

    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    await writeContract(wagmiConfig, {
        chainId: baseSepolia.id,
        address: USDL_ADDRESS as `0x${string}`,
        abi: MOCK_USDL_ABI,
        functionName: 'approve',
        args: [spenderAddress, maxUint256]
    });
}

export async function dripUsdl(): Promise<void> {
    // Ensure we're on the correct chain
    await switchChain(wagmiConfig, { chainId: baseSepolia.id });

    await writeContract(wagmiConfig, {
        chainId: baseSepolia.id,
        address: USDL_ADDRESS as `0x${string}`,
        abi: MOCK_USDL_ABI,
        functionName: 'drip',
        args: []
    });
}

export async function isLegitBet(betAddress: `0x${string}`): Promise<boolean> {
    if (!isFactoryConfigured()) {
        throw new Error('Factory address/ABI not configured. Cannot validate bet.');
    }

    const publicClient = getPublicClient();
    const result = await publicClient.readContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'isLegitBet',
        args: [betAddress]
    });
    return result as boolean;
}

// User bet reading functions
export async function getUserBets(betAddress: `0x${string}`, userAddress: `0x${string}`): Promise<{ onSideA: number; onSideB: number }> {
    if (isStubbed()) {
        return { onSideA: 0, onSideB: 0 };
    }

    const publicClient = getPublicClient();
    const result = await publicClient.readContract({
        address: betAddress,
        abi: BET_ABI,
        functionName: 'getUserBets',
        args: [userAddress]
    });

    const [onSideA, onSideB] = result as [bigint, bigint];
    return {
        onSideA: Number(onSideA) / USDL_MULTIPLIER,
        onSideB: Number(onSideB) / USDL_MULTIPLIER
    };
}

export async function calculateUserWinnings(betAddress: `0x${string}`, userAddress: `0x${string}`): Promise<{ ifSideAWins: number; ifSideBWins: number }> {
    if (isStubbed()) {
        return { ifSideAWins: 0, ifSideBWins: 0 };
    }

    const publicClient = getPublicClient();
    const result = await publicClient.readContract({
        address: betAddress,
        abi: BET_ABI,
        functionName: 'calculatePotentialWinnings',
        args: [userAddress]
    });

    const [ifSideAWins, ifSideBWins] = result as [bigint, bigint];
    return {
        ifSideAWins: Number(ifSideAWins) / USDL_MULTIPLIER,
        ifSideBWins: Number(ifSideBWins) / USDL_MULTIPLIER
    };
}


