const {hmacFetch} = require('../utils');

const BASE_URL = 'http://localhost:6660/api';

const apiFetch = (url, body) => hmacFetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
}).then(res => res.json());

/**
 * These integration tests run against the development build.
 *
 * They can only be run when the whole system is running using the docker-compose.yml
 * file provided at the top level directory. It is recommended to run them one at a
 * time, as the process of creating a certificate goes on for several seconds after
 * the call to `addDomain` returns.
 */
describe('Can add a certificate successfully', function () {
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

        second.should.have.property('success').equal(true);
    });

    it('Gets a domain', async function () {
        const res = await apiFetch('/getDomain', {
            domain: 'ghost.local'
        });

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
