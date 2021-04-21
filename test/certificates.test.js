// Switch these lines once there are useful utils
// const testUtils = require('./utils');
const {hmacFetch} = require('./utils');

const BASE_URL = 'http://localhost:6660/api';

const apiFetch = (url, body) => hmacFetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
}).then(res => res.json());

describe('Can add a certificate successfully', function () {
    // TODO: Add "before" and "after" to mkdirp test config directory
    // TODO: Use test config for testing
    // TODO: Launch docker-compose from `yarn test` to ensure test config used(?)

    it('Adds a domain', async function () {
        const res = await apiFetch('/addDomain', {
            domain: 'ghost.local'
        });

        res.should.not.have.property('error');
    });

    it('Can add domain which already exists as no-op', async function () {
        await apiFetch('/addDomain', {
            domain: 'ghost.local'
        });

        const second = await apiFetch('/addDomain', {
            domain: 'ghost.local'
        });

        second.should.have.property('message').equal('Domain ghost.local already exists in Greenlock');
    });

    it('Gets a domain', async function () {
        const res = await apiFetch('/getDomain', {
            domain: 'ghost.local'
        });

        console.log('Domain: ' + JSON.stringify(res, null, 2));
        res.should.not.have.property('error');
        res.should.have.property('result').not.null();
    });
    
    it('Removes a domain', async function () {
        const res = await apiFetch('/removeDomain', {
            domain: 'ghost.local'
        });

        res.should.not.have.property('error');
    });
});
