const {Router} = require('express');
const logging = require('./logging');

module.exports = ({greenlock}) => {
    const router = Router();

    router.get('/.well-known/acme-challenge/:token', async function (req, res) {
        const host = req.host;
        const token = req.params.token;

        logging.info(`challengeResponser: ${host} and ${token}`);

        try {
            const {keyAuthorization} = await greenlock.getChallenge(host, token);
            res.status(200);
            res.send(keyAuthorization);
            res.end();
        } catch (err) {
            logging.error('challengeResponder: Failed to retrieve token', err);
            res.status(404);
            res.end();
        }
    });

    return router;
};
