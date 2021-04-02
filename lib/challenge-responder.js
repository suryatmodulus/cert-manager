const router = require('express').Router();
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const logging = require('./logging');

router.get('/.well-known/acme-challenge/:token', async function (req, res) {
    const host = req.host;
    const tokenFile = req.params.token;

    logging.info(`challengeResponser: ${host} and ${tokenFile}`);

    try {
        const token = await fs.readFile(path.join(config.get('challengeResponder:directory'), host, tokenFile));
        res.status(200);
        res.send(token);
        res.end();
    } catch (err) {
        // TODO: Implement error checking
        // Probably file does not exist
        logging.error('challengeResponder: Failed to retrieve token', err);
        res.status(404);
        res.end();
    }
});

module.exports = router;
