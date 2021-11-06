// Dependancies
const config = require('./config.json')

const fastify = require('fastify')()
const fastifySession = require('fastify-session')
const fastifyCookie = require('fastify-cookie')
const helmet = require('fastify-helmet')
const mariadb = require('mariadb')
const axios = require('axios')
const querystring = require('querystring')

const pool = mariadb.createPool({ host: config.database.host, user: config.database.user, password: config.database.password, database: config.database.db, connectionLimit: 10 })

fastify.register(helmet, { contentSecurityPolicy: false }).register(require('fastify-socket.io'), {}).register(require('point-of-view'), {
    engine: {
        mustache: require('mustache')
    }
}).register(fastifyCookie).register(fastifySession, {
    secret: config.session_token,
    cookie: { secure: false }
})

let staffAllowed = []
let recentPlayers = []

// Response
fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/login/code?code=')) return

    if (!request.session.accessToken) {
        return reply.redirect(config.discord.oauth)
    }

    const ip = request.connection.remoteAddress
    if (request.session.member && HasPermission(request.session.member.roles, 'staff')) {
        if (!staffAllowed.includes(ip)) staffAllowed.push(ip)
    } else if (request.session.member && !HasPermission(request.session.member.roles, 'staff' && staffAllowed.includes(ip))) {
        staffAllowed.splice(staffAllowed.indexOf(ip), 1)
    }
})

