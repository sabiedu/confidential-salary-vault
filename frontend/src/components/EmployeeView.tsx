"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { useDecryptValues } from "@zama-fhe/react-sdk";
import {
  abi,
  isConfigured,
  scanTx,
  shortAddr,
  UNIT_LABEL,
  VAULT_ADDRESS,
} from "../config";
import { DecryptGate } from "./DecryptGate";
import { Spinner } from "./Spinner";

const ZERO_HANDLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function EmployeeView() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const isEmployeeRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "isEmployee",
    args: [address!],
    query: { enabled: !!address },
  });
  const isPaidRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "isPaid",
    args: [address!],
    query: { enabled: !!address },
  });

  // msg.sender-scoped handles (pass account so eth_call sets `from`)
  const salaryRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "mySalary",
    account: address,
    query: { enabled: !!address },
  });
  const perfRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "myPerformance",
    account: address,
    query: { enabled: !!address },
  });
  const payoutRead = useReadContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "myLastPayout",
    account: address,
    query: { enabled: !!address },
  });

  const salaryHandle = salaryRead.data as `0x${string}` | undefined;
  const perfHandle = perfRead.data as `0x${string}` | undefined;
  const payoutHandle = payoutRead.data as `0x${string}` | undefined;

  const isEmployee = (isEmployeeRead.data as boolean | undefined) ?? false;
  const isPaid = (isPaidRead.data as boolean | undefined) ?? false;

  // Build the decrypt inputs (only non-zero handles) for the SDK query.
  const decryptInputs = useMemo(() => {
    const out: { encryptedValue: `0x${string}`; contractAddress: `0x${string}` }[] =
      [];
    if (salaryHandle && salaryHandle !== ZERO_HANDLE)
      out.push({ encryptedValue: salaryHandle, contractAddress: VAULT_ADDRESS });
    if (perfHandle && perfHandle !== ZERO_HANDLE)
      out.push({ encryptedValue: perfHandle, contractAddress: VAULT_ADDRESS });
    if (payoutHandle && payoutHandle !== ZERO_HANDLE)
      out.push({ encryptedValue: payoutHandle, contractAddress: VAULT_ADDRESS });
    return out;
  }, [salaryHandle, perfHandle, payoutHandle]);

  const decrypt = useDecryptValues(decryptInputs, {
    enabled: isEmployee && decryptInputs.length > 0,
  });

  const salaryClear = salaryHandle ? decrypt.data?.[salaryHandle] : undefined;
  const perfClear = perfHandle ? decrypt.data?.[perfHandle] : undefined;
  const payoutClear = payoutHandle ? decrypt.data?.[payoutHandle] : undefined;

  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    if (!address) return;
    setError(null);
    setBusy(true);
    try {
      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi,
        functionName: "claimPayday",
        args: [],
      });
      setLastTx(hash);
      setConfirming(true);
      await publicClient?.waitForTransactionReceipt({ hash });
      await Promise.all([isPaidRead.refetch(), payoutRead.refetch()]);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!isConfigured) {
    return (
      <div className="banner warn">
        Contract address not configured. Set <code>VITE_VAULT_ADDRESS</code> after
        deploying.
      </div>
    );
  }
  if (!address) {
    return <div className="empty">Connect your wallet to view your payroll.</div>;
  }
  if (isEmployeeRead.isLoading) return <Spinner label="Loading your record…" />;

  if (!isEmployee) {
    return (
      <div className="banner warn">
        🚫 Wallet <code>{shortAddr(address)}</code> is not registered as an employee
        in this vault. Ask HR to onboard you.
      </div>
    );
  }

  return (
    <div className="grid">
      {/* Status tiles */}
      <div className="card wide">
        <div className="between">
          <h2>👤 Your payroll</h2>
          <span className={`tag ${isPaid ? "ok" : "warn"}`}>
            {isPaid ? "✓ paid this cycle" : "awaiting claim"}
          </span>
        </div>
        <p className="card-sub">
          Only <strong>you</strong> can decrypt these — every other address is
          denied by the on-chain ACL.
        </p>

        <DecryptGate>
          {decrypt.isLoading ? (
            <Spinner label="Decrypting your confidential values…" />
          ) : decrypt.error ? (
            <div className="banner danger">
              Decryption failed: {humanError(decrypt.error)}
            </div>
          ) : (
            <div className="grid" style={{ marginTop: 4 }}>
              <div className="stat">
                <div className="label">Your base salary</div>
                <div className="value">
                  {fmt(salaryClear)} <span className="faint">{UNIT_LABEL}</span>
                </div>
              </div>
              <div className="stat">
                <div className="label">Performance score</div>
                <div className="value">{fmt(perfClear)} / 100</div>
              </div>
              <div className="stat">
                <div className="label">Last payout (salary + bonus)</div>
                <div className="value">
                  {fmt(payoutClear)} <span className="faint">{UNIT_LABEL}</span>
                </div>
              </div>
            </div>
          )}
        </DecryptGate>
      </div>

      {/* Claim payday */}
      <div className="card wide">
        <h2>💵 Claim payday</h2>
        <p className="card-sub">
          The contract computes your payout = salary + (salary × performance ÷ 100)
          <strong> entirely under encryption</strong>, then stores it for you to
          decrypt.
        </p>
        <div className="btn-row">
          <button
            className="btn success"
            disabled={busy || isPaid}
            onClick={claim}
          >
            {busy ? <Spinner /> : isPaid ? "✓ Already claimed" : "💰 Claim payday"}
          </button>
          {busy && (
            <span className="tag">
              <Spinner /> {confirming ? "confirming…" : "sign & broadcast…"}
            </span>
          )}
        </div>
        {error && <div className="banner danger" style={{ marginTop: 10 }}>{error}</div>}
        {lastTx && (
          <div className="banner ok" style={{ marginTop: 10 }}>
            ✓ Payday claimed.{" "}
            <a className="tx-link" href={scanTx(lastTx)} target="_blank" rel="noreferrer">
              View on Etherscan ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (typeof v === "bigint") return v.toLocaleString();
  return "—";
}

function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected/i.test(msg)) return "Transaction rejected in wallet.";
  return msg.split("\n")[0].slice(0, 300);
}
