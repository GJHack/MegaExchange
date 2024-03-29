'use strict';
const unzipper = require('unzipper');
const fs = require('fs')
const path = require('node:path');
const xmlParser = require('xml2json');



const {logger} = require('./mainWorkers');

const ABS_PATH = "/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/"

/// true = удалить все товары после прилета zip файла / false =  нормальная работа
const erease = false

module.exports = {

  /**
   * @description Функция проверяет полученный файл.
   * @param {Context} ctx - Контекст запроса
   * @returns {Promise<void>}
   */
  async checkNew(ctx) {

    if(erease) {
      await clearProduct(100000, 160000)
      return
    }

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
            console.log(filename.split('.')[0]);
            const searchImportXMLs = await getAllFiles(ABS_PATH, filename.split('.')[0])
            console.log(`Ообнаружено товаров: ${await searchImportXMLs.length}`);

            if(await searchImportXMLs) {
              await deleteNoUpdate();
            }
          }
        }
      }

        }
    }

  }

/**
 * @description Удаление товаров, которые не были в обновлении.
 * @returns {boolean}
 */
async function deleteNoUpdate() {

  const date = new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Vladivostok",
  });
  const dateClean = date.slice(0, 10).split("/");
  const dateISOCompat = [dateClean[2], dateClean[0], dateClean[1]].join("-");

  const noUpdateEntries = await strapi.entityService.findMany('api::product.product', {
    filters: {
      updateAt: {
        $ne: dateISOCompat,
      },
      createdAt: {
        $ne: dateISOCompat
      }
    },
  });

  console.log(`Помечено на удаление: ${noUpdateEntries}`)

  const deletePromises = await noUpdateEntries.map(async entry => {

    try {
      return await strapi.entityService.delete('api::product.product', entry.id);
    } catch (e) {
      console.log("Удаление не вышло.")
      console.log(entry)
    }

  });

  await Promise.all(deletePromises);

  console.log(`Удалено ${noUpdateEntries.length} товаров, обновленных "не сегодня." :: AFTER WORK WITH FILE`);

  return noUpdateEntries;
}

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
        let parseResult = await parseXML(`${searchPath}/${checkName}`, folderName);
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
 * @description Парсинг XML в getAllFiles()
 */
async function parseXML(path = "/", checkFolder = "") {
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

    console.log("ERROR: ОШИБКА В ПОЛУЧЕНИИ ДАННЫХ ИЗ РАСПАРСЕННОГО XML. -> ОТСУТСТВИЕ КАТАЛОГА")
    console.log("PARSE MODE: " + parseMode)

    return false;
  }


  ////Проверяем категории и создаем новые если не найдено совпадений
  try {
    if(parseMode == "catalog")
      await createCatalog(productsList, checkFolder, result['КоммерческаяИнформация']['Классификатор']['Группы']['Группа'])
    else
      await salesWorking(productsList, result['КоммерческаяИнформация']['ПакетПредложений']['Склады'])
  } catch(error) {
    console.log("ERROR: Отсутствуют группы...Абортаем обмен")
    return false
  }

  ////Проверяем товары и создаем новые если не найдено совпадений

  //Создаем категории;

  //console.log(result['КоммерческаяИнформация']['Каталог']['Товары']['Товар'][0]['БазоваяЕдиница']['Пересчет'])
  //console.log(testObjectProduct)
  return await result;
}

/**
 * @description Создание каталога
 * @param data
 * @returns {Promise<boolean>}
 */
