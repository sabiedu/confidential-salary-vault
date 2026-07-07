# 🎬 Video Pitch Script — Confidential Salary Vault

> **3-minute pitch for the Zama Developer Program.**
> To be recorded by a **real person** (Ubong / Eric) — the Zama form requires a
> real-person pitch; AI-generated video/voice is **disqualified**.
>
- **Total target:** ~2:45–3:00
- **Tone:** confident, demo-forward, light on jargon, heavy on the "wow".
- **Setup before recording:** have the dApp open, a funded Sepolia wallet connected as **owner (HR)**, and 2 extra wallets imported as **employees** so you can switch. Keep MetaMask on Sepolia.
- **On-screen:** screen-recording of the live dApp (`DEMO_URL`). Cut between the speaker and the screen.

---

## SEGMENT 1 — HOOK (0:00–0:20)

**[Camera on speaker]**

> "Salaries are the most sensitive number in any company.
>
> But today, if an auditor or investor asks you to *prove* your total monthly payroll — you have to show them everyone's pay. Every salary, exposed.
>
> What if you could prove the **total** on-chain — while every single salary stays encrypted? That's what we built."

**[Title card: "Confidential Salary Vault — built on Zama FHEVM"]**

---

## SEGMENT 2 — THE PROBLEM → THE PRIMITIVE (0:20–0:45)

**[Speaker + simple graphic]**

> "This is a Fully Homomorphic Encryption problem. With **Zama FHEVM**, a smart contract can *add, multiply, and compare* numbers while they're still encrypted.
>
> So we asked: what if a payroll vault stores every salary as ciphertext — and computes the total *without ever decrypting* anything?"

---

## SEGMENT 3 — LIVE DEMO: confidential onboarding (0:45–1:30)

**[Screen: HR Dashboard]**

> "Here's the dApp. I'm logged in as HR. Watch — I onboard an employee.
>
> I enter a salary and a performance score. But before these ever touch the chain, the **browser encrypts them** with Zama's SDK. The contract only ever sees ciphertext and a zero-knowledge proof."

**[Click "🔒 Onboard (encrypted)" — show the wallet prompt, then the encrypted handle on-chain]**

> "On-chain, that's a `bytes32` ciphertext. Nobody — not even us — can read that salary."

**[Onboard 2–3 employees quickly]**

---

## SEGMENT 4 — THE KILLER FEATURE: audit reveal (1:30–2:05)

**[Screen: "Confidential total payroll" card]**

> "Now the magic. As HR, every salary I added was folded into one **encrypted running total** — homomorphically.
>
> If an auditor needs to verify our payroll, I click **Publish total**, then **Decrypt total**."

**[Click → the big number reveals, e.g. "15,000"]**

> "There's the total — fifteen thousand. Publicly verifiable, on-chain.
>
> But notice: **I still can't see any individual salary.** The total decrypted. The salaries didn't. That's zero-knowledge audit transparency."

---

## SEGMENT 5 — payday under encryption + ACL (2:05–2:40)

**[Switch wallet to an Employee]**

> "Now I'm an employee. Only *I* can see my own pay — the contract's ACL denies every other address.
>
> I grant a one-time decryption permit, and my salary and performance decrypt — just for me."

**[Show the decrypted salary/performance tiles]**

> "I hit **Claim payday**. The contract computes my payout — salary plus a performance-weighted bonus — *entirely under encryption*, then hands me the result to decrypt."

**[Click "💰 Claim payday" → payout decrypts]**

> "My colleague can't see this. The math happened on ciphertext the whole way."

---

## SEGMENT 6 — CLOSE (2:40–3:00)

**[Back to speaker]**

> "Confidential Salary Vault: prove the total, protect the individual.
>
> It exercises the **full** Zama FHE API — encrypted inputs, homomorphic arithmetic, encrypted comparisons, public decryption, and per-user ACLs. And it maps straight onto real confidential finance: payroll, invoicing, investor distributions.
>
> We're shipping the future of private on-chain payroll — built with Zama. Thank you."

**[End card: repo link + demo link + `#ZamaDeveloperProgram`]**

---

## 🎚️ Recording checklist

- [ ] Quiet room, good mic, 1080p webcam, screen at 1080p
- [ ] Sepolia wallet funded; 3 accounts ready (owner + 2 employees)
- [ ] dApp open to HR tab; roster pre-populated with 1 employee so the demo flows
- [ ] Test the full flow once end-to-end **before** hitting record (onboard → reveal → claim)
- [ ] Keep total under 3:00; the Zama form has a length expectation
- [ ] No AI voice / no AI avatar — must be a real person on camera
