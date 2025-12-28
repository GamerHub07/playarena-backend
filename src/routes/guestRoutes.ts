import { Router } from 'express';
import { createGuest, getGuest } from '../controllers/guestController';

const router = Router();

router.post('/', createGuest);
router.get('/:sessionId', getGuest);

export default router;