fastify.get('/', (request, reply) => {
    const data = {
        community_name: config.community_name,
        username: request.session.user.username
    }

    if (request.session.member && HasPermission(request.session.member.roles, 'staff')) {
        data.isStaff = true
    }

    if (request.session.member && HasPermission(request.session.member.roles, 'admin')) {
        data.isAdmin = true
    }

    return reply.view('./public/pages/index.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/dashboard/profile', async (request, reply) => {
    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        navDashboard: true,
        id: request.session.user.id,
        username: request.session.user.username,
        discriminator: request.session.user.discriminator,
        avatar: request.session.user.avatar
    }

    if (request.session.member && HasPermission(request.session.member.roles, 'staff')) {
        data.isStaff = true
    }

    if (request.session.member && HasPermission(request.session.member.roles, 'admin')) {
        data.isAdmin = true
    }

    let conn
    try {
        conn = await pool.getConnection()

        const commendRows = await conn.query('SELECT * FROM commends WHERE id = ?', [ request.session.user.id ])
        if (commendRows && commendRows.length > 0) {
            data.hasCommends = true
            data.commends = commendRows
            for (let i = 0; i < commendRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.commends[i].playername = unescape(data.commends[i].playername)
                    data.commends[i].staffname = unescape(data.commends[i].staffname)
                }
            }
        }

        const playerRows = await conn.query('SELECT * FROM users WHERE id = ?', [ request.session.user.id ])
        if (playerRows && playerRows.length > 0) {
            data.playtime = FormatPlaytime(playerRows[0].playtime)
            data.trustscore = CalculateTrustscore(playerRows[0].playtime, commendRows.length)
        } else {
            return reply.send('No player found for that id.')
        }

        const warningRows = await conn.query('SELECT * FROM warnings WHERE id = ?', [ request.session.user.id ])
        if (warningRows && warningRows.length > 0) {
            data.hasWarnings = true
            data.warnings = warningRows
            for (let i = 0; i < warningRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.warnings[i].playername = unescape(data.warnings[i].playername)
                    data.warnings[i].staffname = unescape(data.warnings[i].staffname)
                }
            }
        }

        const kickRows = await conn.query('SELECT * FROM kicks WHERE id = ?', [ request.session.user.id ])
        if (kickRows.length > 0) {
            data.hasKicks = true
            data.kicks = kickRows
            for (let i = 0; i < kickRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.kicks[i].playername = unescape(data.kicks[i].playername)
                    data.kicks[i].staffname = unescape(data.kicks[i].staffname)
                }
            }
        }

        const banRows = await conn.query('SELECT * FROM bans WHERE id = ?', [ request.session.user.id ])
        if (banRows.length > 0) {
            data.hasBans = true
            data.bans = banRows
            for (let i = 0; i < banRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.bans[i].playername = unescape(data.bans[i].playername)
                    data.bans[i].staffname = unescape(data.bans[i].staffname)
                }
            }
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/dashboard/profile.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/players', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const playersRows = await conn.query('SELECT * FROM users')
        if (playersRows && playersRows.length > 0) {
            data.players = playersRows
            for (let i = 0; i < playersRows.length; i++) {
                data.players[i].playtime = FormatPlaytime(data.players[i].playtime)
                
                for (let ii = 0; ii < 50; ii++) {
                    data.players[i].username = unescape(data.players[i].username)
                }
            }
        } else {
            return reply.send('No players found.')
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    reply.view('./public/pages/staff/players.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/player/:id', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        id: request.params.id,
        staff: request.session.user.id,
        staffName: `${request.session.user.username}#${request.session.user.discriminator}`,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin'),
        canWarn: HasPermission(request.session.member.roles, 'warn'),
        canKick: HasPermission(request.session.member.roles, 'kick'),
        canTempBan: HasPermission(request.session.member.roles, 'tempban'),
        canPermBan: HasPermission(request.session.member.roles, 'permban'),
        canCommend: HasPermission(request.session.member.roles, 'commend'),
        canRemoveWarn: HasPermission(request.session.member.roles, 'removewarn'),
        canRemoveKick: HasPermission(request.session.member.roles, 'removekick'),
        canRemoveBan: HasPermission(request.session.member.roles, 'removeban'),
        canRemoveCommend: HasPermission(request.session.member.roles, 'removecommend')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const commendRows = await conn.query('SELECT * FROM commends WHERE id = ?', [ request.params.id ])
        if (commendRows && commendRows.length > 0) {
            data.hasCommends = true
            data.commends = commendRows
            for (let i = 0; i < commendRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.commends[i].playername = unescape(data.commends[i].playername)
                    data.commends[i].staffname = unescape(data.commends[i].staffname)
                }
            }
        }

        const playerRows = await conn.query('SELECT * FROM users WHERE id = ?', [ request.params.id ])
        if (playerRows && playerRows.length > 0) {
            data.username = unescape(playerRows[0].username)
            data.discriminator = playerRows[0].discriminator
            data.avatar = playerRows[0].avatar
            data.playtime = FormatPlaytime(playerRows[0].playtime)
            data.trustscore = CalculateTrustscore(playerRows[0].playtime, commendRows.length)
            data.identifiers = JSON.parse(playerRows[0].identifiers)
            data.ingamename = playerRows[0].ingamename
        } else {
            return reply.send('No player found for that id.')
        }

        const warningRows = await conn.query('SELECT * FROM warnings WHERE id = ?', [ request.params.id ])
        if (warningRows && warningRows.length > 0) {
            data.hasWarnings = true
            data.warnings = warningRows
            for (let i = 0; i < warningRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.warnings[i].playername = unescape(data.warnings[i].playername)
                    data.warnings[i].staffname = unescape(data.warnings[i].staffname)
                }
            }
        }

        const kickRows = await conn.query('SELECT * FROM kicks WHERE id = ?', [  request.params.id ])
        if (kickRows.length > 0) {
            data.hasKicks = true
            data.kicks = kickRows
            for (let i = 0; i < kickRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.kicks[i].playername = unescape(data.kicks[i].playername)
                    data.kicks[i].staffname = unescape(data.kicks[i].staffname)
                }
            }
        }

        const banRows = await conn.query('SELECT * FROM bans WHERE id = ?', [  request.params.id ])
        if (banRows.length > 0) {
            data.hasBans = true
            data.bans = banRows
            for (let i = 0; i < banRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.bans[i].playername = unescape(data.bans[i].playername)
                    data.bans[i].staffname = unescape(data.bans[i].staffname)
                }
            }
        }

        const noteRows = await conn.query('SELECT * FROM notes WHERE id = ?', [ request.params.id ])
        if (noteRows && noteRows.length > 0) {
            data.hasNotes = true
            data.notes = noteRows
            for (let i = 0; i < noteRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.notes[i].playername = unescape(data.notes[i].playername)
                    data.notes[i].staffname = unescape(data.notes[i].staffname)
                }
            }
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/staff/player.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/warnings', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const warningsRows = await conn.query('SELECT * FROM warnings')
        if (warningsRows && warningsRows.length > 0) {
            data.warnings = warningsRows
            for (let i = 0; i < warningsRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.warnings[i].playername = unescape(data.warnings[i].playername)
                    data.warnings[i].staffname = unescape(data.warnings[i].staffname)
                }
            }
        } else {
            return reply.send('No warnings found.')
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/staff/warnings.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/kicks', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const kicksRows = await conn.query('SELECT * FROM kicks')
        if (kicksRows && kicksRows.length > 0) {
            data.kicks = kicksRows
            for (let i = 0; i < kicksRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.kicks[i].playername = unescape(data.kicks[i].playername)
                    data.kicks[i].staffname = unescape(data.kicks[i].staffname)
                }
            }
        } else {
            return reply.send('No kicks found.')
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/staff/kicks.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/bans', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const bansRows = await conn.query('SELECT * FROM bans')
        if (bansRows && bansRows.length > 0) {
            data.bans = bansRows
            for (let i = 0; i < bansRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.bans[i].playername = unescape(data.bans[i].playername)
                    data.bans[i].staffname = unescape(data.bans[i].staffname)
                }
            }
        } else {
            return reply.send('No bans found.')
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/staff/bans.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/commends', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const commendsRows = await conn.query('SELECT * FROM commends')
        if (commendsRows && commendsRows.length > 0) {
            data.commends = commendsRows
            for (let i = 0; i < commendsRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.commends[i].playername = unescape(data.commends[i].playername)
                    data.commends[i].staffname = unescape(data.commends[i].staffname)
                }
            }
        } else {
            return reply.send('No commends found.')
        }
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/staff/commends.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/servers', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }
    let conn
    try {
        conn = await pool.getConnection()

        const serversRows = await conn.query('SELECT * FROM servers')
        data.servers = serversRows
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/staff/servers.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/staff/server/:identifier', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: true,
        navStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin')
    }

    let recent = []
    for (let recentPlayer of recentPlayers) {
        if (recentPlayer.identifier == request.params.identifier) recent.push(recentPlayer)
    }
    data.recentPlayers = recent

    let conn
    try {
        conn = await pool.getConnection()

        const serverRow = await conn.query('SELECT name FROM servers WHERE identifier = ?', [ request.params.identifier ])
        data.identifier = request.params.identifier
        data.name = serverRow[0].name
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }

    fastify.io.of('/servers').sockets.forEach((socket) => {
        socket.emit('getPlayers', request.params.identifier, (players) => {
            if (players) {
                data.players = players
                data.totalPlayers = players.length
                return reply.view('./public/pages/staff/server.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
            }
        })
    })
})

