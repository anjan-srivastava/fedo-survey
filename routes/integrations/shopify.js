var OUIntegration = require('./ouintegration.js');
var uuid = require('uuid/v4');
var appconfig = require('config-yml');
var shopifyApi = require('shopify-node-api');


class Shopify extends OUIntegration {

    constructor(shopConfig) { 
        super(shopConfig);

        const scon = appconfig.integrations.shopify;
        this.client = new shopifyApi({

            shop: this.config.shop,
            shopify_api_key: scon.apiKey,
            shopify_shared_secret: scon.apiSecret,
            shopify_scope: scon.scope.join(','),
            redirect_uri: scon.redirect_uri,
            nonce: 'ABCD'

        });
    }

    api() {
        return this.client;
    }
};

module.exports = Shopify;