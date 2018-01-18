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
    Survey.distinct('tags')
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

module.exports = router;