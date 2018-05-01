var express = require('express');
var router = express.Router();

var uuid = require('uuid/v4');
var config = require('config-yml');
var mongoose = require('mongoose');
var Settings = require('../models/Settings');
var License = require('../models/License');
var User = require('../models/User');

mongoose.connect(config.db.url, { useMongoClient: true });

// TODO decide where to put this
// in DB or in config file
const defaultWidgetConfig = {
    licenseReviewLimit: 5,
    settings: {
        enabled: true,
        position: 0, // 0: left, 1: right
        scrollEnabled: true,
        titleEnabled: true,
        titleText: 'What people say about our product!',
        showReviewerName: true,
        defaultState: 1, // 0: minimized, 1: expanded
        showReviewDate: true,
        maxReviews: 3
    },
    design: {
        backgroundColorOpen: '#ffffff',
        titleFontColor: '#495864',
        nameFontColor: '#000000',
        fontColor: '#4a4a4a',
        ratingIconColor: '#ffc719',
        outreechFavColor: '#ff434b'
    }
};

router.get('/widgetUrl', function(req, res, next) {

    // company would be used as workspace/project
    Settings
        .findOne({username: req.user.username, company: req.user.company})
        .select({_id:0, __v:0})
        .exec(function(err, setting) {
            console.log("First", err);
            if (err) {
                res.status(500).send("Something went wrong.");
                res.end();
            } else if (setting){
                res.json( { url: config.app.url + "/widgets/" + setting.widgetToken + "/widget.js"} );
                res.end();
            } else {
                let widgetToken = uuid();
                new Settings({
                    _id: mongoose.Types.ObjectId(),
                    username: req.user.username,
                    company: req.user.company,
                    updated: new Date(),
                    widgetToken: widgetToken,
                    widgetConfig: defaultWidgetConfig,
                    emailConfig: { fromField: req.user.company, replyTo: req.user.username }
                }).save(function(err) {
                    if (err) {
                        console.log("Second", err);
                        res.status(500).send("Something went wrong.");
                        res.end();
                    } else {
                        res.json({url: config.app.url + "/widgets/" + widgetToken + "/widget.js"});
                        res.end();
                    }
                });

            }
        });

});

router.get('/widget', function(req, res, next) {
    Settings.findOne({username: req.user.username, company: req.user.company})
        .select({widgetConfig: 1})
        .exec(function (err ,doc) {
            if (err)  {
                res.status(500).send('Something went wrong.');
                res.end();
            } else if (doc) {
                License.findOne({userId: req.user._id})
                    .exec (function (err, license) {
                        if (!err && license) {
                            doc.widgetConfig.licenseReviewLimit = license.maxlimits.review;
                        }
                        res.json(doc.widgetConfig);
                        res.end();
                    });
            }
        });
});

router.put('/widget', function(req, res, next) {

    Settings.update({username: req.user.username, company: req.user.company},
            {$set: {widgetConfig: req.body }})
        .exec(function(err, doc) {
            if (err) res.json({success: false, msg: 'Error while updating settings.'});
            else res.json({success: true, msg: 'You settings were successfully saved.'});

            res.end();
        })

});

router.post('/widget/reset', function(req, res, next) {
    Settings.findOne({username: req.user.username, company: req.user.company})
        .exec(function (err, doc) {
            if (!err) {
                resetWidgetConfig(doc.widgetToken, function(err1, widgetConfig) {
                    if (!err1) res.json({success: true, msg: 'Successfully restored default settings.', widgetConfig: widgetConfig});
                    else res.json({success: false, msg: 'Something went wrong, please try again.'});
                    res.end();
                });    
            }
        });
});

// resets to default config and returns default configuration
var resetWidgetConfig = function(widgetToken, callback) {
    Settings.update({widgetToken: widgetToken}, 
            {$set: { widgetConfig: defaultWidgetConfig }})
    .exec(function (err, doc) {
        callback(err, defaultWidgetConfig);
    });
};



/***** Profile settings apis *****/

router.get('/profile', function(req, res, next) {
    User.findOne({ username: req.user.username } )
        .select({_id: 0, __v: 0, activationToken: 0, passwdToken: 0, password: 0 })
        .exec(function (err, doc) {
            if (err) {
                res.status(500).send('Something went wrong.');
            } else {
                res.json(doc);
            }

            res.end();
        });
});

router.post('/profile', function(req, res, next) {
    var profileUpdates = req.body;
    if (!profileUpdates.username ||
            !profileUpdates.company) {
        res.end();
        return;
    }

    User.update({ username: req.user.username }, {
        $set: {
            username: profileUpdates.username,
            name: profileUpdates.name,
            lname: profileUpdates.lname,
            contactNumber: profileUpdates.contactNumber,
            company: profileUpdates.company,
            address: profileUpdates.address
        }
    }).exec(function(err, doc) {
        if (err) {
            res.json({success: false, msg: 'Error while saving profile, please retry.'});
            res.end();
        } else {
            Settings.update({ username: req.user.username },
                    {$set: {
                        username: profileUpdates.username,
                        company: profileUpdates.company,   
                     }})
            .exec(function(err, doc) {
                if (err) {
                    res.json({success: false, msg: 'Error while saving profile, partially saved.'});
                } else {
                    res.json({success: true, msg: 'You settings were successfully saved.'});
                };

                // TODO might have to reload the session
                req.user.username = profileUpdates.username;
                req.user.company = profileUpdates.company;
                res.end();
            });
        }
    });
});


router.get('/email', function(req, res, next) {
    Settings.findOne({username: req.user.username, company: req.user.company})
        .select({_id:0, __v:0})
        .exec(function (err, doc) {
            if (err) {
               res.status(500).send('Something went wrong.');
            } else if (doc && doc.emailConfig) {
                res.json(doc.emailConfig);
            } else if (doc){
                res.json({fromField: req.user.company}); // use company name as default from field
            }
            res.end();
        });
});


router.post('/email', function(req, res, next) {
    Settings.update({username: req.user.username, company: req.user.company},
            {$set: { 'emailConfig.fromField': req.body.fromName, 'emailConfig.replyTo': req.body.replyTo }})
        .exec(function (err, doc) {
            if (err) {
               res.json({success: false, msg: 'Something went wrong.'})
            } else {
                res.json({success: true, msg: 'You settings were successfully saved.'});
            }
            res.end();
        });
});
module.exports = router;
