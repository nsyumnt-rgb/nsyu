"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParamRule = exports.dateRangeQueryRules = exports.runPayrollRules = exports.createEmployeeRules = exports.createSaleRules = exports.createProductRules = exports.loginRules = exports.registerOwnerRules = void 0;
exports.validate = validate;
const express_validator_1 = require("express-validator");
/**
 * Runs a set of express-validator rules, then rejects with 400 +
 * a field-level error list if any failed — otherwise calls next().
 * This is a SECOND layer of defense on top of each controller's own
 * manual checks (which stay in place); it exists to catch malformed
 * input (wrong type, out-of-range, missing) consistently and before
 * any DB/business logic runs, per the "Validate all input" security
 * requirement.
 */
function validate(rules) {
    return [
        ...rules,
        (req, res, next) => {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array().map((e) => ({ field: e.path ?? e.param, message: e.msg })),
                });
            }
            next();
        },
    ];
}
// ---- Reusable rule sets for the highest-risk write endpoints ----
exports.registerOwnerRules = [
    (0, express_validator_1.body)("name").trim().notEmpty().withMessage("name is required").isLength({ max: 150 }),
    (0, express_validator_1.body)("email").trim().isEmail().withMessage("a valid email is required").normalizeEmail(),
    (0, express_validator_1.body)("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
    (0, express_validator_1.body)("phone").optional({ nullable: true }).isString().isLength({ max: 20 }),
];
exports.loginRules = [
    (0, express_validator_1.body)("email").trim().notEmpty().withMessage("email, username, or phone is required"),
    (0, express_validator_1.body)("password").notEmpty().withMessage("password is required"),
];
exports.createProductRules = [
    (0, express_validator_1.body)("name").trim().notEmpty().withMessage("name is required").isLength({ max: 150 }),
    (0, express_validator_1.body)("sku").trim().notEmpty().withMessage("sku is required").isLength({ max: 60 }),
    (0, express_validator_1.body)("purchase_price").optional().isFloat({ min: 0 }).withMessage("purchase_price must be >= 0"),
    (0, express_validator_1.body)("selling_price").optional().isFloat({ min: 0 }).withMessage("selling_price must be >= 0"),
    (0, express_validator_1.body)("mrp").optional().isFloat({ min: 0 }).withMessage("mrp must be >= 0"),
    (0, express_validator_1.body)("discount").optional().isFloat({ min: 0, max: 100 }).withMessage("discount must be 0-100"),
    (0, express_validator_1.body)("tax_percent").optional().isFloat({ min: 0, max: 100 }).withMessage("tax_percent must be 0-100"),
];
exports.createSaleRules = [
    (0, express_validator_1.body)("items").isArray({ min: 1 }).withMessage("items must be a non-empty array"),
    (0, express_validator_1.body)("items.*.productId").isInt({ min: 1 }).withMessage("each item needs a valid productId"),
    (0, express_validator_1.body)("items.*.quantity").isFloat({ gt: 0 }).withMessage("each item needs a positive quantity"),
    (0, express_validator_1.body)("paymentMethod")
        .isIn(["cash", "upi", "bank_transfer", "card", "cheque", "other"])
        .withMessage("invalid paymentMethod"),
    (0, express_validator_1.body)("paidAmount").optional().isFloat({ min: 0 }).withMessage("paidAmount must be >= 0"),
    (0, express_validator_1.body)("billDiscount").optional().isFloat({ min: 0 }).withMessage("billDiscount must be >= 0"),
];
exports.createEmployeeRules = [
    (0, express_validator_1.body)("name").trim().notEmpty().withMessage("name is required").isLength({ max: 150 }),
    (0, express_validator_1.body)("email").trim().isEmail().withMessage("a valid email is required").normalizeEmail(),
    (0, express_validator_1.body)("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
];
exports.runPayrollRules = [
    (0, express_validator_1.body)("employeeId").isInt({ min: 1 }).withMessage("employeeId is required"),
    (0, express_validator_1.body)("periodStart").isISO8601().withMessage("periodStart must be a valid date"),
    (0, express_validator_1.body)("periodEnd").isISO8601().withMessage("periodEnd must be a valid date"),
    (0, express_validator_1.body)("otherDeduction").optional().isFloat({ min: 0 }),
    (0, express_validator_1.body)("advanceDeduction").optional().isFloat({ min: 0 }),
];
exports.dateRangeQueryRules = [
    (0, express_validator_1.query)("from").optional().isISO8601().withMessage("from must be a valid date"),
    (0, express_validator_1.query)("to").optional().isISO8601().withMessage("to must be a valid date"),
    (0, express_validator_1.query)("shopId").optional().isInt({ min: 1 }).withMessage("shopId must be a valid id"),
];
const idParamRule = (name) => (0, express_validator_1.param)(name).isInt({ min: 1 }).withMessage(`${name} must be a valid id`);
exports.idParamRule = idParamRule;
//# sourceMappingURL=validate.js.map