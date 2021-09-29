/*
Versjon 6.0

Laget av Gard

*/

const dotenv = require("dotenv").config()
const https = require("https")
const Discord = require("discord.js")
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
})
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
var guildId = process.env.GUILD_ID

client.login(botToken)

client.on("ready", () => {
    console.log("bot ready")
    client.user.setActivity(`/hjelp`)
    //register all commands
    const guild = client.guilds.cache.get(guildId)
    var commands
    if (guild) {
        commands = guild.commands
    } else {
        commands = client.application.commands
    }
    commands.create({
        name: "finnbutikk",
        description: "Finn butikk etter navn",
        options: [{
            name: "butikknavn",
            description: "Butikknavn, kan inkludere mellomrom",
            required: true,
            type: Discord.Constants.ApplicationCommandOptionTypes.STRING
        }]
    })
    commands.create({ 
        name: "sjekkdag",
        description: "Finn åpninstider på en butikk på en spesifik dag",
        options: [{
                name: "butikknavn",
                description: "Butikknavn, kan inneholde mellomrom",
                required: true,
                type: Discord.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: "dag",
                description: "Dagen du vil sjekke, kan IKKE inneholde mellomrom",
                required: true,
                type: Discord.Constants.ApplicationCommandOptionTypes.STRING
            }
        ]
    })
    commands.create({
        name:"kode",
        description: "sjekk ut den episke koden Gard har laget for å få denne botten til å funke"
    })
    commands.create({
        name:"hjelp",
        description:"sjekk ut alle komandoene"
    })
})

