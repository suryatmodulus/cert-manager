const {
    ServiceBroker,
    Loggers: {
        Base: BaseLogger
    },
    Service
} = require('moleculer');

const config = require('./config');
const logging = require('./logging');

module.exports = ({greenlock}) => {
    const brokerConfig = config.get('broker');

    if (brokerConfig) {
        class MoleculerLogger extends BaseLogger {
            getLogHandler() {
                return (type, args) => logging[type](...args);
            }
        }

        const serviceBroker = new ServiceBroker(Object.assign({}, config.get('broker'), {
            logger: new MoleculerLogger(),
            nodeID: process.env.HOSTNAME || 'cert-manager',
            ServiceFactory: class InjectionServiceFactory extends Service {
                constructor(broker, schema) {
                    if (schema instanceof Function) {
                        // Intialise Service with all dependencies
                        super(broker, schema({
                            greenlock
                        }));
                    } else {
                        super(broker, schema);
                    }
                }
            }
        }));

        serviceBroker.loadServices();
        return serviceBroker;
    } else {
        return {
            start() {
                logging.info('No service broker enabled');
            }
        };
    }
};
