const config = require('./lib/config');

module.exports = Object.assign({}, config.get('broker'), {
    nodeID: 'local',
    transporter: {
        options: {
            // Always use localhost when testing service broker
            url: 'stan://localhost:4222'
        }
    }
});
