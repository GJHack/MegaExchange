'use strict';

module.exports = ({ strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('exchange')
      .service('myService')
      .getWelcomeMessage();
  },
});
