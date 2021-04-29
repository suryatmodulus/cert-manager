const {
    ServiceBroker,
    Loggers: {
        Base: BaseLogger
    }
} = require('moleculer');

const domainsService = require('../services/domains/domains.service');

const config = require('./config');
const logging = require('./logging');

module.exports = ({certificateService}) => {
    const brokerConfig = config.get('broker');

    if (brokerConfig) {
        class MoleculerLogger extends BaseLogger {
            getLogHandler() {
                return (type, args) => logging[type](...args);
            }
        }

        const serviceBroker = new ServiceBroker(Object.assign({}, config.get('broker'), {
            logger: new MoleculerLogger(),
            nodeID: process.env.HOSTNAME || 'cert-manager'
        }));

        serviceBroker.createService(domainsService({certificateService}));
        return serviceBroker;
    } else {
        return {
            start() {
                logging.info('No service broker enabled');
            }
        };
    }
};
