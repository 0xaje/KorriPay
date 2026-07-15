import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        walletAddress: string;
      };
      userId?: string;
    }
  }
}

declare module 'ioredis';
declare module 'swagger-ui-express';
declare module 'swagger-jsdoc';
declare module 'compression';