fastify.get('/staff/mystats', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'staff')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        isStaff: true,
        isAdmin: HasPermission(request.session.member.roles, 'admin'),
        navStaff: true
    }

    data.username = unescape(request.session.user.username)

    let allPunishments = [
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        },
        {
            amount: 0
        }
    ]

    let totalWarnsWeek = 0
    let totalWarnsMonth = 0
    const warningRows = await conn.query('SELECT * FROM warnings WHERE staff = ?', [ request.session.user.id ])
    if (warningRows && warningRows.length > 0) {
        data.hasWarnings = true
        data.warnings = warningRows

        for (let i = 0; i < warningRows.length; i++) {
            for (let ii = 0; ii < 50; ii++) {
                data.warnings[i].playername = unescape(data.warnings[i].playername)
                data.warnings[i].staffname = unescape(data.warnings[i].staffname)
            }
        }

        for (let warn of warningRows) {
            allPunishments[warn.date.getMonth()].amount += 1
            let date = new Date(Date.now() - 604800000);
            if (warn.date > date) totalWarnsWeek += 1
        }

        for (let warn of warningRows) {
            let date = new Date()
            date.setMonth(date.getMonth() - 1);
            if (warn.date > date) totalWarnsMonth += 1
        }
    }
    data.totalWarnsWeek = totalWarnsWeek
    data.totalWarnsMonth = totalWarnsMonth
    data.totalWarns = warningRows.length

    let totalKicksWeek = 0
    let totalKicksMonth = 0
    const kickRows = await conn.query('SELECT * FROM kicks WHERE staff = ?', [ request.session.user.id ])
    if (kickRows && kickRows.length > 0) {
        data.hasKicks = true
        data.kicks = kickRows

        for (let i = 0; i < kickRows.length; i++) {
            for (let ii = 0; ii < 50; ii++) {
                data.kicks[i].playername = unescape(data.kicks[i].playername)
                data.kicks[i].staffname = unescape(data.kicks[i].staffname)
            }
        }

        for (let kick of kickRows) {
            allPunishments[kick.date.getMonth()].amount += 1
            let date = new Date(Date.now() - 604800000);
            if (kick.date > date) totalKicksWeek += 1
        }

        for (let kick of kickRows) {
            let date = new Date()
            date.setMonth(date.getMonth() - 1);
            if (kick.date > date) totalKicksMonth += 1
        }
    }
    data.totalKicksWeek = totalKicksWeek
    data.totalKicksMonth = totalKicksMonth
    data.totalKicks = kickRows.length

    let totalBansWeek = 0
    let totalBansMonth = 0
    const banRows = await conn.query('SELECT * FROM bans WHERE staff = ?', [ request.session.user.id ])
    if (banRows && banRows.length > 0) {
        data.hasBans = true
        data.bans = banRows

        for (let i = 0; i < banRows.length; i++) {
            for (let ii = 0; ii < 50; ii++) {
                data.bans[i].playername = unescape(data.bans[i].playername)
                data.bans[i].staffname = unescape(data.bans[i].staffname)
            }
        }

        for (let ban of banRows) {
            allPunishments[ban.date.getMonth()].amount += 1
            let date = new Date(Date.now() - 604800000);
            if (ban.date > date) totalBansWeek += 1
        }

        for (let ban of banRows) {
            let date = new Date()
            date.setMonth(date.getMonth() - 1);
            if (ban.date > date) totalBansMonth += 1
        }
    }
    data.totalBansWeek = totalBansWeek
    data.totalBansMonth = totalBansMonth
    data.totalBans = banRows.length

    const commendRows = await conn.query('SELECT * FROM commends WHERE staff = ?', [ request.session.user.id ])
    if (commendRows && commendRows.length > 0) {
        data.hasCommends = true
        data.commends = commendRows

        for (let i = 0; i < commendRows.length; i++) {
            for (let ii = 0; ii < 50; ii++) {
                data.commends[i].playername = unescape(data.commends[i].playername)
                data.commends[i].staffname = unescape(data.commends[i].staffname)
            }
        }
    }

    data.allPunishments = allPunishments
    return reply.view('./public/pages/admin/playerstats.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/admin/servers', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'admin')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: HasPermission(request.session.member.roles, 'staff'),
        isAdmin: true,
        navAdmin: true
    }
    let conn
    try {
        conn = await pool.getConnection()

        const serversRows = await conn.query('SELECT * FROM servers')
        data.servers = serversRows
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
    return reply.view('./public/pages/admin/servers.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/admin/stats', (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'admin')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        username: request.session.user.username,
        isStaff: HasPermission(request.session.member.roles, 'staff'),
        isAdmin: true,
        navAdmin: true
    }
    return reply.view('./public/pages/admin/stats.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
})

