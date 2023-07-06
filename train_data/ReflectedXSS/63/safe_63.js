var express = require('express'),
  express_namespace = require('express-namespace'),
  WebServer = express(),
  compression = require('compression'),
  csrf = require('csurf'),
  session = require('express-session'),
  bodyParser = require('body-parser'),
  favicon = require('serve-favicon'),
  helmet = require('helmet'),
  server = require('http').createServer(WebServer),
  RedisStore = require('connect-redis')(session),
  cookieParser = require('cookie-parser'),
  serveStatic = require('serve-static'),
  path = require('path'),
  RDB = require('./redis'),
  utils = require('../public/src/utils.js'),
  pkg = require('../package.json'),
  fs = require('fs'),

  user = require('./user.js'),
  categories = require('./categories.js'),
  posts = require('./posts.js'),
  topics = require('./topics.js'),
  notifications = require('./notifications.js'),
  admin = require('./routes/admin.js'),
  userRoute = require('./routes/user.js'),
  apiRoute = require('./routes/api.js'),
  auth = require('./routes/authentication.js'),
  meta = require('./meta.js'),
  feed = require('./feed'),
  plugins = require('./plugins'),
  nconf = require('nconf'),
  winston = require('winston'),
  validator = require('validator'),
  db = require('./db'),
  async = require('async'),
  constants = require('./lib/perms/constants'),
  util = require('./lib/util'),
  ejs = require('ejs'),
  passport = require('passport'),
  editorTemplate = fs.readFileSync(__dirname + '/' + '../public/templates/editor.ejs').toString()
learnMenuTemplate = fs.readFileSync(__dirname + '/' + '../public/templates/learn_menu.ejs').toString(),
cluster = require('cluster'),
numCPUs = require('os').cpus().length

