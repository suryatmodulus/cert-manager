const {Router} = require('express');
const logging = require('@tryghost/logging');

module.exports = ({certificateService}) => {
    const router = Router();

    router.get('/.well-known/acme-challenge/:token', async function (req, res) {
        const host = req.hostname;
        const token = req.params.token;

        try {
            const result = await certificateService.getChallenge(host, token);
            if (!result) {
                res.status(404);
                return res.end();
            }
            const {keyAuthorization} = result;
            logging.info(`challengeResponder: Successfully got token for domain ${host}`);
            res.status(200);
            res.send(keyAuthorization);
            return res.end();
        } catch (err) {
            logging.error('challengeResponder: Failed to retrieve token', err);
            res.status(500);
            return res.end();
        }
    });

    return router;
};
