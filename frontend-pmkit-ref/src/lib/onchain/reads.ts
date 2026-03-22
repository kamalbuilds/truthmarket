// Centralized read helpers for Base chain integration.
// Factory contract: status-based address lists.
// Market contract: per-bet metadata and totals.

import { Abi, decodeAbiParameters } from 'viem';
import { readContract } from 'wagmi/actions';
import { baseSepolia } from 'wagmi/chains';
import { wagmiConfig } from './wagmiConfig';
import type { MarketData, MarketState, MarketOutcome } from '../../data/markets';
import BetFactoryArtifact from '../../lib/contracts/BetFactoryCOFI.json';
import BetArtifact from '../../lib/contracts/BetCOFI.json';

const FACTORY_ADDRESS =
    process.env.NEXT_PUBLIC_BET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';
const FACTORY_ABI = BetFactoryArtifact.abi as Abi;
const BET_ABI = BetArtifact.abi as Abi;

function isFactoryStubbed() {
    const isZero = FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000';
    const hasAbi = Array.isArray(FACTORY_ABI) && FACTORY_ABI.length > 0;
    const shouldStub = isZero || !hasAbi;
    if (shouldStub) {
        console.error('[reads] Factory not configured', {
            FACTORY_ADDRESS,
            hasAbi
        });
    }
    return shouldStub;
}

function isBetStubbed() {
    const hasAbi = Array.isArray(BET_ABI) && BET_ABI.length > 0;
    const shouldStub = !hasAbi;
    if (shouldStub) {
        console.error('[reads] Bet ABI not configured', { hasAbi });
    }
    return shouldStub;
}

const StatusMap: Record<number, MarketState> = {
    0: 'ACTIVE',
    1: 'RESOLVING',
    2: 'RESOLVED',
    3: 'UNDETERMINED'
};

function parseStatus(code: number): MarketState {
    return StatusMap[code] ?? 'UNDETERMINED';
}

function computeProb(totalA: number, totalB: number) {
    const vol = totalA + totalB;
    if (vol === 0) return { probYes: 0.5, probNo: 0.5, volume: 0 };
    const probYes = totalA / vol;
    // Convert volume from wei (6 decimals for USDL) to standard units
    const volumeInUsdl = vol / 1e6;
    return { probYes, probNo: 1 - probYes, volume: volumeInUsdl };
}

// Fetch bet addresses for a given status from factory
export async function fetchBetAddressesByStatus(status: MarketState): Promise<`0x${string}`[]> {
    if (isFactoryStubbed()) {
        console.warn('Factory not configured, returning empty list');
        return [];
    }

    try {
        const raw = await readContract(wagmiConfig, {
            chainId: baseSepolia.id,
            address: FACTORY_ADDRESS as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: 'getBetsByStatus',
            args: [Number(Object.entries(StatusMap).find(([, v]) => v === status)?.[0] ?? 0)]
        });

        return raw as `0x${string}`[];
    } catch (error) {
        console.error(`Error fetching bets for status ${status}:`, error);
        return [];
    }
}

// Fetch a single market info from its contract
async function fetchMarketInfo(betAddress: `0x${string}`): Promise<MarketData> {
    if (isBetStubbed()) {
        throw new Error("Bet ABI not configured");
    }

    const [info, statusCode, resolutionTypeCode, resolutionDataBytes] = await Promise.all([
        readContract(wagmiConfig, {
            chainId: baseSepolia.id,
            address: betAddress,
            abi: BET_ABI,
            functionName: "getInfo"
        }),
        readContract(wagmiConfig, {
            chainId: baseSepolia.id,
            address: betAddress,
            abi: BET_ABI,
            functionName: "status"
        }),
        readContract(wagmiConfig, {
            chainId: baseSepolia.id,
            address: betAddress,
            abi: BET_ABI,
            functionName: "resolutionType"
        }),
        readContract(wagmiConfig, {
            chainId: baseSepolia.id,
            address: betAddress,
            abi: BET_ABI,
            functionName: "resolutionData"
        })
    ]);

    const [
        _creator,
        _title,
        _resolutionCriteria,
        _sideAName,
        _sideBName,
        _creationDate,
        _endDate,
        _isResolved,
        _isSideAWinner,
        _totalSideA,
        _totalSideB,
        _resolvedPrice,
        _winnerValue
    ] = info as unknown as [
        string,
        string,
        string,
        string,
        string,
        bigint,
        bigint,
        boolean,
        boolean,
        bigint,
        bigint,
        bigint,
        string
    ];

    const resolutionTypeNum = Number(resolutionTypeCode ?? 0);
    let decodedSymbol = "";
    let decodedName = "";
    const hasContent = typeof resolutionDataBytes === "string" && resolutionDataBytes.length > 2;
    if (hasContent) {
        try {
            const [sym, nam] = decodeAbiParameters(
                [{ type: "string" }, { type: "string" }],
                resolutionDataBytes as `0x`
            ) as [string, string];
            decodedSymbol = sym || "";
            decodedName = nam || "";
        } catch (err) {
            // ignore decode errors
        }
    }

    const totals = computeProb(Number(_totalSideA), Number(_totalSideB));
    const status = parseStatus(Number(statusCode));
    let resolvedOutcome: MarketOutcome | undefined = undefined;
    let finalPrice: number | undefined = undefined;

    if (status === "RESOLVED") {
        resolvedOutcome = _winnerValue;
        // Convert resolvedPrice from contract (divide by 100 to get proper decimal format)
        finalPrice = Number(_resolvedPrice) / 100;
    }
    if (status === "UNDETERMINED") {
        resolvedOutcome = "INVALID";
        // For undetermined markets, we might still have a resolved price
        if (_resolvedPrice && Number(_resolvedPrice) > 0) {
            finalPrice = Number(_resolvedPrice) / 100;
        }
    }

    const category = resolutionTypeNum === 1 ? "STOCKS" : "CRYPTO";
    const mType = category === "STOCKS" ? "stock" : "crypto";
    const identifier = category === "STOCKS"
        ? decodedSymbol
        : (decodedName || decodedSymbol);

    return {
        id: betAddress,
        contractId: betAddress,
        title: _title,
        ticker: decodedSymbol,
        description: _resolutionCriteria,
        sideAName: _sideAName,
        sideBName: _sideBName,
        type: mType,
        category,
        identifier,
        deadline: Number(_endDate),
        deadlineDate: new Date(Number(_endDate) * 1000).toISOString(),
        resolutionSource: "",
        resolutionRule: "",
        liquidity: 0,
        volume: totals.volume,
        state: status,
        resolvedOutcome,
        deadlinePrice: finalPrice,
        priceSymbol: '$',
        probYes: totals.probYes,
        probNo: totals.probNo,
        percentChange: 0,
        statsLoading: false
    };
}

// Fetch markets by status (factory -> addresses -> per-bet info)
export async function fetchMarketsByStatus(status: MarketState): Promise<MarketData[]> {
    const addresses = await fetchBetAddressesByStatus(status);
    const markets = await Promise.all(
        addresses.map(async (addr, idx) => {
            const m = await fetchMarketInfo(addr);
            // ensure stable, non-zero id for UI selection within this status list
            return { ...m, id: String(idx + 1) };
        })
    );
    return markets;
}

// Combined fetch for UI needs across statuses
export async function fetchAllMarkets(statuses: MarketState[] = ['ACTIVE', 'RESOLVING', 'RESOLVED', 'UNDETERMINED']) {
    const results = await Promise.all(statuses.map((s) => fetchMarketsByStatus(s)));
    return results.flat();
}
