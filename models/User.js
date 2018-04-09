var mongoose = require('mongoose');

var schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    username: String,
    password: String,
    name: String,
    lname: String,
    company: String,
    contactNumber: String,
    address: String,
    updated: Date,
    active: Boolean,
    activationToken: String,
    passwdToken: String
});

module.exports = mongoose.model('User', schema);
