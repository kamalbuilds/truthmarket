/**
 * EVM -> GenLayer Relay
 *
 * Polls for ResolutionRequested events from Base Sepolia BetFactoryCOFI
 * and deploys the appropriate oracle contract to GenLayer.
 *
 */

import { ethers, AbiCoder } from "ethers";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync } from "fs";
import path from "path";
import {
  getBaseSepoliaRpcUrl,
  getBetFactoryAddress,
  getGenlayerRpcUrl,
  getPrivateKey,
  getBridgeSenderAddress,
} from "../config.js";

const RESOLUTION_TYPES = ["CRYPTO", "STOCKS", "NEWS"];
const BASE_SEPOLIA_LZ_EID = 40245;

// Oracle contracts in local intelligent-oracles directory
const ORACLE_CONTRACTS: Record<number, string> = {
  0: "crypto_prediction_market.py",  // CRYPTO
  1: "stock_prediction_market.py",   // STOCKS
  2: "news_pm.py",                   // NEWS (not yet implemented)
};

const BET_FACTORY_ABI = [
  "event ResolutionRequested(address indexed betContract, address indexed creator, uint8 resolutionType, string title, string sideAName, string sideBName, bytes resolutionData, uint256 timestamp)",
];

function decodeResolutionData(data: string): [string, string] | null {
  if (!data || data === "0x") return null;
  try {
    const abiCoder = AbiCoder.defaultAbiCoder();
    const [param1, param2] = abiCoder.decode(["string", "string"], data);
    return [param1, param2];
  } catch {
    return null;
  }
}

export class EvmToGenLayerRelay {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private genLayerClient: any;
  private processedEvents: Set<string>;
  private lastBlock: number;
  private pollInterval: NodeJS.Timeout | null;

  constructor() {
    // EVM provider for Base Sepolia
    this.provider = new ethers.JsonRpcProvider(getBaseSepoliaRpcUrl());
    this.factoryContract = new ethers.Contract(
      getBetFactoryAddress(),
      BET_FACTORY_ABI,
      this.provider
    );

    // GenLayer client
    const privateKey = getPrivateKey();
    const account = createAccount(`0x${privateKey.replace(/^0x/, "")}`);
    this.genLayerClient = createClient({
      chain: {
        ...studionet,
        rpcUrls: {
          default: { http: [getGenlayerRpcUrl()] },
        },
      },
      account,
    });

    this.processedEvents = new Set<string>();
    this.lastBlock = 0;
    this.pollInterval = null;
  }

  private loadOracleCode(resolutionType: number): string {
    const filename = ORACLE_CONTRACTS[resolutionType];
    if (!filename) {
      throw new Error(`Unknown resolution type: ${resolutionType}`);
    }

    // Use environment variable or fallback to process.cwd() for Railway compatibility
    const oraclesBasePath = process.env.ORACLES_PATH || path.join(process.cwd(), "intelligent-oracles");
    const contractPath = path.join(oraclesBasePath, filename);

    console.log(`[EVM→GL] Loading oracle from: ${contractPath}`);
    return readFileSync(contractPath, "utf-8");
  }

  private async deployOracle(
    betContract: string,
    resolutionType: number,
    title: string,
    sideAName: string,
    sideBName: string,
    resolutionData: string
  ): Promise<string | null> {
    try {
      // Decode resolution data to get token/stock symbol and name
      const decoded = decodeResolutionData(resolutionData);
      if (!decoded) {
        console.error("[EVM→GL] Failed to decode resolution data");
        return null;
      }
      const [tokenSymbol, tokenName] = decoded;

      const bridgeSender = getBridgeSenderAddress();
      const targetChainEid = BASE_SEPOLIA_LZ_EID;
      const targetContract = getBetFactoryAddress();

      const args = [
        betContract, tokenSymbol, tokenName, title, sideAName, sideBName,
        bridgeSender, targetChainEid, targetContract
      ];

      console.log(`[EVM→GL] Deploying oracle...`);
      console.log(`  Contract: ${ORACLE_CONTRACTS[resolutionType]}`);
      console.log(`  Market ID: ${betContract}`);
      console.log(`  Token: ${tokenSymbol} (${tokenName})`);
      console.log(`  Title: ${title}`);
      console.log(`  Sides: "${sideAName}" vs "${sideBName}"`);
      console.log(`  Bridge: ${bridgeSender} → EID ${targetChainEid} → ${targetContract}`);

      const code = this.loadOracleCode(resolutionType);

      // Deploy to GenLayer
      const hash = await this.genLayerClient.deployContract({
        code,
        args,
        leaderOnly: false,
      });

      console.log(`[EVM→GL] Deploy TX: ${hash}`);

      // Wait for deployment
      const receipt = await this.genLayerClient.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        retries: 30,
        interval: 2000,
      });

      const oracleAddress = receipt.data?.contract_address;
      console.log(`[EVM→GL] Oracle deployed: ${oracleAddress}`);

      return oracleAddress;
    } catch (error) {
      console.error("[EVM→GL] Deploy error:", error);
      return null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();

      // On first run, start from current block (skip all historical events)
      if (this.lastBlock === 0) {
        this.lastBlock = currentBlock;
        console.log(`[EVM→GL] Starting from block ${currentBlock} (ignoring historical events)`);
        return;
      }

      // No new blocks
      if (currentBlock <= this.lastBlock) {
        return;
      }

      // Query for new events
      const filter = this.factoryContract.filters.ResolutionRequested();
      const events = await this.factoryContract.queryFilter(
        filter,
        this.lastBlock + 1,
        currentBlock
      );

      for (const event of events) {
        const eventId = `${event.transactionHash}-${event.index}`;

        if (this.processedEvents.has(eventId)) {
          continue;
        }

        const log = event as ethers.EventLog;
        const [betContract, creator, resolutionType, title, sideAName, sideBName, resolutionData, eventTimestamp] = log.args;

        // Mark as processed BEFORE deploying (deployment is slow)
        this.processedEvents.add(eventId);

        const decoded = decodeResolutionData(resolutionData);
        console.log(`\n[EVM→GL] *** ResolutionRequested ***`);
        console.log(`  Bet: ${betContract}`);
        console.log(`  Creator: ${creator}`);
        console.log(`  Type: ${RESOLUTION_TYPES[Number(resolutionType)]} (${resolutionType})`);
        console.log(`  Title: ${title}`);
        console.log(`  Sides: "${sideAName}" vs "${sideBName}"`);
        console.log(`  Data: ${decoded ? `[${decoded.join(", ")}]` : "(empty)"}`);
        console.log(`  TX: ${event.transactionHash}`);

        // Deploy oracle to GenLayer
        await this.deployOracle(
          betContract as string,
          Number(resolutionType),
          title as string,
          sideAName as string,
          sideBName as string,
          resolutionData as string
        );
      }

      this.lastBlock = currentBlock;
    } catch (error) {
      console.error("[EVM→GL] Poll error:", error);
    }
  }

  public startListening(): void {
    console.log(`[EVM→GL] Starting event polling (every 5s)...`);
    console.log(`[EVM→GL] Factory: ${getBetFactoryAddress()}`);
    console.log(`[EVM→GL] RPC: ${getBaseSepoliaRpcUrl()}`);
    console.log(`[EVM→GL] GenLayer: ${getGenlayerRpcUrl()}`);

    this.poll();

    // Poll every 5 seconds
    this.pollInterval = setInterval(() => this.poll(), 5000);

    console.log(`[EVM→GL] Polling for ResolutionRequested events\n`);
  }

  public stopListening(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log(`[EVM→GL] Stopped polling`);
  }
}
