const {Sequelize, Model, DataTypes} = require('sequelize');
const JobManager = require('./job-manager');
const logging = require('./logging');

class CertificateJob extends Model {}

/**
 * Status of a certificate job can be:
 * - Queued: Waiting to start
 * - Pending: Greenlock is acquiring a certificate
 * - Created: Got certificate successfully, waiting for Fastly to deploy
 * - Deployed: Deployed certificate to Fastly, keeping record to avoid repeated checks for certificate deployment
 * - Failed: Encountered an error either during the creation of certificate or while deploying to Fastly
 */
const CertificateJobStatus = {
    QUEUED: 'QUEUED',
    PENDING: 'PENDING',
    CREATED: 'CREATED',
    DEPLOYED: 'DEPLOYED',
    FAILED: 'FAILED'
};

/**
 * Greenlock service wraps the greenlock library and provides rate-limited
 * function calls for adding new domains
 */
class GreenlockService {
    constructor({greenlock, fastly, database}) {
        this.greenlock = greenlock;
        this.fastly = fastly;

        if (!database) {
            this.db = new Sequelize('sqlite::memory:');
        } else {
            this.db = new Sequelize(database);
        }

        this.jobManager = new JobManager({
            database,
            jobHandler: async () => {
                const subject = await this._getNextJob();
                logging.info(`Got subject for next job: ${subject}`);
                if (subject) {
                    await this._internalAddDomain(subject);
                }
            }
        });

        this.greenlock.events.on('certificate_status', async ({subject, status}) => {
            logging.info(`Did something with ${subject}, status is: ${status}`);

            if (status !== 'valid') {
                return;
            }

            let certificateJob;
            certificateJob = await CertificateJob.findOne({
                where: {
                    subject
                },
                order: [
                    ['createdAt', 'ASC']
                ]
            });

            if (!certificateJob) {
                // Should never happen
                throw new Error(`CertificateJob: no job found for domain ${subject}`);
            }

            if (certificateJob.status !== CertificateJobStatus.PENDING) {
                // This is a renewal
                logging.info(`Successfully renewed certificate for ${subject}`);
                logging.info('Removing a token because a renewal took place');
                this.jobManager.removeToken();
            } else {
                // This is an issuance
                logging.info(`Successfully issued certificate for ${subject}`);
                try {
                    certificateJob.status = CertificateJobStatus.CREATED;
                    await certificateJob.save();
                    logging.info(`CertificateJob: Set job status to CREATED for ${subject}`);

                    // This may take up to 32 minutes
                    await this.fastly.checkCertificateDeployment(subject);

                    certificateJob.status = CertificateJobStatus.DEPLOYED;
                    await certificateJob.save();
                    logging.info(`CertificateJob: Set job status to DEPLOYED for ${subject}`);
                } catch (error) {
                    logging.error(`Failed to create certificate for ${subject}`, error);
                    certificateJob.status = CertificateJobStatus.FAILED;
                    await certificateJob.save();
                }
            }
        });

        this._setupPromise = this._init();
    }

    async _init() {
        try {
            await this.db.authenticate();
        } catch (error) {
            throw new Error('Failed to authenticate with database', error);
        }

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

        // Find existing certificates and confirm they are deployed
        this._testCreatedCertificates();

        // Find queued jobs and start them
        this._initialiseBacklog();
    }

    async addDomain(domain) {
        await this._setupPromise;
        await CertificateJob.create({
            subject: domain,
            status: CertificateJobStatus.QUEUED
        });
        logging.info(`CertificateJob: Created new certificate job for ${domain}`);
        await this.jobManager.addJob();
        return {
            success: true
        };
    }

    async _internalAddDomain(domain) {
        const site = await this.greenlock.get({
            servername: domain
        });

        if (site !== null) {
            return site;
        }

        logging.info(`CertificateJob: Requesting issuance of certificate for ${domain}`);

        return await this.greenlock.add({
            subject: domain,
            altnames: [domain]
        });
    }

    async getDomain(domain) {
        await this._setupPromise;
        const job = await CertificateJob.findOne({
            where: {
                subject: domain
            },
            order: [
                ['createdAt', 'ASC']
            ]
        });

        if (!job) {
            return null;
        }

        return job;
    }

    async removeDomain(domain) {
        return await this.greenlock.manager.set({
            subject: domain,
            deletedAt: Date.now()
        });
    }

    async getChallenge(domain, token) {
        const challenge = await this.greenlock.challenges.get({
            type: 'http-01',
            token: token,
            servername: domain
        });

        if (!challenge) {
            return null;
        }

        return challenge;
    }

    async _testCreatedCertificates() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.CREATED
            }
        });

        logging.info(`Testing ${jobs.length} sites to see whether they have deployed`);

        jobs.forEach(async (certificateJob) => {
            try {
                // This may take up to 32 minutes
                await this.fastly.checkCertificateDeployment(certificateJob.subject);

                certificateJob.status = CertificateJobStatus.DEPLOYED;
                await certificateJob.save();
                logging.info(`CertificateJob: Set job status to DEPLOYED for ${certificateJob.subject}`);
            } catch (error) {
                logging.error(`CertificateJob: Deployment check failed for ${certificateJob.subject}`, error);
                certificateJob.status = CertificateJobStatus.FAILED;
                await certificateJob.save();
                logging.info(`CertificateJob: Set job status to FAILED for ${certificateJob.subject}`);
            }
        });
    }

    async _initialiseBacklog() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.QUEUED
            }
        });

        logging.info(`Adding ${jobs.length} queued sites for certificate issuance`);

        // Add all current jobs to queue in case picking up from dead server
        // May pick up other servers' jobs, but the total rate limit will be conserved
        jobs.forEach(() => {
            this.jobManager.addJob();
        });
    }

    async _getNextJob() {
        const job = await CertificateJob.findOne({
            where: {
                status: CertificateJobStatus.QUEUED
            },
            order: [
                ['createdAt', 'ASC']
            ]
        });

        if (!job) {
            // Return token to pool because processing empty job
            logging.info('Returning token because no jobs are in a queued state');
            this.jobManager.addToken();
            return null;
        }

        job.status = CertificateJobStatus.PENDING;
        await job.save();
        logging.info(`CertificateJob: Set job status to PENDING for ${job.subject}`);

        return job.subject;
    }
}

module.exports = GreenlockService;
