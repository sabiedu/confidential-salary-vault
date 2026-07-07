import { vaultAbi } from "./abi";

/**
 * Address of the deployed ConfidentialSalaryVault on Sepolia.
 * Set via VITE_VAULT_ADDRESS in the frontend .env (after deploy).
 *
 * Typed as `0x${string}` to satisfy wagmi/viem call signatures. The empty-string
 * (not-yet-deployed) case is guarded at runtime by `isConfigured` below.
 */
export const VAULT_ADDRESS = (import.meta.env.VITE_VAULT_ADDRESS as
  | string
  | undefined) as `0x${string}`;

export const isConfigured =
  typeof VAULT_ADDRESS === "string" && VAULT_ADDRESS.length === 42;

export const abi = vaultAbi;

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_SCAN = "https://sepolia.etherscan.io";

/** Demo token unit label (smallest unit, e.g. 6-dec USDT micro-units). */
export const UNIT_LABEL = "units";

export function shortAddr(addr?: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function scanTx(txHash: string): string {
  return `${SEPOLIA_SCAN}/tx/${txHash}`;
}

export function scanAddr(addr: string): string {
  return `${SEPOLIA_SCAN}/address/${addr}`;
}
