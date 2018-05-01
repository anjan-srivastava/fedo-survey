var mongoose = require('mongoose');

var schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    username: String,
    company: String,
    updated: Date,
    widgetToken: String,
    widgetConfig: Object,
    emailConfig: Object
});

module.exports = mongoose.model('Settings', schema);
