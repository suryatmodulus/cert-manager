# Cert Manager

Manages certificate lifecycle in Ghost (Pro).

## Implementation notes

### Adding a domain

Cert-manager can talk to other Ghost (Pro) microservices through
Molecular. This allows for simple inter-service communication -
hopefully!

### HTTP challenge

For HTTP challenges the workflow should be:

LetsEncrypt speaks to domain over HTTP, going straight through the CDN
layer to Varnish. Varnish passes these requests to a new backend for
cert-manager.

Use acme-http-01-webroot to persist challenges, regardless of the use
of a webserver. That library only persists challenge responses to
disk, meaning that the application would maintain correct state
between restarts.

### "Hook" results

Greenlock has callbacks for various events, including renewals. These
could be HTTP webhooks, but we could equally use Molecular.

## Usage

API accessible on port 6660 using HMAC signed requests.

```
POST /api/addDomain
{
  "domain": "ghost.local"
}
```

```
POST /api/removeDomain
{
  "domain": "ghost.local"
}
```

```
POST /api/getDomain
{
  "domain": "ghost.local"
}
```

HTTP server for ACME challenge requests is available on
port 6661. Requests with the URL set to a valid token and the `Host`
header set to the correct domain will return the challenge
response. Currently challenges are stored on disk, but in future they
could be in-memory only.

## Develop

For local development, we want to be able to register and remove
domains using real components to ensure that the Greenlock library is
being called correctly. The best setup for this is to have local DNS
setup to enable `.local` domains, and using
[Pebble](https://github.com/letsencrypt/pebble) as an ACME server.

1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.
3. Use `docker-compose up` to start a test environment
4. Curl the API to add domains, remove them, and get their certificates
5. (Optionally) Setup a HTTPS server to test loading the certificates

## Run

- `yarn start`

## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests

For the main tests, the server should already be running using
docker-compose. As the system is tightly integrated with a reference
ACME service, it makes sense to use integration tests rather than just
unit tests. The integration tests check authentication using HMAC
signed requests, adding domains and removing domains.

Currently, the only domain that is used in tests is `ghost.local` -
this is the only domain which is "linked" using docker-compose. To add
more valid domains, add them to the list of linked domains in the
docker-compose file.

## Publish

- `yarn ship`


# Copyright & License 

Copyright (c) 2013-2021 Ghost Foundation. All rights reserved.

This code is considered closed-source and not for distribution. There is no opensource license associated with this project.
