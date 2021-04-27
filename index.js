const dotenv = require("dotenv").config()
const https = require("https")
const Discord = require("discord.js")
const client = new Discord.Client()
const fs = require("fs")
const { parse } = require("dotenv")

var botToken = process.env.BOT_TOKEN
var prefix = process.env.PREFIX
var apiLink = process.env.API_LINK
var apiKey = process.env.API_KEY
var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
var norskeDager = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
var allEmojis = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹"]

client.login(botToken)

client.on("ready", () => {
    console.log("bot ready")
    client.user.setActivity(`Bruker ${prefix}hjelp`)
})

client.on("message", msg => { //venter på meldinger
    var prefixFromMessage = msg.content.substring(0, prefix.length)
    if (prefixFromMessage == prefix) {
        var command = msg.content.substring(prefix.length).split(" ")[0]
        command = command.toLowerCase()
        var args = msg.content.substring(prefix.length).split(" ")
        args.splice(0, 1)
        switch (command) {
            case "finnbutikk":
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
                                    var day = days[date.getDay()]
                                    parsedData[0].openingHours.regularHours.forEach(openDay => {
                                            console.log(openDay.closed)
                                            if (openDay.dayOfTheWeek == day) { //sjekker om denne butikken er stengt denne dagen
                                                var openingTime = +openDay.openingTime.split(":").join("")
                                                var closingTime = +openDay.closingTime.split(":").join("")
                                                var currentTime = +`${date.getHours()}${date.getMinutes()}`
                                                if (!openDay.closed && currentTime > openingTime && currentTime < closingTime) {
                                                    msg.reply(`${parsedData[0].storeName} er åpen, den stenger kl${openDay.closingTime}`)
                                                } else if(currentTime<openingTime){
                                                    msg.reply(`${parsedData[0].storeName} er stengt, den åpner ikke før ${openDay.openingTime}`)
                                                } 
                                                else if(openDay.closed){
                                                    msg.reply(`${parsedData[0].storeName} er stengt hele ${norskeDager[date.getDay()]}`)
                                                } 
                                                else {
                                                    msg.reply(`${parsedData[0].storeName} er stengt`)
                                                }
                                            }
                                    })
                                } else {
                                    var sendAlert = false
                                    var StoreEmbed = new Discord.MessageEmbed().setTitle("Velg En Butikk")
                                    StoreEmbed.setDescription(`Trykk på matchende reaksjon for å velge butikk`)
                                    client.users.fetch("279292405029535744").then(user => {
                                        StoreEmbed.setFooter(`Poletbot av ${user.username}`, user.avatarURL())
                                        var waitingActions = jsonRead("data/waitingActions.json")
                                        var reactionIndex = 0;
                                        var requestObject = {
                                            "type": "storeInfo",
                                            "MsgId": undefined,
                                            "stores": []
                                        }
                                        parsedData.forEach(store => {
                                            if (reactionIndex < allEmojis.length) {
                                                StoreEmbed.addField(store.storeName, `${allEmojis[reactionIndex]}`)
                                                var newObject = {
                                                    "storeID": store.storeId,
                                                    "reaction": allEmojis[reactionIndex]
                                                }
                                                reactionIndex++
                                                requestObject.stores.push(newObject)
                                            }
                                            if (reactionIndex >= allEmojis.length && !sendAlert) {
                                                sendAlert = true
                                            }
                                        })
                                        msg.channel.send(StoreEmbed).then(msgFromBot => {
                                            if (sendAlert) {
                                                msg.channel.send("Meldingen ble avkuttet, hvis du ikke ser butikken du lette etter, venligst ver mer spesifik")
                                            }
                                            for (var i = 0; i < reactionIndex; i++) {
                                                msgFromBot.react(allEmojis[i])
                                            }
                                            if (parsedData.length > 0) {
                                                requestObject.MsgId = msgFromBot.id
                                                waitingActions.push(requestObject)
                                                jsonWrite("data/waitingActions.json", waitingActions)
                                            }
                                        })
                                    })
                                }
                            } catch (e) {
                                console.log(e)
                            }
                        })
                    })
                }
                break;
                case "hjelp":
                    msg.reply(`bruk: ${prefix}finnbutikk navn eller by her`)
                break;
        }
    }
});

client.on("messageReactionAdd", (react, user) => {
    if (!user.bot) {
        var waitingActions = jsonRead("data/waitingActions.json")
        waitingActions.forEach((waitingAction, i) => {
            if (waitingAction.type == "storeInfo" && waitingAction.MsgId == react.message.id) {
                waitingAction.stores.forEach(store => {
                    if (store.reaction == react.emoji.name) {
                        var options = {
                            hostname: `${apiLink}`,
                            port: 443,
                            path: `/stores/v0/details?storeId=${store.storeID}`,

                            headers: {
                                'Ocp-Apim-Subscription-Key': 'c245d6546cb64fe19a957657058f335b'
                            }
                        }
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
                                    store = parsedData[0]
                                    var storeName = store.storeName
                                    var date = new Date()
                                    store.openingHours.regularHours.forEach(regularHour => {
                                        if(regularHour.dayOfTheWeek == days[date.getDay()]){
                                            var currentTime = +`${date.getHours()}${date.getMinutes()}`
                                            var openingTime = +regularHour.openingTime.split(":").join("")
                                            var closingTime = +regularHour.closingTime.split(":").join("")
                                            if(!regularHour.closed && currentTime>=openingTime && currentTime<=closingTime){
                                                react.message.channel.send(`${storeName} er åpen, den stenger kl ${regularHour.closingTime}`)
                                            } else if(currentTime<=openingTime){
                                                react.message.channel.send(`${storeName} er stengt, den åpner ikke før kl ${regularHour.openingTime}`)
                                            } 
                                            else if(regularHour.closed){
                                                react.message.channel.send(`${storeName} er stengt hele ${norskeDager[date.getDay()]}`)
                                            } else{
                                                react.message.channel.send(`${storeName} stengte kl ${regularHour.closingTime}`)
                                            }
                                        }
                                        waitingActions.splice(i, 1)
                                        jsonWrite("data/waitingActions.json", waitingActions)

                                    })
                                } catch (e) {
                                    console.log(e)
                                }
                            })
                        })
                    }
                })
            }
        });
    }
});

(function () {
    var allFiles = [
        ["waitingActions.json", "[]"]
    ]
    var statusSent = false;
    if (!fs.existsSync("data/")) {
        fs.mkdirSync("data/")
        console.log("\x1b[33m%s\x1b[0m", "Opretter Database.....")
        statusSent = true;
    }
    allFiles.forEach(file => {
        if (!fs.existsSync(`data/${file[0]}`)) {
            if (!statusSent) {
                console.log("\x1b[33m%s\x1b[0m", "Opretter Database.....")
                statusSent = true
            }
            jsonWrite(`data/${file[0]}`, JSON.parse(file[1]))
        }
    })
    if (statusSent) {
        console.log("\x1b[32m%s\x1b[0m", "Database Oprettet!")
    }
})()

function jsonRead(path) {
    return JSON.parse(fs.readFileSync(path))
}

function jsonWrite(path, data) {
    fs.writeFileSync(path, JSON.stringify(data))
}

function nextLetter(s) {
    return s.replace(/([a-zA-Z])[^a-zA-Z]*$/, function (a) {
        var c = a.charCodeAt(0);
        switch (c) {
            case 90:
                return 'A';
            case 122:
                return 'a';
            default:
                return String.fromCharCode(++c);
        }
    });
}