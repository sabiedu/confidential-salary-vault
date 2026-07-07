"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  useDecryptPublicValues,
  useEncrypt,
} from "@zama-fhe/react-sdk";
import {
  abi,
  isConfigured,
  scanTx,
  shortAddr,
  UNIT_LABEL,
  VAULT_ADDRESS,
} from "../config";
import { Spinner } from "./Spinner";
import { Roster } from "./Roster";

type Phase = "idle" | "encrypting" | "sending" | "confirming" | "done";

export function OwnerDashboard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const encrypt = useEncrypt();
  const decryptPublic = useDecryptPublicValues();
  const { writeContractAsync } = useWriteContract();

  // --- contract reads ---
  const ownerRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "owner",
  });
  const cycleRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "cycle",
  });
  const rosterSizeRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "rosterSize",
  });
  const totalHandleRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "totalPayrollHandle",
  });

  const owner = ownerRead.data as string | undefined;
  const isOwner = !!address && !!owner && owner.toLowerCase() === address.toLowerCase();
  const cycle = (cycleRead.data as bigint | undefined) ?? 0n;
  const rosterSize = (rosterSizeRead.data as bigint | undefined) ?? 0n;
  const totalHandle = totalHandleRead.data as `0x${string}` | undefined;

  const [revealedTotal, setRevealedTotal] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- onboarding form ---
  const [empAddr, setEmpAddr] = useState("");
  const [salary, setSalary] = useState("");
  const [perf, setPerf] = useState("");

  function reset() {
    setPhase("idle");
    setBusy(null);
  }

  async function runTx(
    which: string,
    fn: () => Promise<`0x${string}`>,
    onDone?: () => void
  ) {
    setError(null);
    setBusy(which);
    setPhase("sending");
    try {
      const hash = await fn();
      setLastTx(hash);
      setPhase("confirming");
      await publicClient?.waitForTransactionReceipt({ hash });
      setPhase("done");
      onDone?.();
      // give the indexer a beat, then refresh reads
      setTimeout(() => {
        cycleRead.refetch();
        rosterSizeRead.refetch();
        totalHandleRead.refetch();
        reset();
      }, 1200);
    } catch (e) {
      setError(humanError(e));
      reset();
    }
  }

  async function onboard() {
    if (!address) return;
    if (!empAddr || !empAddr.startsWith("0x") || empAddr.length !== 42) {
      setError("Enter a valid 0x… employee address.");
      return;
    }
    const salaryN = BigInt(salary || "0");
    const perfN = Number(perf);
    if (salaryN <= 0n) {
      setError("Salary must be greater than 0.");
      return;
    }
    if (!Number.isInteger(perfN) || perfN < 0 || perfN > 100) {
      setError("Performance must be an integer 0–100.");
      return;
    }

    setError(null);
    setBusy("onboard");
    try {
      setPhase("encrypting");
      // 1) encrypt salary (euint64) + performance (euint8) off-chain
      const encSalary = await encrypt.mutateAsync({
        values: [{ value: salaryN, type: "euint64" }],
        contractAddress: VAULT_ADDRESS,
        userAddress: address,
      });
      const encPerf = await encrypt.mutateAsync({
        values: [{ value: BigInt(perfN), type: "euint8" }],
        contractAddress: VAULT_ADDRESS,
        userAddress: address,
      });

      // 2) submit on-chain with the ciphertext handles + ZK proofs
      await runTx("onboard", () =>
        writeContractAsync({
          address: VAULT_ADDRESS,
          abi,
          functionName: "onboardEmployee",
          args: [
            empAddr as `0x${string}`,
            encSalary.encryptedValues[0],
            encSalary.inputProof,
            encPerf.encryptedValues[0],
            encPerf.inputProof,
          ],
        })
      );
      if (!error) {
        setEmpAddr("");
        setSalary("");
        setPerf("");
      }
    } catch (e) {
      setError(humanError(e));
      reset();
    }
  }

  async function revealTotal() {
    await runTx("reveal", () =>
      writeContractAsync({
        address: VAULT_ADDRESS,
        abi,
        functionName: "publishTotalPayroll",
        args: [],
      })
    );
  }

  async function decryptTotal() {
    if (!totalHandle || totalHandle === ZERO_HANDLE) return;
    setBusy("decryptTotal");
    setError(null);
    try {
      const res = await decryptPublic.mutateAsync([totalHandle]);
      const val = res.clearValues?.[totalHandle];
      if (typeof val === "bigint") setRevealedTotal(val);
      else setRevealedTotal(null);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  async function nextCycle() {
    await runTx("cycle", () =>
      writeContractAsync({
        address: VAULT_ADDRESS,
        abi,
        functionName: "nextCycle",
        args: [],
      })
    );
  }

  if (!isConfigured) {
    return (
      <div className="banner warn">
        Contract address not configured. Set <code>VITE_VAULT_ADDRESS</code> in{" "}
        <code>frontend/.env</code> after deploying.
      </div>
    );
  }

  if (ownerRead.isLoading) return <Spinner label="Loading vault…" />;

  return (
    <div className="grid">
      {!isOwner && (
        <div className="banner warn wide">
          Only the vault <strong>owner</strong> (HR) can manage payroll. Connected
          wallet <code>{shortAddr(address)}</code> is not the owner (
          <code>{shortAddr(owner)}</code>). You can still browse the roster.
        </div>
      )}

      {/* Onboard */}
      <div className="card wide">
        <h2>💼 Onboard employee</h2>
        <p className="card-sub">
          Salary &amp; performance are encrypted client-side (FHE) before they ever
          touch the chain. The contract only ever sees ciphertext.
        </p>
        <div className="grid" style={{ marginTop: 4 }}>
          <div className="field">
            <label>Employee wallet address</label>
            <input
              placeholder="0x…"
              value={empAddr}
              onChange={(e) => setEmpAddr(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Base salary (smallest {UNIT_LABEL})</label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 5000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <span className="hint">Stored encrypted as euint64.</span>
          </div>
          <div className="field">
            <label>Performance score (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 90"
              value={perf}
              onChange={(e) => setPerf(e.target.value)}
            />
            <span className="hint">Bonus weight, stored encrypted as euint8.</span>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button
            className="btn primary"
            disabled={!isOwner || busy !== null}
            onClick={onboard}
          >
            {busy === "onboard" ? <Spinner /> : "🔒 Onboard (encrypted)"}
          </button>
          <PhaseTag active={busy === "onboard"} phase={phase} />
        </div>
      </div>

      {/* Reveal total payroll */}
      <div className="card accent wide">
        <h2>🔍 Confidential total payroll</h2>
        <p className="card-sub">
          The contract holds the homomorphic sum of all salaries. Click to make
          <em> only the total</em> publicly decryptable — individual salaries stay
          encrypted.
        </p>
        {revealedTotal !== null ? (
          <div className="reveal">
            <div className="num">{revealedTotal.toLocaleString()}</div>
            <div className="unit">total payroll · all salaries still private</div>
          </div>
        ) : (
          <div className="empty">
            Total is currently encrypted / not yet revealed.
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            className="btn primary"
            disabled={!isOwner || busy !== null}
            onClick={revealTotal}
          >
            {busy === "reveal" ? <Spinner /> : "🌐 Publish total"}
          </button>
          <button
            className="btn"
            disabled={!totalHandle || totalHandle === ZERO_HANDLE || busy !== null}
            onClick={decryptTotal}
          >
            {busy === "decryptTotal" ? <Spinner /> : "👁 Decrypt total"}
          </button>
          <PhaseTag active={busy === "reveal"} phase={phase} />
        </div>
        <div className="kv" style={{ marginTop: 10 }}>
          encrypted handle: {totalHandle && totalHandle !== ZERO_HANDLE ? shortAddr(totalHandle) : "—"}
        </div>
      </div>

      {/* Roster + cycle */}
      <div className="card">
        <div className="between">
          <h2>👥 Roster</h2>
          <span className="tag">{rosterSize.toString()} employees</span>
        </div>
        <p className="card-sub">Active employees &amp; paid-this-cycle status.</p>
        <Roster size={Number(rosterSize)} myAddress={address} />
      </div>

      <div className="card">
        <h2>📅 Payroll cycle</h2>
        <p className="card-sub">Resetting the cycle marks everyone unpaid again.</p>
        <div className="stat" style={{ marginBottom: 12 }}>
          <div className="label">Current cycle</div>
          <div className="value">#{cycle.toString()}</div>
        </div>
        <button
          className="btn full"
          disabled={!isOwner || busy !== null}
          onClick={nextCycle}
        >
          {busy === "cycle" ? <Spinner /> : "↻ Reset cycle (next period)"}
        </button>
        <PhaseTag active={busy === "cycle"} phase={phase} />
      </div>

      {error && <div className="banner danger wide">{error}</div>}
      {lastTx && (
        <div className="banner ok wide">
          ✓ Transaction confirmed.{" "}
          <a className="tx-link" href={scanTx(lastTx)} target="_blank" rel="noreferrer">
            View on Etherscan ↗
          </a>
        </div>
      )}
    </div>
  );
}

const ZERO_HANDLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

function PhaseTag({ active, phase }: { active: boolean; phase: Phase }) {
  if (!active) return null;
  const labels: Record<Phase, string> = {
    idle: "",
    encrypting: "encrypting (FHE)…",
    sending: "sign & broadcast…",
    confirming: "confirming…",
    done: "confirmed ✓",
  };
  return (
    <span className="tag">
      <Spinner /> {labels[phase]}
    </span>
  );
}

function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected/i.test(msg)) return "Transaction rejected in wallet.";
  return msg.split("\n")[0].slice(0, 300);
}
