var express = require('express');
var router = express.Router();
var fs = require('fs');

var dateformat = require('dateformat');
var config = require('config-yml');
var Settings = require('../models/Settings');
var License = require('../models/License');
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

                      License.findOne({userId: user._id})
                          .exec(function (err, license) {
                              if (!err && license)  {
                                  widgetConfig.licenseReviewLimit = license.maxlimits.review;

                                  // try to unqiuely identify from which page widget has been used.
                                  handleWidgetRef(req.headers['referer'], license._id);
                               }

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
                                                'user': { name: d.name, id: d.emailId },
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
                          
                          });
                      
                    } else res.end();

                });
            } else res.end();
            
        });
});


// requested by shwaytaj

const extractName = function(emailId) {
    // assuming correct email syntax
    var delimRegex = /(!|#|\$|%|&|'|\*|\+|\-|\/|=|\?|\^|_|`|\{|\}|~|;|"|\d|\.)/;
    var candidate = emailId.split('@')[0],
        parts = candidate.split(delimRegex);

    parts = parts.filter(function(p){ return !(delimRegex.test(p) || p==="")});

    return parts.slice(0, Math.min(parts.length, 2)).join(' ');

},

handleWidgetRef = function (ref, licenseId) {
    if (!ref || !ref.length) return;

    License.update({_id: licenseId},
            { $addToSet: { 'limits.widgetRefs': ref }})
    .exec(function(err, doc) { 
        if (err) console.log("Error while updating widget ref");
    });
};

module.exports = router;

