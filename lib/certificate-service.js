const {Sequelize, Model, DataTypes} = require('sequelize');
const JobManager = require('./job-manager');
const logging = require('./logging');

class CertificateJob extends Model {}

/**
 * Status of a certificate job can be:
 * - Queued: Waiting to start (issuing only!)
 * - Pending: Greenlock is acquiring a certificate (issuing only!)
 * - Created: Got certificate successfully from LetsEncrypt
 * - Uploaded: Uploaded to Fastly successfully
 * - Deployed: Deployed certificate to Fastly, keeping record to avoid repeated checks for certificate deployment
 * - Failed: Encountered an error either during the creation of certificate or while deploying to Fastly
 */
const CertificateJobStatus = {
    QUEUED: 'QUEUED',
    PENDING: 'PENDING',
    CREATED: 'CREATED',
    UPLOADED: 'UPLOADED',
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

        this.greenlock.events.on('cert_issue', async ({subject}) => {
            logging.info(`Successfully issued certificate for ${subject}`);

            this._onCertificateCreated(subject);
        });

        this.greenlock.events.on('cert_renew', async ({subject}) => {
            logging.info(`Successfully renewed certificate for ${subject}`);
            logging.info('Removing a token because a renewal took place');
            this.jobManager.removeToken();

            this._onCertificateCreated(subject);
        });

        this.greenlock.events.on('error', async (error) => {
            if (error.code === 'ENOTFOUND') {
                logging.error(`CertificateJob: DNS does not resolve for domain ${error.subject}`);
                await this._failJob(error.subject);
                // Return token to the pool as no LetsEncrypt action taken
                await this.jobManager.addToken();
            } else if (error.code === 'E_FAIL_DRY_CHALLENGE') {
                logging.error(`CertificateJob: Failed dry challenge for domain ${error.subject}`);
                await this._failJob(error.subject);
                // Return token to the pool as no LetsEncrypt action taken
                await this.jobManager.addToken();
            } else if (error.type === 'urn:ietf:params:acme:error:rateLimited') {
                logging.error(`ACME Rate limit: Hit the order rate limit`);
                await this.jobManager.blockPeriod();
            } else {
                logging.error(`${error.code}: ${error.message}`);
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
                type: DataTypes.STRING,
                unique: true
            },
            status: {
                type: DataTypes.STRING
            }
        }, {
            sequelize: this.db,
            modelName: 'CertificateJob'
        });

        await CertificateJob.sync();

        // Initial boot sequence: Resets states for existing jobs and intialises queue

        // Re-queue failed jobs
        logging.info('Boot Sequence: Queueing failed jobs');
        await this._queueFailedJobs();

        // Re-queue old pending jobs
        logging.info('Boot Sequence: Queueing pending jobs');
        await this._queuePendingJobs();

        // Check deployment of uploaded jobs
        logging.info('Boot Sequence: Testing already uploaded jobs');
        await this._testUploadedJobs();

        // Upload old created jobs
        logging.info('Boot Sequence: Uploading created jobs to Fastly');
        await this._uploadCreatedJobs();

        // Find queued jobs and start them
        logging.info('Boot Sequence: Adding queued jobs to memory');
        this._initialiseBacklog();
    }

    async addDomain(domain) {
        await this._setupPromise;
        const [job, created] = await CertificateJob.findOrCreate({
            where: {
                subject: domain
            },
            defaults: {
                status: CertificateJobStatus.QUEUED
            }
        });
        if (!created) {
            job.status = CertificateJobStatus.QUEUED;
            job.save();
        }
        logging.info(`CertificateJob: Created new certificate job for ${domain}`);
        await this.jobManager.addJob();
        return {
            success: true
        };
    }

    async _internalAddDomain(domain) {
        const certInfo = await this.greenlock.get({
            servername: domain
        });

        if (certInfo !== null) {
            // Transition to CREATED
            await this._onCertificateCreated(domain);
            return certInfo;
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
            }
        });

        if (!job) {
            return null;
        }

        if (job.status === CertificateJobStatus.CREATED || job.status === CertificateJobStatus.DEPLOYED) {
            job.certificateInfo = await this.greenlock.get({
                servername: job.subject
            });
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

    async _onCertificateCreated(subject) {
        const [certificateJob, created] = await CertificateJob.findOrCreate({
            where: {
                subject
            },
            defaults: {
                status: CertificateJobStatus.CREATED
            }
        });

        if (!created) {
            certificateJob.status = CertificateJobStatus.CREATED;
            await certificateJob.save();
        }

        logging.info(`CertificateJob: Set job status to CREATED for ${subject}`);

        this._uploadCertificate(certificateJob);
    }

    async _uploadCertificate(certificateJob) {
        try {
            const certificateInfo = await this.greenlock.get({
                servername: certificateJob.subject
            });

            logging.info(`CertificateJob: Uploading certificates for ${certificateJob.subject}`);

            // Upload private key
            await this.fastly.createPrivateKey(certificateInfo.pems.privkey, certificateJob.subject);

            // Upload certificate
            const certificate = await this.fastly.getCertificateByDomain(certificateJob.subject);
            if (certificate !== null) {
                await this.fastly.updateCertificate(certificate.id, certificateInfo.pems.cert, certificateInfo.pems.chain);
            } else {
                await this.fastly.createCertificate(certificateInfo.pems.cert, certificateInfo.pems.chain);
            }

            certificateJob.status = CertificateJobStatus.UPLOADED;
            await certificateJob.save();
            logging.info(`CertificateJob: Set job status to UPLOADED for ${certificateJob.subject}`);

            this._checkCertificateDeployment(certificateJob);
        } catch (error) {
            logging.error(`CertificateJob: Failed to upload certificate to Fastly for ${certificateJob.subject}`);
            certificateJob.status = CertificateJobStatus.FAILED;
            certificateJob.save();
        }
    }

    /**
     * Wrapper around the fastly method, handles state transitions
     * Avoid awaiting this function - can take 32 minutes to resolve for failures
     */
    async _checkCertificateDeployment(certificateJob) {
        try {
            logging.info(`CertificateJob: Checking deployment for ${certificateJob.subject}`);
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
    }

    /**
     * Failed is the most complex state, as we can transition to failure from any other state
     */
    async _queueFailedJobs() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.FAILED
            }
        });

        for (const job of jobs) {
            const certInfo = await this.greenlock.get({
                servername: job.subject
            });

            if (certInfo && certInfo.pems && certInfo.pems.cert) {
                await this._onCertificateCreated(job.subject);
            } else {
                job.status = CertificateJobStatus.QUEUED;
                await job.save();
                logging.info(`CertificateJob: Set job status to QUEUED for failed job ${job.subject}`);        
            }
        }
    }

    async _queuePendingJobs() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.PENDING
            }
        });

        for (const job of jobs) {
            job.status = CertificateJobStatus.QUEUED;
            await job.save();
            logging.info(`CertificateJob: Set job status to QUEUED for pending job ${job.subject}`);
        }
    }

    async _testUploadedJobs() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.UPLOADED
            }
        });

        logging.info(`Testing ${jobs.length} sites to see whether they have deployed`);

        jobs.forEach(async (certificateJob) => {
            this._checkCertificateDeployment(certificateJob);
        });
    }

    async _uploadCreatedJobs() {
        const jobs = await CertificateJob.findAll({
            where: {
                status: CertificateJobStatus.CREATED
            }
        });

        logging.info(`Uploading ${jobs.length} sites to Fastly before testing deployment`);

        jobs.forEach(async (certificateJob) => {
            this._uploadCertificate(certificateJob);
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
                ['updatedAt', 'ASC']
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

    async _failJob(subject) {
        const [job, created] = await CertificateJob.findOrCreate({
            where: {
                subject
            },
            defaults: {
                status: CertificateJobStatus.FAILED
            }
        });
        if (!created) {
            job.status = CertificateJobStatus.FAILED;
            await job.save();
        }
        logging.info(`CertificateJob: Set job status to FAILED for ${subject}`);
        await this.removeDomain(subject);
        logging.info(`CertificateJob: Removed ${subject} from Greenlock due to failure`);
    }
}

module.exports = GreenlockService;
