const router = require('express').Router();
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const logging = require('./logging');
const glPromise = require('./greenlock')();

router.get('/.well-known/acme-challenge/:token', async function(req, res) {
    const host = req.host;
    const token = req.params.token;

    logging.info(`challengeResponser: ${host} and ${token}`);

    try {
        const greenlock = await glPromise;
        const {keyAuthorization} = await greenlock.challenges.get({
            type: 'http-01',
            token: token,
            servername: host
        });
        res.status(200);
        res.send(keyAuthorization);
        res.end();
    } catch (err) {
        logging.error('challengeResponder: Failed to retrieve token', err);
        res.status(404);
        res.end();
    }
});

module.exports = router;
