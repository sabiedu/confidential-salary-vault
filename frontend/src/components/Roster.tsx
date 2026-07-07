"use client";

import { useReadContracts } from "wagmi";
import { abi, scanAddr, shortAddr, VAULT_ADDRESS } from "../config";
import { Spinner } from "./Spinner";

const MAX_ROWS = 50;

/**
 * Renders the employee roster. Two batched multicalls:
 *  1) rosterAt(i) for i in [0, size)
 *  2) isEmployee(addr) + isPaid(addr) for each resolved address
 */
export function Roster({ size, myAddress }: { size: number; myAddress?: string }) {
  const count = Math.min(size, MAX_ROWS);

  const rosterCalls = Array.from({ length: count }, (_, i) => ({
    address: VAULT_ADDRESS,
    abi,
    functionName: "rosterAt" as const,
    args: [BigInt(i)] as const,
  }));

  const rosterRead = useReadContracts({
    contracts: rosterCalls,
    query: { enabled: count > 0 },
  });

  const addresses: string[] = (rosterRead.data ?? [])
    .map((r) => r.result as string | undefined)
    .filter((a): a is string => !!a);

  const statusCalls = addresses.flatMap((a) => [
    {
      address: VAULT_ADDRESS,
      abi,
      functionName: "isEmployee" as const,
      args: [a as `0x${string}`] as const,
    },
    {
      address: VAULT_ADDRESS,
      abi,
      functionName: "isPaid" as const,
      args: [a as `0x${string}`] as const,
    },
  ]);

  const statusRead = useReadContracts({
    contracts: statusCalls,
    query: { enabled: addresses.length > 0 },
  });

  if (size === 0) {
    return <div className="empty">No employees onboarded yet.</div>;
  }
  if (rosterRead.isLoading || statusRead.isLoading) {
    return <Spinner label="Loading roster…" />;
  }
  if (rosterRead.error || statusRead.error) {
    return (
      <div className="banner danger">
        Failed to load roster:{" "}
        {String((rosterRead.error || statusRead.error)?.message ?? "error")}
      </div>
    );
  }

  const status = statusRead.data ?? [];

  return (
    <div className="roster">
      {addresses.map((addr, i) => {
        const active = status[i * 2]?.result as boolean | undefined;
        const paid = status[i * 2 + 1]?.result as boolean | undefined;
        return (
          <div className="roster-row" key={addr}>
            <span className="idx">{i + 1}</span>
            <span className="addr">
              <a href={scanAddr(addr)} target="_blank" rel="noreferrer">
                {shortAddr(addr)}
              </a>{" "}
              {addr.toLowerCase() === myAddress?.toLowerCase() && (
                <span className="you-badge">YOU</span>
              )}
            </span>
            <span className={`tag ${active === false ? "warn" : "ok"}`}>
              {active === false ? "offboarded" : "active"}
            </span>
            <span className={`tag ${paid ? "ok" : ""}`}>
              {paid ? "✓ paid" : "unpaid"}
            </span>
          </div>
        );
      })}
      {size > MAX_ROWS && (
        <div className="faint" style={{ fontSize: 12 }}>
          Showing first {MAX_ROWS} of {size}.
        </div>
      )}
    </div>
  );
}
