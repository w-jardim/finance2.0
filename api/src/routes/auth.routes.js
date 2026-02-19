import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, signAccessToken } from '../auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at,
  };
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  const { name, email, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
    `;

    const { rows } = await pool.query(query, [name, email, passwordHash]);
    const user = mapUser(rows[0]);
    const access_token = signAccessToken(user);

    return res.status(201).json({ user, access_token });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  try {
    const query = `
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [email]);

    if (!rows[0]) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRow = rows[0];
    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = mapUser(userRow);
    const access_token = signAccessToken(user);

    return res.json({ user, access_token });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT id, name, email, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [req.user.id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: mapUser(rows[0]) });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
