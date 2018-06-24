var mongoose = require('mongoose');
var uuid = require('uuid/v4');
var config = require('config-yml');
var fs = require('fs');

var Survey = require('../models/Survey');
var FeedbackRecord = require('../models/FeedbackRecord');
var Settings = require('../models/Settings');
var License = require('../models/License');
var campaignMailer = require('../utils/mail/campaignMailer');

const CTYPE_REGULAR = 'REGULAR';

function incrementEmailLimits(userId, byvalue = 1) {
   License.findOne({userId: userId})
      .exec(function (err, doc) {
        if (!err && doc) {
            if (!doc.limits) doc.limits = {};
            if (!doc.limits.email) doc.limits.email = 0;
            doc.limits.email += byvalue;
            
            let license = new License(doc);
            license.isNew = false;
            license.save(function(err) { if (err) console.log("Error while updating email limits."); });
        }
      });
}

function saveOrEdit(data) {
    const recepients = data.recepients 
    const testRun = data.testRun;
    data.type  = data.type || CTYPE_REGULAR;

    let surveyKey;

    if (recepients && typeof recepients.map === 'function') {
        // Generate survey key and feedbacks key
        surveyKey = data.surveyKey || uuid();
        let surveyId = null;
        let fkeys = [];
        recepients.forEach(function() { fkeys.push(uuid());});
        // check if survey already exists then modify it.
        Survey.findOne({surveyKey: data.surveyKey}, function(err, result) {
            if (!err && result) {
                surveyKey = data.surveyKey;
                surveyId = result._id;
                data.type = result.type; // make sure we don't override survey type once set
                console.log("Survey Id Callback: ", surveyId); 
            }
            
            if (! data.saveOnly ) {
                Settings.findOne({username: data.username, company: data.company})
                    .exec(function(err, setting) {
                        console.log("Preparing for sending emails.");
                        const mailerOptions = {
                            //create recepients and respective submit urls
                            //this option can be used to customize user emails
                            recepients: recepients.map(function(email, index) { // NOTE! make sure ordering in recepients remains same
                                const fkey = fkeys[index];
                                return {
                                    email: email,
                                    submitUrl: config.app.url + '/api/feedbacks/submit/' + surveyKey + '/' + fkey,
                                    webformUrl: config.app.url + '/api/feedbacks/submit/webform?sk=' + surveyKey+'&fk='+fkey
                                }
                            }),

                            mailSubject: data.subject,
                            mailBody: data.mailBody,
                            cta: data.cta,
                            signature: data.signature,
                            replyto: setting.emailConfig.replyTo? setting.emailConfig.replyTo: data.username
                        };
                     
                        if (!err) mailerOptions.fromName = setting.emailConfig && setting.emailConfig.fromField; 
                        // Generate and send mails. 
                        campaignMailer.sendCampaignMail(mailerOptions);

                        // TODO, may be separate out this call to a middleware.
                        incrementEmailLimits(data.createdBy.id, data.recepients.length);
                    });
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
                        name: extractName(mail),
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

    return surveyKey;
}

const extractName = function(emailId) {
    // assuming correct email syntax
    var delimRegex = /(!|#|\$|%|&|'|\*|\+|\-|\/|=|\?|\^|_|`|\{|\}|~|;|"|\d|\.)/;
    var candidate = emailId.split('@')[0],
        parts = candidate.split(delimRegex);

    parts = parts.filter(function(p){ return !(delimRegex.test(p) || p==="")});

    return parts.slice(0, Math.min(parts.length, 2)).join(' ');

};

module.exports = saveOrEdit;
