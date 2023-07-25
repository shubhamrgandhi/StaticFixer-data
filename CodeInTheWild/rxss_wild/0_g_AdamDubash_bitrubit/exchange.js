const router = require('express').Router()

const passport = require('../auths/passport')
const config = require("../config")
const redis = require("../libs/redisClient")
const validator = require('../libs/validator')
const notify = require("../libs/notification")

const QiwiApi = require('../libs/qiwi-api')
const QiwiWebhook = require("../libs/qiwi-webhook")
const BTCWallet = require('../libs/btcw')

const Exchange = require('../models/exchange')

const btcw = new BTCWallet(config.get('exchange:btc:url'), config.get('exchange:btc:token'));

const courseValidators = {
    "qiwi-btc": async (data) => {
        const result = {ok: false, msg: "Некорректно введены входные данные"}

        if (isNaN(data.amount) || !data.sourceAddress || !data.destAddress) {
            return result
        }

        const qiwiMin = config.get("exchange:limits:qiwi:min")

        if(data.amount < qiwiMin) {
            result.msg = `Минимальная сумма обмена QIWI: ${qiwiMin}RUB`

            return result
        }

        if(!validator.addressIsValid("qiwi", data.sourceAddress)) {
            result.msg = "Некорректно введен номер телефона. Правильный пример: +79876665544"

            return result
        }

        if(!validator.addressIsValid("btc", data.destAddress)) {
            result.msg = "Некорректно введен адрес получения."

            return result
        }

        result.ok = true

        return result
    },
    "btc-qiwi": async (data) => {
        const result = { ok: false, msg: "Некорректно введены входные данные" }

        if (isNaN(data.amount)  || !data.destAddress) {
            return result
        }

        const btcMin = config.get("exchange:limits:btc:min")

        if (data.amount < btcMin) {
            result.msg = `Минимальная сумма обмена BTC: ${btcMin}BTC`

            return result
        }

        if (!validator.addressIsValid("qiwi", data.destAddress)) {
            result.msg = "Некорректно введен адрес получения."

            return result
        }

        result.ok = true

        return result
    }
}

router.get('/', (req, res) => {
    const limits = config.get("exchange:limits")

    res.render('exchange', {limits})
})

const reqValidator = async (req,res, next) => {
    const unclosed = await Exchange.find({owner: +req.user.nid, 'status.code': 0})

    if(unclosed && unclosed.length === 0) {
        return res.status(400).send("Обнаружены незавершенные обмены.")
    }

    const {course, data} = req.body 
    
    if( !course || !data) {
        return res.status(400).send("Неверный формат данных!")
    }

    const courseValidator = courseValidators[course]

    if( !courseValidator) {
        return res.status(400).send("Недоступная валютная пара!")
    }

    const exchangeable = await courseValidator(data)

    if(!exchangeable.ok) {
        return res.status(400).send(exchangeable.msg)
    }

    next()    
}

