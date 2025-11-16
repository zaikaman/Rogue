import { Request, Response, NextFunction } from 'express';
import { verifyMessage } from 'ethers';
import jwt from 'jsonwebtoken';
import { config } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { AppError } from './error.js';

/**
 * Extended request with authenticated wallet
 */
export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

/**
 * Verify wallet signature middleware
 * 
 * Expects headers:
 * - x-wallet-address: The wallet address
 * - x-signature: Signature of a message
 * - x-message: The signed message
 */
export async function verifyWalletSignature(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const walletAddress = req.headers['x-wallet-address'] as string;
    const signature = req.headers['x-signature'] as string;
    const message = req.headers['x-message'] as string;

    if (!walletAddress || !signature || !message) {
      throw new AppError('Missing authentication headers', 401);
    }

    // Verify the signature
    const recoveredAddress = verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AppError('Invalid signature', 401);
    }

    // Check message timestamp (prevent replay attacks)
    try {
      const messageData = JSON.parse(message);
      const timestamp = messageData.timestamp;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (Math.abs(now - timestamp) > fiveMinutes) {
        throw new AppError('Signature expired', 401);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // If message is not JSON, skip timestamp check
    }

    // Attach wallet address to request
    req.walletAddress = walletAddress.toLowerCase();

    logger.info('Wallet authenticated', { walletAddress: req.walletAddress });
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', 401));
    }
  }
}

/**
 * Generate JWT token for authenticated session
 */
export function generateToken(walletAddress: string): string {
  return jwt.sign(
    { wallet_address: walletAddress.toLowerCase() },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify JWT token middleware
 */
export function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('No token provided', 401);
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      wallet_address: string;
    };

    req.walletAddress = decoded.wallet_address;
    next();
  } catch (error) {
    next(new AppError('Invalid or expired token', 401));
  }
}

/**
 * Optional authentication - doesn't fail if not authenticated
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      wallet_address: string;
    };
    req.walletAddress = decoded.wallet_address;
  } catch (error) {
    logger.warn('Invalid token in optional auth', { error });
  }

  next();
}

export default {
  verifyWalletSignature,
  verifyToken,
  optionalAuth,
  generateToken,
};
