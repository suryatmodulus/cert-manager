require('../utils');

const request = require('supertest');
const app = require('express')();
const challengeResponder = require('../../lib/challenge-responder');
const CertificateService = require('../../lib/certificate-service');
const challengeHandler = require('@tryghost/acme-http-01-sequelize').create({});
const EventEmitter = require('events');

describe('[Unit] Correctly stores and retrieves challenges', function () {
    before(function () {
        const certificateService = new CertificateService({
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
                },

                events: new EventEmitter()
            }
        });
        app.use(challengeResponder({certificateService}));
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
