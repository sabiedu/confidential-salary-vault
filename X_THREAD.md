# X (Twitter) Thread — Confidential Salary Vault · #ZamaDeveloperProgram

> **REQUIRED** by the Zama Builder Track form ("A thread or article published on X introducing your project"). Tag @zama, hashtag #ZamaDeveloperProgram. Post from the builder's account (Ubong @<handle> or Eric). Replace `[DEMO_URL]`, `[CONTRACT]`, `[REPO]` before posting.

---

**1/8**
Salaries are the most sensitive number in any company — yet today, to prove a payroll total to an auditor or investor, you reveal everyone's pay.

What if the TOTAL could be verified on-chain without exposing a single salary? 🔒

Enter: Confidential Salary Vault 🧵 #ZamaDeveloperProgram @zama_fhe

**2/8**
Built on @zama_fhe FHEVM — Fully Homomorphic Encryption on EVM.

Employee salaries live on-chain as ENCRYPTED ciphertexts. The smart contract adds, compares & computes bonuses on them WITHOUT EVER DECRYPTING a single value. 🤯

**3/8**
How it works:

💼 HR onboards employees → salary + performance stored encrypted (FHE.fromExternal + ZK proof)
➕ Contract homomorphically sums them → encrypted total payroll
🔍 "Reveal Total" → only the SUM decrypts, via FHE.makePubliclyDecryptable
👤 Each employee decrypts ONLY their own salary (per-employee ACL)

**4/8**
The killer primitive 👇

An auditor clicks "Reveal Total Payroll" → the grand total (e.g. $42,000/mo) is publicly decryptable. But every individual salary? Still fully encrypted. Zero-knowledge audit transparency.

**5/8**
Payday is computed ENTIRELY under encryption:

payout = salary + (salary × performance / 100)

That's FHE.mul → FHE.div → FHE.add — plus an overflow guard built from FHE.lt + FHE.select. The employee learns their payout; nobody else does.

**6/8**
This maps directly to the real-world confidential-finance use cases @zama keeps naming: payroll, invoicing, investor distributions.

Composable privacy isn't a feature — it's the unlock for confidential on-chain finance. 🏗️

**7/8**
🔧 Stack: Solidity + FHEVM · React + Zama SDK · deployed on Sepolia testnet
🔒 Full FHE API exercised: fromExternal, add/sub/mul/div, comparison, select, makePubliclyDecryptable, ACL
📂 Code: https://github.com/sabiedu/confidential-salary-vault
🚀 Live demo: [DEMO_URL]
📜 Contract: https://sepolia.etherscan.io/address/0xa9B609Da313d22382ba9d5dEb56cB978BDA0fe09

**8/8**
Confidential Salary Vault — prove the total. Protect the individual. Built with @zama_fhe FHEVM for the #ZamaDeveloperProgram.

We're shipping the future of private on-chain payroll. 🚀

🔗 https://github.com/sabiedu/confidential-salary-vault

---
