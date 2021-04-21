const Greenlock = require('@sam-lord/greenlock');
const config = require('./config');
const logging = require('./logging');

const path = require('path');
const packageRootDirectory = path.dirname(require.main.filename);

const packageInfo = require('../package.json');

const dbConfig = {
    dialect: config.get('database:client'),
    host: config.get('database:connection:host'),
    database: config.get('database:connection:database'),
    username: config.get('database:connection:user'),
    password: config.get('database:connection:password'),
    define: {
        charset: config.get('database:connection:charset')
    },
    logging: false
};

async function createInstance() {
    const gl = Greenlock.create({
        packageRoot: packageRootDirectory,
        agreeToTerms: true,
        manager: {
            module: '@tryghost/greenlock-manager-fastly',
            fastly: config.get('fastly'),
            persistentManager: {
                module: '@tryghost/greenlock-manager-sequelize',
                database: dbConfig
            }
        },
        configDir: config.get('greenlock:configDirectory'),
        packageAgent: `${packageInfo.name}/${packageInfo.version}`,
        maintainerEmail: config.get('greenlock:maintainerEmail'),
        staging: process.env.NODE_ENV !== 'production' && !config.get('greenlock:directoryUrl'),
        notify: (event, details) => {
            if (event === 'error') {
                logging.error('Event: ' + event, details);
            } else {
                logging.info('Event: ' + event, details);
            }
        }
    });

    await gl.manager.defaults({
        subscriberEmail: config.get('greenlock:subscriberEmail'),
        agreeToTerms: true,
        // This outputs a warning - but the warning is bogus
        directoryUrl: config.get('greenlock:directoryUrl'),
        store: {
            module: '@tryghost/greenlock-fastly-store',
            fastly: config.get('fastly'),
            persistentStore: {
                module: '@tryghost/greenlock-store-sequelize',
                database: dbConfig
            }
        },
        challenges: {
            'http-01': {
                module: '@tryghost/acme-http-01-sequelize',
                database: dbConfig
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
