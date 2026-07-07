import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { SEPOLIA_CHAIN_ID, shortAddr } from "../config";
import { Spinner } from "./Spinner";

export function WalletButton() {
  const { address, isConnected, isReconnecting } = useAccount();
  const { connectors, connectAsync, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const onWrongChain = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  if (isReconnecting) {
    return (
      <button className="btn" disabled>
        <Spinner /> Reconnecting…
      </button>
    );
  }

  if (!isConnected) {
    return (
      <button
        className="btn primary"
        disabled={connecting}
        onClick={async () => {
          // Prefer the first injected connector (MetaMask/Rabby/etc.).
          const c = connectors[0];
          if (c) await connectAsync({ connector: c });
        }}
      >
        {connecting ? <Spinner /> : <WalletIcon />}
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="header-right">
      {onWrongChain && (
        <button
          className="btn sm"
          disabled={switching}
          onClick={() => switchChainAsync({ chainId: SEPOLIA_CHAIN_ID })}
        >
          {switching ? <Spinner /> : "⚠ Switch to Sepolia"}
        </button>
      )}
      <span className="tag" title={address}>
        <span className="dot" /> {shortAddr(address)}
      </span>
      <button className="btn ghost sm" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h2v8h-2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="16.5" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}
