var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var FeedbackRecord = require('../models/FeedbackRecord');
var Survey = require('../models/Survey');
var router = express.Router();

mongoose.connect('mongodb://localhost/fedo', {useMongoClient: true});

router.post('/submit', function(req, res, next) {
    var surveyKey = req.query.sk,
        feedbackKey = req.query.fk,
        rating = req.body.star,
        feedback = req.body.feedbackBox;
    
    if (!rating) {
        res.render('feedbackSubmit', { title:'Feedback Submission', message: 'Please rate feature atleast.' } );
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

    res.render('feedbackSubmit', { title:'Feedback Submission', message: 'Thank you for your feedback!' } );
    res.end();
});

router.post('/', function(req, res, next) {
    const searchReq = req.body;
    let { q, filters } = searchReq;

    let ratingFilters = []
    let query = { status: 'submitted', 'createdBy.id': mongoose.Types.ObjectId(req.user.id) };
    if (filters && typeof filters.filter === 'function' && filters.length) {
        try {
            ratingFilters = filters.filter((d) => typeof d=== 'string' && d.startsWith('rating:')).map((d)=> parseInt(d.split(':')[1]));
        } catch(e) { console.log("Error while parsing rating label; filters received: ", filters, " ; ignoring..."); }

        filters = filters.filter((d) => typeof d === 'string' && !d.startsWith('rating:'));
    }

    // apply label filter
    if (filters && filters.length) {
        query['tags'] = { $in: filters };
    }

    // apply rating filter
    if (ratingFilters.length) {
        query['rating'] = { $in: ratingFilters };    
    }

    if (q && q.length) {
        const regexQuery = new RegExp(q, 'i');
        query['$or'] =  [{ feedbacktext: regexQuery}, {emailId: regexQuery} ];
    }

    console.log("Feedback Query", query);
    FeedbackRecord.paginate(query, {
            page: req.query.page || 1,
            limit: 10,
            sort: { updated: -1 },
            select: {_id:0, __v:0 }
        }, 
        function(err, result) {
            if (err) res.status(500).send("Something went wrong.");
            else res.json(result);
            res.end();
        });
});

router.get('/tags', function(req, res, next) {
    const prefix = req.query.q;
    let result = [];
    Survey.distinct('tags', {'createdBy.id': req.user._id})
        .exec(function(err, tags) {
            if (err) res.json(result);
            else {
                result = tags;
                if (prefix) result = result.filter((t) => t.startsWith(prefix));
                result = result.slice(0, Math.min(result.length, 10));
                res.json(result);
            }
            res.end();
        });        
});

router.put('/:fkey/publish', function(req, res, next) {
    FeedbackRecord.update({feedbackKey: req.params.fkey},
            {$set: {isPublished: true}})
            .exec(function(err, doc) {
                console.log("Publish: ", doc);
                if (err) {
                    res.json({success: false, msg: "Something went wrong while publishing."});
                } else {
                    res.json({success: true, msg: "Your review was successfully published."});
                }
                res.end();
            });
});

router.put('/:fkey/unpublish', function(req, res, next) {
    FeedbackRecord.update({feedbackKey: req.params.fkey},
            {$set: {isPublished: false}})
            .exec(function(err, doc) {
                if (err) {
                    res.json({success: false, msg: "Something went wrong while unpublishing."});
                } else {
                    res.json({success: true, msg: "Your review was successfully unpublished."});
                }
                res.end();
            });
});

router.put('/:fkey/edit', function(req, res, next) {
    FeedbackRecord.update({ feedbackKey: req.params.fkey },
            {$set: {name: req.body.name}})
        .exec(function(err, doc) {
                if (err) {
                    res.json({success: false, msg: "Something went wrong while changing reviewer's name."});
                } else {
                    res.json({success: true, msg: "Successfully updated reviwer's name."});
                }
                res.end();
        });
});
module.exports = router;
