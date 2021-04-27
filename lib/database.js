const config = require('./config');

module.exports = {
    dialect: config.get('database:client'),
    host: config.get('database:connection:host'),
    port: config.get('database:connection:port') || 3306,
    database: config.get('database:connection:database'),
    username: config.get('database:connection:user'),
    password: config.get('database:connection:password'),
    define: {
        charset: config.get('database:connection:charset')
    },
    logging: false
};
