var express = require('express');
var router = express.Router();
var path = require('path');

router.get('/me', function(req, res, next) {
    res.json( { id: req.user._id, username: req.user.username, name: req.user.name, company: req.user.company } );
    res.end();
});

module.exports = router;
