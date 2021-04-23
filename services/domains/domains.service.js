const errors = require('ghost-ignition').errors;

module.exports = ({greenlock}) => ({
    name: 'domains',
    methods: {}, // TODO
    actions: {
        status() {
            return 'OK';
        },

        add: {
            metrics: {
                params: true,
                meta: true
            },
            params: {
                domain: {
                    type: 'string',
                    optional: true
                }
            },
            async handler(ctx) {
                const domain = ctx.params.domain;

                if (!domain) {
                    throw new errors.ValidationError({message: 'Missing parameter - domain'});
                }

                try {
                    return await greenlock.addDomain(domain);
                } catch (error) {
                    this.logger.error(error);
                    throw error;
                }
            }
        },

        get: {
            metrics: {
                params: true,
                meta: true
            },
            params: {
                domain: {
                    type: 'string',
                    optional: true
                }
            },
            async handler(ctx) {
                const domain = ctx.params.domain;

                if (!domain) {
                    throw new errors.ValidationError({message: 'Missing parameter - domain'});
                }

                try {
                    return await greenlock.getDomain(domain);
                } catch (error) {
                    this.logger.error(error);
                    throw error;
                }
            }
        },
        
        remove: {
            metrics: {
                params: true,
                meta: true
            },
            params: {
                domain: {
                    type: 'string',
                    optional: true
                }
            },
            async handler(ctx) {
                const domain = ctx.params.domain;

                if (!domain) {
                    throw new errors.ValidationError({message: 'Missing parameter - domain'});
                }

                try {
                    return await greenlock.removeDomain(domain);
                } catch (error) {
                    this.logger.error(error);
                    throw error;
                }
            }
        }
    }
});
