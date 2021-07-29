const config = require('../lib/config.js');
const Fastly = require('@tryghost/fastly-js');

const fastly = new Fastly(config.get('fastly'));

const main = async () => {
    const res = await fastly._fetch('/tls/private_keys', 'GET');
    const jsonRes = await res.json();

    const keyCount = jsonRes.meta.record_count;

    /* eslint-disable-next-line no-console */
    console.log(`Private key count: ${keyCount}`);
};

main();