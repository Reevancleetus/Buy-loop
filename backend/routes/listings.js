const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const requireAuth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', requireAuth, upload.array('images', 5), listingController.createListing);
router.get('/', listingController.getListings);
router.get('/:id', listingController.getListingById);
router.patch('/:id/status', requireAuth, listingController.updateListingStatus);
router.delete('/:id', requireAuth, listingController.deleteListing);

module.exports = router;
