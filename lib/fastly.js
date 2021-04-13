// const Fastly = require('@sam-lord/fastly-js');
const Fastly = require('./fastly-library');
const config = require('./config');

const fastly = new Fastly(config.get('fastly'));

module.exports = fastly;
