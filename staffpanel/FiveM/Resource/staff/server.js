const config = require('./config.json')

const io = require('socket.io-client')
let options = {
    auth: {
        token: config.token
    }
}
if (config.ssl) {
    options = {
        auth: {
            token: config.token
        },
        secure: true
    }
}
const socket = io(`${config.url}/servers`, options)

socket.on('connect', () => {
    setTimeout(() => {
        socket.emit('verifyToken', config.identifier, (verified) => {
            if (verified) {
                console.log('Successfully verified.')
            } else {
                console.log('Unsuccessfully verified, please check your token in the config.')
            }
        })
    }, 50)

    console.log(`Successfully connected to portal. (${socket.id})`)
})

socket.on('warnPlayer', (discord, reason) => {
    for (let i = 0; i < GetNumPlayerIndices(); i++) {
        const player = GetPlayerFromIndex(i)

        for (let ii = 0; ii < GetNumPlayerIdentifiers(player); ii++) {
            const identifier = GetPlayerIdentifier(player, ii)

            if (identifier.includes('discord:') && identifier.includes(discord)) {
                emitNet('Scotty:Client:WarnPlayer', player, reason)
                emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(player)}^0 has been warned by staff for ^2${reason}^0.`)
            }
        }
    }
})

socket.on('kickPlayer', (discord, reason) => {
    for (let i = 0; i < GetNumPlayerIndices(); i++) {
        const player = GetPlayerFromIndex(i)

        for (let ii = 0; ii < GetNumPlayerIdentifiers(player); ii++) {
            const identifier = GetPlayerIdentifier(player, ii)

            if (identifier.includes('discord:') && identifier.includes(discord)) {
                DropPlayer(player, `
                ⚠️ You Have Been Kicked From This Server ⚠️
                --------------------------------------
                📝 Reason: ${reason}
                --------------------------------------
            `)
            emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(player)}^0 has been kicked by staff for ^2${reason}^0.`)
            }
        }
    }
})

socket.on('banPlayer', (discord, reason) => {
    for (let i = 0; i < GetNumPlayerIndices(); i++) {
        const player = GetPlayerFromIndex(i)

        for (let ii = 0; ii < GetNumPlayerIdentifiers(player); ii++) {
            const identifier = GetPlayerIdentifier(player, ii)

            if (identifier.includes('discord:') && identifier.includes(discord)) {
                DropPlayer(player, `
                ⚠️ You Are Banned From This Server ⚠️
                --------------------------------------
                📝 Reason: ${reason}
                --------------------------------------
                Reconnect for more details.
            `)
            emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(player)}^0 has been banned by staff for ^2${reason}^0.`)
            }
        }
    }
})

socket.on('getOnline', (discord, callback) => {
    for (let i = 0; i < GetNumPlayerIndices(); i++) {
        const player = GetPlayerFromIndex(i)

        for (let ii = 0; ii < GetNumPlayerIdentifiers(player); ii++) {
            const identifier = GetPlayerIdentifier(player, ii)

            if (identifier.includes('discord:') && identifier.includes(discord)) {
                callback(true)
            }
        }
    }
    callback(false)
})

socket.on('getPlayers', (serverIdentifier, callback) => {
    if (config.identifier === serverIdentifier || serverIdentifier === null) {
        let players = []
        for (let i = 0; i < GetNumPlayerIndices(); i++) {
            const player = GetPlayerFromIndex(i)
            let discord
            for (let ii = 0; ii < GetNumPlayerIdentifiers(player); ii++) {
                const identifier = GetPlayerIdentifier(player, ii)
    
                if (identifier.includes('discord:')) {
                    discord = identifier.split('discord:')[1]
                }
            }
            players.push({ source: player, name: GetPlayerName(player), id: discord, ping: GetPlayerPing(player) })
        }
        callback(players)
    } else {
        callback(false)
    }
})

on('playerConnecting', (name, _setKickReason, deferrals) => {
    deferrals.defer()

    const player = this.source

    setTimeout(() => {
        deferrals.update(`Hello ${name}. Your discord is being checked.`)

        let discord = null
        let identifiers = []

        for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
            const identifier = GetPlayerIdentifier(player, i)

            if (!identifier.includes('ip:')) identifiers.push({ identifier: identifier })
            if (identifier.includes('discord:')) {
                discord = identifier.split('discord:')[1]
            }
        }

        setTimeout(() => {
            if (discord === null) {
                deferrals.done('Discord is required to join this server.')
            } else {
                deferrals.update('Adding you as a user...')
                if (socket.connected) {
                    socket.emit('addUser', discord, name, identifiers, (_result) => {
                        setTimeout(() => {
                            deferrals.update('Checking if you\'re banned...')
                            socket.emit('getBanned', discord, (result) => {
                                if (result.banned) {
                                    deferrals.done(`
                                        ⚠️ You Are Banned From This Server ⚠️
                                        --------------------------------------
                                        📝 Reason: ${result.reason}
                                        ⏰ Expiration: ${formatDate(result.expiry)}
                                        --------------------------------------
                                    `)
                                } else {
                                    setTimeout(() => {
                                        let done = false;
                                        deferrals.update('Getting ace groups...')
                                        socket.emit('getAceGroups', discord, (groups) => {
                                            for (const group of groups) {
                                                ExecuteCommand(`add_principal identifier.discord:${discord} group.${group}`)
                                            }
                                            deferrals.done()
                                            done = true;
                                        })
                                        setTimeout(() => {
                                            if (!done) deferrals.done()
                                        }, 1000)
                                    }, 0)
                                }
                            })
                        }, 0)
                    })
                } else {
                    deferrals.done()
                }
            }
        }, 0)
    }, 0)
})

on('playerDropped', (reason) => {
    const player = this.source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }
    socket.emit('addRecentPlayer', config.identifier, discord, GetPlayerName(player), reason)
    socket.emit('getAceGroups', discord, (groups) => {
        for (const group of groups) {
            ExecuteCommand(`remove_principal identifier.discord:${discord} group.${group}`)
        }
    })
})

function formatDate(givenDate) { // Thanks Stack Overflow :p
    let date
    if (typeof(givenDate) == 'string') {
        date = new Date(givenDate)
    } else {
        date = givenDate
    }
    let hours = date.getHours()
    let minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12
    minutes = minutes < 10 ? '0' + minutes : minutes
    const strTime = hours + ':' + minutes + ampm
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear() + '  ' + strTime
}

RegisterCommand('warn', (source, args, _rawCommand) => {
    const player = source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }

    const target = parseInt(args.splice(0, 1)[0])
    let targetDiscord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(target); i++) {
        if (GetPlayerIdentifier(target, i).includes('discord:')) targetDiscord = GetPlayerIdentifier(target, i).split('discord:')[1]
    }

    const reason = args.join(' ')
    if (discord && targetDiscord) {
        socket.emit('addWarn', discord, targetDiscord, reason)
        emitNet('Scotty:Client:WarnPlayer', target, reason)
        emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(target)}^0 has been warned by staff for ^2${reason}^0.`)
    }
})

