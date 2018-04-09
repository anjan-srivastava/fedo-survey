var express = require('express');
var router = express.Router();
var fs = require('fs');

var dateformat = require('dateformat');
var config = require('config-yml');
var Settings = require('../models/Settings');
var User = require('../models/User');
var FeedbackRecord = require('../models/FeedbackRecord');

var mongoose = require('mongoose');

mongoose.connect(config.db.url, {useMongoClient: true});


router.get('/:widgetToken/widget.js', function(req, res) {
    Settings
        .findOne({widgetToken: req.params.widgetToken})
        .exec(function (err, setting) {
            if (err) {
                res.status(500).send("Something went wrong");
                res.end();
            } else if (setting) {
               var widgetConfig = setting.widgetConfig;

               User
                .findOne({username: setting.username})
                .exec(function(err, user) {
                    if (err) {
                        res.status(500).send("Something went wrong");
                        res.end();
                    } else if (user) {
                      FeedbackRecord
                        .find({'createdBy.id': user._id, status: 'submitted', isPublished: true})
                        .limit(Math.min(widgetConfig.licenseReviewLimit, widgetConfig.settings.maxReviews))
                        .exec(function(err, docs) {
                            if (err) {
                                res.status(500).send("Something went wrong");
                            } else if (docs) {
                                var reviews = docs.map((d)=> {
                                    return {
                                        'rating': d.rating,
                                        'user': { name: extractName(d.emailId), id: d.emailId },
                                        'content': {
                                            'text': d.feedbacktext,
                                            //'media': (Math.random() > 0.5)? ([config.app.url + '/static/codepen.jpg']):([])
                                        },

                                        'date': dateformat(d.updated, 'mmm d, yyyy')
                                    };
                                
                                });
                                
                                var snippet = fs.readFileSync('views/widget.min.js.tpl', 'utf8');
                                res.setHeader('Content-Type', 'application/javascript');
                                snippet = snippet.replace(/#{reviews}/g, JSON.stringify(reviews));
                                snippet = snippet.replace(/#{config}/g, JSON.stringify(widgetConfig));
                                
                                res.send(snippet.replace(/#{staticUrl}/g, config.app.url + "/static"));

                            }

                            res.end();
                        });
                    } else res.end();

                });
            } else res.end();
            
        });
});


// stupid way of getting people names
// requested by shwaytaj

var extractName = function(emailId) {
    // assuming correct email syntax
    var delimRegex = /(!|#|\$|%|&|'|\*|\+|\-|\/|=|\?|\^|_|`|\{|\}|~|;|"|\d|\.)/;
    var candidate = emailId.split('@')[0],
        parts = candidate.split(delimRegex);

    parts = parts.filter(function(p){ return !(delimRegex.test(p) || p==="")});

    return parts.slice(0, Math.min(parts.length, 2)).join(' ');

};

module.exports = router;

