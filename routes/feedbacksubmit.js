var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var config = require('config-yml');
var FeedbackRecord = require('../models/FeedbackRecord');
var Survey = require('../models/Survey');
var router = express.Router();

mongoose.connect(config.db.url, {useMongoClient: true});


router.get('/webform', function(req, res, next) {
    const surveyKey = req.query.sk;
    const feedbackKey = req.query.fk;

    if (!surveyKey || !feedbackKey) {
        res.status(400).send("Bad Request.");
        res.end();
        return;
    }

    Survey.findOne({surveyKey: surveyKey}, function(err, survey) {
        if (!survey) { res.status(400).send("Campaign does not exist."); }
        else {
            res.render('feedbackWebForm.jade', 
            { 
                contentStyle: '/stylesheets/login.css',
                url: config.app.url + '/api/feedbacks/submit/'+surveyKey+'/'+feedbackKey,
                cta: survey.cta ? survey.cta: 'Send us your feedback'
            
            });
        }
    });

});

let submissionHandler = function(req, res, next) {
    var surveyKey = req.params.sk,
        feedbackKey = req.params.fk,
        rating = req.body.star || req.query.star,
        feedback = req.body.feedbackBox || req.query.feedbackBox;
    
    if (!rating) {
        res.render('feedbackSubmit', { title:'Feedback Submission', message: 'Please rate feature atleast.', poweredByText: true } );
        res.end();
        return;
    }
    FeedbackRecord.findOne({ feedbackKey: feedbackKey }, function(err, record){
        if (err) console.log(err);
        // don't allow multiple feedbacks for same form

        if (record && record.status === 'sent') {
            record.status = 'submitted';
            record.rating = new Number(rating);
            record.feedbacktext = feedback;
            record.updated = new Date();
            record.save(function(err){
                if (err) {
                    console.log(err);
                } else {
                    console.log("Recorded feedback successfully.");
                }
            });
        }
    });

    res.render('feedbackSubmit', { title:'Feedback Submission', message: 'Thank you for your feedback!', poweredByText: true } );
    res.end();
};

// GET form submission is required; since some mail clients(one of Apple Mail) send GET req
// instead of POST on form submission
router.get('/:sk/:fk', submissionHandler);
router.post('/:sk/:fk', submissionHandler);

module.exports = router;
