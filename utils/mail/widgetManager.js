var fs = require('fs');
var jade = require('jade');

function widgetManager(widgetName, model) {
    const template = 'views/mail/' + widgetName + '.jade';
    const style = 'views/mail/' + widgetName + '.css';
    
    var result = {};

    try {
        content = fs.readFileSync(template);
        if (!model) {
            result.html = jade.compile(content);
        } else {
            result.html = jade.compile(content)(model);
        }
    } catch (err) {
        throw err;
    }

    try {
        result.style = fs.readFileSync(style);
    } catch (err) {
        result.style = "";
        console.log("Style not found for widget " + widgetName + ", ignoring...");
    }
    return result;
}

module.exports = widgetManager;
