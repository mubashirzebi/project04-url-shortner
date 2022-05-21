
const urlModel = require('../models/urlModel')
const randomString = require('randomstring');
const redis = require("redis");
const { promisify } = require("util");


//=======================================Connect to redis=============================================//

const redisClient = redis.createClient(
    12542,
    "redis-12542.c9.us-east-1-4.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);

redisClient.auth("JTA6xJq8bKzz0sJNGqNGYJa5lpVhKn5h", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

//Connection setup for redis

const SETEX_ASYNC = promisify(redisClient.SETEX).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);


//==============================================POST /url/shorten=======================================================//

const urlShortner = async function (req, res) {
    try {
        const reqBody = req.body;
        const longUrl = req.body.longUrl

        const urlValidatorRegex = /^([hH][tT][tT][pP]([sS])?:\/\/.)(www\.)?[-a-zA-Z0-9@:%.\+#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%\+.#?&//=_]*$)/g

        if (!longUrl) {
            return res.status(400).send({ status: false, message: "longUrl must be required...", })
        }

        const longUrlValidator = (urlValidatorRegex).test(longUrl)

        if (!longUrlValidator) {
            return res.status(400).send({ status: false, message: "Url is invalid", })
        }

        const checkLongUrlInRedis = await GET_ASYNC(`${longUrl}`)

        const redisOutPut = JSON.parse(checkLongUrlInRedis)

        if (checkLongUrlInRedis) {
            return res.status(201).send({ status: true, data: redisOutPut })
        }

        const checkDuplicateLongUrlInDB = await urlModel.findOne({ longUrl }).select({ createdAt: 0, updatedAt: 0, __v: 0, _id: 0 })

        if (checkDuplicateLongUrlInDB) {

            await SETEX_ASYNC(`${longUrl}`, 60 * 60, JSON.stringify(checkDuplicateLongUrlInDB))

            return res.status(201).send({ status: true, data: checkDuplicateLongUrlInDB })
        }

        // let f = false
        // while (f == false) {
        var urlCode = randomString.generate({ length: 8, capitalization: 'lowercase' })

        //     const checkDuplicateUrlCode = await urlModel.findOne({ urlCode })

        //     if (!checkDuplicateUrlCode) {
        //         f = true
        //     }
        // }

        const shortUrl = `http://localhost:3000/${urlCode}`
        reqBody.shortUrl = shortUrl
        reqBody.urlCode = urlCode

        createUrl = await urlModel.create(reqBody)

        let obj = {};
        obj.longUrl = createUrl.longUrl
        obj.shortUrl = createUrl.shortUrl
        obj.urlCode = createUrl.urlCode

        return res.status(201).send({ status: true, data: obj })
    }
    catch (error) {
        return res.status(500).send({ status: false, error: error.message })
    }

}


//=============================================GET /:urlCode======================================//

const getUrl = async function (req, res) {
    try {

        const urlCode = req.params.urlCode

        const findUrlCodeInRedis = await GET_ASYNC(`${urlCode}`)

        if (findUrlCodeInRedis) {
            return res.status(302).redirect(findUrlCodeInRedis)
        }

        const findUrlCodeInDB = await urlModel.findOne({ urlCode: urlCode })

        if (!findUrlCodeInDB) {
            return res.status(404).send({ status: false, message: "urlCode is not found in DB..." })
        }

        await SETEX_ASYNC(`${urlCode}`, 60 * 60, findUrlCodeInDB.longUrl)

        return res.status(302).redirect(findUrlCodeInDB.longUrl)

    }
    catch (error) {
        return res.status(500).send({ status: false, error: error.message })
    }
}




module.exports = { urlShortner, getUrl }