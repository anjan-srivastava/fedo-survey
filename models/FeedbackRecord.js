var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({ 
    feedbackKey: String,
    surveyKey: String,
    emailId: String,
    name: String,
    rating: Number,
    feedbacktext: String,
    status: String,
    tags: [String],
    updated: Date,
    createdBy: Object
});

schema.plugin(mongoosePaginate);
module.exports = mongoose.model('FeedbackRecord', schema);
