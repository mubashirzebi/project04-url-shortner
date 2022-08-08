
const urlModel = require('../models/urlModel')
const randomString = require('randomstring');
const redis = require("redis");


//=======================================Connect to redis=============================================//

const client = redis.createClient({
    url: "redis://default:mJsrV4ebvRJIpn0ffI1NV0rzOPulQ2qS@redis-16938.c74.us-east-1-4.ec2.cloud.redislabs.com:16938"
});

client.connect()
.then(()=> {
console.log("redis Connected")
})
.catch( err => {
    console.log('Error ' + err);
});


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

        const checkLongUrlInRedis = await client.get(`${longUrl}`)

        const redisOutPut = JSON.parse(checkLongUrlInRedis)

        if (checkLongUrlInRedis) {
            return res.status(201).send({ status: true, data: redisOutPut })
        }

        const checkDuplicateLongUrlInDB = await urlModel.findOne({ longUrl }).select({ createdAt: 0, updatedAt: 0, __v: 0, _id: 0 })

        if (checkDuplicateLongUrlInDB) {

            await client.setEx(`${longUrl}`, 60 * 60, JSON.stringify(checkDuplicateLongUrlInDB))

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

        const findUrlCodeInRedis = await client.get(`${urlCode}`)

        if (findUrlCodeInRedis) {
            return res.status(302).redirect(findUrlCodeInRedis)
        }

        const findUrlCodeInDB = await urlModel.findOne({ urlCode: urlCode })

        if (!findUrlCodeInDB) {
            return res.status(404).send({ status: false, message: "urlCode is not found in DB..." })
        }

        await client.setEx(`${urlCode}`, 60 * 60, findUrlCodeInDB.longUrl)

        return res.status(302).redirect(findUrlCodeInDB.longUrl)

    }
    catch (error) {
        return res.status(500).send({ status: false, error: error.message })
    }
}




module.exports = { urlShortner, getUrl }