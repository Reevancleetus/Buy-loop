const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, chatController.getChats);
router.post('/', requireAuth, chatController.getOrCreateChat);
router.get('/:chatId/messages', requireAuth, chatController.getMessages);
router.post('/:chatId/messages', requireAuth, chatController.sendMessage);
router.post('/meetup', requireAuth, chatController.proposeMeetup);
router.patch('/meetup/:meetupId', requireAuth, chatController.updateMeetupStatus);
router.get('/:chatId/meetups', requireAuth, chatController.getMeetups);

module.exports = router;
