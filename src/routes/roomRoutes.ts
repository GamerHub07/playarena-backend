import { Router } from 'express';
import { createRoom, getRoom, joinRoom } from '../controllers/roomController';

const router = Router();

router.post('/', createRoom);
router.get('/:code', getRoom);
router.post('/:code/join', joinRoom);

export default router;
