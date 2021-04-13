// TODO: Remove this file! This should be replaced by the shared
// library @sam-lord/fastly-js when the bugs are ironed out.

const fetch = require('node-fetch');
const {readFile} = require('fs').promises;

const Methods = {
    DELETE: 'DELETE',
    GET: 'GET',
    POST: 'POST',
    PATCH: 'PATCH'
};

class Fastly {
    /**
     * @param config { apiKey, tlsConfigurationName, allowUntrustedRoot, rootCertificate }
     */
    constructor(config) {
        this._apiKey = config.apiKey;
        this._baseUrl = 'https://api.fastly.com';
        this._allowUntrustedRoot = config.allowUntrustedRoot;
        if (this._allowUntrustedRoot) {
            this._rootCertificatePromise = readFile(config.rootCertificate);
        }
        this._tlsConfigurationPromise = this._fetchList('/tls/configurations').then(res => {
            return res.data.find(config => config.name === config.tlsConfigurationName).id;
        });
    }

    _fetch(url, method, body) {
        const headers = {
            'Fastly-Key': this._apiKey
        };
        if (body !== undefined) {
            headers['Content-Type'] = 'application/vnd.api+json';
            headers['Accept'] = 'application/vnd.api+json';
        }
        return fetch(this._baseUrl + url, {
            headers: headers,
            method: method,
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async _fetchList(url) {
        const urlObj = new URL(this._baseUrl + url);
        const searchParams = urlObj.searchParams;
        searchParams.set('page_number', '1');
        searchParams.set('page_size', '20');

        const getUrl = () => urlObj.pathname + '?' + searchParams.toString();

        const result = await this._fetch(getUrl(), Methods.GET).then(res => res.json());
        while (result.meta.current_page < result.meta.total_pages) {
            searchParams.set('page_number', (parseInt(searchParams.get('page_number')) + 1).toString());
            const nextResult = await this._fetch(getUrl(), Methods.GET).then(res => res.json());
            result.data.push(nextResult.data);
            if ('included' in result && 'included' in nextResult) {
                result.included.push(nextResult.included);
            }
        }
        return result;
    }

    createPrivateKey(key, domain) {
        // Keys will be created for each renewal, so are formatted with the date created
        const keyName = `${domain}-${(new Date()).toISOString()}`;
        return this._fetch('/tls/private_keys', Methods.POST, {
            data: {
                type: 'tls_private_key',
                attributes: {
                    key: key,
                    name: keyName
                }
            }
        }).then(res => res.json());
    }

    deletePrivateKey(id) {
        if (!id) {
            throw new Error('No ID found while deleting private key');
        }
        return this._fetch('/tls/private_keys/' + id, Methods.DELETE);
    }

    async getCertificateByDomain(domain) {
        const apiUrl = '/tls/bulk/certificates';
        const searchParams = new URLSearchParams();
        searchParams.set('filter[tls_domain.id][match]', domain);
        const res = await this._fetchList(`${apiUrl}?${searchParams.toString()}`);
        // Usually should be first entry, but partial matches are included so this finds the first certificate with matching domain
        return res.data.find(certificate => certificate.relationships.tls_domains.data.find(tlsDomain => tlsDomain.id === domain)) || null;
    }
    
    async createCertificate(certificate, intermediates) {
        return this._fetch('/tls/bulk/certificates', Methods.POST, {
            data: {
                type: 'tls_bulk_certificate',
                attributes: {
                    allow_untrusted_root: this._allowUntrustedRoot,
                    cert_blob: certificate,
                    intermediates_blob: this._allowUntrustedRoot
                        ? `${intermediates}${await this._rootCertificatePromise}`
                        : intermediates
                },
                relationships: {
                    tls_configurations: {
                        data: [
                            {
                                type: 'tls_configuration',
                                id: await this._tlsConfigurationPromise
                            }
                        ]
                    }
                }
            }
        }).then(res => res.json());
    }

    async updateCertificate(id, certificate, intermediates) {
        console.log('Intermediates:\n' + `${intermediates}${await this._rootCertificatePromise}`);
        return this._fetch('/tls/bulk/certificates/' + id, Methods.PATCH, {
            data: {
                id: id,
                type: 'tls_bulk_certificate',
                attributes: {
                    allow_untrusted_root: this._allowUntrustedRoot,
                    cert_blob: certificate,
                    intermediates_blob: this._allowUntrustedRoot
                        ? `${await this._rootCertificatePromise}${intermediates}`
                        : intermediates
                }
            }
        }).then(res => res.json());
    }
    
    deleteCertificate(id) {
        if (!id) {
            throw new Error('No ID found while deleting certificate');
        }
        return this._fetch('/tls/bulk_certificates/' + id, Methods.DELETE);
    }
}

module.exports = Fastly;
