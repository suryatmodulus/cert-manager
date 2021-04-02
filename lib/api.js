const {json, Router} = require('express');
const router = Router();
const greenlock = require('./greenlock');
const logging = require('./logging');

router.use(json());
// TODO use some sort of authentication middleware

router.post('/addDomain', async function (req, res) {
    const logPrefix = 'addDomain: ';
    const domain = req.body.domain;
    if (!domain) {
        const message = 'No domain specified';
        logging.error(logPrefix + message);
        res.status(500);
        res.send({
            success: false,
            message: message
        });
        return res.end();
    }
    const gl = await greenlock();
    try {
        await gl.add({
            subject: domain,
            altnames: [domain]
        });
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
        res.status(500);
        res.send({
            success: false,
            message: message
        });
        return res.end();
    }
});

router.post('/removeDomain', async function (req, res) {
    const logPrefix = 'removeDomain: ';
    const domain = req.body.domain;
    if (!domain) {
        const message = 'No domain specified';
        logging.error(logPrefix + message);
        res.status(500);
        res.send({
            success: false,
            message: message
        });
        return res.end();
    }
    const gl = await greenlock();
    try {
        await gl.remove({
            subject: domain
        });
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
        res.status(500);
        res.send({
            success: false,
            message: message
        });
        return res.end();
    }
});

module.exports = router;
