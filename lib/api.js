const {json, Router} = require('express');
const errors = require('ghost-ignition').errors;
const logging = require('./logging');
const hmacAuth = require('../middleware/hmac-auth');

module.exports = ({certificateService}) => {
    const router = Router();

    router.use(json());
    router.use(hmacAuth);
    router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        // JSON error handling
        res.status(err.statusCode);
        res.send({
            error: err,
            success: false
        });
        res.end();
    });

    router.post('/api/addDomain', async function (req, res) {
        const logPrefix = 'addDomain: ';
        const domain = req.body.domain;
        if (!domain) {
            const message = 'No domain specified';
            logging.error(logPrefix + message);
            throw new errors.BadRequestError(message);
        }
        try {
            // Check if site already exists
            const site = await certificateService.getDomain(domain);
            if (site !== null && site.certificateInfo) {
                const message = `Domain ${domain} already exists in Greenlock`;
                logging.info(logPrefix + message);
                res.status(200);
                res.send({
                    success: true,
                    message: message
                });
                return res.end();
            }
            await certificateService.addDomain(domain);
            const message = `Adding ${domain} to Greenlock`;
            logging.info(logPrefix + message);
            res.status(200);
            res.send({
                success: true,
                message: message
            });
            return res.end();
        } catch (error) {
            const message = `Failed to add ${domain} to Greenlock`;
            logging.error(logPrefix + message, error);
            throw new errors.InternalServerError(message);
        }
    });

    router.post('/api/getDomain', async function (req, res) {
        const logPrefix = 'getDomain: ';
        const domain = req.body.domain;
        if (!domain) {
            const message = 'No domain specified';
            logging.error(logPrefix + message);
            throw new errors.BadRequestError(message);
        }
        try {
            const message = `Getting ${domain} status from Greenlock`;
            logging.info(logPrefix + message);
            const result = await certificateService.getDomain(domain);
            res.status(200);
            res.send({
                success: true,
                result: result,
                message: `Got status of ${domain} from Greenlock`
            });
            return res.end();
        } catch (error) {
            const message = `Failed to get ${domain} status from Greenlock`;
            logging.error(logPrefix + message, error);
            throw new errors.InternalServerError(message);
        }
    });

    router.post('/api/removeDomain', async function (req, res) {
        const logPrefix = 'removeDomain: ';
        const domain = req.body.domain;
        if (!domain) {
            const message = 'No domain specified';
            logging.error(logPrefix + message);
            throw new errors.BadRequestError(message);
        }
        try {
            await certificateService.removeDomain(domain);
            const message = `Removing ${domain} from Greenlock`;
            logging.info(logPrefix + message);
            res.status(200);
            res.send({
                success: true,
                message: message
            });
            return res.end();
        } catch (error) {
            const message = `Failed to remove ${domain} from Greenlock`;
            logging.error(logPrefix + message, error);
            throw new errors.InternalServerError(message);
        }
    });

    return router;
};
