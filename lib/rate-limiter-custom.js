const {RateLimiterMySQL, RateLimiterMemory} = require('rate-limiter-flexible');
const RateLimiterAbstract = require('rate-limiter-flexible/lib/RateLimiterAbstract');

module.exports = class RateLimiterCustom extends RateLimiterAbstract {
    constructor(options = {}, callback) {
        super(options);

        const limiterType = (options.storeClient)
            ? RateLimiterMySQL
            : RateLimiterMemory;

        const mainLimiter = new limiterType(Object.assign({}, options, {
            keyPrefix: 'main'
        }), callback);

        const intervalLimiter = new limiterType(Object.assign({}, options, {
            keyPrefix: 'interval',
            points: 1,
            duration: Math.ceil(this.duration / this.points)
        }));

        this._mainLimiter = mainLimiter;
        this._intervalLimiter = intervalLimiter;
    }

    async consume(key, points = 1, options = {}) {
        await this._intervalLimiter.consume(key, points, options);
        return await this._mainLimiter.consume(key, points, options);
    }

    penalty(key, points = 1) {
        return this._mainLimiter.penalty(key, points);
    }

    reward(key, points = 1) {
        return this._mainLimiter.reward(key, points);
    }

    get(key) {
        return this._mainLimiter.get(key);
    }

    set(key, points, secDuration) {
        return this._mainLimiter.set(key, points, secDuration);
    }

    block(key, secDuration) {
        return this._mainLimiter.block(key, secDuration);
    }

    delete(key) {
        return this._mainLimiter.delete(key);
    }
};