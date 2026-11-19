import { AccessTokenPayload } from "../utils/jwt";

export interface CustomerContext {
  customerId: number;
  shopId: number;
  ownerId: number;
  accountId: number;
  phone: string;
}

export interface SupplierContext {
  supplierId: number;
  ownerId: number;
  name: string;
  phone: string;
  email: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      customer?: CustomerContext;
      supplier?: SupplierContext;
    }
  }
}

export {};
