'use strict';
const { parseMultipartData, sanitizeEntity } = require('strapi-utils');
const unzipper = require('unzipper');
const fs = require('fs')

function init(ctx) {
  console.log('Параметры передачи данных, переданы в 1С')
  ctx.body = "zip=yes\n"
}


function file(ctx) {
  console.log('Начало записи файла')

  /*
    const { file } = ctx.request.files;

    //Начинаем стрим файла
    const zipStream = fs.createReadStream(file.path)
      .pipe(unzipper.Parse({ forceStream: true }));
      console.log(zipStream)
    //Cтрим процесс
    zipStream.on('entry', (entry) => {
      // Handle each file entry in the ZIP stream
      // For example, you can extract or process the files
    });
  */

}


module.exports = {

  async switcher(ctx) {
    console.log(ctx.request)
    ///ОБНОВИТЬ ( СДЕЛАТЬ ЧЕРЕЗ ОКРУЖЕНИЕ )
    const API_KEY = "ZXhjaGFuZ2UxYzphczIyNDdrTA==";

    const CHECK_KEY = ctx.headers?.authorization?.split(' ')[1];

    if(!CHECK_KEY) {
      return false;
      ctx.body = "failure\nОтсутствует ключ подтверждения"
    }

    if(CHECK_KEY !== API_KEY) {
      return false;
      ctx.body = "failure\nНеверный ключ подтверждения"
    }

    const {type, mode, sessid} = await ctx.request.query;

    if (type == "catalog") {
      switch (mode) {

        //Проверка возможностей сервера
        case "checkauth":
          console.log('Начало обмена 1С. Проверка авторизации')
          ctx.body = "success\nPHPSESSID\nc84bba7587de83c2b7f88a837ffc4237\n641ec5e7f1547d4934458141ec237512"
          break;

        //Инициализация
        case "init":
          console.log('Инициализация обмена. Передача параметров')
          init(ctx)
          break;

        //Прием файлов от 1С
        case "file":
          console.log('Начало загрузки файлов 1С///PROCCESSING')
          file(ctx)
          break;
        ///Ответ при неизвестном моде
        default:
          console.log("Попытка обратиться к неизвестному моду")
          ctx.body = {
            error: "Неизвестный запрос"
          }
      }

    }

  }
}

