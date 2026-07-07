import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "ethers";
import * as hre from "hardhat";

const CONTRACT_NAME = "ConfidentialSalaryVault";

// Clean demo values (token units). Perf is a 0..100 percentage.
const SALARY_ALICE = 5000n;
const PERF_ALICE = 90n;
const SALARY_BOB = 7000n;
const PERF_BOB = 100n;
const SALARY_CAROL = 3000n;
const PERF_CAROL = 80n;
const EXPECTED_TOTAL = SALARY_ALICE + SALARY_BOB + SALARY_CAROL; // 15000

describe("ConfidentialSalaryVault", function () {
  let vault: ethers.Contract;
  let vaultAddress: string;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  before(async function () {
    [owner, alice, bob, carol] = await hre.ethers.getSigners();

    const factory = await hre.ethers.getContractFactory(CONTRACT_NAME);
    vault = await factory.connect(owner).deploy();
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();

    // Initialise the FHEVM mock coprocessor bound to this contract.
    await hre.fhevm.assertCoprocessorInitialized(vault, CONTRACT_NAME);
  });

  /**
   * Helper: the owner onboards an employee with an ENCRYPTED salary + performance.
   * Two independent encrypted inputs are produced off-chain (mock SDK) and
   * submitted with their ZK proofs; the contract never sees cleartext.
   */
  async function onboard(
    employee: HardhatEthersSigner,
    salary: bigint,
    performance: bigint,
  ) {
    const salaryInput = hre.fhevm.createEncryptedInput(vaultAddress, owner.address);
    salaryInput.add64(salary);
    const encSalary = await salaryInput.encrypt();

    const perfInput = hre.fhevm.createEncryptedInput(vaultAddress, owner.address);
    perfInput.add8(Number(performance));
    const encPerf = await perfInput.encrypt();

    const tx = await vault.connect(owner).onboardEmployee(
      employee.address,
      encSalary.handles[0],
      encSalary.inputProof,
      encPerf.handles[0],
      encPerf.inputProof,
    );
    await tx.wait();
  }

  describe("Onboarding", function () {
    it("onboards 3 employees with encrypted salaries", async function () {
      await onboard(alice, SALARY_ALICE, PERF_ALICE);
      await onboard(bob, SALARY_BOB, PERF_BOB);
      await onboard(carol, SALARY_CAROL, PERF_CAROL);

      expect(await vault.rosterSize()).to.equal(3);
      expect(await vault.isEmployee(alice.address)).to.equal(true);
      expect(await vault.isEmployee(bob.address)).to.equal(true);
      expect(await vault.isEmployee(carol.address)).to.equal(true);
    });

    it("rejects onboarding an employee twice", async function () {
      const salaryInput = hre.fhevm.createEncryptedInput(vaultAddress, owner.address);
      salaryInput.add64(1234n);
      const encSalary = await salaryInput.encrypt();
      const perfInput = hre.fhevm.createEncryptedInput(vaultAddress, owner.address);
      perfInput.add8(50);
      const encPerf = await perfInput.encrypt();

      await expect(
        vault
          .connect(owner)
          .onboardEmployee(
            alice.address,
            encSalary.handles[0],
            encSalary.inputProof,
            encPerf.handles[0],
            encPerf.inputProof,
          ),
      ).to.be.revertedWith("CSV: already active");
    });
  });

  describe("Access control", function () {
    it("rejects non-owner onboarding", async function () {
      const salaryInput = hre.fhevm.createEncryptedInput(vaultAddress, alice.address);
      salaryInput.add64(9999n);
      const encSalary = await salaryInput.encrypt();
      const perfInput = hre.fhevm.createEncryptedInput(vaultAddress, alice.address);
      perfInput.add8(50);
      const encPerf = await perfInput.encrypt();

      await expect(
        vault
          .connect(alice)
          .onboardEmployee(
            bob.address,
            encSalary.handles[0],
            encSalary.inputProof,
            encPerf.handles[0],
            encPerf.inputProof,
          ),
      ).to.be.revertedWith("CSV: not owner");
    });
  });

  describe("Per-employee decryption (ACL)", function () {
    it("lets an employee decrypt ONLY their own salary", async function () {
      const aliceSalaryHandle = await vault.connect(alice).mySalary();

      // Alice CAN decrypt her own salary handle.
      const aliceSalary = await hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceSalaryHandle,
        vaultAddress,
        alice,
      );
      expect(aliceSalary).to.equal(SALARY_ALICE);

      // Bob CANNOT decrypt Alice's salary handle (no ACL grant).
      await expect(
        hre.fhevm.userDecryptEuint(
          FhevmType.euint64,
          aliceSalaryHandle,
          vaultAddress,
          bob,
        ),
      ).to.be.rejected;
    });

    it("lets an employee decrypt their own performance", async function () {
      const alicePerfHandle = await vault.connect(alice).myPerformance();
      const alicePerf = await hre.fhevm.userDecryptEuint(
        FhevmType.euint8,
        alicePerfHandle,
        vaultAddress,
        alice,
      );
      expect(alicePerf).to.equal(PERF_ALICE);
    });
  });

  describe("Homomorphic total payroll (public audit)", function () {
    it("reveals the TOTAL payroll publicly while salaries stay encrypted", async function () {
      // Owner marks the encrypted total as publicly decryptable.
      await expect(vault.connect(owner).publishTotalPayroll())
        .to.emit(vault, "TotalPayrollPublished");

      const totalHandle = await vault.totalPayrollHandle();

      // Anyone (no signature) can reveal the SUM …
      const total = await hre.fhevm.publicDecryptEuint(
        FhevmType.euint64,
        totalHandle,
      );
      expect(total).to.equal(EXPECTED_TOTAL);

      // … but Bob STILL cannot decrypt Alice's individual salary.
      const aliceSalaryHandle = await vault.connect(alice).mySalary();
      await expect(
        hre.fhevm.userDecryptEuint(
          FhevmType.euint64,
          aliceSalaryHandle,
          vaultAddress,
          bob,
        ),
      ).to.be.rejected;
    });
  });

  describe("Claim payday (homomorphic payout)", function () {
    it("computes salary + bonus entirely under encryption", async function () {
      // payout = salary + salary * performance / 100
      // Alice: 5000 + 5000 * 90 / 100 = 5000 + 4500 = 9500
      const expectedPayout = SALARY_ALICE + (SALARY_ALICE * PERF_ALICE) / 100n;

      await expect(vault.connect(alice).claimPayday())
        .to.emit(vault, "PaydayClaimed");
      expect(await vault.isPaid(alice.address)).to.equal(true);

      const payoutHandle = await vault.connect(alice).myLastPayout();
      const payout = await hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        payoutHandle,
        vaultAddress,
        alice,
      );
      expect(payout).to.equal(expectedPayout);
    });

    it("blocks a second claim in the same cycle", async function () {
      await expect(vault.connect(alice).claimPayday()).to.be.revertedWith(
        "CSV: already paid this cycle",
      );
    });

    it("keeps one employee's payout hidden from another (ACL)", async function () {
      await vault.connect(bob).claimPayday();
      const bobPayoutHandle = await vault.connect(bob).myLastPayout();
      await expect(
        hre.fhevm.userDecryptEuint(
          FhevmType.euint64,
          bobPayoutHandle,
          vaultAddress,
          carol,
        ),
      ).to.be.rejected;
    });
  });
});
