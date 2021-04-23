require('../utils');

const request = require('supertest');
const app = require('express')();
const challengeResponder = require('../../lib/challenge-responder');
const GreenlockService = require('../../lib/greenlock-service');
const challengeHandler = require('@tryghost/acme-http-01-sequelize').create({});

describe('Correctly stores and retrieves challenges', function () {
    before(function () {
        const greenlock = new GreenlockService({
            greenlock: {
                challenges: {
                    get: function ({token, servername}) {
                        return challengeHandler.get({
                            challenge: {
                                identifier: {
                                    value: servername
                                },
                                token
                            }
                        });
                    }
                }
            }
        });
        app.use(challengeResponder({greenlock}));
    });
    
    it('Retrieves challenge correctly', async function () {
        const servername = 'ghost.local';
        const token = '123';
        const key = 'secret';
        await challengeHandler.set({
            challenge: {
                identifier: {
                    value: servername
                },
                token,
                keyAuthorization: key
            }
        });

        const res = await request(app)
            .get(`/.well-known/acme-challenge/${token}`)
            .set('Host', servername)
            .expect(200);
        res.text.should.equal(key);
    });

    it('Cannot retrieve challenge with wrong token', async function () {
        const servername = 'ghost.local';
        const token = 'notValid';

        await request(app)
            .get(`/.well-known/acme-challenge/${token}`)
            .set('Host', servername)
            .expect(404);
    });
});
