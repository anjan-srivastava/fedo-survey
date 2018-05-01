var Mixpanel = require('mixpanel');
var config = require('config-yml');
var Survey = require('../../models/Survey');
var FeedbackRecord = require('../../models/FeedbackRecord');
var License = require('../../models/License');
var Settings = require('../../models/Settings');
var Dispatcher = require('../dispatcher.js');

const dispatcher = Dispatcher();
const mixpanel = Mixpanel.init(config.analytics.apiToken);

// TODO remove this dispatcher thing, as this can be done using simply middlewares

/****** Event: `Initiate Sign in` */
dispatcher.register(/^\/login$/, 'GET', function(req, res, props) {
    mixpanel.track('Initiate Sign in', { ...props });    
});

/****** Event: `Complete Sign in` */
dispatcher.register(/^\/login$/, 'POST', function(req, res, props) {
    if ((res.statusCode != 200 && res.statusCode !=302) || !req.user) return;

    License.findOne({userId: req.user._id})
        .exec(function(err, doc) {
            let lic = 'BASIC'
            if (!err && doc) lic = doc.plan;

            mixpanel.people.set(req.user.id, {
                $email: req.user.username,
                $first_name: req.user.name,
                $last_name: req.user.lname,
                'User Type': 'Free', // TODO
                'Plan Name': lic,
                'Plan Subscription': 'Monthly',
                'Company': req.user.company,
                ... props
            });
           
            mixpanel.alias(req.user.id, req.user.username); 
            mixpanel.track('Complete Sign in', { ...props });
        });
});


/****** Event: `Initiate Sign up` */
dispatcher.register(/^\/signup(\?.*)?$/, 'GET', function (req, res, props) {
    let plan;
    switch (req.query.plan) {
        case 'basic': plan = 'Basic';
                       break;
        case 'pro': plan = 'Pro';
                     break;
        default: plan = 'None';
    }

    mixpanel.track('Initiate Sign up', { ...props, 'Plan Type': plan });
});


/****** Event: `Complete Sign up` */
dispatcher.register(/^\/api\/signup$/, 'POST', function (req, res, props) {
    if (res.statusCode != 200) return;
    let plan;
    
    switch (req.body.plan) {
        case 'basic': plan = 'Basic';
                       break;
        case 'pro': plan = 'Pro';
                     break;
        default: plan = 'None';
    }

    mixpanel.track('Complete Sign up', { ...props, distinct_id: req.body.email, 'Plan Type': plan });
});

/****** Event: `Save Campaign, Trigger Campaign` */
const handler = function (req, res, props) {
    if (res.statusCode != 200) return;
    if (req.body.saveOnly) {
        mixpanel.track('Save Campaign', {
            ...props, 
            'Campagin Name': req.body.title,
            'Emails Added': req.body.recepients.length,
            'Email Upload Type': req.session.uploadedEmailsPath?'CSV': 'Direct'
        });    
    } else {
        mixpanel.track('Trigger Campaign', { ...props, 'Campaign Name': req.body.title });
        mixpanel.people.increment(req.user.id, 'Total Emails sent', req.body.recepients.length);
    }

    if (req.originalUrl.includes('create')) {
        mixpanel.people.increment(req.user.id, 'Total Campaigns Created');
    }
};

dispatcher.register(/^\/api\/surveys\/create$/, 'POST', handler);
dispatcher.register(/^\/api\/surveys\/[^\/]+\/edit$/, 'POST', handler);

/****** Event: `Review Created` */
const reviewHandler = function (req, res, props) {
    Survey.findOne({surveyKey: req.params.sk})
        .exec(function (err, doc) {
            if (!err && doc) {
                mixpanel.track('Review Created', {
                    ...props,
                    'Campaign Name': doc.title,
                    distinct_id: doc.createdBy.id
                });

                mixpanel.people.increment(doc.createdBy.id, 'Total Reviews Created');
            }
        });
};

dispatcher.register(/^\/api\/feedbacks\/submit\/[^\/]+\/.+$/, 'GET', reviewHandler);
dispatcher.register(/^\/api\/feedbacks\/submit\/[^\/]+\/.+$/, 'POST', reviewHandler);

/****** Event: `Publish Review`, `Unpublish Review` */
const handlerFor = function (reviewEvent) {
    return (function (req, res, props) {
        FeedbackRecord.findOne({feedbackKey: req.params.fkey})
            .exec(function (err, doc) {
                if (!err && doc) {
                    Survey.findOne({surveyKey: doc.surveyKey})
                        .exec(function (err, doc) {
                            if (!err && doc)
                                mixpanel.track(reviewEvent, { ...props, 'Campaign Name': doc.title });

                            try {
                                if (reviewEvent === 'Publish Review') {
                                    mixpanel.people.increment(req.user.id, 'Total Reviews Published');
                                } else {
                                    mixpanel.people.increment(req.user.id, 'Total Reviews Published', -1);
                                }
                            } catch (e) { console.log("Error while reporting to mixpanel", e); }
                        });
                }
            });
    });
};

dispatcher.register(/^\/api\/feedbacks\/[^\/]+\/publish$/, 'PUT', handlerFor('Publish Review')); 
dispatcher.register(/^\/api\/feedbacks\/[^\/]+\/unpublish$/, 'PUT', handlerFor('Unpublish Review')); 


/****** Event: `Settings Updated` */
const settingHandler = function (req, res, props) {
    let categ = 'Widget';
    if (req.originalUrl.includes('widget')) categ = 'Widget';
    else if (req.originalUrl.includes('profile')) categ = 'Profile';
    else if (req.originalUrl.includes('email')) categ = 'Email';

    mixpanel.track('Settings Updated', { ...props, Category: categ });
};
dispatcher.register(/^\/api\/settings\/.+$/, 'POST', settingHandler); 
dispatcher.register(/^\/api\/settings\/.+$/, 'PUT', settingHandler); 

/****** Event: `Logout` */
dispatcher.register(/^\/logout$/, 'GET', function (req, res, props) {
    mixpanel.track('Logout', { ...props });
}, 0);

/***** Widget tracking */
dispatcher.register(/^\/widgets\/[^\/]+\/widget\.js$/,'GET', function (req, res, props) {
    const token = req.params.widgetToken;
    let ref = req.headers['referer'];
    Settings.findOne({
        widgetToken: token
    }).exec(function (err, doc) {
        if (!err && doc) {
            mixpanel.people.union(doc.username, {
                widgetUrls: [ ref ]
            });
        }
    });        
});

// middleware for logging analytics to mixpanel
module.exports = function(req, res, next) {
    console.log("DEBUG", req.originalUrl, req.method, res.statusCode);
    try {
        dispatcher.dispatch(req, res);
    } catch (e) {
        console.error("Error while reporting to mixpanel", e);
    }

    next();
};
