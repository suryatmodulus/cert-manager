// TODO: implement leaky-bucket to process job
// TODO: update rate limit when Greenlock emits `certificate_order` event
// TODO: adjust leaky-bucket parameters at runtime based on rate limit object

/**
 * Greenlock service wraps the greenlock library and provides rate-limited
 * function calls for adding new domains
 */
class GreenlockService {
    constructor({greenlock}) {
        this.greenlock = greenlock;
    }

    async addDomain(domain) {
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
