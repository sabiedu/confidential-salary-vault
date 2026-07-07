import { Component, type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { queryClient, wagmiConfig, zamaConfig } from "./zama-config";
import {
  isConfigured,
  scanAddr,
  shortAddr,
  VAULT_ADDRESS,
} from "./config";
import { WalletButton } from "./components/WalletButton";
import { OwnerDashboard } from "./components/OwnerDashboard";
import { EmployeeView } from "./components/EmployeeView";

export default function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ZamaProvider config={zamaConfig}>
            <Shell />
          </ZamaProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

function Shell() {
  const [tab, setTab] = useState<"hr" | "emp">("hr");

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <img src="/vault.svg" alt="" />
            <div>
              <div className="brand-title">Confidential Salary Vault</div>
              <div className="brand-sub">Zama FHEVM · Sepolia</div>
            </div>
          </div>
          <div className="header-spacer" />
          <div className="header-right">
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <span className="pill">
            <span className="dot" /> Fully Homomorphic Payroll
          </span>
          <h1>
            Prove the total. <br />
            <span className="grad">Protect every salary.</span>
          </h1>
          <p className="lead">
            Employee salaries live on-chain as encrypted ciphertext. The contract
            sums bonuses and totals <em>without ever decrypting</em> a single value.
            An auditor reveals the payroll total — every individual pay stays
            private.
          </p>
          <div className="fhe-badges">
            <span>FHE.fromExternal</span>
            <span>FHE.add / mul / div</span>
            <span>FHE.lt + select</span>
            <span>makePubliclyDecryptable</span>
            <span>per-employee ACL</span>
          </div>
        </section>

        {!isConfigured && (
          <div className="banner warn" style={{ margin: "8px 0 0" }}>
            ⚠️ <code>VITE_VAULT_ADDRESS</code> not set — connect a wallet to explore,
            but contract actions need a deployed address.
          </div>
        )}

        <nav className="tabs">
          <button
            className={tab === "hr" ? "active" : ""}
            onClick={() => setTab("hr")}
          >
            💼 HR / Owner
          </button>
          <button
            className={tab === "emp" ? "active" : ""}
            onClick={() => setTab("emp")}
          >
            👤 Employee
          </button>
        </nav>

        {tab === "hr" ? <OwnerDashboard /> : <EmployeeView />}

        <div className="card wide" style={{ marginTop: 22 }}>
          <div className="between">
            <div>
              <div className="faint" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Vault contract
              </div>
              <div className="mono" style={{ fontSize: 13 }}>
                {isConfigured ? (
                  <a href={scanAddr(VAULT_ADDRESS)} target="_blank" rel="noreferrer">
                    {shortAddr(VAULT_ADDRESS)} ↗
                  </a>
                ) : (
                  "not deployed yet"
                )}
              </div>
            </div>
            <span className="tag">Sepolia · FHEVM</span>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Confidential Salary Vault — built with{" "}
        <a href="https://www.zama.ai/" target="_blank" rel="noreferrer">
          Zama FHEVM
        </a>{" "}
        for the #ZamaDeveloperProgram.
      </footer>
    </>
  );
}

/** Catches SDK initialisation failures (e.g. missing cross-origin isolation). */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    const isolated =
      typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px" }}>
        <div className="banner danger">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            ⚠️ Couldn't start the Zama FHE SDK
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            The browser relayer needs a <strong>cross-origin-isolated</strong>
            context (SharedArrayBuffer) for multi-threaded WASM. Current status:{" "}
            <code>{isolated ? "isolated ✓" : "NOT isolated ✗"}</code>.
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 13 }}>
            Run the dev server with the COOP/COEP headers configured in{" "}
            <code>vite.config.ts</code> (<code>npm run dev</code>), or deploy via the
            included <code>vercel.json</code>. Then hard-reload.
          </p>
          <details style={{ fontSize: 12 }}>
            <summary className="muted">Technical detail</summary>
            <pre className="mono" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {e.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
