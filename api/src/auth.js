import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return secret;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      email: user.email,
    },
    getJwtSecret(),
    {
      subject: String(user.id),
      expiresIn: getJwtExpiresIn(),
    },
  );
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, getJwtSecret());

    req.user = {
      id: Number(payload.sub),
      email: payload.email,
    };

    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
