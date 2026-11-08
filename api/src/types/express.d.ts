import { AccessTokenPayload } from "../utils/jwt";

export interface CustomerContext {
  customerId: number;
  shopId: number;
  ownerId: number;
  accountId: number;
  phone: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      customer?: CustomerContext;
    }
  }
}

export {};