const createCatalog = async (data = [{}], foldername = '', groups = false) => {

  if(!Array.isArray(data) || !groups) return false;

  //Инициализация
  let creatorCategories;
  ////Создаем КАТЕГОРИЮ через итерацию
  for(const category of groups) {

    const categoryFind = await strapi.entityService.findMany('api::category.category', {
      fields: ['id1c'],
      filters: {id1c: category['Ид']},
    })

    //Если уже есть КАТЕГОРИЯ, обновляемся
    if(await categoryFind && typeof(await categoryFind[0]) != "undefined") {

      const image = (data['Картинка']) ? true : false;

      try {
          const updateEntry = strapi.entityService.update('api::category.category', categoryFind[0].id, {
            data: {
              name: category['Наименование'],
              id1c: category['Ид'],
            },
          })

          if(await updateEntry) {
            console.log("Категория обновлена: ТИП: IMPORT : " + await updateEntry)
            console.log(await updateEntry)
            //Выискиываем дочерние
            const childs = (typeof category['Группы'] != "undefined" && typeof(category['Группы']['Группа'][0]) != "undefined") ? category['Группы']['Группа'] : false;

            if(!childs) continue;

            for(const child of childs) {

              console.log(child)
              try {
                if(typeof await updateEntry) {
                  const creatorChilds = await strapi.entityService.create('api::category.category', {
                    data: {
                      name: child['Наименование'],
                      id1c: child['Ид'],
                      parent: {
                        connect: [await categoryFind[0].id]
                      }
                    },
                  });
                  console.log("Дочерняя категория создана")
                } else {
                  console.log("Странная ошибка в дочерних, при обновлении категории: - ОТСУТСТВИЕ ОБНОВЛЕНИЯ! ")
                }
              } catch (e) {
                console.log("Ошибка в создании дочерней категории")
                console.log(e.details)
              }

            }
          }


      } catch(e) {
        console.log(e)
        console.log("EROOR: Ошибка в обновлении категории! file: IMPORT")
      }

      } else {

        try {
          //Создаем основную категорию
            console.log("Попытка создания категории...")
            creatorCategories = await strapi.entityService.create('api::category.category', {
              data: {
                name: category['Наименование'],
                id1c: category['Ид'],
              },
          });
          console.log(await creatorCategories)
          //Выискиываем дочерние
          const childs = (typeof category['Группы'] != "undefined" && typeof(category['Группы']['Группа'][0]) != "undefined") ? category['Группы']['Группа'] : false;

          if(!childs) continue;

          for(const child of childs) {
            try {
              if(typeof await creatorCategories.id != "undefined") {
                const creatorChilds = await strapi.entityService.create('api::category.category', {
                  data: {
                    name: child['Наименование'],
                    id1c: child['Ид'],
                    parent: {
                      connect: [await creatorCategories.id]
                    }
                  },
                });
                console.log("Дочерняя категория создана")
              } else {
                console.log("Странная ошибка в дочерних, при обновлении:  ")
                console.log(await creatorCategories)
              }
            } catch (e) {
              console.log(e)
              console.log("Ошибка в создании дочерней категории")
            }
          }

         } catch(e) {
            console.log(e)
            console.log("Ошибка в создании категории! file: IMPORT")
        }

    }

  }
  console.log("Начало работы createProduct()")
  ////Чекаем товары и создаем их в категориях
  for (const item of data) {

    const index = data.indexOf(item);

    //console.log(item['ЗначенияРеквизитов'])

    if (item['ЗначенияРеквизитов']) {
      try {

        const categoryFind = await strapi.entityService.findMany('api::category.category', {
          fields: ['id1c'],
          filters: {id1c: item['Группы']['Ид']},
        })

        if(await categoryFind && categoryFind[0]) {
          //console.log(categoryFind)
          console.log("Категория товара найдена! " + await categoryFind[0].id)
          await createProduct(item,await categoryFind[0], foldername)
        } else {
          //console.log("Товар без категории. Ошибка в данных 99%")
        }

      } catch (e) {

        console.log(e)
        console.log(item)
        console.log("Ошибка в создании каталога!")
        continue;

      }

    }
  }
}

/**
 * @description Работа с ценами и остатками
 * @param data
 * @returns {Promise<boolean>}
 */
