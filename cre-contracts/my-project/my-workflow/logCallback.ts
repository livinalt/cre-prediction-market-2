import {
  cre,
  type Runtime,
  type EVMLog,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem";
import { askGemini } from "./gemini";

type Config = {
  geminiModel: string;
  evms: Array<{
    marketAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

interface Market {
  creator: string;
  createdAt: bigint;
  settledAt: bigint;
  settled: boolean;
  confidence: number;
  outcome: number;
  totalYesPool: bigint;
  totalNoPool: bigint;
  question: string;
}

interface GeminiResult {
  result: "YES" | "NO";
  confidence: number;
}

const EVENT_ABI = parseAbi([
  "event SettlementRequested(uint256 indexed marketId, string question)",
]);

const GET_MARKET_ABI = [
  {
    name: "getMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator",      type: "address"  },
          { name: "createdAt",    type: "uint48"   },
          { name: "settledAt",    type: "uint48"   },
          { name: "settled",      type: "bool"     },
          { name: "confidence",   type: "uint16"   },
          { name: "outcome",      type: "uint8"    },
          { name: "totalYesPool", type: "uint256"  },
          { name: "totalNoPool",  type: "uint256"  },
          { name: "question",     type: "string"   },
        ],
      },
    ],
  },
] as const;

// ── FIX 1: param order must exactly match _settleMarket's abi.decode call:
//   abi.decode(report, (uint256, Prediction, uint16))
//   Prediction is uint8, so order is: marketId (uint256), outcome (uint8), confidence (uint16)
const SETTLEMENT_PARAMS = parseAbiParameters("uint256 marketId, uint8 outcome, uint16 confidence");

export function onLogTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Log Trigger - Settle Market");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // ── Step 1: Decode the SettlementRequested event ──────────────
    const topics = log.topics.map((t: Uint8Array) => bytesToHex(t)) as [
      `0x${string}`,
      ...`0x${string}`[]
    ];
    const data       = bytesToHex(log.data);
    const decodedLog = decodeEventLog({ abi: EVENT_ABI, data, topics });
    const marketId   = decodedLog.args.marketId as bigint;
    const question   = decodedLog.args.question as string;

    runtime.log(`[Step 1] Market #${marketId}: "${question}"`);

    // ── Step 2: Read market state from contract ───────────────────
    const evmConfig = runtime.config.evms[0];
    const network   = getNetwork({
      chainFamily:      "evm",
      chainSelectorName: evmConfig.chainSelectorName,
      isTestnet:        true,
    });

    if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

    const evmClient  = new cre.capabilities.EVMClient(network.chainSelector.selector);
    const callData   = encodeFunctionData({
      abi:          GET_MARKET_ABI,
      functionName: "getMarket",
      args:         [marketId],
    });

    const readResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to:   evmConfig.marketAddress as `0x${string}`,
        data: callData,
      }),
    }).result();

    const market = decodeFunctionResult({
      abi:          GET_MARKET_ABI,
      functionName: "getMarket",
      data:         bytesToHex(readResult.data),
    }) as unknown as Market;

    runtime.log(`[Step 2] Settled: ${market.settled} | Yes: ${market.totalYesPool} | No: ${market.totalNoPool}`);

    // ── FIX 2: Guard against already-settled — prevents duplicate settlement tx ──
    if (market.settled) {
      runtime.log("[Step 2] Already settled — skipping to avoid MarketAlreadySettled revert.");
      return "Market already settled";
    }

    // ── Step 3: Query Gemini AI ───────────────────────────────────
    runtime.log("[Step 3] Querying Gemini AI...");
    const geminiResult = askGemini(runtime, question);

    // ── FIX 3: Robust JSON extraction ────────────────────────────
    // Gemini with google_search grounding sometimes wraps the JSON in
    // markdown fences or prefixes it with prose. Strip everything around it.
    const rawResponse = geminiResult.geminiResponse
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Match the innermost complete JSON object with "result" and "confidence"
    let jsonMatch = rawResponse.match(/\{[^{}]*"result"\s*:\s*"(YES|NO)"[^{}]*"confidence"\s*:\s*\d+[^{}]*\}/);
    if (!jsonMatch) {
      // Fallback: try any JSON object
      const fallback = rawResponse.match(/\{[\s\S]*?"result"[\s\S]*?"confidence"[\s\S]*?\}/);
      if (!fallback) throw new Error(`No valid JSON in AI response: ${rawResponse.slice(0, 200)}`);
      jsonMatch = fallback; // reassignment handled below
    }

    let parsed: GeminiResult;
    try {
      parsed = JSON.parse(jsonMatch[0]) as GeminiResult;
    } catch {
      throw new Error(`JSON parse failed on: ${jsonMatch[0]}`);
    }

    if (!["YES", "NO"].includes(parsed.result)) {
      throw new Error(`AI returned invalid result "${parsed.result}" — cannot settle`);
    }

    // ── FIX 4: Confidence is 0–10000 (basis points from Gemini).
    //   Contract stores as uint16 — max 65535 — so 10000 fits fine.
    //   Clamp to [0, 10000] just in case Gemini goes over.
    const confidenceRaw = Math.max(0, Math.min(10000, Math.round(parsed.confidence)));

    runtime.log(`[Step 3] AI says: ${parsed.result} (confidence: ${confidenceRaw / 100}%)`);

    const outcomeValue = parsed.result === "YES" ? 0 : 1;

    // ── Step 4: Encode and write settlement report ────────────────
    runtime.log("[Step 4] Encoding settlement report...");

    const settlementData = encodeAbiParameters(SETTLEMENT_PARAMS, [
      marketId,
      outcomeValue,
      confidenceRaw,
    ]);

    // ── 0x01 prefix routes _processReport() to _settleMarket() branch ──
    const reportData = ("0x01" + settlementData.slice(2)) as `0x${string}`;

    runtime.log(`[Step 4] Report bytes: ${reportData.slice(0, 40)}… (${reportData.length / 2 - 1} bytes)`);
    runtime.log(`[Step 4] Outcome: ${outcomeValue} (${parsed.result}), Confidence: ${confidenceRaw}`);

    const reportResponse = runtime.report({
      encodedPayload: hexToBase64(reportData),
      encoderName:    "evm",
      signingAlgo:    "ecdsa",
      hashingAlgo:    "keccak256",
    }).result();

    runtime.log("[Step 4] Writing to chain...");
    const writeResult = evmClient.writeReport(runtime, {
      receiver:  evmConfig.marketAddress as `0x${string}`,
      report:    reportResponse,
      gasConfig: { gasLimit: evmConfig.gasLimit },
    }).result();

    if (writeResult.txStatus === TxStatus.SUCCESS) {
      const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
      runtime.log(`[Step 4] ✓ Settled: ${txHash}`);
      runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return `Settled: ${txHash}`;
    }

    throw new Error(`Transaction failed with status: ${writeResult.txStatus}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] ${msg}`);
    throw err;
  }
}