var express = require('express');
var jade = require('jade');
var mailWidgetLoader = require('./widgetManager');
var config = require('config-yml');

var CampaignMailer = function() {
    const apiKey = config.mail.mailer.apiKey;
    this.ratingWidget = mailWidgetLoader('rating');
    this.mailLayout = mailWidgetLoader('layout');

    this.mailer = require('@sendgrid/mail');
    this.mailer.setApiKey(apiKey);
};

// General purpose mail function
let sendMail = function(options, type) {
    
    if (options.recepients &&
            typeof options.recepients.forEach === 'function' &&
            options.mailSubject) { // without mail subject mail won't be sent by sendgrid.
        options.recepients.forEach((function(recepient) {
        
            const ratingHtml = this.ratingWidget.html({url: recepient.submitUrl, cta: options.cta});

            // decide body based on mail type
            let mailBody = "";

            switch(type) {
                case "campaign": 
                    mailBody = this.mailLayout.html({
                    styleHtmlString: this.mailLayout.style + this.ratingWidget.style,
                    emailBodyString: options.mailBody,
                    ratingWidget: ratingHtml,
                    emailSignature: options.signature,
                    webformUrl: recepient.webformUrl});
                    break;
                default: mailBody = options.mailBody;
            }

        // prepare message
            const msg = {
                to: recepient.email,
                from: { email: config.mail.from, name: (options.fromName? options.fromName: config.mail.fromName) },
                subject: options.mailSubject,
                reply_to: options.replyto,
                html: mailBody
            };

            console.log("Sending mail to ", recepient.email, options.replyto);
            this.mailer.send(msg);
        }).bind(this));
    }
};


CampaignMailer.prototype.sendCampaignMail = function(options) {
    return sendMail.call(this, options, "campaign");
};

CampaignMailer.prototype.sendMail = sendMail;

module.exports = new CampaignMailer();
