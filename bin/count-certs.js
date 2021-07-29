const config = require('../lib/config.js');
const Fastly = require('@tryghost/fastly-js');

const fastly = new Fastly(config.get('fastly'));

const main = async () => {
    const res = await fastly._fetch('/tls/bulk/certificates', 'GET');
    const jsonRes = await res.json();

    const certCount = jsonRes.meta.record_count;

    /* eslint-disable-next-line no-console */
    console.log(`Certificate count: ${certCount}`);
};

main();