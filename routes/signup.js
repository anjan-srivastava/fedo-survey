var express = require('express');
var router = express.Router();
var path = require('path');
var uuid = require('uuid/v4');
var bcrypt = require('bcrypt');
var User = require('../models/User');
var License = require('../models/License');
var FeedbackRecord = require('../models/FeedbackRecord');
var mongoose = require('mongoose');
var config = require('config-yml');
var campaignMailer = require('../utils/mail/campaignMailer');
var saveOrEdit = require('./surveyhelper');

// TODO think of moving to db, maybe
const Plan = Object.freeze({
    PRO: 'PRO',
    BASIC: 'BASIC'
}),

parsePlan = function(text) {

    let p;
    if (text) {
        text = text.toUpperCase();
        p = Plan[text];
    }

    if (p) return p;
    return Plan.BASIC;
},

getLimits = function (plan) {
    let limits;
    switch (plan) {
        case Plan.PRO: limits = { review: Infinity, email: 500};
                       break;
        default: limits = { review: 5, email: 50};
    };

    return limits;
};


const saltRounds = 10;
router.post('/', function(req, res, next) {
    const { 
        name, 
        email, 
        company, 
        password } = req.body;

    let activationToken = uuid(); 
    if (email && email.length) {
        User.findOne({username: email}, function(err, user) {
            if (user) {
                res.redirect('/signup?error=Email already taken.&plan=' + req.body.plan );
                return;
            }

            bcrypt.hash(password, saltRounds, function(err, hash) {
                if (err) { res.status(500).render('feedbackSubmit', { title: 'Error', message: "Something went wrong, please try again."});res.end(); return; }

                let userId = mongoose.Types.ObjectId();
                (new User({
                    _id: userId,
                    username: email,
                    password: hash,
                    name: name,
                    company: company,
                    updated: new Date(),
                    active: false,
                    activationToken: activationToken
                }))
                    .save(function(err) {
                        if (err) {
                            console.log("Error while creating user: ", err);
                            res.status(500).send("Something went wrong, please try again.");
                        } else {
                            let plan = parsePlan(req.body.plan);
                            ( new License({
                                _id: mongoose.Types.ObjectId(),
                                userId: userId,
                                started: new Date(),
                                plan: plan,
                                limitDays: 30,
                                active: true,
                                maxlimits: getLimits(plan)             
                            })).save(function (err) {
                                if (err) console.log("Error while creating license.");
                            });
                        }

                        res.end();
                    });


                // send verification mail;
                campaignMailer.sendMail({
                    recepients: [ { email: email} ],
                    mailSubject: 'Outreech - Signup verification',
                    mailBody: '<p>Please <a href="' + config.app.url + '/api/signup/verify/' + activationToken +'">verify</a> your email to complete signup.</p>'
                });

                res.render('feedbackSubmit', { title: 'Signup; Mail Sent', message: "Please check your email, to complete signup process" });
                res.end();
            });
        }); 
    } else {
        res.status(400).send("Invalid email id");
    }
});

router.get('/verify/:token', function(req, res, next) {
    const token = req.params.token;
    if (token) {
        User.findOne({activationToken: token}, function(err, user) {
            if (!err && user && !user.active) {
                user.active = true;
                user.firstLogin = true;
                user.activationToken = null;
                user.isNew = false;
                user.save(function(err) {
                    if (err) {
                        console.log("Error while verifying user, ", err);
                        res.status(500).render('feedbackSubmit', { title: 'Error', message: "Something went wrong, please try again or contact our support chat at the bottom."});
                        res.end();
                        return;
                    }
              
                    createSampleData(user);     
                    res.render('feedbackSubmit', { title:'Email Verification', message: 'Verification successful. Continue to <a style="text-decoration:none;color:rgb(47,132,237)" href="/login">Login</a>' } );
                    res.end();
                });
            } else {
                res.status(400).send("Invalid Request.");
                res.end();            
            }
        });
    }

});


// create sample data after user
// successfully verified
// sample data, include sample campagin,
// and sample review.
const createSampleData = function(user) {
    const sampleCampaign = { recepients: [ 'test@outreech.io' ],
      title: 'Product Feedback',
      subject: 'Help us improve with your reviews!',
      tags: [ 'feature feedback' ],
      mailBody: '<p>Hi there, </p>\n                       <br />\n                       <p>We hope you are enjoying your experience with us! It would be great if you can quickly share your feedback and rate us.</p>\n                       <br />\n                       <p>Any inputs you give will be useful ! :)</p>',
      cta: 'Send it',
      signature: '<p>Team Outreech</p>',
      description: 'Feature Feedback: Outreech Campaigns',
      saveOnly: 'true',
      sample: true
    };

    sampleCampaign.createdBy = { name: user.name, id: user._id };
    sampleCampaign.username = user.username;
    sampleCampaign.company = user.company;


    saveOrEdit(sampleCampaign)
    setTimeout(function() {
        console.log("Sample Review", user._id);
        FeedbackRecord.update({'createdBy.id': mongoose.Types.ObjectId(user._id)}, {$set: {
            status: 'submitted',
            emailId: 'john@doe.com',
            rating: 5,
            feedbacktext: "This is an amazing service! I'v been using it for over a year and it's saved me hours of time and money!",
            sample: true
        }}).exec(function() {});
    }, 3000);
};
module.exports = router;

