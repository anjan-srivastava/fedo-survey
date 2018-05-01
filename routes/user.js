var express = require('express');
var router = express.Router();
var path = require('path');

var License = require('../models/License');
var User = require('../models/User');

router.get('/me', function(req, res, next) {
    License.findOne({userId: req.user._id})
        .select({_id: 0, __v: 0, userId: 0, maxlimits: 0})
        .exec(function (err, doc) {
            if (err) res.status(500).send('Something went wrong.');
            else if (doc) {
                let cnt = doc.limits && doc.limits.widgetRefs && doc.limits.widgetRefs.length;
                let lic = { 
                    started: doc.started,
                    active: doc.active,
                    plan: doc.plan,
                    limitDays: doc.limitDays,
                    widgetCount: cnt
                };

                res.json( { id: req.user._id, 
                            username: req.user.username, 
                            name: req.user.name, 
                            company: req.user.company,
                            firstLogin: req.user.firstLogin,
                            license: lic
                } );
            }

            if (req.user.firstLogin) User.update({username: req.user.username}, {$set: {firstLogin: false}}).exec(function() { });
            res.end();
        });
});

module.exports = router;
