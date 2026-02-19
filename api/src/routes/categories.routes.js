import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

const router = Router();

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
});

const idParamSchema = z.coerce.number().int().positive();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT id, user_id, name, created_at
      FROM categories
      WHERE user_id = $1
      ORDER BY name ASC
    `;
    const { rows } = await pool.query(query, [req.user.id]);

    return res.json({ categories: rows });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  try {
    const query = `
      INSERT INTO categories (user_id, name)
      VALUES ($1, $2)
      RETURNING id, user_id, name, created_at
    `;
    const { rows } = await pool.query(query, [req.user.id, parsed.data.name]);

    return res.status(201).json({ category: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const parsedId = idParamSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    return res.status(400).json({ error: 'Invalid category id' });
  }

  try {
    const query = `
      DELETE FROM categories
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const { rowCount } = await pool.query(query, [parsedId.data, req.user.id]);

    if (!rowCount) {
      return res.status(404).json({ error: 'Category not found' });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
