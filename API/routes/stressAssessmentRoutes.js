import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import db from '../config/db.js';

const router = express.Router();

/**
 * POST /api/v2/stress-assessment
 * Guarda evaluación de estrés y respuestas Q1-Q4.
 */
router.post('/stress-assessment', verifyToken, async (req, res) => {
    const userId = req.user?.id;
    const { q1, q2, q3, q4, perfil_estres } = req.body ?? {};

    if (![q1, q2, q3, q4].every((v) => Number.isInteger(Number(v)))) {
        return res.status(400).json({ message: 'q1, q2, q3 y q4 son requeridos (enteros).' });
    }
    if (!perfil_estres) {
        return res.status(400).json({ message: 'perfil_estres es requerido.' });
    }

    try {
        const { rows } = await db.query(
            `INSERT INTO stress_assessment
               (user_id, q1_energia_cognitiva, q2_tension_fisica, q3_rumiacion, q4_activacion_negativa, perfil_estres)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id_assessment, created_at`,
            [userId, q1, q2, q3, q4, perfil_estres],
        );
        res.status(201).json({ ok: true, assessment: rows[0] });
    } catch (err) {
        console.error('[stress-assessment] insert error:', err.message);
        res.status(500).json({ message: 'No se pudo guardar la evaluación.' });
    }
});

/**
 * GET /api/v2/stress-assessment/me
 * Última evaluación del usuario autenticado.
 */
router.get('/stress-assessment/me', verifyToken, async (req, res) => {
    const userId = req.user?.id;
    try {
        const { rows } = await db.query(
            `SELECT q1_energia_cognitiva AS q1, q2_tension_fisica AS q2,
                    q3_rumiacion AS q3, q4_activacion_negativa AS q4,
                    perfil_estres, created_at
             FROM stress_assessment
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId],
        );
        if (!rows.length) {
            return res.status(404).json({ message: 'Sin evaluaciones previas.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[stress-assessment/me] error:', err.message);
        res.status(500).json({ message: 'Error al leer evaluación.' });
    }
});

export default router;
