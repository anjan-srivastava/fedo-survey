var express = require('express');
var router = express.Router();
var path = require('path');
var mongoose = require('mongoose');

var appconfig = require('config-yml');
var Shopify = require('./shopify.js');

var saveOrEdit = require('../surveyhelper');

var License = require('../../models/License');
var User = require('../../models/User');
var Integration = require('../../models/Integration');

router.get('/shopify/install', function(req, res, next) {
	const shopify = new Shopify({ shop: req.query.shop });
    // TODO HMAC verification
    // see https://help.shopify.com/api/getting-started/authentication/oauth#verification

    res.redirect(shopify.api().buildAuthURL());
});


// after user authorize us on shopify
// we get here (shopify would call this end point, with user details
// and access token
router.get('/shopify/connect', function(req, res, next) {
	const shopify = new Shopify({ shop: req.query.shop });

	shopify.api().exchange_temporary_token(req.query, function (err, data) {
		if (!err) {
			const shopToken = data.access_token,
			scope = data.scope;

			res.redirect(`/integrations/shopify/finalize?shop_token=${ shopToken }&shop=${ req.query.shop }`);

		} else {
			console.log(err);
			res.status(403).send("Invalid authentication.");
		}
		res.end();
	});

});

// Ensure user is logged in
// now we have identified user and 
// we have access_token for user's shop
router.get('/shopify/finalize',
	require('connect-ensure-login').ensureLoggedIn(),

	function (req, res, next) {
		Integration.findOne({ userId: req.user._id, type: 'SHOPIFY' }, function (err, integration) {
			let surveyKey;
			if (integration) {
				surveyKey = integration.surveyKey;
				integration.accessToken = req.query.shop_token;
				integration.updated = new Date();
				integration.isNew = false;
				integration.save(function (err) {
					console.log(err);
				});

				
			} else {
				surveyKey = createShopifyCampaign(req.user, req.query.shop);
				new Integration({
					_id: mongoose.Types.ObjectId(),
					userId: req.user._id,
					type: 'SHOPIFY',
					surveyKey: surveyKey,
					accessToken: req.query.shop_token,
					updated: new Date()

				}).save(function (err) {
					console.log(err);
				});

			}

			res.redirect(`/app/#/surveys/${ surveyKey }/edit`);
		});
		
	}
);

function createShopifyCampaign(user, shop) {
	const data = {
		recepients: [ 'test@outreech.io' ],
	    title: 'Shopify Automated Mail',
	    subject: 'Help us improve with your reviews!',
	    tags: [ 'Shopify' ],
	    mailBody: '<p>Hi there, </p>\n                       <br />\n                       <p>We hope you are enjoying your experience with us! It would be great if you can quickly share your feedback and rate us.</p>\n                       <br />\n                       <p>Any inputs you give will be useful ! :)</p>',
	    cta: 'Send it',
	    signature: '<p>Team Outreech</p>',
	    description: `Product feedback for ${ shop }`,
	    saveOnly: 'true',
	    type: 'INTEGRATION'
	};

	data.createdBy = { name: user.name, id: user._id };
    data.username = user.username;
    data.company = user.company;

	return saveOrEdit(data);
}

module.exports = router;
