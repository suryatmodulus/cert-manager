const config = require('../lib/config');
const logging = require('@tryghost/logging');
const errors = require('@tryghost/errors');
const crypto = require('crypto');
const querystring = require('querystring');

const withinRange = function (requestTime) {
    const current = Math.floor(Date.now() / 1000); // Current time in seconds
    const difference = current - requestTime;
    // Request must have happened less that 120 seconds ago, and no
    // more than 60 seconds into the future
    return difference >= -60 && difference <= 120;
};

module.exports = function authenticateHmac(req, res, next) {
    const unsignedPath = req.url.replace(/&hmac=.*/, '');
    const HMAC_KEY = config.get('api:hmac');

    let hash = crypto.createHmac('sha1', HMAC_KEY).update(unsignedPath).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
    let reqHash = querystring.unescape(req.query.hmac);

    if (hash === reqHash && withinRange(parseInt(req.query.t))) {
        return next();
    } else {
        logging.info('Authentication: User failed HMAC authentication');
        return next(new errors.UnauthorizedError({message: 'Access denied.'}));
    }
};
