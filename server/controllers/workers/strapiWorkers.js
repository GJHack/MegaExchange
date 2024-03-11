'use strict';

/**
 * @description Удаление товаров, которые не были в обновлении.
 * @returns {boolean}
 */
async function deleteNoUpdate() {
  return new Promise(async (resolve, reject) => {
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

    resolve(noUpdateEntries);
  })
}
module.exports = {
  deleteNoUpdate
}
