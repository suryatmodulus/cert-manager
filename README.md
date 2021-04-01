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

Use acmd-http-01-webroot to persist challenges, regardless of the use
of a webserver. That library only persists challenge responses to
disk, meaning that the application would maintain correct state
between restarts.

### "Hook" results

Greenlock has callbacks for various events, including renewals. These
could be HTTP webhooks, but we could equally use Molecular.

## Install

## Usage

## Develop

1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.


## Run

- `yarn dev`
- View: [http://localhost:9999](http://localhost:9999)


## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests


## Publish

- `yarn ship`


# Copyright & License 

Copyright (c) 2013-2021 Ghost Foundation. All rights reserved.

This code is considered closed-source and not for distribution. There is no opensource license associated with this project.
