import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function validateSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-logline-signature'];

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  // Verify the body was parsed
  if (!req.body) {
     return res.status(400).json({ error: 'Missing request body' });
  }

  // Reconstruct payload for signing
  // We rely on JSON.stringify producing the same output as the backend.
  // Ideally we should use the raw body buffer, but for this MVP we match the backend's logic.
  const computedSignature = crypto
    .createHmac('sha256', config.loglineSharedSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Constant-time comparison
  const a = Buffer.from(signature as string);
  const b = Buffer.from(computedSignature);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn('Signature mismatch', { received: signature, computed: computedSignature });
    return res.status(403).json({ error: 'Invalid signature' });
  }

  next();
}
