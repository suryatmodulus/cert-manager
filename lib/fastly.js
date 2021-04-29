const config = require('./config');
const Fastly = require('@tryghost/fastly-js');

module.exports = new Fastly(config.get('fastly'));