client.on("messageReactionAdd", (react, user) => {
    if (!user.bot) {
        var waitingActions = jsonRead("data/waitingActions.json")
        waitingActions.forEach((waitingAction, i) => {
            if (waitingAction.type == "storeInfo" && waitingAction.MsgId == react.message.id) {
                waitingAction.stores.forEach(store => {
                    if (store.reaction == react.emoji.name) {
                        var optionsForApi = {
                            hostname: `${apiLink}`,
                            port: 443,
                            path: `/stores/v0/details?storeId=${store.storeID}`.replaceAll(" ", "_"),

                            headers: {
                                'Ocp-Apim-Subscription-Key': apiKey
                            }
                        }
                        var storeGet = https.get(optionsForApi, (res) => {
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
                            } else {
                                res.setEncoding('utf-8')
                                var rawData = ""
                                res.on("data", (chunk) => {
                                    rawData += chunk
                                })
                                res.on("end", () => {
                                    try { //Bruker har valgt butikk så viser detaljer om valgt butikk
                                        const parsedData = JSON.parse(rawData)
                                        store = parsedData[0]
                                        var storeName = store.storeName
                                        var date = new Date()
                                        store.openingHours.regularHours.forEach(regularHour => {
                                            if (regularHour.dayOfTheWeek == days[date.getDay()]) {
                                                var currentTime = +`${date.getHours()}${date.getMinutes()}`
                                                var openingTime = +regularHour.openingTime.split(":").join("")
                                                var closingTime = +regularHour.closingTime.split(":").join("")
                                                var storeEmbed = new Discord.MessageEmbed().setColor("#ECECEC")
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
                                                                    } else {
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
                                                    react.message.channel.send({embeds:[storeEmbed]})
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

client.on("interactionCreate", (interaction) => {
    if (!interaction.isCommand()) {
        return
    }

    const {
        commandName,
        options
    } = interaction
    var command = commandName
    command = command.toLowerCase()
    var args = options
    var msg = interaction
    switch (command) {
        case "finnbutikk":
            if (false) { //deprecated
                msg.reply(`mangler argument, bruk slik: ${prefix}${command} navn på butikk`)
            } else {
                var storeNameString = args.getString("butikknavn")
                var optionsForApi = {
                    hostname: `${apiLink}`,
                    port: 443,
                    path: `/stores/v0/details?storeNameContains=${storeNameString}`.replaceAll(" ", "_"),

                    headers: {
                        'Ocp-Apim-Subscription-Key': apiKey
                    }
                }
                var storeGet = https.get(optionsForApi, (res) => {
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
                                            var storeEmbed = new Discord.MessageEmbed().setColor("#ECECEC")

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
                                                                } else {
                                                                    times++
                                                                    newDate.setDate(newDate.getDate() + 1)
                                                                }
                                                            }
                                                        })
                                                    }
                                                    storeEmbed.setDescription(`${storeName} stengte kl ${openDay.closingTime}. Den åpner kl ${newOpeningHour} på ${openingDay}`)
                                                }
                                                msg.reply({ embeds:[storeEmbed]})
                                            })
                                        }
                                    })
                                } else { //fant flere butikker så bruker må velge hvilken
                                    var sendAlert = false
                                    var StoreEmbed = new Discord.MessageEmbed().setTitle("Velg En Butikk")
                                    StoreEmbed.setColor("#ECECEC")
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
                                        msg.channel.send(".").then((msgFromBot) => {
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
                                                deleteDate.setHours(deleteDate.getHours() + 1)
                                                var J = nodeSchedule.scheduleJob(deleteDate, () => {
                                                    var waitingActions = jsonRead("data/waitingActions.json")
                                                    waitingActions.forEach((waitingAction, WI) => {
                                                        if (waitingAction.MsgId == requestObject.MsgId) {
                                                            waitingActions.splice(WI, 1)
                                                            jsonWrite("data/waitingActions.json", waitingActions)
                                                        }
                                                    })
                                                    J.cancelNext()
                                                })
                                            }
                                        })
                                        msg.reply({embeds:[StoreEmbed]})
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
        case "sjekkdag": //sjekker neste Xdag, for eksempel !!sjekkdag lagunen Lørdag vil sjekke åpningstid på lagunen neste lørdag
            if (false) { //deprecated grunnet overgang til slashkomandoer
                msg.reply(`mangler argument, bruk slik: ${prefix}sjekkdag butikk navn her Dag(for eksempel Lørdag)`)
            } else {
                var storeNameString
                var dayToCheck = false
                var dayIndex = false
                var arguments = []
                arguments.push(args.getString("butikknavn"))
                arguments.push(args.getString("dag"))
                arguments.forEach(arg => {
                    var isDay = false
                    norskeDager.forEach((norskDag, I) => {
                        if (arg.toLowerCase() == norskDag.toLowerCase()) {
                            dayToCheck = days[I]
                            dayIndex = I
                            isDay = true
                        }
                    })
                    if (!isDay) {
                        if (storeNameString) {
                            storeNameString += ` ${arg}`
                        } else {
                            storeNameString = arg
                        }
                    }
                })
                if (dayToCheck && storeNameString) {
                    var optionsForApi = {
                        hostname: `${apiLink}`,
                        port: 443,
                        path: `/stores/v0/details?storeNameContains=${storeNameString}`.replaceAll(" ", "_"),

                        headers: {
                            'Ocp-Apim-Subscription-Key': apiKey
                        }
                    }
                    var httpRequest = https.get(optionsForApi, (res) => {
                        const {
                            statusCode
                        } = res
                        const contentType = res.headers['content-type']
                        if (statusCode !== 200) {
                            console.log(`request failed. \n` + `status Code: ${statusCode}`)
                            msg.channel.send(`Kunne ikke hente data fra ${apiLink} fikk kode ${statusCode} <@${administratorDiscordID}>`)
                        } else if (!/^application\/json/.test(contentType)) {
                            console.log(`Invalid content type. \n` + `Excpected application/json but recived ${contentType}`)
                        } else {
                            var rawData = ""
                            res.on("data", (chunk) => {
                                rawData += chunk
                            })
                            res.on("end", () => {
                                try {
                                    var parsedData = JSON.parse(rawData)
                                    if (parsedData.length == 1) {
                                        var store = parsedData[0]
                                        var date = new Date()
                                        var currentDay = days[date.getDay()]
                                        var daysToAdd = 0
                                        var done = false
                                        var startLoop = false
                                        while (!done) {
                                            if (daysToAdd >= 14) {
                                                msg.reply(`gikk gjennom dagene mer en 14 ganger uten resultat, avbryter`)
                                                break;
                                            }
                                            days.forEach(day => {
                                                if (!done) {
                                                    if (!startLoop && day == currentDay) {
                                                        startLoop = true
                                                    } else if (day == dayToCheck) {
                                                        daysToAdd++
                                                        done = true
                                                    } else {
                                                        daysToAdd++
                                                    }
                                                }
                                            })
                                        }
                                        if (done) {
                                            var storeEmbed = new Discord.MessageEmbed().setColor("#ECECEC")
                                            storeEmbed.setTitle(store.storeName)
                                            storeEmbed.setImage("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Vinmonopolets_logo.jpg/1024px-Vinmonopolets_logo.jpg")
                                            storeEmbed.addField("Områade/By", store.address.city, true)
                                            storeEmbed.addField("Adresse", store.address.street, true)
                                            var dateToCheck = new Date()
                                            dateToCheck.setDate(date.getDate() + daysToAdd)
                                            store.openingHours.regularHours.forEach(openingHour => {
                                                if (openingHour.dayOfTheWeek == dayToCheck) {
                                                    var isException = false
                                                    store.openingHours.exceptionHours.forEach(exceptionHour => {
                                                        var exceptionDate = `${dateToCheck.getFullYear()}-${formatDate(dateToCheck.getMonth()+1)}-${formatDate(dateToCheck.getDate())}`
                                                        if (exceptionHour.date == exceptionDate && exceptionHour.openingTime == "") {
                                                            isException = true
                                                            if (exceptionHour.message != "") {
                                                                storeEmbed.setDescription(`${store.storeName} er stengt på ${norskeDager[dayIndex]}. Grunnet: ${exceptionHour.message}`)
                                                            } else {
                                                                storeEmbed.setDescription(`${store.storeName} er stengt på ${norskeDager[dayIndex]}`)
                                                            }
                                                        } else if (exceptionHour.date == exceptionDate) {
                                                            isException = true
                                                            if (exceptionHour.message != "") {
                                                                storeEmbed.setDescription(`${store.storeName} har spesielle åpningstider neste ${norskeDager[dayIndex]}. ${store.storeName} er kun åpent mellom ${exceptionHour.openingTime} og ${exceptionHour.closingTime}. Grunnet ${exceptionHour.message}`)
                                                            } else {
                                                                storeEmbed.setDescription(`${store.storeName} har spesielle åpningstider neste ${norskeDager[dayIndex]}. ${store.storeName} er kun åpent mellom ${exceptionHour.openingTime} og ${exceptionHour.closingTime}.`)
                                                            }
                                                        }
                                                    })
                                                    if (!openingHour.closed && !isException) {
                                                        storeEmbed.setDescription(`${store.storeName} er åpen mellom ${openingHour.openingTime} og ${openingHour.closingTime} på ${norskeDager[dayIndex]}`)
                                                    } else if (!isException) {
                                                        storeEmbed.setDescription(`${store.storeName} er stengt på ${norskeDager[dayIndex]}`)
                                                    }
                                                    if (storeEmbed.description) {
                                                        client.users.fetch("279292405029535744").then(user => {
                                                            storeEmbed.setFooter(`Polet-bot av ${user.username}`, user.avatarURL())
                                                            msg.reply({embeds:[storeEmbed]})
                                                        })
                                                    } else {
                                                        msg.channel.send("noe gikk galt. storeEmbed.description === undefined")
                                                    }
                                                }
                                            })
                                        }
                                    } else {
                                        msg.reply(`fikk flere resultat, vær mer nøyaktig med butikk navn. Bruk ${prefix}finnbutikk for å finne nøyaktig butikknavn?`)
                                    }
                                } catch (e) {
                                    msg.channel.send("noe gikk galt. " + e)
                                    console.log(e)
                                }
                            })
                        }
                    })
                } else {
                    msg.reply(`mangler argument, bruk slik: ${prefix}sjekkdag butikk navn her Dag(for eksempel Lørdag) nr2`)
                }
            }
            break;
        case "kode":
            msg.reply("https://github.com/gard971/polet/blob/main/index.js")
            break;
        case "hjelp":
            var msgEmbed = new Discord.MessageEmbed()
            msgEmbed.setTitle("Hjelp")
            msgEmbed.addFields({
                name: `/finnbutikk butikknavn`,
                value: `Få informasjon om butikk; Åpningstid, adresse osv`
            }, {
                name: `/sjekkdag butikknavn dag`,
                value: `få informasjon om butikk frem i tid, som åpningstid adresse osv`
            }, {
                name: `/kode`,
                value: `sjekk ut den episke koden gard har laget`
            })
            client.users.fetch("279292405029535744").then(user => {
                msgEmbed.setFooter(`Polet-bot av ${user.username}`, user.avatarURL())
                msgEmbed.setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Vinmonopolets_logo.jpg/1024px-Vinmonopolets_logo.jpg")
                msgEmbed.setColor("#ECECEC")
                msg.reply({embeds:[msgEmbed]})
            })
            break;
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
        return `0${date}`
    } else {
        return date
    }
}

function encodeForApi(link) {
    return link.replace("/ /", "_")
}

//error handling

process.on("SIGINT", () => {
    jsonWrite("data/waitingActions.json", [])
    process.exit()
})
String.prototype.replaceAll = function (str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof (str2) == "string") ? str2.replace(/\$/g, "$$$$") : str2);
}