// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint8, ebool, externalEuint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialSalaryVault
 * @author HICLAW
 * @notice A fully-homomorphic payroll vault. Employee salaries and performance
 *         scores are stored ENCRYPTED on-chain. The contract computes:
 *           - a homomorphic total payroll (sum of encrypted salaries),
 *           - a performance-weighted bonus for each employee,
 *         WITHOUT EVER DECRYPTING any individual value.
 *
 *         The defining property: an auditor or investor can reveal the TOTAL
 *         monthly payroll (`publishTotalPayroll` + public decryption) while every
 *         individual salary remains confidential — only the employee who owns a
 *         salary handle can decrypt it.
 *
 * @dev Built on Zama FHEVM. Inherits `ZamaEthereumConfig` for Sepolia/mainnet
 *      coprocessor configuration. All amounts are in the smallest token unit
 *      (e.g. 6-dec USDT micro-units). Salaries fit comfortably in euint64.
 */
contract ConfidentialSalaryVault is ZamaEthereumConfig {
    /* ------------------------------------------------------------------ */
    /*  State                                                              */
    /* ------------------------------------------------------------------ */

    address public immutable owner;

    struct Employee {
        bool active;
        euint64 salary; // encrypted base salary (token units)
        euint8 performance; // encrypted performance score 0..100 (bonus %)
        bool paid; // has claimed this payroll cycle?
    }

    mapping(address => Employee) private employees;
    address[] private roster;

    /// @dev Homomorphic sum of every active employee's salary. Stays encrypted.
    euint64 private totalPayroll;

    /// @dev Per-employee encrypted payout from the most recent claimPayday().
    ///      Enables off-chain decryption of the homomorphically-computed payout.
    mapping(address => euint64) private lastPayouts;

    /// @notice Cycle id increments on each reset so the frontend can show fresh claims.
    uint256 public cycle;

    /* ------------------------------------------------------------------ */
    /*  Events                                                             */
    /* ------------------------------------------------------------------ */

    event EmployeeOnboarded(address indexed employee, uint256 indexed cycle);
    event SalaryRevised(address indexed employee, uint256 indexed cycle);
    event EmployeeOffboarded(address indexed employee, uint256 indexed cycle);
    event PaydayClaimed(address indexed employee, uint256 indexed cycle);
    event TotalPayrollPublished(uint256 indexed cycle);
    event CycleReset(uint256 indexed newCycle);

    /* ------------------------------------------------------------------ */
    /*  Modifiers                                                          */
    /* ------------------------------------------------------------------ */

    modifier onlyOwner() {
        require(msg.sender == owner, "CSV: not owner");
        _;
    }

    modifier onlyActive() {
        require(employees[msg.sender].active, "CSV: not an active employee");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /* ------------------------------------------------------------------ */
    /*  HR / Owner operations                                              */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Onboard an employee with a CONFIDENTIAL salary + performance score.
     * @dev The owner encrypts both values off-chain (SDK `useEncrypt`) and submits
     *      the ciphertexts + ZK proofs. The contract verifies the proofs, stores
     *      the encrypted values, and folds the salary into the encrypted total.
     */
    function onboardEmployee(
        address employee,
        externalEuint64 encryptedSalary,
        bytes calldata salaryProof,
        externalEuint8 encryptedPerformance,
        bytes calldata perfProof
    ) external onlyOwner {
        require(employee != address(0), "CSV: zero employee");
        require(!employees[employee].active, "CSV: already active");

        euint64 salary = FHE.fromExternal(encryptedSalary, salaryProof);
        euint8 performance = FHE.fromExternal(encryptedPerformance, perfProof);

        // CRITICAL (FHEVM ACL): freshly-verified handles from fromExternal need
        // allowThis BEFORE any FHE operation. Without this, FHE.add reverts with
        // "SenderNotAllowed".
        FHE.allowThis(salary);
        FHE.allowThis(performance);

        employees[employee] = Employee({
            active: true,
            salary: salary,
            performance: performance,
            paid: false
        });
        roster.push(employee);

        // Fold into the homomorphic total payroll.
        totalPayroll = FHE.add(totalPayroll, salary);
        // Persist self-ACL on the accumulated total so future onboards (sub/add)
        // and the public audit reveal work across transactions.
        FHE.allowThis(totalPayroll);

        // The employee may decrypt ONLY their own salary & performance.
        FHE.allow(salary, employee);
        FHE.allow(performance, employee);

        emit EmployeeOnboarded(employee, cycle);
    }

    /**
     * @notice Revise an employee's salary + performance confidentially.
     *         The encrypted total payroll is updated by the encrypted delta.
     */
    function reviseSalary(
        address employee,
        externalEuint64 encryptedNewSalary,
        bytes calldata salaryProof,
        externalEuint8 encryptedNewPerformance,
        bytes calldata perfProof
    ) external onlyOwner {
        Employee storage e = employees[employee];
        require(e.active, "CSV: not active");

        euint64 newSalary = FHE.fromExternal(encryptedNewSalary, salaryProof);
        euint8 newPerf = FHE.fromExternal(encryptedNewPerformance, perfProof);

        // CRITICAL (FHEVM ACL): allowThis on fromExternal results before any op.
        FHE.allowThis(newSalary);
        FHE.allowThis(newPerf);

        // Homomorphic delta on the total: total = total - old + new.
        euint64 totalAfterRemove = FHE.sub(totalPayroll, e.salary);
        totalPayroll = FHE.add(totalAfterRemove, newSalary);
        FHE.allowThis(totalPayroll);

        e.salary = newSalary;
        e.performance = newPerf;

        // Re-grant ACL on the freshly-stored handles.
        FHE.allow(newSalary, employee);
        FHE.allow(newPerf, employee);

        emit SalaryRevised(employee, cycle);
    }

    /**
     * @notice Remove an employee; subtract their encrypted salary from the total.
     */
    function offboardEmployee(address employee) external onlyOwner {
        Employee storage e = employees[employee];
        require(e.active, "CSV: not active");

        totalPayroll = FHE.sub(totalPayroll, e.salary);
        FHE.allowThis(totalPayroll);
        e.active = false;

        emit EmployeeOffboarded(employee, cycle);
    }

    /**
     * @notice Mark the encrypted total payroll as PUBLICLY decryptable.
     *         Anyone can then reveal the grand total via the SDK
     *         (`useDecryptPublicValues`) — yet NO individual salary is revealed.
     *         This is the audit-transparency primitive.
     */
    function publishTotalPayroll() external onlyOwner {
        FHE.allowThis(totalPayroll);
        FHE.makePubliclyDecryptable(totalPayroll);
        emit TotalPayrollPublished(cycle);
    }

    /**
     * @notice Advance to the next payroll cycle (resets every employee's `paid`).
     */
    function nextCycle() external onlyOwner {
        unchecked {
            cycle += 1;
        }
        for (uint256 i = 0; i < roster.length; i++) {
            if (employees[roster[i]].active) {
                employees[roster[i]].paid = false;
            }
        }
        emit CycleReset(cycle);
    }

    /* ------------------------------------------------------------------ */
    /*  Employee operations                                                */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Claim this payroll cycle. The contract computes the encrypted
     *         payout = salary + bonus, where bonus = salary * performance / 100,
     *         entirely under encryption. Only the caller learns their payout.
     * @dev Demonstrates FHE.mul, FHE.div (plaintext divisor), FHE.add, plus an
     *      overflow-guarded FHE.select on an FHE.lt comparison. The resulting
     *      `payout` handle is ACL-granted to the caller for off-chain decryption.
     */
    function claimPayday() external onlyActive {
        Employee storage e = employees[msg.sender];
        require(!e.paid, "CSV: already paid this cycle");

        // bonus = salary * performance / 100  (performance is a 0..100 percentage)
        euint64 product = FHE.mul(e.salary, e.performance);
        euint64 bonus = FHE.div(product, 100);
        euint64 payout = FHE.add(e.salary, bonus);

        // Overflow guard: if payout wrapped below salary, keep the base salary.
        ebool overflow = FHE.lt(payout, e.salary);
        payout = FHE.select(overflow, e.salary, payout);

        // Persist the encrypted payout so the employee can decrypt it off-chain.
        lastPayouts[msg.sender] = payout;

        e.paid = true;

        // Grant the employee (and the contract) decryption rights on the payout.
        FHE.allowThis(payout);
        FHE.allow(payout, msg.sender);

        emit PaydayClaimed(msg.sender, cycle);
    }

    /* ------------------------------------------------------------------ */
    /*  Read-only handle getters (return encrypted handles, NOT cleartext) */
    /* ------------------------------------------------------------------ */

    /// @notice Returns the caller's own encrypted salary handle. Only they can decrypt it.
    function mySalary() external view onlyActive returns (euint64) {
        return employees[msg.sender].salary;
    }

    /// @notice Returns the caller's own encrypted performance handle.
    function myPerformance() external view onlyActive returns (euint8) {
        return employees[msg.sender].performance;
    }

    /// @notice Returns the caller's encrypted payout from their last claimPayday().
    function myLastPayout() external view onlyActive returns (euint64) {
        return lastPayouts[msg.sender];
    }

    /// @notice Returns the encrypted total-payroll handle. Decrypt publicly via SDK.
    function totalPayrollHandle() external view returns (euint64) {
        return totalPayroll;
    }

    function isEmployee(address account) external view returns (bool) {
        return employees[account].active;
    }

    function isPaid(address account) external view returns (bool) {
        return employees[account].paid;
    }

    function rosterSize() external view returns (uint256) {
        return roster.length;
    }

    function rosterAt(uint256 i) external view returns (address) {
        return roster[i];
    }
}
