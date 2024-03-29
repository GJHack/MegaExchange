
// /exchange?type=catalog&mode=checkauth
const fs = require("fs");

module.exports = [
  {
    method: 'GET',
    path: '/',
    handler: 'auth.switcher',
    config: {
      auth: false,
      middlewares: [],
    }
  },
  /*

   */
  {
    method: 'GET',
    path: '/new_files',
    handler: 'file_cheker.checkNew',
    config: {
      auth: false,
      middlewares: [
        //"plugin::exchange.upload",
      ],
    }
  },
]


