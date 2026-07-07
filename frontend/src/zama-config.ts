import { http, createConfig as createWagmiConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient } from "@tanstack/react-query";
import { sepolia as fheSepolia } from "@zama-fhe/sdk/chains";
import { web } from "@zama-fhe/sdk/web";
import {
  createConfig as createZamaConfig,
} from "@zama-fhe/react-sdk/wagmi";

/**
 * wagmi config — wallet connection + JSON-RPC reads/writes on Sepolia.
 * Uses the `injected` connector so MetaMask / Rabby / Brave / any EIP-1193
 * wallet works without a WalletConnect project id.
 */
export const wagmiConfig = createWagmiConfig({
  chains: [sepolia],
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  transports: {
    [sepolia.id]: http(),
  },
});

/**
 * Zama FHE SDK config. The browser relayer (`web()`) spins up a Web Worker
 * that loads the TFHE WASM — this requires a cross-origin-isolated context
 * (COOP + COEP headers), configured in vite.config.ts + vercel.json.
 */
export const zamaConfig = createZamaConfig({
  chains: [fheSepolia],
  relayers: {
    [fheSepolia.id]: web(),
  },
  wagmiConfig,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
