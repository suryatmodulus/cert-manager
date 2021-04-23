/**
 * Test Utilities
 *
 * Shared utils for writing tests
 */

// Require overrides - these add globals for tests
require('./overrides');

// Require assertions - adds custom should assertions
require('./assertions');

const crypto = require('crypto');
const fetch = require('node-fetch');
const querystring = require('querystring');

const config = require('../../lib/config');
const HMAC_KEY = config.get('api:hmac');

/**
 * Assume resource to be string URL
 * Assume init to be options
 */
const hmacFetch = (resource, init) => {
    const url = new URL(resource);
    const params = url.searchParams;
    params.set('t', Math.floor(Date.now() / 1000));
    url.searchParams = params;
    const unsignedPath = url.pathname + url.search;
    const hmac = crypto.createHmac('sha1', HMAC_KEY).update(unsignedPath).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const signedPath = unsignedPath + `&hmac=${querystring.escape(hmac)}`;

    return fetch(url.origin + signedPath, init);
};

module.exports = {
    hmacFetch
};
