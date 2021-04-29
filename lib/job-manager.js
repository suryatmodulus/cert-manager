const {Sequelize} = require('sequelize');
const {RateLimiterMySQL, RateLimiterMemory, RateLimiterQueue} = require('rate-limiter-flexible');
const config = require('./config');
const logging = require('./logging');

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
                res(new RateLimiterMemory({
                    points: config.get('rateLimiter:amount'),
                    duration: config.get('rateLimiter:duration'),
                    execEvenly: true
                }));
                return;
            }
            const rateLimiter = new RateLimiterMySQL({
                storeClient: this.db,
                dbName: this.db.getDatabaseName(),
                tableName: 'RateLimits',
                points: config.get('rateLimiter:amount'),
                duration: config.get('rateLimiter:duration'),
                execEvenly: true
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
}

module.exports = JobManager;
