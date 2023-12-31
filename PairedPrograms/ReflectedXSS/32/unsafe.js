/**
 * Created by championswimmer on 16/05/17.
 */
const basicAuth = require('express-basic-auth')
const passport = require('passport')
const Router = require('express').Router
const escapeHtml = require('escape-html')

const auth = require('./../utils/auth')
const config = require('./../config')
const du = require('./../utils/datautils')

const { BOSS_END_DATE, BOSS_START_DATE } = require('./../utils/consts')

const { getUrlDetails } = require('../utils/urlUtils')

const route = new Router()

let adminUser = process.env.BOSS_ADMIN || config.secrets.BOSS_DB_USER
let adminPass = process.env.BOSS_PASSWORD || config.secrets.BOSS_DB_PASS
let users = {}
users[adminUser] = adminPass

route.get('/', (req, res) => {
  if (Date.now() < BOSS_START_DATE.getTime()) {
    res.render('pages/comingsoon')
  } else if (Date.now() > BOSS_END_DATE.getTime()) {
    res.render('pages/end')
  } else {
    res.render('pages/index')
  }
})

route.get('/admin', auth.adminOnly, (req,res) => {
  du.getAllAdmins()
    .then((users) => {
      res.render('pages/admin',{ users })
    })
    .catch((error) => {
      console.log(error)
      res.send('Error in getting Admin Page')
    })
})

route.post('/admin', auth.adminOnly, (req,res) => {
  du.getUserByOneAuthId(req.body.id)
  .then((user) => {
    console.log(user)
    if(!user) {
      res.redirect('/admin')
    }
    else {
      du.makeUserAdmin(req.body.id)
        .then((result) => {
          res.redirect('/admin')
        })
        .catch((error) => {
          console.log(error)
          res.send('Error in making Admin')
        })
    }
  })
})

route.get('/login', passport.authenticate('oauth2', { failureRedirect: '/failed' }))
route.get('/login/callback', passport.authenticate('oauth2', { failureRedirect: '/failed' }), (req, res) => {
  res.redirect('/')
})

route.get('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/')
})

route.get('/leaderboard/:year?', async (req, res) => {
  let { year = '2020' } = req.params
  const validYears = ['2020', '2019', '2018']

  if (!validYears.includes(year)) {
    return res.status(404).render('pages/404')
  } else {
    year = parseInt(year)
  }

  const options = {
    page: req.query.page || 1,
    size: req.query.size || config.PAGINATION_SIZE,
    year
  }

  options.page = parseInt(options.page)

  let loggedInUser = {}
  const githubDetails = req.user && req.user.usergithub
  if (githubDetails) {
    const result = await du.getLoggedInUserStats(options, githubDetails.username)
    if (result[0][0]) {
      loggedInUser = result[0][0]
    }
  }

  du.getLeaderboard(options)
    .then(data => {
      const pagination = []
      const count = data[0]
      const rows = data[1][0]
      const lastPage = Math.ceil(count / options.size)
      const showUserAtTop = loggedInUser.user && !rows.some(row => row.user === loggedInUser.user)
      rows.forEach(row => {
        if (githubDetails && githubDetails.username === row.user) {
          row.isColored = true
        }
      })
      for (var i = 1; i <= lastPage; i++) pagination.push({ link: `?page=${i}&size=${options.size}`, index: i })

      res.render('pages/leaderboard', {
        prevPage: options.page - 1,
        nextPage: options.page + 1,
        isFirstPage: options.page == 1,
        isLastPage: options.page == lastPage,
        size: options.size,
        page: options.page,
        pagination: pagination,
        userstats: rows,
        loggedInUser,
        showUserAtTop,
        menu: {
          leaderboard: 'active',
          leaderboard2020: (year === '2020' || !year) && 'active',
          leaderboard2019: year === '2019' && 'active'
        }
      })
    })
    .catch(error => {
      console.log(error)
      res.send('Error fetching leaderboard')
    })
})

route.get('/stats', (req, res) => {
  du.getCounts()
    .then(data => {
      res.render('pages/stats', {
        participants: data[0],
        claims: data[1],
        accepted: data[2],
        totalclaimed: data[3],
        menu: { stats: 'active' }
      })
    })
    .catch(error => {
      res.send('Error fetching stats!')
    })
})

