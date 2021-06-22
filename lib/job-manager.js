const {Sequelize} = require('sequelize');
const RateLimiter = require('./rate-limiter-custom');
const {RateLimiterQueue} = require('rate-limiter-flexible');
// Using internal copy of rate limite queue for bugfixes - TODO upstream
//const RateLimiterQueue = require('./rate-limit-queue');
const config = require('./config');
const logging = require('@tryghost/logging');

const LimiterKey = 'limiter';

class JobManager {
    constructor({database, jobHandler}) {
        if (!database) {
            this.db = new Sequelize('sqlite::memory:');
        } else {
            this.db = new Sequelize(database);
        }

        this._jobHandler = jobHandler;

        this._setupPromise = this._init();
    }

    async _init() {
        try {
            await this.db.authenticate();
        } catch (error) {
            throw new Error('Failed to authenticate with database', error);
        }

        // Rate limiter is expected
        this._rateLimiter = await new Promise((res, rej) => {
            if (this.db.getDialect() !== 'mysql') {
                res(new RateLimiter({
                    points: config.get('rateLimiter:amount'),
                    duration: config.get('rateLimiter:duration')
                }));
                return;
            }
            const rateLimiter = new RateLimiter({
                storeClient: this.db,
                dbName: this.db.getDatabaseName(),
                tableName: 'RateLimits',
                points: config.get('rateLimiter:amount'),
                duration: config.get('rateLimiter:duration')
            }, (err) => {
                if (err) {
                    rej(err);
                } else {
                    res(rateLimiter);
                }
            });
        });
        this._limitedQueue = new RateLimiterQueue(this._rateLimiter);
    }

    async addJob() {
        await this._setupPromise;
        // This may take many seconds / minutes to resolve
        this._limitedQueue.removeTokens(1).then(() => {
            this._jobHandler();
        });
    }

    async removeToken() {
        await this._setupPromise;
        try {
            await this._rateLimiter.penalty(LimiterKey, 1);
        } catch (err) {
            logging.error('Failed to apply penalty to rate limit for renewal', err);
        }
    }

    async addToken() {
        await this._setupPromise;
        try {
            await this._rateLimiter.reward(LimiterKey, 1);
        } catch (err) {
            logging.error('Failed to apply reward to rate limit for empty job', err);
        }
    }

    async blockPeriod() {
        await this._setupPromise;
        try {
            await this._rateLimiter.block(LimiterKey, config.get('rateLimiter:duration'));
        } catch (err) {
            logging.error('Failed to apply block to rate limit for period', err);
        }
    }
}

module.exports = JobManager;
