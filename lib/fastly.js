const Fastly = require('@tryghost/fastly-js');
const config = require('./config');

const fastly = new Fastly(config.get('fastly'));

module.exports = fastly;
