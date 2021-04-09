const express = require('express');
const apiApp = express();
const challengeApp = express();

const config = require('./lib/config');
const logging = require('./lib/logging');
const challengeResponder = require('./lib/challenge-responder');
const apiRoutes = require('./lib/api');
const greenlock = require('./lib/greenlock');

/**
 * Main functionality includes:
 * - setting up HTTP server to respond to ACME challenges
 * - setting up HTTP server to respond to API requests (separate port)
 * - starting Greenlock
 */
async function main() {
    challengeApp.use(challengeResponder);
    challengeApp.listen(config.get('challengeResponder:port'));
    logging.info(`ACME challenge app listening on port ${config.get('challengeResponder:port')}`);

    apiApp.use(apiRoutes);
    apiApp.listen(config.get('api:port'));
    logging.info(`Domain API listening on port ${config.get('api:port')}`);

    // Initialise greenlock
    await greenlock();
}

main();
