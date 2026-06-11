const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const requireAuth = require('../middleware/auth');

router.post('/', requireAuth, transactionController.createTransaction);
router.get('/', requireAuth, transactionController.getTransactions);
router.patch('/:transactionId', requireAuth, transactionController.updateTransactionStatus);
router.get('/listing/:listingId', requireAuth, transactionController.getTransactionByListing);

module.exports = router;
