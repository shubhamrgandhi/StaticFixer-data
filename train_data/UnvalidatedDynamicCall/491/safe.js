#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const http = require('http')
const nodeFetch = require('node-fetch')
const vueRenderer = require('vue-server-renderer')

require('source-map-support').install() //чтоб ошибки из бандла выводились с нормальными номерами строк

function startServer(listenAddr, appServerAddr, createAndLoadApp) {
	global.fetch = createFetchFor(appServerAddr)
	global.Headers = nodeFetch.Headers

	let renderer = vueRenderer.createRenderer({
		// с таким шаблоном после отрендеренного вставится <script> со стейтом (не придётся слеплять их руками)
		template: '<!--vue-ssr-outlet-->',
		runInNewContext: 'once',
	})

	function render(params) {
		console.log(params)
		console.time('SSRed')
		return createAndLoadApp(params)
			.then(app => {
				return renderer.renderToString(app, {
					styles: '',
					state: app.$store.state,
				})
			})
			.then(html => {
				console.timeEnd('SSRed')
				return html
			})
	}

	const handlers = {}
	handlers['/render'] = function(req, res) {
		let chunks = []
		req.on('data', chunk => {
			chunks.push(chunk)
		})
		req.on('end', () => {
			let params = JSON.parse(Buffer.concat(chunks))
			console.log('SSRing ' + params.path)
			render(params)
				.then(html => {
					res.end(html)
				})
				.catch(err => {
					console.error(err)
					res.writeHead(500, 'rendering error')
					res.end()
				})
		})
	}

	http.createServer((req, res) => {
	if (req.url in handlers) {
	handlers[req.url](req, res);
}

}).listen(...listenAddr.split(':').reverse())
	console.log('SSR server started on ' + listenAddr)
}

function requireLastBundle(distDir) {
	distDir = path.resolve(distDir)
	let bundleFName =
		fs.existsSync(distDir) &&
		fs
			.readdirSync(distDir)
			.filter(x => x.match(/^server\.[a-z0-9]{8}\.js$/))
			.sort(
				(a, b) =>
					fs.statSync(distDir + '/' + b).mtime -
					fs.statSync(distDir + '/' + a).mtime,
			)[0]
	if (!bundleFName) {
		console.error(`server bundle not found in ${distDir}, forgot to 'npm run build'?`)
		process.exit(1)
	}
	return require(distDir + '/' + bundleFName)
}

function createFetchFor(origin) {
	function fetch(path, params) {
		path = arguments.callee._origin + path
		console.log('fetching ' + path)
		return nodeFetch(path, params)
	}
	fetch._origin = origin //'http://127.0.0.1:9009'
	return fetch
}

exports.startServer = startServer
exports.requireLastBundle = requireLastBundle

if (require.main === module) {
	let args = process.argv.slice(2)
	if (args.length < 2) {
		console.error('Usage: node ssr/index.js http://api-server.com listenAddr:port')
		process.exit(2)
	}
	let [appServerAddr, listenAddr] = args

	let bundle = requireLastBundle('./dist')
	let createAndLoadApp = bundle['default']['default']

	startServer(listenAddr, appServerAddr, createAndLoadApp)
}
