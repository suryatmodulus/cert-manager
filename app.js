const express = require('express');
const apiApp = express();
const challengeApp = express();

const config = require('./lib/config');
const dbConfig = require('./lib/database');
const logging = require('@tryghost/logging');
const challengeResponder = require('./lib/challenge-responder');
const apiRoutes = require('./lib/api');
const fastly = require('./lib/fastly');
const greenlock = require('./lib/greenlock');
const CertificateService = require('./lib/certificate-service');
const serviceBroker = require('./lib/service-broker');

// For debugging memory leak
require('heapdump');

/**
 * Main functionality includes:
 * - setting up HTTP server to respond to ACME challenges
 * - setting up HTTP server to respond to API requests (separate port)
 * - starting Greenlock
 */
async function main() {
    const certificateService = new CertificateService({
        greenlock: await greenlock(),
        fastly,
        database: dbConfig
    });

    challengeApp.use(challengeResponder({
        certificateService
    }));
    challengeApp.listen(config.get('challengeResponder:port'));
    logging.info(`ACME challenge app listening on port ${config.get('challengeResponder:port')}`);

    apiApp.use(apiRoutes({
        certificateService
    }));
    apiApp.listen(config.get('api:port'));
    logging.info(`Domain API listening on port ${config.get('api:port')}`);

    serviceBroker({
        certificateService
    }).start();
}

process.on('unhandledRejection', (error) => {
    let errorMessage = '';
    if (error && 'message' in error) {
        // Take first line of error message to avoid huge log entries
        errorMessage = '\n\tError message: ' + String(error.message).split('\n')[0];
    }
    logging.error('Unhandled promise rejection - Caught at application level' + errorMessage);
});

main();
