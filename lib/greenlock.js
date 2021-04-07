const Greenlock = require('@root/greenlock');
const config = require('./config');
const logging = require('./logging');

const path = require('path');
const packageRootDirectory = path.dirname(require.main.filename);

const packageInfo = require('../package.json');

async function createInstance() {
    const gl = Greenlock.create({
        packageRoot: packageRootDirectory,
        configDir: config.get('greenlock:configDirectory'),
        packageAgent: `${packageInfo.name}/${packageInfo.version}`,
        maintainerEmail: config.get('greenlock:maintainerEmail'),
        staging: process.env.NODE_ENV !== 'production' && !config.get('greenlock:directoryUrl'),
        notify: (event, details) => {
            if (event === 'error') {
                logging.error(details);
            } else {
                logging.info(details);
            }
        }
    });

    await gl.manager.defaults({
        subscriberEmail: config.get('greenlock:subscriberEmail'),
        agreeToTerms: true,
        // This outputs a warning - but the warning is bogus
        directoryUrl: config.get('greenlock:directoryUrl'),
        challenges: {
            'http-01': {
                module: 'acme-http-01-webroot',
                webroot: config.get('greenlock:challengeDirectory')
            }
        }
    });

    logging.info('Initialised Greenlock successfully');

    return gl;
}

// Greenlock is a singleton, can be imported in multiple places
let greenlockPromise = null;
module.exports = function getInstance() {
    if (!greenlockPromise) {
        greenlockPromise = createInstance();
    }
    return greenlockPromise;
};
