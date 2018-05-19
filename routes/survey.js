var express = require('express');
var mongoose = require('mongoose');
var uuid = require('uuid/v4');
var config = require('config-yml');
var fs = require('fs');

var Survey = require('../models/Survey');
var FeedbackRecord = require('../models/FeedbackRecord');
var Settings = require('../models/Settings');
var campaignMailer = require('../utils/mail/campaignMailer');
var saveOrEdit = require('./surveyhelper');
var router = express.Router();

mongoose.connect(config.db.url, {useMongoClient: true});

router.get('/', function(req, res, next) {
    Survey.paginate({ 'createdBy.id': mongoose.Types.ObjectId(req.user.id) }, {
        page: req.query.page || 1,
        limit: 10,
        select: { _id: 0, __v: 0, cta: 0, recepients:0,tags:0,subject:0 },
        sort: { created: -1 }
    }, function(err, docs) {
        if (err) { 
            res.status(500).send("Something went wrong."); 
        } else {
            res.json(docs);
        }
    });
});

router.get('/query', function(req, res, next) {
    Survey.find({ 'createdBy.id': mongoose.Types.ObjectId(req.user.id) })
        .select({title: 1, surveyKey: 1})
        .exec(function (err, docs) {
            if (err) res.status(500).send("Something went wrong");
            else res.json(docs);

            res.end();
        });
});

router.get('/:surveyKey', function(req, res, next) {
    Survey.findOne({surveyKey: req.params.surveyKey})
        .select({_id:0, __v: 0})
        .exec(function(err, survey){
            if (err) {
                res.status(500).send("Something went wrong");
            } else {
                res.json(survey);
            }
        });
});

router.post('/create', function(req, res, next) {
    let data = req.body;
    const testRun = data.testRun;
    
    let session = req.session;
    let recepients = data.recepients;

    // Override inline recepients list, if CSV is uploaded
    if (session.uploadedEmailsPath && !testRun ) {
       const recepData = JSON.parse(fs.readFileSync(session.uploadedEmailsPath, 'utf-8'));
      if (recepData && recepData._.length) {
          data.recepients = recepData._; 
      }

      fs.unlink(session.uploadedEmailsPath);
      session.uploadedEmailsPath = null;
    }

    data.createdBy =  { name: req.user.name, id: req.user._id } ;
    data.username = req.user.username;
    data.company = req.user.company;
    const surveyKey = saveOrEdit(data);     

    res.json({status: "success", surveykey: surveyKey});
    res.end();
});

router.post('/:surveyKey/edit', function(req, res, next) {
    let data = req.body;
    const testRun = data.testRun;
    
    let session = req.session;
    let recepients = data.recepients;

    data.surveyKey = req.params.surveyKey;
    // Override inline recepients list, if CSV is uploaded
    if (session.uploadedEmailsPath && !testRun ) {
       const recepData = JSON.parse(fs.readFileSync(session.uploadedEmailsPath, 'utf-8'));
      if (recepData && recepData._.length) {
          data.recepients = recepData._; 
      }

      fs.unlink(session.uploadedEmailsPath);
      session.uploadedEmailsPath = null;
    }

    data.createdBy =  { name: req.user.name, id: req.user._id } ;
    data.username = req.user.username;
    data.company = req.user.company;
    const surveyKey = saveOrEdit(data);     

    res.json({status: "success", surveykey: surveyKey});
    res.end();

});

module.exports = router;