fastify.get('/admin/stats/:id', async (request, reply) => {
    if (!request.session.member || !HasPermission(request.session.member.roles, 'admin')) return reply.send('No permissions.')

    let data = {
        community_name: config.community_name,
        isStaff: HasPermission(request.session.member.roles, 'staff'),
        isAdmin: true,
        navAdmin: true
    }

    try {
        conn = await pool.getConnection()

        let playerRows
        if (isNaN(request.params.id)) {
            console.log(JSON.stringify(request.params), request.params.id.includes('#'))
            if (request.params.id.includes('hashtaghasbeenputhere')) {
                let splitName = request.params.id.split('hashtaghasbeenputhere')
                console.log(splitName[0], splitName[1])
                playerRows = await conn.query('SELECT * FROM users WHERE username = ? AND discriminator = ?', [ splitName[0], splitName[1] ])
            } else {
                playerRows = await conn.query('SELECT * FROM users WHERE ingamename = ?', [ request.params.id ])
            }
        } else {
            playerRows = await conn.query('SELECT * FROM users WHERE id = ?', [ request.params.id ])
        }
        if (playerRows && playerRows.length === 0) {
            return reply.send('No player exists with that id / name.')
        } else if (playerRows && playerRows.length > 1) {
            return reply.send('More than one player with that name :(.')
        }
        data.username = unescape(playerRows[0].username)
        request.params.id = playerRows[0].id

        let allPunishments = [
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            },
            {
                amount: 0
            }
        ]

        let totalWarnsWeek = 0
        let totalWarnsMonth = 0
        const warningRows = await conn.query('SELECT * FROM warnings WHERE staff = ?', [ request.params.id ])
        if (warningRows && warningRows.length > 0) {
            data.hasWarnings = true
            data.warnings = warningRows

            for (let i = 0; i < warningRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.warnings[i].playername = unescape(data.warnings[i].playername)
                    data.warnings[i].staffname = unescape(data.warnings[i].staffname)
                }
            }

            for (let warn of warningRows) {
                allPunishments[warn.date.getMonth()].amount += 1
                let date = new Date(Date.now() - 604800000);
                if (warn.date > date) totalWarnsWeek += 1
            }

            for (let warn of warningRows) {
                let date = new Date()
                date.setMonth(date.getMonth() - 1);
                if (warn.date > date) totalWarnsMonth += 1
            }
        }
        data.totalWarnsWeek = totalWarnsWeek
        data.totalWarnsMonth = totalWarnsMonth
        data.totalWarns = warningRows.length

        let totalKicksWeek = 0
        let totalKicksMonth = 0
        const kickRows = await conn.query('SELECT * FROM kicks WHERE staff = ?', [ request.params.id ])
        if (kickRows && kickRows.length > 0) {
            data.hasKicks = true
            data.kicks = kickRows

            for (let i = 0; i < kickRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.kicks[i].playername = unescape(data.kicks[i].playername)
                    data.kicks[i].staffname = unescape(data.kicks[i].staffname)
                }
            }

            for (let kick of kickRows) {
                allPunishments[kick.date.getMonth()].amount += 1
                let date = new Date(Date.now() - 604800000);
                if (kick.date > date) totalKicksWeek += 1
            }

            for (let kick of kickRows) {
                let date = new Date()
                date.setMonth(date.getMonth() - 1);
                if (kick.date > date) totalKicksMonth += 1
            }
        }
        data.totalKicksWeek = totalKicksWeek
        data.totalKicksMonth = totalKicksMonth
        data.totalKicks = kickRows.length

        let totalBansWeek = 0
        let totalBansMonth = 0
        const banRows = await conn.query('SELECT * FROM bans WHERE staff = ?', [ request.params.id ])
        if (banRows && banRows.length > 0) {
            data.hasBans = true
            data.bans = banRows

            for (let i = 0; i < banRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.bans[i].playername = unescape(data.bans[i].playername)
                    data.bans[i].staffname = unescape(data.bans[i].staffname)
                }
            }

            for (let ban of banRows) {
                allPunishments[ban.date.getMonth()].amount += 1
                let date = new Date(Date.now() - 604800000);
                if (ban.date > date) totalBansWeek += 1
            }

            for (let ban of banRows) {
                let date = new Date()
                date.setMonth(date.getMonth() - 1);
                if (ban.date > date) totalBansMonth += 1
            }
        }
        data.totalBansWeek = totalBansWeek
        data.totalBansMonth = totalBansMonth
        data.totalBans = banRows.length

        const commendRows = await conn.query('SELECT * FROM commends WHERE staff = ?', [ request.params.id ])
        if (commendRows && commendRows.length > 0) {
            data.hasCommends = true
            data.commends = commendRows

            for (let i = 0; i < commendRows.length; i++) {
                for (let ii = 0; ii < 50; ii++) {
                    data.commends[i].playername = unescape(data.commends[i].playername)
                    data.commends[i].staffname = unescape(data.commends[i].staffname)
                }
            }
        }

        data.allPunishments = allPunishments
        return reply.view('./public/pages/admin/playerstats.mustache', data, { partials: { header: './public/pages/partials/header.mustache', nav: './public/pages/partials/nav.mustache' } })
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }
})