RegisterCommand('kick', (source, args, _rawCommand) => {
    const player = source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }

    const target = parseInt(args.splice(0, 1)[0])
    let targetDiscord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(target); i++) {
        if (GetPlayerIdentifier(target, i).includes('discord:')) targetDiscord = GetPlayerIdentifier(target, i).split('discord:')[1]
    }

    const reason = args.join(' ')
    if (discord && targetDiscord) {
        socket.emit('addKick', discord, targetDiscord, reason)
        emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(target)}^0 has been kicked by staff for ^2${reason}^0.`)
        DropPlayer(target, `
            ⚠️ You Have Been Kicked From This Server ⚠️
            --------------------------------------
            📝 Reason: ${reason}
            --------------------------------------
        `)
    }
})

RegisterCommand('ban', (source, args, _rawCommand) => {
    const player = source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }

    const target = parseInt(args.splice(0, 1)[0])
    let targetDiscord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(target); i++) {
        if (GetPlayerIdentifier(target, i).includes('discord:')) targetDiscord = GetPlayerIdentifier(target, i).split('discord:')[1]
    }

    const length = args.splice(0, 1)[0]
    let banLength = null
    if (length !== '0' && length !== '0d' && length !== '0h') {
        if (length.includes('d')) {
            banLength = parseInt(length.split('d')[0] * 24)
        } else if (length.includes('h')) {
            banLength = parseInt(length.split('h')[0])
        } else if (!isNaN(length)) {
            banLengh = parseInt(length)
        }
    } else {
        banLength = 0
    }

    const reason = args.join(' ')
    if (discord && targetDiscord && !isNaN(banLength)) {
        socket.emit('addBan', discord, targetDiscord, banLength, reason)
        emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(target)}^0 has been banned by staff for ^2${reason}^0.`)
        DropPlayer(target, `
            ⚠️ You Are Banned From This Server ⚠️
            --------------------------------------
            📝 Reason: ${reason}
            ⏰ Length: ${banLength} Hours
            --------------------------------------
            Reconnect for more details.
        `)
    }
})

RegisterCommand('commend', (source, args, _rawCommand) => {
    const player = source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }

    const target = parseInt(args.splice(0, 1)[0])
    let targetDiscord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(target); i++) {
        if (GetPlayerIdentifier(target, i).includes('discord:')) targetDiscord = GetPlayerIdentifier(target, i).split('discord:')[1]
    }

    const reason = args.join(' ')
    if (discord && targetDiscord) {
        socket.emit('addCommend', discord, targetDiscord, reason)
        emitNet('Scotty:Client:CommendPlayer', target, reason)
        emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(target)}^0 has been commended by staff for ^2${reason}^0.`)
    }
})

RegisterCommand('trustscore', (source, args, _rawCommand) => {
    const player = source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }

    const target = parseInt(args.splice(0, 1)[0])
    let targetDiscord = null
    if (target) {
        for (let i = 0; i < GetNumPlayerIdentifiers(target); i++) {
            if (GetPlayerIdentifier(target, i).includes('discord:')) targetDiscord = GetPlayerIdentifier(target, i).split('discord:')[1]
        }
    }

    socket.emit('getTrustscore', discord, targetDiscord, (trustscore, playtime) => {
        if (targetDiscord) {
            emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(target)}^0 has a trustscore of ^2${trustscore}%^0 and a playtime of ^2${playtime}^0.`)
        } else {
            emitNet('chatMessage', -1, '', [ 255, 255, 255 ], `${config.prefix}^0 ^2${GetPlayerName(player)}^0 has a trustscore of ^2${trustscore}%^0 and a playtime of ^2${playtime}^0.`)
        }
    })
})

on('getTrustscore', (source, callback) => {
    const player = source
    let discord = null
    for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
        if (GetPlayerIdentifier(player, i).includes('discord:')) discord = GetPlayerIdentifier(player, i).split('discord:')[1]
    }
    if (socket.connected) {
        socket.emit('getTrustscore', discord, null, (trustscore, playtime) => {
            callback(trustscore)
        }) 
    } else {
        callback(75)
    }
})