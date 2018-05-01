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
    sample: Boolean
});

schema.plugin(mongoosePaginate);
module.exports = mongoose.model('Survey', schema);