const salesWorking = async (data = [{}], placesArray = []) => {

  if(!Array.isArray(data)) return false;

  return new Promise(async (resolve, reject) => {
    //const placeString2 = (Array.isArray(placesArray['Склад'])) ? placesArray['Склад'].filter((item, index) => item['Ид'] == data['Cклад'][index]['ИдСклада']) : "Нет склада"
    console.log(data['Cклад'])

    const placeString = 'Нет склада'

    for (const item of data) {

      const index = data.indexOf(item);

      if(item['Ид']) {
        try {

          const entries = await strapi.entityService.findMany('api::product.product', {
            fields: ['id1c'],
            filters: {'id1c': item['Ид']},
          })

          if (await entries.length != false) {

            if (item['Цены']) {
              //console.log("Попытка задать свойства товара")
              if(typeof entries[0] != 'undefined') {
                await updateProduct(item, entries[0].id, placeString)
              } else {
                //console.log("Ошибка поиска товара в БД")
              }
            }
          } else {
            //console.log("Продукт с таким 1CUid не обнаружен")
          }

        } catch (e) {

          console.log(e)
          console.log(item)
          console.log("Ошибка в обновлении товара!")

          continue;
        }

      }
    }

    resolve(true)
  })
}

/**
 * @description Создание товара
 * @param data
 * @param category
 * @returns {Promise<boolean>}
 */