fastify.get('/api/status', (request, reply) => {
    return { response: 'ok', status: 'online' }
})

fastify.get('/api/login/code', async (request, reply) => {
    const code = request.url.split('?code=')[1]
    const tokenResult = await axios.post('https://discordapp.com/api/v8/oauth2/token', querystring.stringify({
        'client_id': config.discord.client_id,
        'client_secret': config.discord.client_secret,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': `${config.url}/api/login/code`,
        'scope': 'identify'
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })

    const userResult = await axios.get('https://discordapp.com/api/v8/users/@me', {
        headers: {
            'Authorization': `Bearer ${tokenResult.data.access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })

    try {
        conn = await pool.getConnection()

        await conn.query('INSERT INTO users (id, username, discriminator, avatar) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE username = ?, discriminator = ?, avatar = ?', [
            userResult.data.id,
            escape(userResult.data.username),
            userResult.data.discriminator,
            userResult.data.avatar || 'none',
            escape(userResult.data.username),
            userResult.data.discriminator,
            userResult.data.avatar || 'none'
        ])
    } catch (error) {
        reply.send(`An error occured while performing a database check. (${error})`)
    } finally {
        if (conn) conn.release()
    }

    const memberResult = await axios.get(`https://discordapp.com/api/v8/guilds/${config.discord.guild_id}/members/${userResult.data.id}`, {
        headers: {
            'Authorization': `Bot ${config.discord.bot_token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })

    request.session.user = userResult.data
    request.session.member = memberResult.data
    request.session.accessToken = tokenResult.data.access_token
    reply.redirect('/')
})

// Ready
fastify.ready((error) => {
    if (error) fastify.log.error(error)
    fastify.io.of('/webusers').on('connect', (socket) => {
        socket.on('addWarning', async (id, staff, staffName, playerName, reason, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return

            try {
                conn = await pool.getConnection()
        
                await conn.query('INSERT INTO warnings (id, staff, staffname, playername, reason) VALUES (?, ?, ?, ?, ?)', [ id, staff, escape(staffName), escape(playerName), reason ])
                fastify.io.of('/servers').emit('warnPlayer', id, reason)

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }

            /*axios.post(config.discord.webhook, {
                embeds: [
                    {
                        title: 'Website Warn',
                        description: 'A player has been warned by staff from the staff portal.',
                        fields: [
                            {
                                name: 'Staff Member',
                                value: staffName
                            },
                            {
                                name: 'Player Name',
                                value: playerName
                            },
                            {
                                name: 'Reason',
                                value: reason
                            }
                        ]
                    }
                ]
            })*/
        })

        socket.on('addKick', async (id, staff, staffName, playerName, reason, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return

            try {
                conn = await pool.getConnection()
        
                await conn.query('INSERT INTO kicks (id, staff, staffname, playername, reason) VALUES (?, ?, ?, ?, ?)', [ id, staff, escape(staffName), escape(playerName), reason ])
                fastify.io.of('/servers').emit('kickPlayer', id, reason)

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }

            /*axios.post(config.discord.webhook, {
                embeds: [
                    {
                        title: 'Website Kick',
                        description: 'A player has been kicked by staff from the staff portal.',
                        fields: [
                            {
                                name: 'Staff Member',
                                value: staffName
                            },
                            {
                                name: 'Player Name',
                                value: playerName
                            },
                            {
                                name: 'Reason',
                                value: reason
                            }
                        ]
                    }
                ]
            })*/
        })

        socket.on('addBan', async (id, staff, staffName, playerName, reason, length, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('INSERT INTO bans (id, staff, staffname, playername, reason, length) VALUES (?, ?, ?, ?, ?, ?)', [ id, staff, escape(staffName), escape(playerName), reason, length ])
                fastify.io.of('/servers').emit('banPlayer', id, reason)

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }

            /*axios.post(config.discord.webhook, {
                embeds: [
                    {
                        title: 'Website Ban',
                        description: 'A player has been banned by staff from the staff portal.',
                        fields: [
                            {
                                name: 'Staff Member',
                                value: staffName
                            },
                            {
                                name: 'Player Name',
                                value: playerName
                            },
                            {
                                name: 'Reason',
                                value: reason
                            },
                            {
                                name: 'Length',
                                value: `${length} Hours`
                            }
                        ]
                    }
                ]
            })*/
        })

        socket.on('addCommend', async (id, staff, staffName, playerName, reason, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return

            try {
                conn = await pool.getConnection()
        
                await conn.query('INSERT INTO commends (id, staff, staffname, playername, reason) VALUES (?, ?, ?, ?, ?)', [ id, staff, escape(staffName), escape(playerName), reason ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('addNote', async (id, staff, staffName, playerName, note, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('INSERT INTO notes (id, staff, staffname, playername, note) VALUES (?, ?, ?, ?, ?)', [ id, staff, escape(staffName), escape(playerName), note ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('addServer', async (identifier, name, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('INSERT INTO servers (identifier, name) VALUES (?, ?)', [ identifier, name ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('removeWarn', async (id, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('DELETE FROM warnings WHERE wid = ?', [ id ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('removeKick', async (id, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('DELETE FROM kicks WHERE kid = ?', [ id ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('removeBan', async (id, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('DELETE FROM bans WHERE bid = ?', [ id ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('removeCommend', async (id, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('DELETE FROM commends WHERE cid = ?', [ id ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('removeNote', async (id, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('DELETE FROM notes WHERE nid = ?', [ id ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('removeServer', async (identifier, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return
            
            try {
                conn = await pool.getConnection()
        
                await conn.query('DELETE FROM servers WHERE identifier = ?', [ identifier ])

                callback('ok')
            } catch (error) {
                callback('failed')
            } finally {
                if (conn) conn.release()
            }
        })

        socket.on('getServerStatus', (identifier, callback) => {
            if (!staffAllowed.includes(socket.request.connection.remoteAddress)) return

            if (fastify.io.in(identifier).engine.clientsCount > 1) {
                return callback(true)
            }
            callback(false)
        })
    })

    fastify.io.of('/servers').on('connect', (socket) => {
        const token = socket.handshake.auth.token;

        socket.on('verifyToken', (identifier, callback) => {
            if (token === config.token) {
                socket.join(identifier)
                recentPlayers[identifier] = []
                callback(true)
            } else {
                callback(false)
            }
        })

        socket.on('addUser', async (discord, name, identifiers, callback) => {
            if (token === config.token) {
                let userResult = {}

                try {
                    conn = await pool.getConnection()

                    const result = await conn.query('SELECT * FROM users where id = ?', [ discord ])

                    if (result && result.length > 0) {
                        userResult.data = result[0]
                    } else {
                        userResult = await axios.get(`https://discordapp.com/api/v8/users/${discord}`, {
                            headers: {
                                'Authorization': `Bot ${config.discord.bot_token}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        })
                    }
                } catch (error) {
                    console.log(`An error occured while performing a database check. (${error})`)
                } finally {
                    if (conn) conn.release()
                }

                try {
                    conn = await pool.getConnection()

                    await conn.query('INSERT INTO users (id, username, ingamename, discriminator, avatar, identifiers) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username = ?, ingamename = ?, discriminator = ?, avatar = ?, identifiers = ?', [
                        userResult.data.id,
                        escape(userResult.data.username),
                        name,
                        userResult.data.discriminator,
                        userResult.data.avatar || 'none',
                        JSON.stringify(identifiers),
                        escape(userResult.data.username),
                        name,
                        userResult.data.discriminator,
                        userResult.data.avatar || 'none',
                        JSON.stringify(identifiers)
                    ])
                    callback(true)
                } catch (error) {
                    console.log(`An error occured while performing a database check. (${error})`)
                } finally {
                    if (conn) conn.release()
                }
            } else {
                callback(false)
            }
        })

        socket.on('getBanned', async (discord, callback) => {
            if (token === config.token) {
                try {
                    conn = await pool.getConnection()
            
                    const banRows = await conn.query('SELECT reason, length, date FROM bans WHERE id = ?', [ discord ])
    
                    if (banRows && banRows.length > 0) {
                        for (let ban of banRows) {
                            let expiryDate = new Date(ban.date)
                            expiryDate.setTime(expiryDate.getTime() + (ban.length * 60 * 60 * 1000))
                            if (expiryDate >= new Date() || ban.length == 0) {
                                if (conn) conn.release()
                                return callback({ banned: true, expiry: expiryDate, reason: ban.reason })
                            }
                        }
                        callback({ banned: false })
                    }
                    callback({ banned: false })
                } catch (error) {
                    callback('failed')
                } finally {
                    if (conn) conn.release()
                }
            }
        })

        socket.on('addWarn', async (discord, targetDiscord, reason) => {
            if (token === config.token) {
                let memberResult = await axios.get(`https://discordapp.com/api/v8/guilds/${config.discord.guild_id}/members/${discord}`, {
                    headers: {
                        'Authorization': `Bot ${config.discord.bot_token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })

                if (HasPermission(memberResult.data.roles, 'warn')) {
                    const userResult = await axios.get(`https://discordapp.com/api/v8/users/${discord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    const targetUserResult = await axios.get(`https://discordapp.com/api/v8/users/${targetDiscord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    try {
                        conn = await pool.getConnection()
                        
                        await conn.query('INSERT INTO warnings (id, staff, staffname, playername, reason) VALUES (?, ?, ?, ?, ?)', [ targetDiscord, discord, escape(`${userResult.data.username}#${userResult.data.discriminator}`), escape(`${targetUserResult.data.username}#${targetUserResult.data.discriminator}`), reason ])
                    } catch (error) {
                        console.log(`Error while warning player with database. (${error})`)
                    } finally {
                        if (conn) conn.release()
                    }

                    /*axios.post(config.discord.webhook, {
                        embeds: [
                            {
                                title: 'In-Game Warning',
                                description: 'A player has been warned by staff in-game.',
                                fields: [
                                    {
                                        name: 'Staff Member',
                                        value: `${userResult.data.username}#${userResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Player Name',
                                        value: `${targetUserResult.data.username}#${targetUserResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason
                                    }
                                ]
                            }
                        ]
                    })*/
                }
            }
        })

        socket.on('addKick', async (discord, targetDiscord, reason) => {
            if (token === config.token) {
                let memberResult = await axios.get(`https://discordapp.com/api/v8/guilds/${config.discord.guild_id}/members/${discord}`, {
                    headers: {
                        'Authorization': `Bot ${config.discord.bot_token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })

                if (HasPermission(memberResult.data.roles, 'kick')) {
                    const userResult = await axios.get(`https://discordapp.com/api/v8/users/${discord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    const targetUserResult = await axios.get(`https://discordapp.com/api/v8/users/${targetDiscord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })
                    
                    try {
                        conn = await pool.getConnection()
                
                        await conn.query('INSERT INTO kicks (id, staff, staffname, playername, reason) VALUES (?, ?, ?, ?, ?)', [ targetDiscord, discord, escape(`${userResult.data.username}#${userResult.data.discriminator}`), escape(`${targetUserResult.data.username}#${targetUserResult.data.discriminator}`), reason ])
                    } catch (error) {
                        console.log(`Error while kicking player with database. (${error})`)
                    } finally {
                        if (conn) conn.release()
                    }

                    /*axios.post(config.discord.webhook, {
                        embeds: [
                            {
                                title: 'In-Game Kick',
                                description: 'A player has been kicked by staff in-game.',
                                fields: [
                                    {
                                        name: 'Staff Member',
                                        value: `${userResult.data.username}#${userResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Player Name',
                                        value: `${targetUserResult.data.username}#${targetUserResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason
                                    }
                                ]
                            }
                        ]
                    })*/
                }
            }
        })

        socket.on('addBan', async (discord, targetDiscord, length, reason) => {
            if (token === config.token) {
                let memberResult = await axios.get(`https://discordapp.com/api/v8/guilds/${config.discord.guild_id}/members/${discord}`, {
                    headers: {
                        'Authorization': `Bot ${config.discord.bot_token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })

                if ((length == 0 && HasPermission(memberResult.data.roles, 'permban')) || (length > 0 && HasPermission(memberResult.data.roles, 'tempban'))) {
                    const userResult = await axios.get(`https://discordapp.com/api/v8/users/${discord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    const targetUserResult = await axios.get(`https://discordapp.com/api/v8/users/${targetDiscord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })
                    
                    try {
                        conn = await pool.getConnection()
                
                        await conn.query('INSERT INTO bans (id, staff, staffname, playername, reason, length) VALUES (?, ?, ?, ?, ?, ?)', [ targetDiscord, discord, escape(`${userResult.data.username}#${userResult.data.discriminator}`), escape(`${targetUserResult.data.username}#${targetUserResult.data.discriminator}`), reason, length ])
                    } catch (error) {
                        console.log(`Error while banning player with database. (${error})`)
                    } finally {
                        if (conn) conn.release()
                    }

                    /*axios.post(config.discord.webhook, {
                        embeds: [
                            {
                                title: 'In-Game Ban',
                                description: 'A player has been banned by staff in-game.',
                                fields: [
                                    {
                                        name: 'Staff Member',
                                        value: `${userResult.data.username}#${userResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Player Name',
                                        value: `${targetUserResult.data.username}#${targetUserResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Length',
                                        value: length
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason
                                    }
                                ]
                            }
                        ]
                    })*/
                }
            }
        })

        socket.on('addCommend', async (discord, targetDiscord, reason) => {
            if (token === config.token) {
                let memberResult = await axios.get(`https://discordapp.com/api/v8/guilds/${config.discord.guild_id}/members/${discord}`, {
                    headers: {
                        'Authorization': `Bot ${config.discord.bot_token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })

                if (HasPermission(memberResult.data.roles, 'commend')) {
                    const userResult = await axios.get(`https://discordapp.com/api/v8/users/${discord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })

                    const targetUserResult = await axios.get(`https://discordapp.com/api/v8/users/${targetDiscord}`, {
                        headers: {
                            'Authorization': `Bot ${config.discord.bot_token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    })
                    
                    try {
                        conn = await pool.getConnection()
                
                        await conn.query('INSERT INTO commends (id, staff, staffname, playername, reason) VALUES (?, ?, ?, ?, ?)', [ targetDiscord, discord, escape(`${userResult.data.username}#${userResult.data.discriminator}`), escape(`${targetUserResult.data.username}#${targetUserResult.data.discriminator}`), reason ])
                    } catch (error) {
                        console.log(`Error while commending player with database. (${error})`)
                    } finally {
                        if (conn) conn.release()
                    }

                    /*axios.post(config.discord.webhook, {
                        embeds: [
                            {
                                title: 'In-Game Kick',
                                description: 'A player has been kicked by staff in-game.',
                                fields: [
                                    {
                                        name: 'Staff Member',
                                        value: `${userResult.data.username}#${userResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Player Name',
                                        value: `${targetUserResult.data.username}#${targetUserResult.data.discriminator}`
                                    },
                                    {
                                        name: 'Reason',
                                        value: reason
                                    }
                                ]
                            }
                        ]
                    })*/
                }
            }
        })

        socket.on('getTrustscore', async (discord, targetDiscord, callback) => {
            if (token === config.token) {
                if (targetDiscord) {
                    try {
                        conn = await pool.getConnection()
                
                        const commendRow = await conn.query('SELECT * FROM commends WHERE id = ?', [ targetDiscord ])

                        const playerRow = await conn.query('SELECT playtime FROM users WHERE id = ?', [ targetDiscord ])
                        
                        callback(CalculateTrustscore(playerRow[0].playtime, commendRow.length), FormatPlaytime(playerRow[0].playtime))
                    } catch (error) {
                        console.log(`Error while commending player with database. (${error})`)
                    } finally {
                        if (conn) conn.release()
                    }
                } else {
                    try {
                        conn = await pool.getConnection()
                
                        const commendRow = await conn.query('SELECT * FROM commends WHERE id = ?', [ discord ])

                        const playerRow = await conn.query('SELECT playtime FROM users WHERE id = ?', [ discord ])
                        
                        callback(CalculateTrustscore(playerRow[0].playtime, commendRow.length), FormatPlaytime(playerRow[0].playtime))
                    } catch (error) {
                        console.log(`Error while commending player with database. (${error})`)
                    } finally {
                        if (conn) conn.release()
                    }
                }
            }
        })

        socket.on('getAceGroups', async (discord, callback) => {
            if (token === config.token) {
                let memberResult = await axios.get(`https://discordapp.com/api/v8/guilds/${config.discord.guild_id}/members/${discord}`, {
                    headers: {
                        'Authorization': `Bot ${config.discord.bot_token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })

                callback(GetAceGroups(memberResult.data.roles))
            }
        })

        socket.on('addRecentPlayer', (identifier, discord, name, reason) => {
            if (token === config.token) {
                if (discord && name) {
                    recentPlayers.push({ identifier: identifier, id: discord, name: name, reason: reason })
                    setTimeout(() => {
                        recentPlayers.splice(recentPlayers.indexOf({ identifier: identifier, id: discord, name: name, reason: reason }))
                    }, 300000)
                }
            }
        })

        setInterval(() => {
            if (token === config.token) {
                socket.emit('getPlayers', null, async (players) => {
                    if (players) {
                        let conn
                        try {
                            conn = await pool.getConnection()

                            conn.beginTransaction()

                            for (const player of players) {
                                conn.query('UPDATE users SET playtime = playtime + 1 WHERE id = ?', [ player.id ])
                            }

                            conn.commit()
                        } catch (error) {
                            conn.rollback()
                            console.log(`Database error while updating playtime. (${error})`)
                        } finally {
                            if (conn) conn.release()
                        }
                    }
                })
            }
        }, 60000)
    })
})

// Start
fastify.listen(config.port, (error) => {
    if (error) fastify.log.error(error)
    console.log('Web Server Successfully Started.')
})

function CalculateTrustscore(playtime, commends) {
    let trustscore = (Math.floor(playtime / 60) + config.base_trustscore) + (commends * 3)
    if (trustscore > 100) {
        trustscore = 100
    }
    return trustscore
}

function HasPermission(roles, permission) {
    for (let role in config.permissions) {
        if (roles.includes(role) && config.permissions[role].includes(permission)) {
            return true
        }
    }
    return false
}

function GetAceGroups(roles) {
    let ace_groups = []
    for (let role in config.ace_groups) {
        if (roles.includes(role)) {
            ace_groups.push(config.ace_groups[role])
        }
    }
    return ace_groups
}

function FormatPlaytime(playtime) {
    if (playtime > 0) return `${Math.round(playtime / 24 / 60)} Days, ${Math.round(playtime / 60 % 24)} Hours & ${Math.round(playtime % 60)} Minutes`
    return 'None'
}