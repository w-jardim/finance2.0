import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const router = Router();

const transactionSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  title: z.string().trim().min(1),
  amount_cents: z.number().int().positive(),
  category_id: z.number().int().positive().nullable().optional(),
  occurred_at: z.string().date(),
});

const idParamSchema = z.coerce.number().int().positive();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT id, user_id, type, title, amount_cents, category_id, occurred_at, due_date, paid_at, notes, created_at, updated_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY occurred_at DESC, id DESC
    `;
    const { rows } = await pool.query(query, [req.user.id]);

    return res.json({ transactions: rows });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  const { type, title, amount_cents, category_id = null, occurred_at } = parsed.data;

  try {
    if (category_id !== null) {
      const categoryCheckQuery = `
        SELECT id
        FROM categories
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `;
      const categoryResult = await pool.query(categoryCheckQuery, [category_id, req.user.id]);

      if (!categoryResult.rows[0]) {
        return res.status(400).json({ error: 'Invalid category_id for this user' });
      }
    }

    const insertQuery = `
      INSERT INTO transactions (user_id, type, title, amount_cents, category_id, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, type, title, amount_cents, category_id, occurred_at, due_date, paid_at, notes, created_at, updated_at
    `;
    const { rows } = await pool.query(insertQuery, [
      req.user.id,
      type,
      title,
      amount_cents,
      category_id,
      occurred_at,
    ]);

    return res.status(201).json({ transaction: rows[0] });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const parsedId = idParamSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({ error: 'Invalid transaction id' });
  }

  try {
    const query = `
      DELETE FROM transactions
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const { rowCount } = await pool.query(query, [parsedId.data, req.user.id]);

    if (!rowCount) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
