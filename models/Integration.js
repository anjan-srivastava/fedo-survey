var mongoose = require('mongoose');

var schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    type: ['SHOPIFY'],
    surveyKey: String,
    accessToken: String,
    updated: Date
});

module.exports = mongoose.model('Integration', schema);
