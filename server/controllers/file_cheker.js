'use strict';
const unzipper = require('unzipper');
const fs = require('fs')
const path = require('node:path');
const xmlParser = require('xml2json');

const {logger} = require('./workers/mainWorkers');
const {deleteNoUpdate} = require('./workers/strapiWorkers');
const {unzip, searchInFolder, getAllFiles} = require('./workers/filesWorkers')

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
              deleteNoUpdate();
            }
          }
        }
      }

        }
    }

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
        console.log("Ошибка в обновлении категории! file: IMPORT")
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

      //await logger(JSON.stringify(data)) //log

      const groupsToConnect = [];

      try {

        const entries = await strapi.entityService.findMany('api::product.product', {
          fields: ['id1c'],
          filters: { id1c: data['Ид'] },
        })

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

            let arrayImages = []

            if(typeof noFormatString == "string") {
              noFormatString.split(',')
              if(Array.isArray(noFormatString) && typeof noFormatString[0] != 'undefined')  {
                arrayImages = [...noFormatString[0]];
              }
            }
            if(typeof arrayImages[0] == 'undefined') arrayImages.push(noFormatString)

            if(Array.isArray(arrayImages[0])) {
              arrayImages = arrayImages[0]
            }
            /* Создание нового товара через внутреннее api */

            console.log("============================")
            console.log("Наименование: ")
            console.log((data['Наименование']) ? `${data['Наименование']}` : "Нет наименования",)
            console.log("Картинка: ")
            console.log((noFormatString) ? `/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${arrayImages[0]}` : null)
            console.log("============================")

            const creatorProduct = await strapi.entityService.create('api::product.product', {
              data: {
                title: (data['Наименование']) ? `${data['Наименование']}` : "Нет наименования",
                description: (typeof data['Описание'] == 'string') ?  `${data['Описание'] }`: "Нет описания",
                id1c:  (data['Ид']) ? `${data['Ид']}` : null,
                imgs: (image) ? await strapi.plugins['upload'].services.upload.upload(
                  { data: {fileInfo: {}}, files: {
                      path: (noFormatString) ? path.resolve(`/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${arrayImages[0]}`): null, // Put your file path
                      name: "${data['Картинка']",
                      type: 'image/jpg'
                    }}
                ) : null,
                //stock: ( data['Количество']) ?  data['Количество'] : "Уточнять",
                //storeplace: ( data['Город']) ?  data['Город'] : "Склад неизвестен",
                quantitySales: '0',
                //price:  ( data['Цена']) ?  data['Цена'] : 0,
                categories: {
                  connect: [...groupsToConnect]
                }
                //priceOpt:  ( data['ЦенаОпт']) ?  data['ЦенаОпт'] : 0,
              },
              populate: ['categories']
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
            console.log("Обновление товара из IMPORT")
            //Поиск группы и коннект
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

            let arrayImages = []

            if(typeof noFormatString == "string") {
              noFormatString.split(',')
              if(Array.isArray(noFormatString) && typeof noFormatString[0] != 'undefined')  {
                arrayImages = [...noFormatString[0]];
              }
            }
            if(typeof arrayImages[0] == 'undefined') arrayImages.push(noFormatString)

            if(Array.isArray(arrayImages[0])) {
              arrayImages = arrayImages[0]
            }
            let image = (noFormatString) ? fs.readFileSync(`/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${arrayImages[0]}`, (file) => file) : null;

            if(data['Наименование']) {
              const updateEntry = await strapi.entityService.update('api::product.product', entries[0].id, {
                data: {
                  id1c: data['Ид'],
                  imgs: (image) ? await strapi.plugins['upload'].services.upload.upload(
                    { data: {fileInfo: {}}, files: {
                        path: (noFormatString) ? path.resolve(`/usr/share/nginx/html/back/public/uploads/exchangeStrapi/tempXMLS/${foldername2}/${arrayImages[0]}`) : null, // Put your file path
                        name: "${data['Картинка']",
                        type: 'image/jpg'
                      }}
                  ) : null,
                  categories: {
                    set: [...groupsToConnect]
                  }
                },
              });
              if(arrayImages) {
                console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!ТОВАР ОБНОВЛЕН IMPORT FILE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
                console.log("Товар создан")
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
        console.log(e)
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
          console.log("=> Товар обновлен = ТИП: Цены и остатки: " + updateEntry.title)
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
