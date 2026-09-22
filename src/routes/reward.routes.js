import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { listRewards, redeem } from '../controllers/reward.controller.js';
const router = Router();
router.get('/', auth, listRewards);
router.post('/:rewardId/redeem', auth, redeem);
export default router;
