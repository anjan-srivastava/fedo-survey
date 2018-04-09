var express = require('express');
var mongoose = require('mongoose');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bcrypt = require('bcrypt');
var config = require('config-yml');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var User = require('./models/User');

// routes
var index = require('./routes/index');
var user = require('./routes/user');
var settings = require('./routes/settings');
var widgetManager = require('./routes/widgetManager');
var recepients = require('./routes/recepients');
var feedback = require('./routes/feedback');
var feedbacksubmit = require('./routes/feedbacksubmit');
var survey = require('./routes/survey');
var signup = require('./routes/signup');
var forgotpasswd = require('./routes/forgotpasswd');

mongoose.connect(config.db.url, {useMongoClient: true});

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({secret: 'c50e92ee0-5cc3-4323-b836-ae6c8a4f6ad2', saveUninitialized: false, resave: false }))
app.use(passport.initialize());
app.use(passport.session());

// configure passport
passport.use(new LocalStrategy(function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
        if (err) return done(err);
        if (!user) return done(null, false);
        bcrypt.compare(password, user.password).then(function(passed) {
            if (!passed)
                return done(null, false);

            if (!user.active) return done(null, false);
            // successful login
            return done(null, user);
        });
    });
}));

passport.serializeUser(function(user, cb) {
      cb(null, user._id);
});

passport.deserializeUser(function(id, cb) {
    User.findOne({ _id: id}, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});


app.use(function (err, req, res, next) {
      console.log(err.stack);
      res.status(500).send('Something broke!');
      next();
});

/**
 * app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

**/

app.get('/signup',
  function(req, res){
    res.render('signup', { title: 'Fedo - Signup', contentStyle: '/stylesheets/login.css'});
  });

app.get('/forgotpasswd',
  function(req, res){
    res.render('forgotPassword', { title: 'Fedo - Forgot Password', contentStyle: '/stylesheets/login.css'});
  });

app.get('/login',
  function(req, res){
    res.render('login', { title: 'Fedo - Login', contentStyle: '/stylesheets/login.css'});
  });
  
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });
  
app.get('/logout',
  function(req, res){
    req.logout();
    if (req.session) req.session.destroy();
    res.set("Connection", "close");
    res.redirect('/login');
  });

app.use('/widgets', widgetManager);


app.use('/api/users', 
        require('connect-ensure-login').ensureLoggedIn(),
        user);
app.use('/api/settings', 
        require('connect-ensure-login').ensureLoggedIn(),
        settings);
app.use('/api/recepients', 
        require('connect-ensure-login').ensureLoggedIn(),
        recepients);
app.use('/api/surveys', 
        require('connect-ensure-login').ensureLoggedIn(),
        survey);
app.use('/api/feedbacks/submit',
        feedbacksubmit);
app.use('/api/signup',
        signup);
app.use('/api/forgotpasswd',
        forgotpasswd);
app.use('/api/feedbacks',
        require('connect-ensure-login').ensureLoggedIn(),
        feedback);

app.use('/', 
        require('connect-ensure-login').ensureLoggedIn(),
        index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

