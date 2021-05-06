const {RateLimiterUnion, RateLimiterMySQL, RateLimiterMemory} = require('rate-limiter-flexible');
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

        this._unionLimiter = new RateLimiterUnion(mainLimiter, intervalLimiter);
        this._mainLimiter = mainLimiter;
    }

    async consume(key, points = 1, options = {}) {
        // Consume from the union limiter and error on a single failure - return result from main limiter if possible
        try {
            const {main, interval} = await this._unionLimiter.consume(key, points, options);
            main.msBeforeNext = Math.max(main.msBeforeNext, interval.msBeforeNext);
            return main;
        } catch (result) {
            if (result instanceof Error) {
                throw result;
            }
            const {main, interval} = result;
            if (main && interval) {
                main.msBeforeNext = Math.max(main.msBeforeNext, interval.msBeforeNext);
                throw main;
            } else if (main) {
                throw main;
            } else {
                throw interval;
            }
        }
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