/***
 * This module imposes license limits
 * on user calls based on their opted plans
 */

var License = require('../../models/License');
var express = require('express');
var router = express.Router();
var fs = require('fs');

const handler = function (req, res, next) {
    console.log("DEBUG", "Imposing license limit.", req.body.saveOnly);
    const data = req.body;
    const session = req.session;
    const testRun = data.testRun; 
    let recepients = data.recepients;

    // Override inline recepients list, if CSV is uploaded
    if (session.uploadedEmailsPath && !testRun ) {
       const recepData = JSON.parse(fs.readFileSync(session.uploadedEmailsPath, 'utf-8'));
      if (recepData && recepData._.length) {
          recepients = recepData._;
      }
    }

    if (!req.body.saveOnly) {
        License.findOne({userId: req.user._id})
            .exec(function(err, doc) {
                if (!err && doc) {
                    let currentCount = 0;
                    if (doc.limits && doc.limits.email) currentCount = doc.limits.email;
                    if ((currentCount + recepients.length) > doc.maxlimits.email) {
                        console.log("DEBUG", "Email limit exhausted.");
                        res.status(403).send(`We can only send ${doc.maxlimits.email} emails. Try reducing the number of email addresses and try again`);
                        res.end();
                    } else {
                        next();
                    }
                } else {
                    next();
                }
            });
    } else { 
        next();
    }
};

router.post('/api/surveys/create', handler);
router.post('/api/surveys/:surveyKey/edit', handler);

module.exports = router;
    
