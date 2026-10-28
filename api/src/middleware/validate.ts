import { Request, Response, NextFunction } from "express";
import { body, query, param, ValidationChain, validationResult } from "express-validator";

/**
 * Runs a set of express-validator rules, then rejects with 400 +
 * a field-level error list if any failed — otherwise calls next().
 * This is a SECOND layer of defense on top of each controller's own
 * manual checks (which stay in place); it exists to catch malformed
 * input (wrong type, out-of-range, missing) consistently and before
 * any DB/business logic runs, per the "Validate all input" security
 * requirement.
 */
export function validate(rules: ValidationChain[]) {
  return [
    ...rules,
    (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array().map((e: any) => ({ field: e.path ?? e.param, message: e.msg })),
        });
      }
      next();
    },
  ];
}

// ---- Reusable rule sets for the highest-risk write endpoints ----

export const registerOwnerRules = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 150 }),
  body("email").trim().isEmail().withMessage("a valid email is required").normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
  body("phone").optional({ nullable: true }).isString().isLength({ max: 20 }),
];

export const loginRules = [
  body("email").trim().notEmpty().withMessage("email, username, or phone is required"),
  body("password").notEmpty().withMessage("password is required"),
];

export const createProductRules = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 150 }),
  body("sku").trim().notEmpty().withMessage("sku is required").isLength({ max: 60 }),
  body("purchase_price").optional().isFloat({ min: 0 }).withMessage("purchase_price must be >= 0"),
  body("selling_price").optional().isFloat({ min: 0 }).withMessage("selling_price must be >= 0"),
  body("mrp").optional().isFloat({ min: 0 }).withMessage("mrp must be >= 0"),
  body("discount").optional().isFloat({ min: 0, max: 100 }).withMessage("discount must be 0-100"),
  body("tax_percent").optional().isFloat({ min: 0, max: 100 }).withMessage("tax_percent must be 0-100"),
];

export const createSaleRules = [
  body("items").isArray({ min: 1 }).withMessage("items must be a non-empty array"),
  body("items.*.productId").isInt({ min: 1 }).withMessage("each item needs a valid productId"),
  body("items.*.quantity").isFloat({ gt: 0 }).withMessage("each item needs a positive quantity"),
  body("paymentMethod")
    .isIn(["cash", "upi", "bank_transfer", "card", "cheque", "other"])
    .withMessage("invalid paymentMethod"),
  body("paidAmount").optional().isFloat({ min: 0 }).withMessage("paidAmount must be >= 0"),
  body("billDiscount").optional().isFloat({ min: 0 }).withMessage("billDiscount must be >= 0"),
];

export const createEmployeeRules = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 150 }),
  body("email").trim().isEmail().withMessage("a valid email is required").normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("password must be at least 8 characters"),
];

export const runPayrollRules = [
  body("employeeId").isInt({ min: 1 }).withMessage("employeeId is required"),
  body("periodStart").isISO8601().withMessage("periodStart must be a valid date"),
  body("periodEnd").isISO8601().withMessage("periodEnd must be a valid date"),
  body("otherDeduction").optional().isFloat({ min: 0 }),
  body("advanceDeduction").optional().isFloat({ min: 0 }),
];

export const dateRangeQueryRules = [
  query("from").optional().isISO8601().withMessage("from must be a valid date"),
  query("to").optional().isISO8601().withMessage("to must be a valid date"),
  query("shopId").optional().isInt({ min: 1 }).withMessage("shopId must be a valid id"),
];

export const idParamRule = (name: string) => param(name).isInt({ min: 1 }).withMessage(`${name} must be a valid id`);