const createProduct = async (data = { }, category = {}, foldername2 = '') => {

    if(!data) return false;

  return new Promise( async (resolve, reject) => {

      const entries = await strapi.entityService.findMany('api::product.product', {
        fields: ['id1c'],
        filters: { id1c: data['Ид'] },
      })

      //await logger(JSON.stringify(data)) //log

      const groupsToConnect = [];


      try {
        if(typeof await entries[0] == 'undefined') {

          try {

            if(!data['Ид']) return false
            console.log("::::::НАЧАЛО СОЗДАНИЕ ТОВАРА С 1СИД::::::")

            console.log("=> Изображение товара <=")
            console.log(data['Картинка'])

            const image = (data['Картинка']) ? true : false

            //Поиск группы и коннект
            if(data['Группы']) {

              if(Array.isArray(data['Группы'])) {

                for(const group of data['Группы']) {

                  const categoryManyFind = await strapi.entityService.findMany('api::category.category', {
                    fields: ['id1c'],
                    filters: {id1c: group['Ид']},
                  })

                  if(typeof categoryManyFind[0] == 'undefined') {
                    groupsToConnect.push(await categoryManyFind[0].id)
                  }
                }

              } else {

                console.log(data['Группы']['Ид'])

                const categorySoloFind = await strapi.entityService.findMany('api::category.category', {
                  fields: ['id1c'],
                  filters: {id1c: data['Группы']['Ид']},
                })

                if(typeof await categorySoloFind[0] != 'undefined') {
                  console.log(await categorySoloFind)
                  groupsToConnect.push(await categorySoloFind[0].id)
                }
                console.log(categorySoloFind)
              }
              console.log("Дочерние группы товара: " + groupsToConnect.toString())

            } else {

              console.log("Товар не привязан к подгруппе. Добавляем в группу")

            }

            const mainCat = data['ЗначенияРеквизитов']['ЗначениеРеквизита'][1]['Значение']

            const mainFind = await strapi.entityService.findMany('api::category.category', {
              fields: ['name'],
              filters: {name: mainCat},
            })
            if(await mainFind) {
              try {
                groupsToConnect.push(await mainFind[0].id)
              } catch(e) {
                console.log(mainFind[0])
              }
            } else {
              console.log("Не найдена главная категория")
            }
            console.log("Все группы товара: " + groupsToConnect.toString())

            let noFormatString = (data['Картинка']) ? data['Картинка'] : null;
            let arrayImages = [];

            if (typeof noFormatString === "string") {
              noFormatString = noFormatString.split(',');
              if (Array.isArray(noFormatString) && typeof noFormatString[0] !== 'undefined') {
                arrayImages = [...noFormatString];
              }
            }
            if (typeof arrayImages[0] === 'undefined') arrayImages.push(noFormatString);

            if (Array.isArray(arrayImages[0])) {
              arrayImages = arrayImages[0];
            }

            console.log("============================");
            console.log("Наименование: ");
            console.log((data['Наименование']) ? `${data['Наименование']}` : "Нет наименования");
            console.log("Картинки: ");
            console.log(arrayImages.map(img => `/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${img}`));
            console.log("============================");

            const creatorProduct = await strapi.entityService.create('api::product.product', {
              data: {
                title: (data['Наименование']) ? `${data['Наименование']}` : "Нет наименования",
                description: (typeof data['Описание'] === 'string') ? `${data['Описание']}` : "Нет описания",
                id1c: (data['Ид']) ? `${data['Ид']}` : null,
                imgs: await Promise.all(arrayImages.map(async (imagePath) => {
                  if (imagePath) {
                    const uploadedImage = await strapi.plugins['upload'].services.upload.upload({
                      data: { fileInfo: {} },
                      files: {
                        path: path.resolve(`/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${imagePath}`),
                        name: imagePath,
                        type: 'image/jpg'
                      }
                    });
                    return uploadedImage[0];
                  }
                  return null;
                })),
                quantitySales: '0',
                categories: {
                  connect: [...groupsToConnect]
                }
              },
              populate: ['categories', 'imgs']
            });

            if(arrayImages) {
              console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!ТОВАР СОЗДАН IMPORT FILE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
              console.log("Товар создан")
              console.log("Путь до картинки")
              console.log(arrayImages)
            }
            resolve(await creatorProduct)

          } catch(e) {
            console.log("!!!!!!!!!!!!!!Ошибка создания товара!!!!!!!!!!!!")
            console.log(e)
          }


        } else {

          /* Обновление существующего товара через внутреннее api */
          if(typeof entries[0].id1c != 'undefined') {
            console.log("WARNING: Обновление товара из IMPORT")
            //Поиск группы и коннект
            if(data['Группы']) {
              if(Array.isArray(data['Группы'])) {
                for(const group of data['Группы']) {

                  const categoryManyFind = await strapi.entityService.findMany('api::category.category', {
                    fields: ['id1c'],
                    filters: {id1c: group['Ид']},
                  })

                  if(typeof categoryManyFind[0] == 'undefined') {
                    groupsToConnect.push(await categoryManyFind[0].id)
                  }
                  console.log(categoryManyFind)
                }
              } else {
                console.log(data['Группы']['Ид'])
                const categorySoloFind = await strapi.entityService.findMany('api::category.category', {
                  fields: ['id1c'],
                  filters: {id1c: data['Группы']['Ид']},
                })

                if(typeof await categorySoloFind[0] != 'undefined') {
                  //console.log(await categorySoloFind)
                  groupsToConnect.push(await categorySoloFind[0].id)
                }
                //console.log(categorySoloFind)
              }
              //console.log("Дочерние группы товара: " + groupsToConnect.toString())
            } else {
              //console.log("Товар не привязан к подгруппе. Добавляем в группу")
            }
            const mainCat = data['ЗначенияРеквизитов']['ЗначениеРеквизита'][1]['Значение']

            const mainFind = await strapi.entityService.findMany('api::category.category', {
              fields: ['name'],
              filters: {name: mainCat},
            })
            if(await mainFind) {
              try {
                groupsToConnect.push(await mainFind[0].id)
              } catch(e) {
                console.log(mainFind[0])
              }
            } else {
              console.log("Не найдена главная категория")
            }
            console.log("Все группы товара: " + groupsToConnect.toString())


            let noFormatString = (data['Картинка']) ? data['Картинка'] : null;
            let arrayImages = [];

            if (typeof noFormatString === "string") {
              noFormatString = noFormatString.split(',');
              if (Array.isArray(noFormatString) && typeof noFormatString[0] !== 'undefined') {
                arrayImages = [...noFormatString];
              }
            }
            if (typeof arrayImages[0] === 'undefined') arrayImages.push(noFormatString);

            if (Array.isArray(arrayImages[0])) {
              arrayImages = arrayImages[0];
            }

            if (data['Наименование']) {
              const updateEntry = await strapi.entityService.update('api::product.product', entries[0].id, {
                data: {
                  id1c: data['Ид'],
                  imgs: await Promise.all(arrayImages.map(async (imagePath) => {
                    if (imagePath) {
                      const image = fs.readFileSync(`/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${imagePath}`, (file) => file);
                      const uploadedImage = await strapi.plugins['upload'].services.upload.upload({
                        data: { fileInfo: {} },
                        files: {
                          path: path.resolve(`/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${imagePath}`),
                          name: imagePath,
                          type: 'image/jpg'
                        }
                      });
                      return uploadedImage[0];
                    }
                    return null;
                  })),
                  categories: {
                    set: [...groupsToConnect]
                  }
                },
              });

              if(arrayImages) {
                console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!ТОВАР ОБНОВЛЕН IMPORT FILE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
                console.log("Товар ОБНОВЛЕН")
                console.log("Путь до картинки")
                console.log(arrayImages)
              }
              resolve(await updateEntry)
            }
            /* Пишем тут что надо делать в случае найденного совпадения в каталоге*/

          } else {
          }

        }

      } catch(e) {
        console.log(await entries)
        console.log("Ошибка в работе с товаром!")
        resolve(false)
      }
    })

}

