const fs = require('fs')
const path = require('node:path');


const logger = async (text = ``) => {

    console.log(path.resolve('log_product_add.txt'))

    try {
      await fs.appendFileSync(path.resolve('log_product_add.txt'), text, (err) => {
        if(err) throw err
        console.log("log add item. thx for log")
      })
    } catch (err) {
      console.log("Ошибка записи в лог добавления товаров")
      console.log(err)
    }

}

module.exports = {logger}
