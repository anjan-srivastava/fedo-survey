var express = require('express');
var mongoose = require('mongoose');
var uuid = require('uuid/v4');
var config = require('config-yml');

var Survey = require('../models/Survey');
var FeedbackRecord = require('../models/FeedbackRecord');
var campaignMailer = require('../utils/mail/campaignMailer');
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
    saveOrEdit(data);     

    res.json({status: "success"});
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
    saveOrEdit(data);     

    res.json({status: "success"});
    res.end();

});

function saveOrEdit(data) {
    const recepients = data.recepients 
    const testRun = data.testRun;
    
    if (recepients && typeof recepients.map === 'function') {
        // Generate survey key and feedbacks key
        let surveyKey = uuid();
        let surveyId = null;
        let fkeys = [];

        // check if survey already exists then modify it.
        Survey.findOne({surveyKey: data.surveyKey}, function(err, result) {
            if (!err && result) {
                surveyKey = data.surveyKey;
                surveyId = result._id;
                console.log("Survey Id Callback: ", surveyId); 
            }
            
            if (! data.saveOnly ) {
                console.log("Preparing for sending emails.");
                const mailerOptions = {
                    //create recepients and respective submit urls
                    //this option can be used to customize user emails
                    recepients: recepients.map(function(email) { 
                        const fkey = uuid();
                        fkeys.push(fkey);
                        return {
                            email: email,
                            submitUrl: config.app.url + '/api/feedbacks/submit/' + surveyKey + '/' + fkey,
                            webformUrl: config.app.url + '/api/feedbacks/submit/webform?sk=' + surveyKey+'&fk='+fkey
                        }
                    }),

                    mailSubject: data.subject,
                    mailBody: data.mailBody,
                    cta: data.cta,
                    signature: data.signature
                };
               
                // Generate and send mails. 
                campaignMailer.sendCampaignMail(mailerOptions);
            }
            // Do not create campaign in case of test run.
            if (!testRun) {
                console.log("Creating campaign, as this is not test run.");
                // Create Survey and respective feedbacks in DB
                console.log("Survey Id: ", surveyId); 
                // TODO make this user initiated action
                var campaign = new Survey({ _id: surveyId,
                              surveyKey: surveyKey,
                              created: new Date(),
                              ...data });
                if (surveyId) { 
                    campaign.isNew = false;
                }
                campaign.save(function(err) {
                    if (err) {
                        console.log(err);
                    }
                });

                recepients.forEach(function(mail, index) {
                    const fkey = fkeys[index];
                    // save feedback record in db
                    (new FeedbackRecord({
                        emailId: mail,
                        surveyKey: surveyKey,
                        feedbackKey: fkey,
                        status: 'sent',
                        tags: data.tags,
                        updated: new Date(),
                        createdBy: data.createdBy
                    })).save(function(err) {
                        console.log(err);
                    });
                });
            }
        });
    }

}

module.exports = router;
