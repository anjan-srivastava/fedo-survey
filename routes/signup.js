var express = require('express');
var router = express.Router();
var path = require('path');
var uuid = require('uuid/v4');
var bcrypt = require('bcrypt');
var User = require('../models/User');
var mongoose = require('mongoose');
var config = require('config-yml');
var campaignMailer = require('../utils/mail/campaignMailer');

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
                res.redirect('/signup?error=Email already taken.');
                return;
            }

            bcrypt.hash(password, saltRounds, function(err, hash) {
                if (err) { res.status(500).render('feedbackSubmit', { title: 'Error', message: "Something went wrong, please try again."});res.end(); return; }
                (new User({
                    _id: mongoose.Types.ObjectId(),
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
                            res.end();
                        }
                    });


                // send verification mail;
                campaignMailer.sendMail({
                    recepients: [ { email: email} ],
                    mailSubject: 'Fedo - Signup verification',
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
                user.activationToken = null;
                user.isNew = false;
                user.save(function(err) {
                    if (err) {
                        console.log("Error while verifying user, ", err);
                        res.status(500).render('feedbackSubmit', { title: 'Error', message: "Something went wrong, please try again or contact support@fedo.com"});
                        res.end();
                        return;
                    }
                   
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
module.exports = router;
