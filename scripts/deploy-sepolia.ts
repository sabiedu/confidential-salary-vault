/**
 * Deploy ConfidentialSalaryVault to Sepolia.
 * Uses plain ethers.js (bypasses the FHEVM hardhat plugin which has network detection issues).
 *
 * Usage: npx tsx scripts/deploy-sepolia.ts
 *   or:  node --import tsx scripts/deploy-sepolia.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

  if (!PRIVATE_KEY) {
    throw new Error("Missing PRIVATE_KEY in .env");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();
  console.log("Deploying with account:", wallet.address);
  console.log("Network chainId:", network.chainId.toString());
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Load compiled artifacts
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "ConfidentialSalaryVault.sol", "ConfidentialSalaryVault.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Run 'npx hardhat compile' first.`);
  }

  const artifactJson = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifactJson.abi;
  const bytecode: string = artifactJson.bytecode;

  console.log(`\nDeploying ConfidentialSalaryVault...`);
  console.log(`Bytecode size: ${(bytecode.length / 2 / 1024).toFixed(1)} KB`);

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const owner = await contract.owner();

  console.log(`\n✅ ConfidentialSalaryVault deployed to: ${address}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Tx: ${contract.deploymentTransaction()?.hash}`);
  console.log(`   Etherscan: https://sepolia.etherscan.io/address/${address}`);

  // Save deployment info
  const deployInfo = {
    contract: address,
    network: "sepolia",
    chainId: network.chainId.toString(),
    deployer: wallet.address,
    txHash: contract.deploymentTransaction()?.hash,
    etherscan: `https://sepolia.etherscan.io/address/${address}`,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(process.cwd(), "deployed-address.json"),
    JSON.stringify(deployInfo, null, 2)
  );
  fs.writeFileSync(
    path.join(process.cwd(), "deployed-address.txt"),
    JSON.stringify(deployInfo, null, 2)
  );
  console.log(`\nAddress saved to deployed-address.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
