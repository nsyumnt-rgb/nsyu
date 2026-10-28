"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordEmployeeLedgerEntry = recordEmployeeLedgerEntry;
exports.reverseEmployeeLedgerEntry = reverseEmployeeLedgerEntry;
const models_1 = require("../models");
/**
 * The ONLY function allowed to change Employee.salary_outstanding.
 * Mirrors utils/ledger.ts (CustomerLedger) exactly: row-locks the
 * Employee record, applies the signed amount, and writes the
 * EmployeeLedger row in the same transaction so they can never drift.
 *
 * "credit" increases what's owed to the employee (Salary, Incentive);
 * "debit" decreases it (Advance, Advance Recovery, Deduction, Salary Payment).
 */
async function recordEmployeeLedgerEntry(params) {
    const { ownerId, shopId, employeeId, entryType, amount, referenceType, referenceId, description, actorType, actorId, entryDate, externalTransaction, } = params;
    if (amount <= 0) {
        throw Object.assign(new Error("Ledger entry amount must be positive"), { status: 400 });
    }
    const run = async (t) => {
        const employee = (await models_1.Employee.findOne({
            where: { id: employeeId, owner_id: ownerId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        }));
        if (!employee)
            throw Object.assign(new Error("Employee not found"), { status: 404 });
        const signedAmount = entryType === "credit" ? amount : -amount;
        const newBalance = Number(employee.salary_outstanding) + signedAmount;
        employee.salary_outstanding = newBalance;
        await employee.save({ transaction: t });
        const entry = await models_1.EmployeeLedger.create({
            owner_id: ownerId,
            shop_id: shopId,
            employee_id: employeeId,
            entry_type: entryType,
            amount,
            running_balance: newBalance,
            reference_type: referenceType,
            reference_id: referenceId ?? null,
            description,
            entry_date: entryDate ?? new Date(),
            actor_type: actorType,
            actor_id: actorId,
        }, { transaction: t });
        return { entry, employee };
    };
    if (externalTransaction)
        return run(externalTransaction);
    return models_1.sequelize.transaction(run);
}
/** Posts an opposite-direction reversal for a previously-posted entry; never deletes the original, just annotates it "reversed". */
async function reverseEmployeeLedgerEntry(params) {
    const { originalEntryId, description, actorType, actorId, externalTransaction } = params;
    const run = async (t) => {
        const original = await models_1.EmployeeLedger.findOne({ where: { id: originalEntryId }, transaction: t });
        if (!original)
            throw Object.assign(new Error("Ledger entry not found"), { status: 404 });
        if (original.status === "reversed")
            throw Object.assign(new Error("Ledger entry already reversed"), { status: 400 });
        const reversedType = original.entry_type === "credit" ? "debit" : "credit";
        const { entry } = await recordEmployeeLedgerEntry({
            ownerId: original.owner_id,
            shopId: original.shop_id,
            employeeId: original.employee_id,
            entryType: reversedType,
            amount: Number(original.amount),
            referenceType: original.reference_type,
            referenceId: original.reference_id ?? undefined,
            description,
            actorType,
            actorId,
            externalTransaction: t,
        });
        original.status = "reversed";
        await original.save({ transaction: t });
        return entry;
    };
    if (externalTransaction)
        return run(externalTransaction);
    return models_1.sequelize.transaction(run);
}
//# sourceMappingURL=salaryLedger.js.map