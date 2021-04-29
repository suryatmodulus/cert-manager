const errors = require('ghost-ignition').errors;

module.exports = ({certificateService}) => ({
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
                    return await certificateService.addDomain(domain);
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
                    return await certificateService.getDomain(domain);
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
                    return await certificateService.removeDomain(domain);
                } catch (error) {
                    this.logger.error(error);
                    throw error;
                }
            }
        }
    }
});
