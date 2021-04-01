const {logging} = require('ghost-ignition');
const config = require('./config');

module.exports = logging(config.get('logging'));
