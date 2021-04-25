const dotenv = require("dotenv").config()
const https = require("https")
const Discord = require("discord.js")
const client = new Discord.Client()

var botToken = process.env.BOT_TOKEN
var prefix = process.env.PREFIX
var apiLink = process.env.API_LINK
var apiKey = process.env.API_KEY
var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

client.login(botToken)

client.on("ready", () => {
    console.log("bot ready")
})

client.on("message", msg => {
    var prefixFromMessage = msg.content.substring(0, prefix.length)
    if (prefixFromMessage == prefix) {
        var command = msg.content.substring(prefix.length).split(" ")[0]
        var args = msg.content.substring(prefix.length).split(" ")
        args.splice(0, 1)
        switch (command) {
            case "FinnButikk":
                if (!args[0]) {
                    msg.reply(`mangler argument, bruk slik: ${prefix}${command} navn på butikk`)
                } else {
                    var storeNameString
                    args.forEach(storeNameWord => {
                        if (storeNameString) {
                            storeNameString += ` ${storeNameWord}`
                        } else {
                            storeNameString = storeNameWord
                        }
                    })
                    var options = {
                        hostname: `${apiLink}`,
                        port: 443,
                        path: `/stores/v0/details?storeNameContains=${storeNameString}`,

                        headers: {
                            'Ocp-Apim-Subscription-Key': 'c245d6546cb64fe19a957657058f335b'
                        }
                    }
                    // console.log(options.Headers)
                    var storeGet = https.get(options, (res) => {
                        const {
                            statusCode
                        } = res;
                        const contentType = res.headers['content-type']

                        let error;

                        if (statusCode !== 200) {
                            console.log(`request failed. \n` + `status Code: ${statusCode}`)
                        } else if (!/^application\/json/.test(contentType)) {
                            console.log(`Invalid content type. \n` + `Excpected application/json but recived ${contentType}`)
                        }

                        res.setEncoding('utf-8')
                        var rawData = ""
                        res.on("data", (chunk) => {
                            rawData += chunk
                        })
                        res.on("end", () => {
                            try {
                                const parsedData = JSON.parse(rawData)
                                if (parsedData.length == 1) {
                                    var date = new Date()
                                    date.setDate(23)
                                    date.setHours(16)
                                    var day = days[date.getDay()]
                                    console.log(parsedData)
                                    parsedData[0].openingHours.regularHours.forEach(openDay => {
                                        if (openDay.dayOfTheWeek == day) {
                                            console.log(openDay.closed)
                                            if (!openDay.closed) { //sjekker om denne butikken er stengt denne dagen
                                                var openingTime = +openDay.openingTime.split(":").join("")
                                                var closingTime = +openDay.closingTime.split(":").join("")
                                                var currentTime = +`${date.getHours()}${date.getMinutes()}`
                                                console.log(openingTime)
                                                console.log(closingTime)
                                                console.log(currentTime)
                                                if(currentTime>openingTime && currentTime<closingTime){
                                                    msg.reply(`${parsedData[0].storeName} er åpen, den stenger kl${openDay.closingTime}`)
                                                }
                                                else{
                                                    console.log("closed")
                                                }
                                            }
                                        }
                                    })
                                }
                                parsedData.forEach(store => {
                                    console.log(store.storeName)
                                })
                            } catch (e) {
                                console.log(e)
                            }
                        })
                    })
                    console.log(storeGet.getHeaderNames())
                }
                break;
        }
    }
})