route.get('/claims/view', (req, res) => {
  const options = {
    username: req.query.username,
    projectname: req.query.projectname,
    status: req.query.status || 'claimed',
    page: req.query.page || 1,
    size: req.query.size || config.PAGINATION_SIZE,
    minbounty: req.query.minbounty || 0,
    maxbounty: req.query.maxbounty || 5000,
    merged: req.query.merged === 'true'
  }

  var menuH = {}
  var current
  if (req.user) {
    current = req.user.usergithub.username
  }

  if (options.status == 'claimed') menuH[options.status] = 'active'
  else if (options.status == 'accepted') menuH[options.status] = 'active'
  else menuH[options.status] = 'active'

  options.page = parseInt(options.page)

  du.getClaims(options)
    .then(data => {
      const pagination = []
      const filter = []
      const filterproj = []
      const lastPage = Math.ceil(data[1].count / options.size)

      for (var i = 1; i <= lastPage; i++) {
        if (options.username) {
          pagination.push(`?page=${i}&size=${options.size}&status=${options.status}&username=${options.username}`)
        } else if (options.projectname) {
          pagination.push(`?page=${i}&size=${options.size}&status=${options.status}&projectname=${options.projectname}`)
        } else if (options.minbounty && options.maxbounty) {
          pagination.push(
            `?page=${i}&size=${options.size}&status=${options.status}&minbounty=${options.minbounty}&maxbounty=${options.maxbounty}`
          )
        } else {
          pagination.push(`?page=${i}&size=${options.size}&status=${options.status}`)
        }
      }

      data[0].forEach(function(item, index) {
        filter.push({
          name: item.DISTINCT,
          url: `?status=${options.status}&username=${item.DISTINCT}`
        })
      })

      data[2].forEach(function(item, index) {
        filterproj.push({
          name: item.DISTINCT,
          url: `?status=${options.status}&projectname=${item.DISTINCT}`
        })
      })

      res.render('pages/claims/view', {
        prevPage: options.page - 1,
        nextPage: options.page + 1,
        pagination: pagination,
        isFirstPage: options.page == 1,
        isLastPage: lastPage == options.page,
        page: options.page,
        size: options.size,
        claims: data[1].rows,
        menu: {
          claims_view: 'active',
          claims: 'claims-active'
        },
        status: options.status,
        menuH,
        current,
        filter: filter,
        filterproj: filterproj,
        username: options.username,
        projectname: options.projectname,
        minbounty: options.minbounty,
        maxbounty: options.maxbounty
      })
    })
    .catch(err => {
      console.log(err)
      res.send('Error fetching claims')
    })
})

route.get('/claims/add', auth.ensureLoggedInGithub, (req, res) => {
  res.render('pages/claims/add', {
    menu: {
      claims_add: 'active',
      claims: 'claims-active'
    }
  })
})

route.post('/claims/add', auth.ensureLoggedInGithub, (req, res) => {
  if (Date.now() > BOSS_END_DATE.getTime()) {
    return res.send("Sorry. Boss has ended, can't add claim from now.")
  }
  if (Date.now() < BOSS_START_DATE.getTime()) {
    return res.send('Sorry. BOSS has not yet started')
  }

  du.createClaim(
    req.user.usergithub.username, // github username already valid
    req.body.issue_url,
    req.body.pull_url,
    req.body.bounty,
    config.CLAIM_STATUS.CLAIMED
  )
    .then(claim => {
      res.redirect('/claims/view')
    })
    .catch(error => {
      res.render('pages/claims/unique')
    })
})

route.get('/claims/:id', auth.adminOnly, (req, res) => {
  du.getClaimById(req.params.id)
    .then(claim => {
      if (!claim) throw new Error('No claim found')
      pullUrlDetail = getUrlDetails(claim["pullUrl"])
      issueUrlDetail = getUrlDetails(claim["issueUrl"])
      du.getConflictedClaims(claim,issueUrlDetail,pullUrlDetail.type)
        .then(conflictedClaims => {
          if(conflictedClaims.length === 0)
            res.render('pages/claims/id',{claim, hasConflict: false })
          else
            res.render('pages/claims/id',{ claim, hasConflict: true, conflictedClaims })
        })
        .catch(err => {
          res.send('Error getting conflicting claims')
        })
    })
    .catch(err => {
      console.log(err)
      res.send('Error fetching claim id = ' + req.params.id)
    })
})

route.post('/claims/:id/update', auth.adminOnly, (req, res) => {
  du.updateClaim(req.params.id, req.body)
    .then(result => {
      res.redirect('/claims/' + req.params.id)
    })
    .catch(error => {
      res.send('Error updating claim')
    })
})

route.get('/claims/:id/edit', auth.ensureLoggedInGithub, auth.ensureUserCanEdit, (req, res) => {
  du.getClaimById(req.params.id)
    .then(claim => {
      if (!claim) throw new Error('No claim found')
      res.render('pages/claims/edit', { claim })
    })
    .catch(err => {
      res.send('Error fetching claim id = ' + escapeHtml(req.params.id))
    })
})

route.post('/claims/:id/edit', auth.ensureLoggedInGithub, auth.ensureUserCanEdit, (req, res) => {
  du.updateClaim(req.params.id, req.body)
    .then(result => {
      res.redirect('/claims/view')
    })
    .catch(error => {
      res.send('Error updating claim')
    })
})

route.get('/claims/:id/delete', auth.ensureLoggedInGithub, auth.ensureUserCanEdit, (req, res) => {
  du.delClaim(req.params.id)
    .then(() => {
      res.redirect('/claims/view')
    })
    .catch(error => {
      res.send('Error Deleting Claim')
    })
})

module.exports = route
