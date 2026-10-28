"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.refreshExpiryDate = refreshExpiryDate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = (process.env.JWT_ACCESS_EXPIRES || "15m");
const REFRESH_EXPIRES = (process.env.JWT_REFRESH_EXPIRES || "30d");
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
}
function refreshExpiryDate() {
    // Keep in sync with JWT_REFRESH_EXPIRES (defaults to 30 days)
    const days = 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
//# sourceMappingURL=jwt.js.map