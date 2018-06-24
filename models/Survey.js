var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    surveyKey: String,
    recepients: [String],
    title: String,
    description: String,
    subject: String,
    tags: [String],
    mailBody: String,
    cta: String,
    signature: String,
    created: Date,
    createdBy: Object,
    type: ['SAMPLE', 'REGULAR', 'INTEGRATION'],
    config: Object // extra config, in case of type: INTEGRATION, would be config for automated mails
});

schema.plugin(mongoosePaginate);
module.exports = mongoose.model('Survey', schema);
