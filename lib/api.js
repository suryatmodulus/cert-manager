const {json, Router} = require('express');
const router = Router();
const errors = require('ghost-ignition').errors;
const greenlock = require('./greenlock-service');
const logging = require('./logging');
const hmacAuth = require('../middleware/hmac-auth');

// TODO: remove, only for testing
const fastly = require('./fastly');

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
        const site = await greenlock.getDomain(domain);
        if (site !== null) {
            const message = `Domain ${domain} already exists in Greenlock`;
            logging.info(logPrefix + message);
            res.status(200);
            res.send({
                success: true,
                message: message
            });
            return res.end();
        }
        await greenlock.addDomain(domain);
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
    const gl = await greenlock();
    try {
        const message = `Getting ${domain} status from Greenlock`;
        logging.info(logPrefix + message);
        const result = await greenlock.get(domain);
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

// TODO: Remove, only for testing
router.post('/api/testUpload', async function (req, res) {
    const logPrefix = 'testUpload: ';
    const domain = req.body.domain;
    if (!domain) {
        const message = 'No domain specified';
        logging.error(logPrefix + message);
        throw new errors.BadRequestError(message);
    }
    try {
        const result = await greenlock.getDomain(domain);

        if (result === null) {
            throw new Error('Cannot test upload - no certificate available');
        }

        const privKeyResult = await fastly.createPrivateKey(result.pems.privkey, result.subject);
        logging.info('Uploaded private key to Fastly: ' + JSON.stringify(privKeyResult));

        const certificateUploadResult = await fastly.createCertificate(result.pems.cert, result.pems.chain);
        logging.info(`Uploaded certificate for ${domain}: ` + JSON.stringify(certificateUploadResult));

        res.status(200);
        res.send({
            success: true,
            message: 'Got em'
        });
        return res.end();
    } catch (error) {
        const message = `Failed to upload certificate for ${domain}`;
        logging.error(logPrefix + message, error);
        throw new errors.InternalServerError(message);
    }
});

router.post('/api/testUpdate', async function (req, res) {
    const logPrefix = 'testUpdate: ';
    const domain = req.body.domain;
    if (!domain) {
        const message = 'No domain specified';
        logging.error(logPrefix + message);
        throw new errors.BadRequestError(message);
    }
    try {
        const result = await greenlock.getDomain(domain);

        const privKeyResult = await fastly.createPrivateKey(result.pems.privkey, result.subject);
        logging.info('Uploaded private key to Fastly: ' + JSON.stringify(privKeyResult));

        const certificateResult = await fastly.getCertificateByDomain(domain);
        console.log('Certificate result: ' + certificateResult);
        logging.info(`Got certificate for ${domain}`);
        const certificateUpdateResult = await fastly.updateCertificate(certificateResult.id, result.pems.cert, result.pems.chain);
        logging.info(`Updated certificate for ${domain}: ` + JSON.stringify(certificateUpdateResult));

        res.status(200);
        res.send({
            success: true,
            message: 'Got em'
        });
        return res.end();
    } catch (error) {
        const message = `Failed to update certificate for ${domain}`;
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
        await greenlock.removeDomain(domain);
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

module.exports = router;
