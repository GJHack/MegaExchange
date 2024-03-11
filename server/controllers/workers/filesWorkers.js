'use strict';

const fs = require("fs");
const unzipper = require("unzipper");

/**
 * @description Распаковка файлов от 1С .zip
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
 * @description Поиск по папке
 * @param {Context} ctx
 * @param {String} filePath - Путь до файла
 * @param {String} fileName - Имя файла
 * @param {String} extension - Расширение файла ( по дефолту будет искать папки )
 * @returns {boolean}
 */
async function searchInFolder(ctx, filePath = "", fileName = "text", extension = "",getAllNames = false) {
  if(!filePath || typeof filePath !== "string") return

  const searchPath = (extension) ? filePath : filePath + fileName;

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
        console.log("Получение одиночного файла")

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

/**
 * @description Получение всех файлов внутри найденой папки
 */
async function getAllFiles(absPath = "/", folderName = "test") {

  const searchPath = absPath + folderName;

  const promise = new Promise(async (resolve, reject) => {
    console.log("Получение всех файлов в папке.")
    const allFileNames = []

    fs.readdirSync(searchPath).map(async checkName => {

      const checkString = folderName
      const checkFolder = (typeof checkName.split('.')[1] != "undefined") ? true : false;

      if(checkFolder) {
        let parseResult = await _parseXML(`${searchPath}/${checkName}`, folderName);
        allFileNames.push({
          name: checkName,
          dir: searchPath,
          path: `/usr/share/nginx/html/back/public${searchPath}/${checkName}`,
          jsonData: await parseResult
        })
        if(await parseResult)
          resolve(allFileNames)
      } else {
        console.log(`Среди файлов обнаружена папка: ${checkName}`)
      }
    })

  });

  return await promise;
}

/**
 * @private
 * @description Парсинг XML в getAllFiles()
 */
async function _parseXML(path = "/", checkFolder = "") {
  let result, parseMode, productsList, file2;

  console.log(`Путь до файла с xml: ${path}`)
  try {

    file2 = fs.readFileSync(path, (file) => file)

    result = xmlParser.toJson(file2).toString('utf-8');

    result = result.replaceAll("$t",'t').replaceAll("ПакетПредложени�",'ПакетПредложений').replaceAll('\t','').replaceAll('\n','')

    console.log("РЕЗУЛЬТАТ ПАРСИНГА и преобразования в utf-8 ( END_TYPE: JSON )")

    result = JSON.parse(result)

    delete result.t;

  } catch (e) {
    console.log("ОШИБКА В ПОЛУЧЕНИИ ДАННЫХ ПРИ СОЗДАНИИ JSON")
    console.log(JSON.parse(result))
    return ''
  }


  const testObjectProduct = {
    name: ''
  }
  try {
    ////ТУТ НАЧиНАЕТСЯ РАСПАРС JSONа с ТОВАРАМИ. #КАТАЛОГ
    parseMode =  (typeof result['КоммерческаяИнформация']['Каталог'] != 'undefined') ? "catalog" : "sales"

    productsList = (parseMode == "catalog")
      ?
      result['КоммерческаяИнформация']['Каталог']['Товары']['Товар']
      :
      result['КоммерческаяИнформация']['ПакетПредложений']['Предложения']['Предложение']

    console.log("PARSE MODE: " + parseMode)

    if(parseMode == "sales") {
      //console.log(result['КоммерческаяИнформация']['ПакетПредложений']['Предложения']['Предложение'])
    }

  } catch(e) {

    console.log("ОШИБКА В ПОЛУЧЕНИИ ДАННЫХ ИЗ РАСПАРСЕННОГО XML")
    console.log("PARSE MODE: " + parseMode)

    return false;
  }


  ////Проверяем категории и создаем новые если не найдено совпадений

  if(parseMode == "catalog")
    await createCatalog(productsList, checkFolder, result['КоммерческаяИнформация']['Классификатор']['Группы']['Группа'])
  else
    await salesWorking(productsList, result['КоммерческаяИнформация']['ПакетПредложений']['Склады'])

  ////Проверяем товары и создаем новые если не найдено совпадений

  //Создаем категории;

  //console.log(result['КоммерческаяИнформация']['Каталог']['Товары']['Товар'][0]['БазоваяЕдиница']['Пересчет'])
  //console.log(testObjectProduct)
  return await result;
}

module.exports = {
  unzip,
  searchInFolder,
  getAllFiles,
}
