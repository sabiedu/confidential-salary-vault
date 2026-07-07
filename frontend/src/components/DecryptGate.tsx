"use client";

import { type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useGrantPermit, useHasPermit } from "@zama-fhe/react-sdk";
import { VAULT_ADDRESS } from "../config";
import { Spinner } from "./Spinner";

/**
 * Gate that ensures the connected wallet has granted the Zama decryption
 * "permit" for the vault contract before attempting any user decryption.
 *
 * Pattern (verified against @zama-fhe/react-sdk 3.2.0):
 *   - useHasPermit({ contractAddresses }) -> boolean
 *   - useGrantPermit() -> mutation mutateAsync(contractAddresses)
 *
 * Without a valid permit, useDecryptValues returns nothing (ACL denies it).
 */
export function DecryptGate({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const hasPermit = useHasPermit({
    contractAddresses: [VAULT_ADDRESS],
  });
  const grantPermit = useGrantPermit();

  const loading = hasPermit.isLoading || hasPermit.isFetching;
  const permitted = hasPermit.data === true;

  if (loading) {
    return (
      <div className="banner">
        <Spinner label="Checking decryption permit…" />
      </div>
    );
  }

  if (!permitted) {
    return (
      <div className="banner warn">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          🔑 Decryption permit required
        </div>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          To decrypt your confidential values, grant a one-time permit that lets
          the Zama decryption relayer act on your behalf. This is an off-chain
          EIP-712 signature — no gas, revocable anytime.
        </p>
        <button
          className="btn primary"
          disabled={grantPermit.isPending || !address}
          onClick={async () => {
            await grantPermit.mutateAsync([VAULT_ADDRESS]);
          }}
        >
          {grantPermit.isPending ? <Spinner /> : "🔑 Grant decryption permit"}
        </button>
        {grantPermit.isError && (
          <div className="banner danger" style={{ marginTop: 10 }}>
            Permit failed: {(grantPermit.error as Error)?.message ?? "unknown error"}
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
