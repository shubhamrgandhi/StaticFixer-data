let Canvas;

try {
    Canvas = require('canvas');
} catch(e) {}

const request = require('request-promise-native'),
fs = require('fs'),
qs = require('querystring'),
data = require('../www/data.json'),
config = require('./config.js'),
languages = require('../www/i18n.json');

let util;

function get_canvas_with_text(text, config) {
    let canvas = new Canvas(config.width, config.height || 1500);
    let ctx = canvas.getContext('2d'),
    offsetX = config.offsetX || 10,
    offsetY = config.offsetY || 20,
    split = text.split(/\s+/),
    slice = '';
    ctx.font = config.font || '16px Aerial';
    if (config.background) {
        ctx.fillStyle = config.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = config.color || 'black';
    for (let i = 0; i < split.length; i++) {
        let measure = ctx.measureText(slice + split[i]);
        if (measure.width > config.width - offsetX * 2) {
            ctx.fillText(slice.trim(), offsetX, offsetY);
            offsetY += config.line_height || parseInt(ctx.font) + 10;
            slice = '';
        }
        slice += ' ' + split[i]
    }
    ctx.fillText(slice.trim(), offsetX, offsetY);
    offsetY += config.offsetY || 10;
    let resized_canvas = new Canvas(config.width, offsetY),
    resized_ctx = resized_canvas.getContext('2d');
    resized_ctx.drawImage(canvas, 0, 0);
    return resized_canvas.toDataURL();
}

function i18n(msg, lang, ...args) {
    const locale = (data[lang] || data.en).i18n,
    message = locale[msg] || '';

    return util.format_message(message, args, true);
}

function local(lang) {
    return function(msg, ...args) {
        if (msg instanceof Array) {
            msg = msg[0];
        }
        return i18n(msg, lang, ...args);
    }
}

module.exports = (OpalBot) => {
    const out = {},
    app = OpalBot.app;

    util = OpalBot.util;

    // Security middleware
    app.use((req, res, next) => {
        if (!req.secure && !req.hostname.includes('localhost')) { // Redirect to HTTPS
            return res.redirect(`https://${req.host + req.url}`);
        }
        res
            .append('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
            .append('Content-Security-Policy', `default-src; manifest-src 'self'; connect-src 'self'; script-src 'unsafe-inline' 'unsafe-eval' 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' https://cdn.discordapp.com; form-action 'self'; object-src 'none'; base-uri 'none'; frame-ancestors ${config.APP_NAME}.herokuapp.com ${config.BACKUP_APP_NAME}.herokuapp.com`)
            .append('Referrer-Policy', 'same-origin')
            .append('X-XSS-Protection', '1; mode=block')
            .append('X-Content-Type-Options', 'nosniff')
            .append('X-Frame-Options', 'DENY');

        next();
    });

    // Cache assets
    app.use((req, res, next) => {
        if (req.method == 'GET' && req.url.startsWith('/img/')) {
            res.append('Cache-Control', 'public, max-age=31557600');
        }
        next();
    });
    
    // Middleware for language recognition
    app.use((req, res, next) => {
        let langs = Object.keys(data);
        req.lang = langs.includes(req.cookies.lang) ? req.cookies.lang : req.acceptsLanguages(...langs) || 'en';
        next();
    });

    // Middleware for not needing to add data and lang props to every render
    app.use((req, res, next) => {
        Object.assign(res.locals, {
            data: data,
            lang: req.lang,
            $: local(req.lang),
            i18n: languages[req.lang]
        }, config);
        next();
    });

    // Identification middleware
    app.use((req, res, next) => {
        const session = req.cookies.session,
        sessions = OpalBot.storage.sessions = OpalBot.storage.sessions || {},
        logins = OpalBot.storage.logins = OpalBot.storage.logins || {};
        if (req.url == '/') {
            if (session && logins[session.access_token] === true) {
                delete logins[session.access_token];
                res.locals.banner = 'logged-in-banner';
            } else if (logins[req.cookies.logout] === false) {
                delete logins[req.cookies.logout];
                res.locals.banner = 'logged-out-banner';
                res.clearCookie('logout');
            }
        }
        if (!session) {
            return next();
        }
        const cached = sessions[session.access_token];
        if (cached && cached instanceof Promise) {
            cached.then(user => {
                if (user) {
                    Object.assign(res.locals, {
                        user: user,
                        logged_in: true
                    });
                }
                next();
            });
            return;
        }
        sessions[session.access_token] = Promise.all([
            OpalBot.ready,
            request('https://discordapp.com/api/users/@me', {
                headers: {
                    Authorization: session.token_type + ' ' + session.access_token
                }
            }),
            request('https://discordapp.com/api/users/@me/guilds', {
                headers: {
                    Authorization: session.token_type + ' ' + session.access_token
                }
            })
        ])
        .then((arr) => arr.slice(1).map(JSON.parse))
        .then(([user, guilds]) => {
            try {
                guilds = guilds.map(guild => {
                    guild.acro = guild.name.split(' ').filter(Boolean).map(word => word.charAt(0)).join('').toUpperCase();
                    guild.admin = Boolean(guild.permissions & 8);
                    if (guild.icon) {
                        guild.icon_url = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
                    } else {
                        guild.icon_url = '';
                    }
                    return guild;
                }).sort((a, b) => {
                    if (a.owner) return -1;
                    if (b.owner) return 1;
                    if (a.admin) return -1;
                    if (b.admin) return 1;
                    return b.permissions - a.permissions;
                });
                user.avatar_url = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
                user.guilds = guilds;
                user.non_mutuals = [];
                user.mutual_guilds = guilds.filter(guild => {
                    const match = guild.mutual = OpalBot.client.guilds.get(guild.id);
                    if (!match) {
                        user.non_mutuals.push(guild);
                    }
                    return match;
                });
                Object.assign(res.locals, {
                    user: user,
                    logged_in: true
                });
                console.log('FETCHED', user);
            } catch(e) {
                OpalBot.util.log(e);
            }
            next();
            return user;
        }).catch((err) => {
            OpalBot.util.log(err);
            next();
        });
    });

    // Pages
    app.get('/', (req, res) => {
        res.render('pages/index');
    });

    app.get('/commands', (req, res) => {
        res.render('pages/commands', {
            commands: data[req.lang].commands,
            format: util.format_usage
        });
    });

    app.get('/about', (req, res) => {
        res.render('pages/about');
    });

    app.get('/dashboard', (req, res) => {
        res.render('pages/dashboard');
    });

    app.get('/guilds/:id?', (req, res) => {
        if (req.params.id && res.locals.user) {
            res.render('pages/guild', {
                guild: res.locals.user.guilds.find(g => g.id == req.params.id)
            });
        } else {
            res.render('pages/guilds');
        }
    });

    /* Redirects */
    app.get('/invite', (req, res) => {
        res.redirect('https://discordapp.com/oauth2/authorize?' + qs.stringify({
            client_id: config.CLIENT_ID,
            scope: 'bot',
            permissions: '8206',
            ...req.query
        }));
    });

    app.get('/support', (req, res) => {
        res.redirect(`https://discord.gg/${config.SUPPORT_INVITE}`);
    });

    app.get('/humans.txt', (req, res) => {
        res.redirect('/about');
    });

    /* Auth */
    app.get('/login', (req, res) => {
        res.redirect(`https://discordapp.com/oauth2/authorize?response_type=code&client_id=${config.CLIENT_ID}&scope=identify+guilds&redirect_uri=${encodeURIComponent(config.SERVICE_URL)}%2Fauth`);
    });

    app.get('/logout', (req, res) => {
        const sessions = OpalBot.storage.sessions = OpalBot.storage.sessions || {},
        logins = OpalBot.storage.logins = OpalBot.storage.logins || {},
        session = req.cookies.session;
        if (session) {
            delete sessions[session.access_token];
            res.clearCookie('session', {
                //secure: true,
                httpOnly: true
            });
            const rand = Math.random().toString();
            res.cookie('logout', rand);
            logins[rand] = false;
        }
        res.redirect('/');
    });

    app.get('/auth', (req, res) => {
        const code = req.query.code;
        if (!code) {
            res.render('pages/index', {
                title: 'error',
                banner: 'code-required-banner'
            });
            return;
        }
        const data = {
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
            code: code,
            redirect_uri: config.SERVICE_URL + '/auth',
            grant_type: 'authorization_code'
        },
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        request.post('https://discordapp.com/api/oauth2/token', {
            form: data,
            headers: headers
        }).then((body) => {
            const result = JSON.parse(body);
            if (result.error || result.error_description) {
                res.render('pages/index', {
                    title: 'error',
                    banner: 'error-banner'
                });
                return;
            }
            const logins = OpalBot.storage.logins = OpalBot.storage.logins || {};
            logins[result.access_token] = true;
            res.cookie('session', result, {
                httpOnly: true,
                //secure: true,
                maxAge: result.expires_in * 1000
            });
            res.redirect('/');
        }).catch((err) => {
            OpalBot.util.log(err);
            res.render('pages/index', {
                title: 'error',
                banner: 'error-banner'
            });
        });
    });
    
    // App services
    app.get('/quote_image', (req, res, next) => {
        let storage = OpalBot.storage.quotes || {},
        id = req.query.id,
        quote = id ? storage[id] : null;

        if (!quote) {
            next();
            return;
        }
        let base64 = quote.base64 || get_canvas_with_text(quote.content, { width: 450, background: 'white' }),
        img = new Buffer( base64.slice(22) , 'base64');
        quote.base64 = base64;
        
        res
            .status(200)
            .append('Content-Type', 'image/png')
            .append('Content-Length', img.length)
            .end(img);
    });

    app.get('/dl/*', (req, res, next) => {
        let id = decodeURIComponent(req.url.split('/').pop()),
        filename = id + '.mp3';
        if (fs.existsSync(filename)) {
            let stat = fs.statSync(filename);
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': `attachment; filename=${OpalBot.storage.mp3[id]}`
            });
            fs
                .createReadStream(filename)
                .pipe(res);
        } else {
            next();
        }
    });

    app.post('/paste', (req, res) => {
        OpalBot.storage.pastes = OpalBot.storage.pastes || {};

        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
        code = new Array(6).fill(null).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');

        OpalBot.storage.pastes[code] = req.body;
        
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*'
        })
        res.end(code);
    });

    app.get('/paste/:code', (req, res) => {
        const pastes = OpalBot.storage.pastes,
        code = req.params.code.toLowerCase();

        if (!pastes || !pastes[code]) {
            res.status(404);
            res.end('Not found: ' + code);
            return;
        }

        res.end(pastes[code]);
    })

    // API
    app.post('/ajax/:endpoint?', (req, res) => {
        const endpoint = req.params.endpoint;
        if (!endpoint) {
            res.status(400).send('No endpoint provided.');
        } else if (!OpalBot.endpoints[endpoint]) {
            res.status(500).send('The endpoint provided was not found.');
        } else {
            OpalBot.endpoints[endpoint](req, res);
        }
    });

    // For testing
    app.get('/debug', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8'
        });
        if (req.query.token !== OpalBot.client.token) {
            res.write('Disabled due to abuse.');
            res.end();
        } else {
            res.write(OpalBot.log);
            res.end();
        }
    });

    app.get('/seen', async (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        }); 
        res.write(JSON.stringify((await OpalBot.db).seen));
        res.end();
    });

    return out;
};