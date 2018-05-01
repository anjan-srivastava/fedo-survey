var express = require('express');
var router = express.Router();
var path = require('path');
var uuid = require('uuid/v4');
var config = require('config-yml');
var bcrypt = require('bcrypt');
var campaignMailer = require('../utils/mail/campaignMailer');
var User = require('../models/User');


const saltRounds = 10;

router.post('/sendlink', function(req, res, next) {
    const email = req.body.email;
    if (email) {
        User.findOne({username: email}, function(err, user) {
            if (err) {
                res.status('500').render('feedbackSubmit', { title: 'Error', message: 'Something went wrong, please try again'});
            } else if (user && user.active) {
                const passwdToken = uuid();
                const changeLink = config.app.url + '/api/forgotpasswd/change/' + passwdToken;

                user.passwdToken = passwdToken;
                user.isNew = false;
                user.save(function(err) {
                    if (err) console.log("Error while sending change password link.", err);
                });

                campaignMailer.sendMail({
                    recepients: [ { email: email }],
                    mailSubject: 'Outreech - Change Password',
                    mailBody: '<p>Please <a href="' + changeLink +'">click here</a> to change your password.</p>'
                });
                res.render('feedbackSubmit', { title: 'Password change email', message: 'Please check your mail to continue...'});
            
            }        
            res.end();
        });

    }

});

router.get('/change/:passwdToken', function(req, res, next) {
    const passwdToken = req.params.passwdToken;

    if (passwdToken) {
        User.findOne({passwdToken: passwdToken}, function(err, user) {
            if (user) {
                const newPasswdToken = uuid();
                user.passwdToken = newPasswdToken;
                user.isNew = false;
                user.save(function(err) { if (err) console.log("Something went wrong while generating new pass token."); });
                res.render('changepasswd', {title: 'Change Password', passwdToken: newPasswdToken , contentStyle: '/stylesheets/login.css'});
                res.end();
            } else {
                res.status(400).send('Invalid Request.');
                res.end();
            }
        });
    
    } else {
        res.end();
    }

});


router.post('/update', function(req, res, next) {
    const {
        password,
        confirmpassword,
        token
    } = req.body;



    if (token) {
       User.findOne({passwdToken: token}, function(err, user) {
            if (user) {
                if (password && password != confirmpassword) {
                    res.redirect('/api/forgotpasswd/change/' + token);
                    res.end(); 
                } else if (password == confirmpassword) {
                    bcrypt.hash(password, saltRounds, function(err, hash) {
                        if (err) {
                            res.status(500).render('feedbackSubmit', {title: 'Error', message: 'Something went wrong, please try again.'});
                            res.end();
                            return;
                        }
                    
                        user.password = hash;
                        user.passwdToken = null;
                        user.isNew = false;

                        user.save(function(err) {
                            if (err) console.log("Error while updating password.", err);
                        });
                        
                        res.render('feedbackSubmit', {title: 'Password Changed', message: 'Password changed successfully, <a style="text-decoration:none;color:rgb(47,132,237)" href="/login">Login</a> to continue.'});
                        res.end();

                    });              
                     
                }

            } else {
                res.status(400).send("Invalid Request");
                res.end();
            }
       
       }); 
    
    } else {
        res.status(400).send("Invalid Request.");
        res.end();
    }
});


module.exports = router;
