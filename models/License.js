var mongoose = require('mongoose');

var schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId, // reference to `User._id`
    started: Date,
    limitDays: Number,
    plan: String,
    active: Boolean,
    limits: Object, // current values
    maxlimits: Object
});

module.exports = mongoose.model('License', schema);
