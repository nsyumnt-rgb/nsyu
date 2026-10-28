"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEmiSchedule = buildEmiSchedule;
exports.computeInstallmentStatus = computeInstallmentStatus;
exports.refreshInstallmentStatuses = refreshInstallmentStatuses;
/**
 * Builds the installment schedule for an EMI plan using flat/simple
 * interest (interest computed once on the financed amount, then
 * split evenly across installments) — the common model for
 * small-shop EMI billing. Due dates step forward one calendar month
 * per installment from startDate. Any rounding remainder from the
 * division is absorbed into the LAST installment so the sum of
 * expected_amount across all installments always equals payable_amount
 * exactly (no paise lost to rounding).
 */
function buildEmiSchedule(params) {
    const { financedAmount, interestPercent, numberOfInstallments, startDate } = params;
    if (numberOfInstallments < 1) {
        throw Object.assign(new Error("numberOfInstallments must be at least 1"), { status: 400 });
    }
    if (financedAmount <= 0) {
        throw Object.assign(new Error("financedAmount must be positive"), { status: 400 });
    }
    const interestAmount = round2((financedAmount * interestPercent) / 100);
    const payableAmount = round2(financedAmount + interestAmount);
    const baseInstallment = Math.floor((payableAmount / numberOfInstallments) * 100) / 100;
    const installments = [];
    let allocated = 0;
    for (let i = 1; i <= numberOfInstallments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        const isLast = i === numberOfInstallments;
        const expectedAmount = isLast ? round2(payableAmount - allocated) : baseInstallment;
        allocated = round2(allocated + expectedAmount);
        installments.push({ installmentNumber: i, dueDate, expectedAmount });
    }
    // emi_amount displayed to the customer is the regular (non-last) installment amount
    const emiAmount = baseInstallment;
    return { interestAmount, payableAmount, emiAmount, installments };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
/**
 * Recomputes an installment's status from its current amounts and
 * due_date relative to "today". Does NOT save — callers persist if
 * the value changed. Called on every EMI read path (list/get) so
 * "Overdue" stays accurate without a cron job, and after every
 * payment write.
 */
function computeInstallmentStatus(installment) {
    if (installment.status === "Cancelled")
        return "Cancelled";
    if (Number(installment.remaining_amount) <= 0)
        return "Paid";
    if (Number(installment.paid_amount) > 0)
        return "Partially Paid";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(installment.due_date);
    due.setHours(0, 0, 0, 0);
    if (due.getTime() < today.getTime())
        return "Overdue";
    if (due.getTime() === today.getTime())
        return "Due";
    return "Upcoming";
}
/** Refreshes and persists status for a set of installments; returns them. */
async function refreshInstallmentStatuses(installments) {
    for (const inst of installments) {
        const fresh = computeInstallmentStatus(inst);
        if (fresh !== inst.status) {
            inst.status = fresh;
            await inst.save();
        }
    }
    return installments;
}
//# sourceMappingURL=emi.js.map