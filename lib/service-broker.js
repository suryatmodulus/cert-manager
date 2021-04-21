const {
    ServiceBroker,
    Loggers: {
        Base: BaseLogger
    }
} = require('moleculer');
const config = require('./config');
const logging = require('./logging');

const brokerConfig = config.get('broker');

if (brokerConfig) {
    class MoleculerLogger extends BaseLogger {
        getLogHandler() {
            return (type, args) => logging[type](...args);
        }
    }

    const broker = new ServiceBroker(Object.assign({}, config.get('broker'), {
        logger: new MoleculerLogger(),
        nodeID: process.env.HOSTNAME || 'cert-manager'
    }));
    broker.loadServices();
    module.exports = broker;
} else {
    module.exports = {
        start() {
            logging.info('No service broker enabled');
        }
    };
}
