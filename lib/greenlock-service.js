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
