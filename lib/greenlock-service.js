const JobManager = require('./job-manager');
const logging = require('./logging');

// TODO: implement leaky-bucket to process job
// TODO: update rate limit when Greenlock emits `certificate_order` event
// TODO: adjust leaky-bucket parameters at runtime based on rate limit object

/**
 * Greenlock service wraps the greenlock library and provides rate-limited
 * function calls for adding new domains
 */
class GreenlockService {
    constructor({greenlock, database}) {
        this.greenlock = greenlock;

        this.jobManager = new JobManager({
            database,
            jobHandler: subject => this._internalAddDomain(subject)
        });

        this.greenlock.events.on('cert_renewal', () => {
            logging.info('Removing a token because a renewal took place');
            this.jobManager.removeToken();
        });
    }

    async addDomain(domain) {
        await this.jobManager.addJob({subject: domain});
        return {
            success: true // TODO include more?
        };
    }

    async _internalAddDomain(domain) {
        const site = await this.greenlock.get({
            servername: domain
        });

        if (site !== null) {
            return site;
        }

        return await this.greenlock.add({
            subject: domain,
            altnames: [domain]
        });
    }

    async getDomain(domain) {
        return await this.greenlock.get({
            servername: domain
        });
    }

    async removeDomain(domain) {
        return await this.greenlock.manager.set({
            subject: domain,
            deletedAt: Date.now()
        });
    }

    async getChallenge(domain, token) {
        return await this.greenlock.challenges.get({
            type: 'http-01',
            token: token,
            servername: domain
        });
    }
}

module.exports = GreenlockService;