if (nconf.get('use_cluster') && cluster.isMaster) {
  winston.log('debug', 'Forking', numCPUs, 'workers')
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', function (worker) {
    winston.log('debug', 'worker ' + worker.pid + ' died')
  })
} else {
  passport.serializeUser(function (userObj, done) {
    // console.log("Calling done in serialise", userObj._id)
    done(null, userObj._id)
  })

  passport.deserializeUser(function (userId, done) {
    // console.log("Calling done in deserialise", userId)
    user.findById(userId, function (err, userObj) {
      // console.log(userObj)
      done(null, userObj)
    })
  })

  SAFE_URL_LIST = []

  var use_client_host = nconf.get('use_client_host')
  var app_login = nconf.get('app_login')
  var app_home = nconf.get('app_home')
  var app_home_http = app_home.replace('https://', 'http://')
  var app_home_https = app_home.indexOf('localhost') === -1 ? app_home.replace('http://', 'https://') : null
  var socket_server = nconf.get('socket_server')
  var topic_guest_access_allowed = nconf.get('topic_guest_access_allowed')
  var enable_search_robots = nconf.get('enable_search_robots')

  function ensureAuthenticated (req, res, next) {
    if (topic_guest_access_allowed) {
      next()
    } else {
      var skip = false
      SAFE_URL_LIST.forEach(function (surl) {
        // console.log(req.url.indexOf(surl), surl)
        if (req.url && req.url.indexOf(surl) != -1) {
          if (req.user) {
            res.locals.user = req.user
          }
          skip = true
        }
      })

      if (skip) {
        next()
        return
      }

      if (_redirectsIfNotAuthenticated(req, res)) return
      next()
    }
  }

  function _redirectsIfNotAuthenticated (req, res) {
    var hostname = req.headers['host'] ? req.headers['host'].split(':')[0] : '127.0.0.1'
    if (use_client_host) {
      app_login = 'http://' + hostname + ':8080/login'
      app_home = 'http://' + hostname + ':8080'
      app_home_https = null
      app_home_http = app_home
      socket_server = 'http://' + hostname + ':4567'
    }

    if (!req.isAuthenticated || !req.isAuthenticated()) {
      if (req.session) {
        req.session.returnTo = req.originalUrl || req.url
      }
      res.redirect(app_login)
      return true
    }
    return false
  }

  (function (app) {
    var templates = null,
      clientScripts

    // Minify client-side libraries
    meta.js.get(function (err, scripts) {
      clientScripts = scripts.map(function (script) {
        return script = {
          script: script
        }
      })
    })

    server.app = app

    /**
     *	`options` object	requires:	req, res
     *						accepts:	metaTags
     */
    app.build_header = function (options, callback) {
      var custom_header = {
        'navigation': []
      }
      var hostname = options.req.headers['host'] ? options.req.headers['host'].split(':')[0] : '127.0.0.1'
      if (use_client_host) {
        app_login = 'http://' + hostname + ':8080/login'
        app_home = 'http://' + hostname + ':8080'
        app_home_https = null
        app_home_http = app_home
        socket_server = 'http://' + hostname + ':4567'
      }

      plugins.fireHook('filter:header.build', custom_header, function (err, custom_header) {
        var defaultMetaTags = [{
            name: 'viewport',
            content: 'width=device-width, initial-scale=1.0, user-scalable=no'
          }, {
            name: 'content-type',
            content: 'text/html; charset=UTF-8'
          }, {
            name: 'apple-mobile-web-app-capable',
            content: 'yes'
          }, {
            property: 'og:site_name',
            content: 'Discussions on CoLearnr'
          }, {
            property: 'keywords',
            content: meta.config['keywords'] || ''
          }],
          metaString = utils.buildMetaTags(defaultMetaTags.concat(options.metaTags || [])),
          linkTags = utils.buildLinkTags(options.linkTags || []),
          templateValues = {
            cssSrc: meta.config['theme:src'] || nconf.get('relative_path') + '/vendor/bootstrap/css/bootstrap.min.css',
            pluginCSS: plugins.cssFiles.map(function (file) { return { path: file } }),
            title: meta.config.title || '',
            description: meta.config.description || '',
            'brand:logo': meta.config['brand:logo'] || '',
            'brand:logo:display': meta.config['brand:logo'] ? '' : 'hide',
            browserTitle: meta.config.title || 'discuss',
            csrf: options.res.locals.csrf_token,
            relative_path: nconf.get('relative_path'),
            socket_server: socket_server,
            cdn_prefix: nconf.get('cdn_prefix'),
            app_home: app_home,
            app_home_https: app_home_https,
            app_home_http: app_home_http,
            app_login: app_login,
            meta_tags: metaString,
            link_tags: linkTags,
            clientScripts: clientScripts,
            navigation: custom_header.navigation,
            documentDomain: (nconf.get('cookieDomain') && nconf.get('cookieDomain') !== 'localhost' && nconf.get('cookieDomain').indexOf('dev') === -1) ? nconf.get('cookieDomain').substring(1) : ""
          }

        var uid = null

        if (options.req.user && options.req.user.uid) {
          uid = options.req.user.uid
        }

        topics.get_random_topics({_id: uid}, constants.LEARN_TOPICS_COUNT, function (err, data) {
          templateValues.editor = ejs.render(editorTemplate, {
            user: {_id: uid},
            session: options.req.session,
            app_home: app_home,
            app_home_https: app_home_https,
            app_home_http: app_home_http,
            config: nconf
          })
          templateValues.learn_menu = ejs.render(learnMenuTemplate, {
            user: {_id: uid},
            session: options.req.session,
            random_topics: data,
            app_home: app_home,
            app_home_https: app_home_https,
            app_home_http: app_home_http
          })
          user.isAdministrator(uid, function (isAdmin) {
            // templateValues.adminDisplay = isAdmin ? 'show' : 'hide'
            templateValues.adminDisplay = 'hide'
            // CoLearnr: Support for simple template
            var headerTpl = options.simpleMode ? templates['header-simple'] : (nconf.get('header_template') ? templates[nconf.get('header_template')] : templates.header)
            if (!headerTpl) {
              headerTpl = templates.header
            }
            translator.translate(headerTpl.parse(templateValues), function (template) {
              callback(null, template)
            })
          })
        })

      })
    }

    // Middlewares
    async.series([
      function (next) {
        // Pre-router middlewares
        app.use(helmet({
          frameguard: false
        }));
        app.use(compression({threshold: 512}))

        app.use(favicon(path.join(__dirname, '../', 'public', 'favicon.ico')))
        app.use(require('less-middleware')(path.join(__dirname, '../', 'public'), {
          prefix: nconf.get('relative_path'),
          yuicompress: true
        }))
        app.use(bodyParser.urlencoded({
          extended: false,
          limit: '50mb'
        }))

        app.use(cookieParser()); // If you want to parse cookies (res.cookies)

        // CoLearnr: Support for single sign on between webapp and discuss
        var sessionArgs = {
          store: new RedisStore({
            client: RDB,
            ttl: 60 * 60 * 24 * 14
          }),
          resave: true,
          saveUninitialized: true,
          secret: nconf.get('secret'),
          key: 'connect.sid-' + (process.env.ENV_CONFIG || 'dev')
        }
        var cookieArgs = {
          path: '/',
          maxAge: 1000 * 60 * 60 * 24 * 14,
          httpOnly: true
        }

        var cookieDomain = nconf.get('cookieDomain')
        if (cookieDomain && cookieDomain != 'localhost') {
          cookieArgs['domain'] = nconf.get('cookieDomain')
        }
        sessionArgs['cookie'] = cookieArgs
        app.use(session(sessionArgs))
        var allowCrossDomain = function (req, res, next) {
          res.header('Access-Control-Allow-Origin', '*')
          res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          // intercept OPTIONS method
          if ('OPTIONS' == req.method) {
            res.sendStatus(200)
          } else {
            next()
          }
        }
        app.use(allowCrossDomain)
        app.use(csrf())

        // Local vars, other assorted setup
        app.use(function (req, res, next) {
          nconf.set('https', req.secure)
          res.locals.csrf_token = req.session._csrf
          next()
        })

        // Authentication Routes
        auth.initialize(app)

        next()
      },
      function (next) {
        async.parallel([
          function (next) {
            // Theme configuration
            RDB.hmget('config', 'theme:type', 'theme:id', 'theme:staticDir', 'theme:templates', function (err, themeData) {
              var themeId = (themeData[1] || 'discuss-theme-vanilla')

              // Detect if a theme has been selected, and handle appropriately
              if (!themeData[0] || themeData[0] === 'local') {
                // Local theme
                if (process.env.NODE_ENV === 'development') {
                  winston.info('[themes] Using theme ' + themeId)
                }

                // Theme's static directory
                if (themeData[2]) {
                  app.use('/css/assets', serveStatic(path.join(__dirname, '../node_modules', themeData[1], themeData[2])))
                  if (process.env.NODE_ENV === 'development') {
                    winston.info('Static directory routed for theme: ' + themeData[1])
                  }
                }

                if (themeData[3]) {
                  app.use('/templates', serveStatic(path.join(__dirname, '../node_modules', themeData[1], themeData[3])))
                  if (process.env.NODE_ENV === 'development') {
                    winston.info('Custom templates directory routed for theme: ' + themeData[1])
                  }
                }

                app.use(require('less-middleware')(path.join(__dirname, '../node_modules/' + themeId), {
                  dest: path.join(__dirname, '../public/css'),
                  prefix: nconf.get('relative_path') + '/css',
                  yuicompress: true
                }))

                next()
              } else {
                // If not using a local theme (bootswatch, etc), drop back to vanilla
                if (process.env.NODE_ENV === 'development') {
                  winston.info('[themes] Using theme ' + themeId)
                }

                app.use(require('less-middleware')(path.join(__dirname, '../node_modules/discuss-theme-vanilla'), {
                  dest: path.join(__dirname, '../public/css'),
                  prefix: nconf.get('relative_path') + '/css',
                  yuicompress: true
                }))

                next()
              }
            })

            // Route paths to screenshots for installed themes
            meta.themes.get(function (err, themes) {
              var screenshotPath

              async.each(themes, function (themeObj, next) {
                if (themeObj.screenshot) {
                  screenshotPath = path.join(__dirname, '../node_modules', themeObj.id, themeObj.screenshot)
                  ;(function (id, path) {
                    fs.exists(path, function (exists) {
                      if (exists) {
                        app.get('/css/previews/' + id, function (req, res) {
                          res.sendfile(path)
                        })
                      }
                    })
                  })(themeObj.id, screenshotPath)
                } else {
                  next(false)
                }
              })
            })
          }
        ], next)
      },
      function (next) {
        // Static directory /public
        var maxAge = 28800
        if (!process.env.ENV_CONFIG || 'dev' == process.env.ENV_CONFIG) {
          maxAge = 0
        }
        app.use(nconf.get('relative_path'), serveStatic(path.join(__dirname, '../', 'public'), {maxAge: maxAge}))

        // 404 catch-all
        app.use(function (req, res, next) {
          var isLanguage = /^\/language\/[\w]{2,}\/.*\.json/,
            isClientScript = /^\/src\/forum\/[\w]+\.js/

          res.status(404)

          if (isClientScript.test(req.url)) {
            // Handle missing client-side scripts
            res.type('text/javascript').status(200).send('')
          } else if (isLanguage.test(req.url)) {
            // Handle languages by sending an empty object
            res.status(200).json({})
          } else if (req.accepts('html')) {
            // respond with html page
            if (process.env.NODE_ENV === 'development') winston.warn('Route requested but not found: ' + req.url)
            res.redirect(nconf.get('relative_path') + '/404')
          } else if (req.accepts('json')) {
            // respond with json
            if (process.env.NODE_ENV === 'development') winston.warn('Route requested but not found: ' + req.url)
            res.json({
              error: 'Not found'
            })
          } else {
            // default to plain-text. send()
            res.type('txt').send('Not found')
          }
        })

        // Cache control headers
        // if (!process.env.ENV_CONFIG || 'dev' == process.env.ENV_CONFIG) {
        app.use(function (req, res, next) {
          if (req.url.match(/\b.css\b/i) || req.url.match(/\b.js\b/i)
            || req.url.match(/\b.png\b/i) || req.url.match(/\b.jpg\b/i)) {
            res.setHeader('Cache-Control', 'max-age=28800')
          }
          next()
        })
        // }

        app.use(function (err, req, res, next) {
          // we may use properties of the error object
          // here and next(err) appropriately, or if
          // we possibly recovered from the error, simply next().
          console.error(err.stack)

          res.status(err.status || 500)

          res.status(500).json({
            error: err.message
          })
        })

        next()
      }
    ], function (err) {
      if (err) {
        winston.error('Errors were encountered while attempting to initialise discuss.')
        process.exit()
      } else {
        if (process.env.NODE_ENV === 'development') winston.info('Middlewares loaded.')
      }
    })

    module.exports.init = function () {
      templates = global.templates

      // translate all static templates served by webserver here. ex. footer, logout
      translator.translate(templates['footer'].toString(), function (parsedTemplate) {
        templates['footer'] = parsedTemplate
      })
      translator.translate(templates['logout'].toString(), function (parsedTemplate) {
        templates['logout'] = parsedTemplate
      })

      winston.info('discuss Ready')
      server.listen(nconf.get('PORT') || nconf.get('port'), nconf.get('bind_address'))
    }

    app.create_route = function (url, tpl) { // to remove
      return '<script>templates.ready(function(){ajaxify.go("' + url + '", null, "' + tpl + '");});</script>'
    }

    app.namespace(nconf.get('relative_path'), function () {
      auth.create_routes(app)
      admin.create_routes(app)
      userRoute.create_routes(app)
      apiRoute.create_routes(app)

      // Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
      ;(function () {
        var routes = ['account', 'recent', 'unread', 'notifications', '403', '404']

        for (var i = 0, ii = routes.length; i < ii; i++) {
          (function (route) {
            app.get('/' + route, ensureAuthenticated, function (req, res) {
              if ((route === 'login' || route === 'register') && (req.user && req.user.uid)) {
                user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
                  res.redirect('/user/' + userslug)
                })
                return
              }

              app.build_header({
                req: req,
                res: res
              }, function (err, header) {
                res.status((isNaN(parseInt(route, 10)) ? 200 : parseInt(route, 10))).send(header + app.create_route(route) + templates['footer'])
              })
            })
          }(routes[i]))
        }
      }())

      app.get('/', ensureAuthenticated, function (req, res) {
        async.parallel({
          'header': function (next) {
            app.build_header({
              req: req,
              res: res,
              metaTags: [{
                name: 'title',
                content: 'Discussions on CoLearnr'
              }, {
                name: 'description',
                content: meta.config.description || ''
              }, {
                property: 'og:title',
                content: 'Discussions on CoLearnr'
              }, {
                property: 'og:type',
                content: 'website'
              }]
            }, next)
          },
          'categories': function (next) {
            categories.getAllCategories(function (returnData) {
              returnData.categories = returnData.categories.filter(function (category) {
                if (category.disabled !== '1' && !category.hidden) {
                  return true
                }
                return true
              })
              next(null, returnData)
            }, 0)
          }
        }, function (err, data) {
          res.send(
            data.header +
            '\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/home'].parse(data.categories) + '\n\t</noscript>' +
            app.create_route('') +
            templates['footer']
          )
        })
      })

      // CoLearnr: Custom routes
      // url to dynamically create and display topics from learnbits
      app.get('/topic/user/:user_oid/by_objid/:category_id/:lbit_oid', function (req, res) {
        var cid = req.params.category_id
        var user_oid = req.params.user_oid
        if (!cid || cid == 'undefined') {
          cid = 9
        }
        var lbit_oid = req.params.lbit_oid
        _handleTopicForLearnbit(req, res, cid, user_oid, lbit_oid)
      })

      app.get('/topic/user/:user_oid/:topic_oid/:lbit_oid', function (req, res) {
        var user_oid = req.params.user_oid
        var topic_oid = req.params.topic_oid
        var lbit_oid = req.params.lbit_oid
        categories.getOrCreateCategory(user_oid, topic_oid, function (err, category) {
          if (category && category.cid) {
            _handleTopicForLearnbit(req, res, category.cid, user_oid, lbit_oid)
          } else {
            res.status(500).send('Unable to load the discussions for this topic. Please try again later.')
            return
          }
        })
      })

      function _handleTopicForLearnbit (req, res, cid, user_oid, lbit_oid) {
        winston.debug('_handleTopicForLearnbit', cid, lbit_oid)
        if (!util.validOid(lbit_oid)) {
          res.status(500).send('Unable to load the discussions for this topic. Please try again later.')
          return
        }
        db.learnbits.findOne({_id: db.ObjectId(lbit_oid)}, function (err, lbit) {
          // console.log(err, lbit)
          if (err || !lbit) {
            res.status(500).send('Unable to load the discussions for this topic. Please try again later.')
            return
          }
          var title = lbit.title
          if (utils.empty(title) || title == '#') {
            title = 'New discussion'
          }
          var url = lbit.url
          if (utils.empty(url) || url == '#') {
            url = ''
          }
          var content = ''
          switch (lbit.type) {
            case 'html':
            case 'inline-html':
            case 'iframe-embed':
            case 'iframe':
              content = 'Discussion about ' + title
              break
            case 'quote':
              var body = utils.parseJson(lbit.body)
              title = 'Quote by ' + body.author || 'unknown'
              content = '<quote>' + (body.quote || '') + '</quote>'
              break
            default:
              content = 'Discussion about ' + title
              break
          }
          topics.getOrCreateTopicByObjId(user_oid, cid, lbit_oid, title, url, content, lbit, function (err, tid) {
            if (tid) {
              var tmpslug = utils.slugify(title)
              if (utils.empty(tmpslug)) {
                tmpslug = 'topic'
              }
              res.redirect('/topic/' + tid + '/' + tmpslug + '/?s=1&lbit_oid=' + lbit_oid)
            } else {
              console.error('No discussion topic exists for', cid, lbit_oid)
              res.redirect('404')
            }
          })
        })
      }
      app.get('/topic/:topic_id/:slug?', function (req, res) {
        var tid = req.params.topic_id
        var simpleMode = req.query.s ? true : false
        var lbit_oid = req.query.lbit_oid ? req.query.lbit_oid : null

        async.waterfall([
          function (next) {
            topics.getTopicWithPosts(tid, lbit_oid, ((req.user) ? req.user.uid : 0), 0, -1, function (err, topicData) {
              if (topicData) {
                if (topicData.error) {
                  return next(new Error(topicData.error), null)
                } else if (topicData.deleted === '1' && topicData.expose_tools === 0) {
                  return next(new Error('Topic deleted'), null)
                }
              }

              next(err, topicData)
            })
          },
          function (topicData, next) {
            var lastMod = 0,
              timestamp

            for (var x = 0, numPosts = topicData.posts.length; x < numPosts; x++) {
              timestamp = parseInt(topicData.posts[x].timestamp, 10)
              if (timestamp > lastMod) lastMod = timestamp
            }

            app.build_header({
              req: req,
              res: res,
              simpleMode: simpleMode,
              metaTags: [{
                name: 'title',
                content: topicData.topic_name
              }, {
                name: 'description',
                content: 'Discussions about ' + topicData.topic_name + ' on CoLearnr'
              }, {
                property: 'og:title',
                content: topicData.topic_name + ' | ' + (meta.config.title || 'discuss')
              }, {
                property: 'og:type',
                content: 'article'
              }, {
                property: 'og:url',
                content: nconf.get('url') + 'topic/' + topicData.slug
              }, {
                property: 'og:image',
                content: topicData.main_posts[0].picture
              }, {
                property: 'article:published_time',
                content: new Date(parseInt(topicData.main_posts[0].timestamp, 10)).toISOString()
              }, {
                property: 'article:modified_time',
                content: new Date(lastMod).toISOString()
              }, {
                property: 'article:section',
                content: topicData.category_name
              }],
              linkTags: [
                {
                  rel: 'alternate',
                  type: 'application/rss+xml',
                  href: nconf.get('url') + 'topic/' + tid + '.rss'
                },
                {
                  rel: 'up',
                  href: nconf.get('url') + 'category/' + topicData.category_slug
                }
              ]
            }, function (err, header) {
              next(err, {
                header: header,
                topics: topicData
              })
            })
          },
        ], function (err, data) {
          if (err) {
            console.error(err)
            return res.redirect('404')
          }
          var topic_url = tid + (req.params.slug ? '/' + req.params.slug : 'topic')

          res.send(
            data.header +
            '\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/topic'].parse(data.topics) + '\n\t</noscript>' +
            '\n\t<script>templates.ready(function(){ajaxify.go("topic/' + topic_url + '");});</script>' +
            (simpleMode ? templates['footer-simple'] : templates['footer'])
          )
        })
      })

      // CoLearnr: Custom route
      app.get('/category/user/:user_oid/:topic_oid/:slug?', function (req, res) {
        var user_oid = req.params.user_oid
        var topic_oid = req.params.topic_oid
        categories.getOrCreateCategory(user_oid, topic_oid, function (err, category) {
          if (category && category.slug) {
            res.redirect('/category/' + category.slug)
          } else {
            res.redirect('/404')
          }
        })
      })

      app.get('/category/:category_id/:slug?', function (req, res) {
        var cid = req.params.category_id
        async.waterfall([
          function (next) {
            categories.getCategoryById(cid, 0, function (err, categoryData) {
              if (categoryData) {
                if (categoryData.error) {
                  return next(new Error(categoryData.error), null)
                } else if (categoryData.disabled === '1') {
                  return next(new Error('Category disabled'), null)
                }
              }
              next(err, categoryData)
            })
          },
          function (categoryData, next) {
            app.build_header({
              req: req,
              res: res,
              metaTags: [{
                name: 'title',
                content: categoryData.category_name
              }, {
                name: 'description',
                content: 'Discussions about ' + categoryData.category_name + ' on CoLearnr'
              }, {
                property: 'og:type',
                content: 'website'
              }],
              linkTags: [
                {
                  rel: 'alternate',
                  type: 'application/rss+xml',
                  href: nconf.get('url') + 'category/' + cid + '.rss'
                },
                {
                  rel: 'up',
                  href: nconf.get('url')
                }
              ]
            }, function (err, header) {
              next(err, {
                header: header,
                categories: categoryData
              })
            })
          }
        ], function (err, data) {
          if (err) {
            console.error(err)
            return res.redirect('404')
          }
          var category_url = cid + (req.params.slug ? '/' + req.params.slug : 'category')
          res.send(
            data.header +
            '\n\t<noscript>\n' + templates['noscript/header'] + templates['noscript/category'].parse(data.categories) + '\n\t</noscript>' +
            '\n\t<script>templates.ready(function(){ajaxify.go("category/' + category_url + '");});</script>' +
            templates['footer']
          )
        })
      })

      app.get('/confirm/:code', function (req, res) {
        app.build_header({
          req: req,
          res: res
        }, function (err, header) {
          res.send(header + '<script>templates.ready(function(){ajaxify.go("confirm/' + req.params.code + '");});</script>' + templates['footer'])
        })
      })

      if (enable_search_robots) {
        app.get('/sitemap.xml', function (req, res) {
          var sitemap = require('./sitemap.js')

          sitemap.render(function (xml) {
            res.type('xml').set('Content-Length', xml.length).send(xml)
          })
        })

        app.get('/robots.txt', function (req, res) {
          res.set('Content-Type', 'text/plain')
          res.send('User-agent: *\n' +
            'Disallow: /admin/\n' +
            'Sitemap: ' + nconf.get('url') + 'sitemap.xml')
        })
      }

      app.get('/cid/:cid', function (req, res) {
        categories.getCategoryData(req.params.cid, null, function (err, data) {
          if (data)
            res.send(data)
          else
            res.send(404, "Category doesn't exist!")
        })
      })

      app.get('/tid/:tid', function (req, res) {
        topics.getTopicData(req.params.tid, function (data) {
          if (data)
            res.send(data)
          else
            res.send(404, "Topic doesn't exist!")
        })
      })

      app.get('/recent/:term?', function (req, res) {
        // TODO consolidate with /recent route as well -> that can be combined into this area. See "Basic Routes" near top.
        app.build_header({
          req: req,
          res: res
        }, function (err, header) {
          res.send(header + app.create_route('recent/' + req.params.term, null, 'recent') + templates['footer'])
        })

      })

      app.get('/pid/:pid', function (req, res) {
        posts.getPostData(req.params.pid, function (data) {
          if (data)
            res.send(data)
          else
            res.send(404, "Post doesn't exist!")
        })
      })

      app.get('/outgoing', function (req, res) {
        if (!req.query.url) return res.redirect('/404')

        app.build_header({
          req: req,
          res: res
        }, function (err, header) {
          res.send(
            header + '\n\t<script>templates.ready(function(){ajaxify.go("outgoing?url=' + encodeURIComponent(req.query.url) + '", null, null, true);});</script>' +
            templates['footer']
          )
        })
      })

      app.get('/search', function (req, res) {
        if (!req.user)
          return res.redirect('/403')
        app.build_header({
          req: req,
          res: res
        }, function (err, header) {
          res.send(header + app.create_route('search', null, 'search') + templates['footer'])
        })
      })

      app.get('/search/:term', function (req, res) {
        if (!req.user)
          return res.redirect('/403')
        app.build_header({
          req: req,
          res: res
        }, function (err, header) {
          res.send(header + app.create_route('search/' + req.params.term, null, 'search') + templates['footer'])
        })
      })

      app.get('/reindex', function (req, res) {
        topics.reIndexAll(function (err) {
          if (err) {
            return res.json(err)
          }

          user.reIndexAll(function (err) {
            if (err) {
              return res.json(err)
            } else {
              res.send('Topics and users reindexed')
            }
          })
        })
      })

      app.get('/media/:oid', function (req, res) {
        var oid = req.params.oid
        if (oid) {
          res.redirect(app_home + '/media/' + oid)
        } else {
          res.status(404)
        }
      })

      // Other routes
      require('./routes/plugins')(app)

      // Debug routes
      if (process.env.NODE_ENV === 'development') {
        require('./routes/debug')(app)
      }

      var custom_routes = {
        'routes': [],
        'api_methods': []
      }

      plugins.ready(function () {
        plugins.fireHook('filter:server.create_routes', custom_routes, function (err, custom_routes) {
          var routes = custom_routes.routes
          for (var route in routes) {
            if (routes.hasOwnProperty(route)) {
              (function (route) {
                app[routes[route].method || 'get'](routes[route].route, function (req, res) {
                  routes[route].options(req, res, function (options) {
                    app.build_header({
                      req: options.req,
                      res: options.res
                    }, function (err, header) {
                      res.send(header + options.content + templates['footer'])
                    })
                  })
                })
              }(route))
            }
          }
        })
      })

    })
  }(WebServer))

  global.server = server
}
