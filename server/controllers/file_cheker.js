'use strict';
const unzipper = require('unzipper');
const fs = require('fs')
const convert = require('xml-js');

const ABS_PATH = "/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/"

module.exports = {

  /**
   * @description Функция проверяет полученный файл.
   * @param {Context} ctx - Контекст запроса
   * @returns {Promise<void>}
   */
  async checknew(ctx) {

    const {type, mode, sessid, filename} = await ctx.request.query;

    if(filename) {
      console.log("Новые данные от 1С...Поиск...")
      console.log(filename)

      const searchZipResult = await searchInFolder(ctx, ABS_PATH, filename.split('.')[0], 'zip')
      console.log(`Результат поиска полученного от 1С архива:  ${(searchZipResult) ? "НАЙДЕН" : "НЕ НАЙДЕН"}`);

      if(await searchZipResult) {

        const resultUnzip = await unzip(ABS_PATH + filename, ABS_PATH, filename)
        console.log("Результат распаковки полученного от 1С архива: " + resultUnzip)

        if(await resultUnzip) {

          const searchFolderResult = await searchInFolder(ctx, ABS_PATH, filename.split('.')[0], false, false)
          console.log(`Результат поиска папки  с файлами:  ${(await searchFolderResult) ? "НАЙДЕН" : "НЕ НАЙДЕН"}`);

          if(await searchFolderResult) {
            const searchImportXMLs = await getAllFiles(ABS_PATH, filename.split('.')[0])
            console.log(`Результат получения всех файлов внутри: ${await searchImportXMLs}`);
          }
        }
      }

        }
    }

  }


/**
 *
 * @param {String} filepath - Путь до файла
 * @param {String} fileName - Имя файла
 * @param {String} abspath - Абсолютный путь до папки
 * @returns {boolean}
 */
async function unzip(filePath = "",absPath = "/", fileName = "text.zip") {

  if(!filePath || typeof filePath !== "string") return

    //console.log("старт распаковки....")
    const newFolderName = fileName.split('.')[0];
    //console.log("Файл будет разархивирован по пути: " + newFolderName)

    const promise = new Promise((resolve, reject) => {
      try {
       const readStream = fs.createReadStream(filePath)
             readStream.pipe(unzipper.Extract({path: absPath + newFolderName}))
             readStream.on("close", () => {
              console.log("Архив распакован. Приступаем к парсингу данных");
              resolve(true)
             });
      } catch (e) {
        console.log("!!!ОШИБКА РАСПАКОВКИ АРХИВА 1С!!! controllers: file_cheker.js func: unzip");
        reject(false);
      } finally {
        //
      }
    })

  return await promise;

}

/**
 *
 * @param {Context} ctx
 * @param {String} filePath - Путь до файла
 * @param {String} fileName - Имя файла
 * @param {String} extension - Расширение файла ( по дефолту будет искать папки )
 * @returns {boolean}
 */
async function searchInFolder(ctx, filePath = "", fileName = "text", extension = "",getAllNames = false) {
  if(!filePath || typeof filePath !== "string") return

  const searchPath = (extension) ? filePath : filePath + fileName;
  console.log(getAllNames)
  try{
    if(!extension) {
     // console.log(`Поиск папки !  ${searchPath}`)
      if(fs.existsSync(searchPath)) {
        //console.log(`Папка по пути ${searchPath} cуществует`)
        ctx.body = JSON.stringify({
          error: false,
          result: true,
          data: "success"
        })
        return true
      } else {
        console.log(`Такой папки по пути - ${searchPath} не существует! ${fs.existsSync(searchPath)}`);
        return false;
      }
    } else {
      if(!getAllNames) {
        console.log("IN SINGLE")

        //console.log(`Поиск файла в  ${searchPath}`)
        const promise = new Promise((resolve, reject) => {
          fs.readdirSync(searchPath).map(checkName => {
            const formatSearchString = (extension) ? "." + extension : extension
            const checkString = fileName + formatSearchString
            if(checkName === checkString) {
              console.log(`
                  "Файл" с именем ${fileName} найден!
                     `)
              resolve(true);
            }
          })
        });
        return await promise
      } else {

      }

    }
  } catch(e) {
    console.log(e)
    return false;
  }

}
async function getAllFiles(absPath = "/", folderName = "test") {
  const searchPath = absPath + folderName;

  console.log(searchPath)

  const promise = new Promise(async (resolve, reject) => {
    console.log("Получение всех файлов в папке.")
    const allFileNames = []

    fs.readdirSync(searchPath).map(async checkName => {
      const checkString = folderName

      allFileNames.push({
        name: checkName,
        dir: searchPath,
        path: `${searchPath}/${checkName}`,
        jsonData: await parseXML(`${searchPath}/${checkName}`)
      })
    })

    console.log(allFileNames)
    resolve(allFileNames)
  });

  return await promise
}


async function parseXML(path = "/") {
  let result;

  console.log(result);
  return await result;
}
