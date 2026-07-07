import { ethers } from "hardhat";

/**
 * Deploy ConfidentialSalaryVault to the configured network.
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network hardhat   (local mock)
 *   npx hardhat run scripts/deploy.ts --network sepolia   (Sepolia testnet)
 *
 * For Sepolia: set SEPOLIA_RPC_URL + PRIVATE_KEY in .env
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const factory = await ethers.getContractFactory("ConfidentialSalaryVault");
  const vault = await factory.deploy();
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("✅ ConfidentialSalaryVault deployed to:", address);
  console.log("   Owner:", await vault.owner());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
