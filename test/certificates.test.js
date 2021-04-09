// Switch these lines once there are useful utils
// const testUtils = require('./utils');
const {hmacFetch} = require('./utils');

describe('Can add a certificate successfully', function () {
    // TODO: Add "before" and "after" to mkdirp test config directory
    // TODO: Use test config for testing
    // TODO: Launch docker-compose from `yarn test` to ensure test config used(?)
    
    it('Adds a domain', async function () {
        const res = await hmacFetch('http://localhost:6660/api/addDomain', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                domain: 'ghost.local'
            })
        });

        const resJson = await res.json();

        resJson.should.not.have.property('error');
    });
    
    it('Removes a domain', async function () {
        const res = await hmacFetch('http://localhost:6660/api/removeDomain', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                domain: 'ghost.local'
            })
        });

        const resJson = await res.json();

        resJson.should.not.have.property('error');
    });
});