const reservesAreEnough = async (req, res, next) => {
    const qiwiApi = new QiwiApi(config.get("exchange:qiwi:token"))

    const btcPrice = await redis.getAsync("exchange:btc-course")

    const qiwiRes = await qiwiApi.getBalance()

    // const qiwiBalance = qiwiRes && qiwiRes.accounts[0] && qiwiRes.accounts[0].balance.amount
    // const btcBalance = (await btcw.getBalance()).result || false

    //DEBUG

    const qiwiBalance = 10000
    const btcBalance = 1.12313

    const qiwiReserved = await redis.getAsync("exchange:qiwi:reserved")
    const btcReserved = await redis.getAsync("exchange:btc:reserved")

    console.log(btcPrice, qiwiBalance, btcBalance, qiwiReserved, btcReserved)

    if(isNaN(btcPrice) || isNaN(qiwiBalance) || isNaN(btcBalance) || isNaN(qiwiReserved) || isNaN(btcReserved)) {
        return res.status(500).send("Что-то пошло не так. Попробуйте запрос позже.")
    }

    const qiwiAvailable = qiwiBalance - qiwiReserved
    const btcAvailable = btcBalance - btcReserved

    console.log("available", qiwiAvailable, btcAvailable)

    let qiwiNeeded, btcNeeded;

    if(req.body.course === "qiwi-btc") {
        btcNeeded = +(req.body.data.amount / btcPrice).toFixed(8)
        qiwiNeeded = +req.body.data.amount
    } else {
        qiwiNeeded = ~~(btcPrice * req.body.data.amount)
        btcNeeded = +req.body.data.amount
    }

    console.log("needed", qiwiNeeded, btcNeeded)

    if (qiwiNeeded >= qiwiAvailable || btcNeeded >= btcAvailable) {
        return res.status(400).send("Сумма обмена превышает лимиты наших резервов!")
    }

    req.body.qiwiNeeded = qiwiNeeded
    req.body.btcNeeded = btcNeeded

    next()
}

const exTimeouts = {}

router.post("/", passport.isConfirmed, reqValidator, reservesAreEnough, async (req, res) => {
    const { course, data:{sourceAddress, destAddress} , qiwiNeeded, btcNeeded} = req.body

    console.log(req.body)

    if(!reserveMoney(+qiwiNeeded, +btcNeeded)) {
        res.status(500).send("Что-то пошло не так. Повторите попытку позже")
    }

    const exchArgs = {
        owner: req.user.nid,
        course,
        amount: { qiwi: qiwiNeeded, btc: btcNeeded},
        sourceAddress,
        destAddress
    }

    if (req.body.course === 'btc-qiwi') {
        const regresult = await btcw.reguser(req.user.nid.toString())

        if (!regresult || regresult.error) {
            console.error("user reg error: " + regresult)

            return res.status(500).send("Ошибка при создании BTC-адреса. Повторите запрос позже или обратитесь в поддержку.")
        }

        exchArgs.sourceAddress = regresult.result.address
    }

    console.log(exchArgs)

    const ex = await Exchange.add(exchArgs)

    if(!ex || isNaN(ex.id)) {
        return res.status(500).send("Что-то пошло не так. Повторите запрос позже")
    }

    res.send(`/exchange/id/${ex.id}`)

    exTimeouts[ex.id] = setTimeout(() => {
        deactivateExchange(ex.id)
    }, config.get("exchange:waitingMinutes") * 60 * 1000)
})

const deactivateExchange = async exId => {
    delete exTimeouts[exId]

    const ex = await Exchange.getById(exId)

    if(!ex) {
        return console.error("cannot deactivate ex. not found")
    }

    if(ex.status.code === 0) {
        reserveMoney(-ex.amount.qiwi, -ex.amount.btc)

        ex.status.code = -1
        ex.status.msg = "Обмен отменен. Истекло время ожидания"

        ex.save()
    } 
}

const reserveMoney = async (qiwi, btc) => {
    const qiwiCurrent = await redis.getAsync("exchange:qiwi:reserved")
    const btcCurrent = await redis.getAsync("exchange:btc:reserved")

    return redis.set("exchange:qiwi:reserved", +qiwiCurrent + qiwi)
        && redis.set("exchange:btc:reserved", (+btcCurrent + btc).toFixed(8))
}

