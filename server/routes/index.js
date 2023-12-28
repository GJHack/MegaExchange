

const fs = require("fs");

module.exports = [
  //Старый роут, сейчас не используется
  //Так же надо будет удалить контроллер
  {
    method: 'GET',
    path: '/',
    handler: 'auth.switcher',
    config: {
      auth: false,
      middlewares: [],
    }
  },

  //РОУТ ДЛЯ php отчета о сохранение файла.
  {
    method: 'GET',
    path: '/new_files',
    handler: 'file_cheker.checknew',
    config: {
      auth: false,
      middlewares: [
        //"plugin::exchange.upload",
      ],
    }
  },
]


