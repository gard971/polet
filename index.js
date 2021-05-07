/*
Versjon 4.0

Laget av Gard

*/

const dotenv = require("dotenv").config()
const https = require("https")
const Discord = require("discord.js")
const client = new Discord.Client()
const fs = require("fs")
const nodeSchedule = require("node-schedule")

var botToken = process.env.BOT_TOKEN
var prefix = process.env.PREFIX
var apiLink = process.env.API_LINK
var apiKey = process.env.API_KEY
var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
var norskeDager = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
var allEmojis = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹"]
var administratorDiscordID = process.env.ADMIN_DISCORD_ID

client.login(botToken)

client.on("ready", () => {
    console.log("bot ready")
    client.user.setActivity(`${prefix}hjelp`)
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
                            'Ocp-Apim-Subscription-Key': apiKey
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
                            msg.channel.send(`Kunne ikke hente data fra ${apiLink} fikk kode ${statusCode} <@${administratorDiscordID}>`)
                        } else if (!/^application\/json/.test(contentType)) {
                            console.log(`Invalid content type. \n` + `Excpected application/json but recived ${contentType}`)
                        } else {
                            res.setEncoding('utf-8')
                            var rawData = ""
                            res.on("data", (chunk) => {
                                rawData += chunk
                            })
                            res.on("end", () => {
                                try {
                                    const parsedData = JSON.parse(rawData)
                                    if (parsedData.length == 1) { //Fant kun en butikk så viser detaljer med en gang
                                        var date = new Date()
                                        var day = days[date.getDay()]
                                        var store = parsedData[0]
                                        var storeName = store.storeName
                                        parsedData[0].openingHours.regularHours.forEach(openDay => {
                                            if (day == openDay.dayOfTheWeek) {
                                                var openingTime = +openDay.openingTime.split(":").join("")
                                                var closingTime = +openDay.closingTime.split(":").join("")
                                                var currentTime = +`${date.getHours()}${date.getMinutes()}`
                                                var storeEmbed = new Discord.MessageEmbed()

                                                client.users.fetch("279292405029535744").then(user => {
                                                    storeEmbed.setFooter(`Polet-bot av ${user.username}`, user.avatarURL())

                                                    storeEmbed.setTitle(storeName)
                                                    storeEmbed.addField(`Område/By:`, store.address.city, true)
                                                    storeEmbed.addField(`Adresse:`, store.address.street, true)
                                                    storeEmbed.setImage("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Vinmonopolets_logo.jpg/1024px-Vinmonopolets_logo.jpg")
                                                    if (!openDay.closed && currentTime >= openingTime && currentTime <= closingTime) {
                                                        storeEmbed.setDescription(`${storeName} er åpen, den stenger kl:${openDay.closingTime}`)
                                                    } else if (currentTime <= openingTime) {
                                                        storeEmbed.setDescription(`${storeName} er stengt, den åpner ikke før kl ${openDay.openingTime}`)
                                                    } else if (openDay.closed) {
                                                        storeEmbed.setDescription(`${storeName} er stengt hele ${norskeDager[date.getDay()]}`)
                                                    } else {
                                                        var openingDay
                                                        var newOpeningHour
                                                        var done = false
                                                        var newDate = date
                                                        newDate.setDate(newDate.getDate() + 1) //setter den nye datoen til neste dag så den ikke tar med idag som en dag butikken åpner
                                                        var times = 0
                                                        while (!done) {
                                                            if (times >= 14) {
                                                                msg.channel.send(`Feil, gikk gjennom dagene ${times} ganger uten resultat. Avbryter`)
                                                                done = true
                                                                break;
                                                            }

                                                            store.openingHours.regularHours.forEach(newRegularHour => {
                                                                if (newRegularHour.dayOfTheWeek == days[newDate.getDay()]) {
                                                                    if (!newRegularHour.closed) {
                                                                        openingDay = norskeDager[newDate.getDay()]
                                                                        newOpeningHour = newRegularHour.openingTime
                                                                        done = true
                                                                    }
                                                                    else {
                                                                        times++
                                                                        newDate.setDate(newDate.getDate() + 1)
                                                                    }
                                                                }
                                                            })
                                                        }
                                                        storeEmbed.setDescription(`${storeName} stengte kl ${openDay.closingTime}. Den åpner kl ${newOpeningHour} på ${openingDay}`)
                                                    }
                                                    msg.channel.send(storeEmbed)
                                                })
                                            }
                                        })
                                    } else { //fant flere butikker så bruker må velge hvilken
                                        var sendAlert = false
                                        var StoreEmbed = new Discord.MessageEmbed().setTitle("Velg En Butikk")
                                        StoreEmbed.setDescription(`Trykk på matchende reaksjon for å velge butikk`)
                                        client.users.fetch("279292405029535744").then(user => {
                                            StoreEmbed.setFooter(`Polet-bot av ${user.username}`, user.avatarURL())
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
                                                    var deleteDate = new Date()
                                                    deleteDate.setHours(deleteDate.getHours()+1)
                                                    var J = nodeSchedule.scheduleJob(deleteDate, () => {
                                                        console.log("schedule")
                                                        var waitingActions = jsonRead("data/waitingActions.json")
                                                        waitingActions.forEach((waitingAction, WI) => {
                                                            if(waitingAction.MsgId == requestObject.MsgId){
                                                                console.log("found")
                                                                waitingActions.splice(WI, 1)
                                                                jsonWrite("data/waitingActions.json", waitingActions)
                                                            }
                                                            else{console.log("not  found")}
                                                        })
                                                        J.cancelNext()
                                                    })
                                                }
                                            })
                                        })
                                    }
                                } catch (e) {
                                    console.log(e)
                                }
                            })
                        }
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
                                'Ocp-Apim-Subscription-Key': apiKey
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
                                msg.channel.send(`kunne ikke hente data fra ${apiLink}, fikk kode ${statusCode}, <@${administratorDiscordID}>`)
                            } else if (!/^application\/json/.test(contentType)) {
                                console.log(`Invalid content type. \n` + `Excpected application/json but recived ${contentType}`)
                            }
                            else {
                                res.setEncoding('utf-8')
                                var rawData = ""
                                res.on("data", (chunk) => {
                                    rawData += chunk
                                })
                                res.on("end", () => {
                                    try {  //Bruker har valgt butikk så viser detaljer om valgt butikk
                                        const parsedData = JSON.parse(rawData)
                                        store = parsedData[0]
                                        var storeName = store.storeName
                                        var date = new Date()
                                        store.openingHours.regularHours.forEach(regularHour => {
                                            if (regularHour.dayOfTheWeek == days[date.getDay()]) {
                                                var currentTime = +`${date.getHours()}${date.getMinutes()}`
                                                var openingTime = +regularHour.openingTime.split(":").join("")
                                                var closingTime = +regularHour.closingTime.split(":").join("")
                                                var storeEmbed = new Discord.MessageEmbed()
                                                client.users.fetch("279292405029535744").then(user => {
                                                    storeEmbed.setFooter(`Polet-bot av ${user.username}`, user.avatarURL())
                                                    storeEmbed.setTitle(storeName)
                                                    storeEmbed.addField(`Område/By:`, store.address.city, true)
                                                    storeEmbed.addField(`Adresse:`, store.address.street, true)
                                                    storeEmbed.setImage("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Vinmonopolets_logo.jpg/1024px-Vinmonopolets_logo.jpg")
                                                    if (!regularHour.closed && currentTime >= openingTime && currentTime <= closingTime) {
                                                        storeEmbed.setDescription(`${storeName} er åpen, den stenger kl:${regularHour.closingTime}`)
                                                    } else if (currentTime <= openingTime) {
                                                        storeEmbed.setDescription(`${storeName} er stengt, den åpner ikke før kl ${regularHour.openingTime} idag`)
                                                    } else if (regularHour.closed) {
                                                        storeEmbed.setDescription(`${storeName} er stengt hele ${norskeDager[date.getDay()]}`)
                                                    } else {
                                                        var dateString = `${date.getFullYear()}-${formatDate(date.getMonth())}-${formatDate(date.getDay())}` //for fremtidig bruk
                                                        var openingDay
                                                        var newOpeningHour
                                                        var done = false
                                                        var newDate = date
                                                        newDate.setDate(newDate.getDate() + 1) //setter den nye datoen til neste dag så den ikke tar med idag som en dag butikken åpner
                                                        var times = 0
                                                        while (!done) {
                                                            if (times >= 14) {
                                                                react.message.channel.send(`Feil, gikk gjennom dagene ${times} ganger uten resultat. Avbryter`)
                                                                done = true
                                                                break;
                                                            }
                                                            store.openingHours.regularHours.forEach(newRegularHour => {
                                                                if (newRegularHour.dayOfTheWeek == days[newDate.getDay()]) {
                                                                    if (!newRegularHour.closed) {
                                                                        openingDay = norskeDager[newDate.getDay()]
                                                                        newOpeningHour = newRegularHour.openingTime
                                                                        done = true
                                                                    }
                                                                    else {
                                                                        times++
                                                                        newDate.setDate(newDate.getDate() + 1)
                                                                    }
                                                                }
                                                            })
                                                        }
                                                        if (newOpeningHour && openingDay) {
                                                            storeEmbed.setDescription(`${storeName} stengte kl ${regularHour.closingTime}. Den åpner kl ${newOpeningHour} på ${openingDay}`)
                                                        }
                                                    }
                                                    react.message.channel.send(storeEmbed)
                                                })
                                            }
                                            jsonWrite("data/waitingActions.json", waitingActions)


                                        })
                                    } catch (e) {
                                        console.log(e)
                                    }
                                })
                            }
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
function formatDate(date) {
    if (date < 10) {
        return +`ada`
    }
}

//error handling
process.on("uncaughtException", (e) => {
    console.log(e.message+ "\n FEIL FANGET!! FORTSETTER OPERASJON!!")
    client.users.fetch(administratorDiscordID).then(user => {
        user.send(`fanget feil: ${e.message}. Fortsetter operasjon`)
    })
})
process.on("unhandledRejection", (e) => {
    console.log(e+ "\n FEIL FANGET!! FORTSETTER OPERASJON!!")
    client.users.fetch(administratorDiscordID).then(user => {
        user.send(`fanget feil: ${e}. Fortsetter operasjon`)
    })
})
process.on("SIGINT", () => {
    jsonWrite("data/waitingActions.json", [])
    process.exit()
})