router.post("/ipn/qiwi",  async (req, res, next) => {
    console.log(req.body)
    
    if (!QiwiWebhook.verify(req.body, config.get('qiwi:secret'))) {
        return res.send(401)
    }

    const { sum:{ amount }, account:address, type, status} = req.body.payment

    if (type !== 'IN' || status !== 'SUCCESS') {
       return res.send(200)
    }

    const ex = await Exchange.getByAddress("sourceAddress", address)

    if (!ex) {
        console.error("qiwi-ipn: ex not found")
    } else {
        console.log(ex)

        if(ex.amount.qiwi > amount) {
            ex.status.code = 1
            ex.status.msg = "Вы прислали недостаточно средств. Обратитесь в поддержку для завершения обмена!"
        } else {
            const withdraw = await btcw.withdrawal(ex.destAddress, ex.amount.btc, ex.owner)

            if (!withdraw || withdraw.result) {
                console.error("exchange: withdraw errror", withdraw)

                ex.status.code = 99
                ex.status.msg = "Платеж принят. Но возникла проблема при переводе средств на ваш адрес. Свяжитесь с оператором для завершения обмена"
            } else {
                ex.status.code = 100
                ex.status.msg = "Обмен завершен успешно! Ваша транзакция: " + withdraw.result
            }
        }

        notify.add(`Обмен#${ex.id}: ` + ex.status.msg, +ex.owner)

        ex.save()

        reserveMoney(-ex.amount.qiwi, -ex.amount.btc)
        delete exTimeouts[ex.id]
    }

    res.send("ok")
})

router.post("/ipn/btc", async (req, res, next) => {
    console.log(req.body)
    const { event, account, address, amount, newaddress, transaction } = req.body

    const ex = await Exchange.findOne({ "sourceAddress": address})

    if (!ex) {
        console.error("btc-ipn: ex not found")
        next()
    } 

    console.log(ex)

    if (event === 'receive') {
        delete exTimeouts[ex.id]

        ex.status.code = 90
        ex.status.msg = "Мы обнаружили вашу транзакцию. Ожидаем достижения 2х подтверждений..."
    }

    if (event === 'confirmed') {
        if (ex.amount.btc < amount) {
            ex.status.code = 1
            ex.status.msg = "Вы прислали недостаточно средств. Обратитесь в поддержку для завершения обмена!"
        } else {
            const qiwi = new QiwiApi(config.get("exchange:qiwi:token"))

            const opts = {
                amount: ex.amount.qiwi,
                account: ex.destAddress,
                comment: ``
            };

            const withdraw = await qiwi.toWallet(opts)

            if (!withdraw || withdraw.resultCode !== 200) {
                console.error("exchange: withdraw errror", withdraw)

                ex.status.code = 99
                ex.status.msg = "Платеж принят. Но возникла проблема при переводе средств на ваш счет. Свяжитесь с оператором для завершения обмена"
            } else {
                ex.status.code = 100
                ex.status.msg = "Обмен завершен успешно!" 
            }
        }

        

        //btcw.deleteAccount()
    }

    ex.save()

    notify.add(`Обмен#${ex.id}: ${ex.status.msg}`, +ex.owner)

    res.send("ok")
})

router.get("/id/:id", passport.isConfirmed, async (req, res, next) => {
    const exchangeId = req.params.id

    if (isNaN(exchangeId)) {
        return next()
    }

    const exc = await Exchange.getById(+exchangeId)

    if(!exc) {
        return next()
    }

    const qiwiPhone = config.get("")

    res.render("exchange-ticket", exc)
})



router.get('/course', async (req, res) => {
    const qiwi = await redis.getAsync("exchange:qiwi:balance") - await redis.getAsync("exchange:qiwi:reserved")
    const btc = await redis.getAsync("exchange:btc:balance") - await redis.getAsync("exchange:btc:reserved")
    const course = await redis.getAsync("exchange:btc-course")

    console.log(qiwi, btc)
    
    res.json({
        course, qiwi, btc
    })
})

router.post("/procent", passport.isAdmin, (req, res) => {
    const {procent} = req.body

    config.set("exchange:procent", +procent)
    config.save()

    res.json({ msg: 'Данные успешно обновлены!' });
})

router.post("/waitingminutes", passport.isAdmin, (req, res) => {
    const { minutes } = req.body

    config.set("exchange:waitingMinutes", +minutes)
    config.save()

    res.json({ msg: 'Данные успешно обновлены!' });
})

module.exports = router
