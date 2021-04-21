const greenlock = require('./greenlock');

class GreenlockService {
    constructor() {
        this.glPromise = greenlock();
    }

    async addDomain(domain) {
        const gl = await this.glPromise;

        const site = await gl.get({
            servername: domain
        });

        if (site !== null) {
            return site;
        }

        return await gl.add({
            subject: domain,
            altnames: [domain]
        });
    }

    async getDomain(domain) {
        const gl = await this.glPromise;

        return await gl.get({
            servername: domain
        });
    }

    async removeDomain(domain) {
        const gl = await this.glPromise;

        return await gl.manager.set({
            subject: domain,
            deletedAt: Date.now()
        });
    }
}

const greenlockInstance = new GreenlockService();

module.exports = greenlockInstance;
