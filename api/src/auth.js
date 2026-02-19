import jwt from 'jsonwebtoken';

const { JWT_SECRET = '', JWT_EXPIRES_IN = '7d' } = process.env;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      email: user.email,
    },
    JWT_SECRET,
    {
      subject: String(user.id),
      expiresIn: JWT_EXPIRES_IN,
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
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: Number(payload.sub),
      email: payload.email,
    };

    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