/**
 * @description Обновление товара
 * @param data
 * @param category
 * @returns {Promise<boolean>}
 */
const updateProduct = async (data = { }, itemId = 0, storeplace = 'Не назначен') => {

  //console.log(":::::::::::::: SALES MODe UPDATE ТОВАР :::::::::::::::")
  //console.log(data)
  if(!data || !data['Ид']) return false;

  return new Promise( async (resolve, reject) => {
    try {

      if(data['Наименование']) {

        if(Array.isArray(data['Цены']['Цена'])) {

          const updateEntry = await strapi.entityService.update('api::product.product', itemId, {

            data: {
              stock:(typeof data['Количество'] != 'undefined') ? data['Количество'] : '0',
              storeplace: (storeplace) ? `${storeplace}` : 'Не назначен',
              price:(typeof data['Цены']['Цена'][0]['ЦенаЗаЕдиницу'] != 'undefined') ? `${data['Цены']['Цена'][0]['ЦенаЗаЕдиницу']}` : '0',
              priceOpt: (typeof data['Цены']['Цена'][1]['ЦенаЗаЕдиницу'] != 'undefined') ? `${data['Цены']['Цена'][1]['ЦенаЗаЕдиницу']}` : '0',
            },

          });

          console.log(" => Товар обновлен = ТИП: Цены и остатки: " + updateEntry.title)

          //if(await updateEntry) console.log(updateEntry)

        } else {

          const updateEntry = await strapi.entityService.update('api::product.product', itemId, {
            data: {
              stock:(typeof data['Количество'] != 'undefined') ? data['Количество'] : '0',
              storeplace: (storeplace) ? `${storeplace}` : 'Не назначен',
              price:(typeof data['Цены']['Цена']['ЦенаЗаЕдиницу'] != 'undefined') ? `${data['Цены']['Цена']['ЦенаЗаЕдиницу']}` : '',
              priceOpt: '',
            },
          });

          console.log("=> Товар обновлен = ТИП: Цены и остатки: " + updateEntry.toString())

          if(await updateEntry) {
            resolve(true)
          }
          resolve(false)
        }

      }
    } catch(e) {
      console.log(e)
      console.log(entries)
      console.log("=>ОШИБКА: Товар НЕ обновлен = ТИП: Цены и остатки: ")
    }
  })

}
/*
  const categoryEntry = await strapi.entityService.create('api::category.category', {
    data: {
      title: 'My Article',
    },
  });
 */

const clearProduct = async (start = 0, end = 1) => {
  for(let i = start; i < end; i++ ) {
    const deleteEntry = await strapi.entityService.delete('api::product.product', i);
    console.log(deleteEntry)
  }
}
