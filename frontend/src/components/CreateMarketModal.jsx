import { useState } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client } from "../App";
import { MARKET_ADDRESS, MARKET_ABI } from "../lib/contracts";


const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

/**
 * Uploads description JSON to Pinata IPFS.
 * Returns the IPFS CID string, or "" if no description / upload fails.
 */
async function uploadDescriptionToIPFS(marketQuestion, description) {
  if (!description?.trim()) return "";
  if (!PINATA_JWT) {
    console.warn("VITE_PINATA_JWT not set — skipping IPFS upload");
    return "";
  }

  const payload = {
    question:    marketQuestion.trim(),
    description: description.trim(),
    createdAt:   Math.floor(Date.now() / 1000),
  };

  const body = JSON.stringify({
    pinataContent: payload,
    pinataMetadata: {
      name: `market-${Date.now()}`,
    },
  });

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${PINATA_JWT}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed: ${res.status} — ${text}`);
  }

  const data = await res.json();
  return data.IpfsHash; 
}

export default function CreateMarketModal({ onClose, onCreated }) {
  const account = useActiveAccount();
  const { mutate: sendTx, isPending } = useSendTransaction();

  const [question,    setQuestion]    = useState("");
  const [description, setDescription] = useState("");
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");
  const [uploading,   setUploading]   = useState(false);

  function validate() {
    if (!account)         { setError("Connect your wallet first"); return false; }
    if (!question.trim()) { setError("Enter a question"); return false; }
    return true;
  }

  async function handleCreate() {
    setError("");
    setSuccess("");
    if (!validate()) return;

    let descriptionCID = "";

    // Step 1: Upload description to IPFS
    if (description.trim()) {
      setUploading(true);
      try {
        descriptionCID = await uploadDescriptionToIPFS(question, description);
      } catch (e) {
        
        console.error("IPFS upload error:", e);
        setError(`IPFS upload failed — creating market without description. (${e.message.slice(0, 60)})`);
        
        setTimeout(() => setError(""), 3000);
      } finally {
        setUploading(false);
      }
    }

    // Step 2: Create market onchain with CID
    const contract = getContract({ client, chain: sepolia, address: MARKET_ADDRESS, abi: MARKET_ABI });

    let tx;
    try {
      tx = prepareContractCall({
        contract,
        method: "createMarket",
        params: [question.trim(), descriptionCID],
      });
    } catch (e) {
      setError(e.message.slice(0, 80));
      return;
    }

    sendTx(tx, {
      onSuccess: (receipt) => {
        const marketId = receipt?.logs?.[0]?.topics?.[1]
          ? parseInt(receipt.logs[0].topics[1], 16)
          : Date.now();

        setSuccess(`Market created! ✓${descriptionCID ? " · Description pinned to IPFS" : ""}`);
        setTimeout(() => { onCreated(marketId); onClose(); }, 2000);
      },
      onError: e => setError(e.message.slice(0, 80)),
    });
  }

  const isWorking = isPending || uploading;

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid var(--border2)", background: "var(--bg)",
    color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13,
    outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block", fontFamily: "var(--mono)", fontSize: 10,
    color: "var(--muted)", textTransform: "uppercase",
    letterSpacing: 1, marginBottom: 6,
  };

  function statusLabel() {
    if (uploading)  return "Uploading to IPFS…";
    if (isPending)  return "Confirm in wallet…";
    return "Create Market";
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 16, padding: 28, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        maxHeight: "90vh", overflowY: "auto",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Create Market</h2>
            <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginTop: 3 }}>
              Ask any yes/no question. Chainlink CRE + AI will settle it automatically
            </p>
          </div>
          <div
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 6, cursor: "pointer", background: "var(--bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14, flexShrink: 0 }}
          >✕</div>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Question — stored onchain */}
          <div>
            <label style={labelStyle}>Question</label>
            <textarea
              placeholder="e.g. Will ETH be above $3000 by June 2026?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = "var(--accent)"}
              onBlur={e => e.target.style.borderColor = "var(--border2)"}
            />
          </div>

          {/* Description — uploaded to IPFS, CID stored onchain */}
          <div>
            <label style={labelStyle}>
              Description
              <span style={{ marginLeft: 6, color: "#22d3a5", fontSize: 9 }}>optional · stored on IPFS</span>
            </label>
            <textarea
              placeholder="Add context, resolution criteria, sources…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontSize: 12 }}
              onFocus={e => e.target.style.borderColor = "rgba(34,211,165,0.5)"}
              onBlur={e => e.target.style.borderColor = "var(--border2)"}
            />
            {/* IPFS badge — only shown when Pinata JWT is configured */}
            {PINATA_JWT && description.trim() && (
              <div style={{
                marginTop: 6, display: "flex", alignItems: "center", gap: 5,
                fontFamily: "var(--mono)", fontSize: 9, color: "rgba(34,211,165,0.6)",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22d3a5", display: "inline-block" }} />
                Will be pinned to IPFS via Pinata · CID stored onchain
              </div>
            )}
            {!PINATA_JWT && (
              <div style={{
                marginTop: 6, fontFamily: "var(--mono)", fontSize: 9,
                color: "rgba(245,158,11,0.6)",
              }}>
                ⚠ VITE_PINATA_JWT not set — description won't be stored
              </div>
            )}
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontFamily: "var(--mono)", fontSize: 12 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(34,211,165,0.07)", border: "1px solid rgba(34,211,165,0.3)", color: "#22d3a5", fontFamily: "var(--mono)", fontSize: 12 }}>
            {success}
          </div>
        )}

        {/* Submit */}
        <div
          onClick={!isWorking ? handleCreate : undefined}
          style={{
            marginTop: 20, padding: "12px 0", textAlign: "center",
            borderRadius: 10, cursor: isWorking ? "default" : "pointer",
            background: isWorking ? "var(--border2)" : "linear-gradient(135deg, var(--accent), #22d3a5)",
            color: isWorking ? "var(--muted)" : "#000",
            fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
            opacity: isWorking ? 0.7 : 1, transition: "opacity 0.2s",
            userSelect: "none",
          }}
          onMouseEnter={e => { if (!isWorking) e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = isWorking ? "0.7" : "1"; }}
        >
          {statusLabel()}
        </div>

      </div>
    </div>
  );
}