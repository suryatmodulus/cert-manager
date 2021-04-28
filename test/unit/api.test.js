const {getHmac} = require('../utils');

const EventEmitter = require('events');
const request = require('supertest');
const app = require('express')();
const apiRoutes = require('../../lib/api');
const GreenlockService = require('../../lib/greenlock-service');

describe('API functions correctly', function () {
    before(function () {
        const certs = {};
        const greenlock = new GreenlockService({
            greenlock: {
                async add({subject}) {
                    certs[subject] = {
                        content: 'hello!'
                    };
                    return Promise.resolve({
                        success: true
                    });
                },

                async get({servername}) {
                    const cert = certs[servername];
                    if (!cert || cert.deletedAt) {
                        return Promise.resolve(null);
                    } else {
                        return Promise.resolve(cert);
                    }
                },

                manager: {
                    async set({subject, deletedAt}) {
                        certs[subject].deletedAt = deletedAt;
                        return Promise.resolve({
                            success: true
                        });
                    }
                },

                events: new EventEmitter()
            }
        });
        app.use(apiRoutes({greenlock}));
    });

    it('Calls add correctly', async function () {
        const res = await request(app)
            .post(getHmac('/api/addDomain'))
            .send({domain: 'ghost.local'})
            .set('Accept', 'application/json');

        res.body.success.should.be.true();
    });
});
