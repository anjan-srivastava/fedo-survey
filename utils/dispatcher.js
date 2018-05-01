var browser = require('browser-detect');

module.exports = (function() {
    let table = [],
        match = function (path, method) {
            let found = table.find(function(u) { return u.pattern.test(path); });
            if (found && found[method]) return found[method];
            return null;
        },
    sharedProps = function (req) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const ua = browser(req.headers['user-agent']);
        let props = {
            ip: ip,
            $browser: ua.name,
            $browser_version: ua.version,
            $os: ua.os        
        };

        if (req.user) props.distinct_id = req.user.id;
        return props;
    };

    const register = function(pathPattern, method, handler, delay) {
        let found = table.find(function(u) { return u.pattern.toString() === pathPattern.toString() });
        if (!found) { 
            found = {};
            table.push(found);
        }

        found.pattern = pathPattern;
        found[method] = { handler: handler, delay: delay };
    },

    dispatch = function(req, res) {
        let handler = match(req.originalUrl, req.method),
            delay = handler && handler.delay;
        handler = handler && handler.handler;

        if (delay !== 0) { 
            // in some cases session data would not be instantly available
            setTimeout(function() { 
                    try { 
                        handler && handler(req, res, sharedProps(req)); 
                    } catch (e) {
                        console.log("dispatcher:: Error while calling handler", e);
                    } 
                },
                delay || 1000);
        } else {
            handler && handler(req, res, sharedProps(req));
        }
    };

    return { register: register, dispatch: dispatch };
});    
