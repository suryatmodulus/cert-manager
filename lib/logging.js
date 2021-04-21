const {logging} = require('ghost-ignition');
const config = require('./config');

const loggingInstance = logging(config.get('logging'));

module.exports = loggingInstance;
