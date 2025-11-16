import express, { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /positions/:positionId/yield-history
 * Get historical yield data for charts
 */
router.get('/:positionId/yield-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { positionId } = req.params;
    const { days = '30' } = req.query;

    const supabase = getSupabaseClient();
    const cutoffDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('yield_history')
      .select('timestamp, apy, value, protocol')
      .eq('position_id', positionId)
      .gte('timestamp', cutoffDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      logger.error('Failed to fetch yield history', { error: error.message, positionId });
      return res.status(500).json({ error: 'Failed to fetch yield history' });
    }

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

export default router;
