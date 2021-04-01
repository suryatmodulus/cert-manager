const Greenlock = require('@root/greenlock');
const config = require('./config');
const logging = require('./logging');

const path = require('path');
const packageRootDirectory = path.dirname(require.main.filename);

const packageInfo = require('../package.json');

const gl = Greenlock.create({
    packageRoot: packageRootDirectory,
    configDir: config.get('greenlock:configDirectory'),
    packageAgent: `${packageInfo.name}/${packageInfo.version}`,
    maintainerEmail: config.get('greenlock:maintainerEmail'),
    staging: process.env.NODE_ENV !== 'production',
    notify: (event, details) => {
        if (event === 'error') {
            logging.error(details);
        } else {
            logging.info(details);
        }
    }
});

gl.manager.defaults({
    subscriberEmail: config.get('greenlock:subscriberEmail'),
    agreeToTerms: true,
    challenges: {
        'http-01': {
            module: 'acme-http-01-webroot',
            webroot: config.get('greenlock:challengeDirectory')
        }
    }
});

module.exports = gl;
