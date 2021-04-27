const {Sequelize, Model, DataTypes} = require('sequelize');
const {RateLimiterMySQL, RateLimiterQueue} = require('rate-limiter-flexible');
const logging = require('./logging');

class CertificateJob extends Model {};

/**
 * Status of a certificate job can be:
 * - Queued: Waiting to start
 * - Deploying: Got certificate successfully, waiting for Fastly to deploy
 * - Deployed: Deployed certificate to Fastly, keeping record to avoid repeated checks for certificate deployment
 * - Failed: Encountered an error either during the creation of certificate or while deploying to Fastly
 */
const CertificateJobStatus = {
    QUEUED: 'QUEUED',
    COMPLETED: 'COMPLETED',
    DEPLOYED: 'DEPLOYED',
    ERROR: 'ERROR'
};

const LimiterKey = 'limiter';

class JobManager {
    constructor({database, jobHandler}) {
        if (!database) {
            this.db = new Sequelize('sqlite::memory:');
        } else {
            this.db = new Sequelize(database);
        }

        this._jobHandler = jobHandler;

        // Hard-code limit type for now
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
            const rateLimiter = new RateLimiterMySQL({
                storeClient: this.db,
                dbName: this.db.getDatabaseName(),
                tableName: 'RateLimits',
                points: 100,
                duration: 3600, // 1 hour
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

        await CertificateJob.init({
            subject: {
                type: DataTypes.STRING
            },
            status: {
                type: DataTypes.STRING
            }
        }, {
            sequelize: this.db,
            modelName: 'CertificateJob'
        });

        await CertificateJob.sync();

        // If running in distributed scenario, find existing jobs and queue them
        this._initialiseBacklog();
    }

    async addJob({subject}) {
        await this._setupPromise;
        await CertificateJob.create({
            subject,
            status: CertificateJobStatus.QUEUED
        });
        
        // This may take many seconds / minutes to resolve
        this._limitedQueue.removeTokens(1).then(() => {
            this._processJob();
        });
    }

    async removeToken() {
        await this._setupPromise;
        try {
            await this._rateLimiter.penalty('limiter', 1);
        } catch (err) {
            logging.error('Failed to apply penalty to rate limit for renewal', err);
        }
    }

    async _processJob() {
        const job = await CertificateJob.findOne({
            where: {
                status: CertificateJobStatus.QUEUED
            },
            order: [
                ['createdAt', 'ASC']
            ]
        });

        if (!job) {
            // Empty job queue - can happen in distributed scenarios, return token to pool
            await this._rateLimiter(LimiterKey, 1);
            return;
        }

        // TODO: handle failures
        await this._jobHandler(job.subject);

        job.status = CertificateJobStatus.COMPLETED;
        await job.save();
    }

    async _initialiseBacklog() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.QUEUED
            }
        });

        // Add all current jobs to queue in case picking up from dead server
        // May pick up other servers' jobs, but the total rate limit will be conserved
        for (const _job of jobs) {
            this._rateLimiter.removeTokens(1).then(() => {
                this._processJob();
            });
        }
    }
}

module.exports = JobManager;
