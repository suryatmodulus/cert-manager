const Greenlock = require('@sam-lord/greenlock');
const config = require('./config');
const dbConfig = require('./database');
const logging = require('@tryghost/logging');

const EventEmitter = require('events');
const path = require('path');
const packageRootDirectory = path.dirname(require.main.filename);

const packageInfo = require('../package.json');

class GreenlockEvents extends EventEmitter {
    notify(event, details) {
        this.emit(event, details);
    }
}

async function createInstance() {
    const glEvents = new GreenlockEvents();

    const gl = Greenlock.create({
        packageRoot: packageRootDirectory,
        agreeToTerms: true,
        manager: {
            module: '@tryghost/greenlock-manager-sequelize',
            database: dbConfig
        },
        configDir: config.get('greenlock:configDirectory'),
        packageAgent: `${packageInfo.name}/${packageInfo.version}`,
        maintainerEmail: config.get('greenlock:maintainerEmail'),
        staging: process.env.NODE_ENV !== 'production' && !config.get('greenlock:directoryUrl'),
        notify: (event, details) => {
            if (event !== 'error') {
                logging.info('Event: ' + event, details);
            }
            // Errors only logged through glEvents
            glEvents.notify(event, details);
        }
    });

    await gl.manager.defaults({
        subscriberEmail: config.get('greenlock:subscriberEmail'),
        agreeToTerms: true,
        // This outputs a warning - but the warning is bogus
        directoryUrl: config.get('greenlock:directoryUrl'),
        store: {
            module: '@tryghost/greenlock-store-sequelize',
            database: dbConfig
        },
        challenges: {
            'http-01': {
                module: '@tryghost/acme-http-01-sequelize',
                database: dbConfig
            }
        },
        renewOffset: config.get('greenlock:renewOffset'),
        renewStagger: config.get('greenlock:renewStagger')
    });

    gl.events = glEvents;

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
