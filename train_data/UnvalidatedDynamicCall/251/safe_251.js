// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/**
 * SAGE2 HTTP handlers
 *
 * @module server
 * @submodule httpserver
 * @requires node-utils
 */

// require variables to be declared
"use strict";

// builtins
var fs   = require('fs');
var path = require('path');
var url  = require('url');
var mime = require('mime');
var zlib = require('zlib');  // to enable HTTP compression

// Using the debug package to track HTTP request
//   to see request: env DEBUG=sage2http node server.js ....
var debug = require('debug')('sage2http');

// External package to clean up URL requests
var normalizeURL = require('normalizeurl');

// SAGE2 own modules
var sageutils  = require('../src/node-utils');    // provides utility functions
var generateSW = require('../generate-service-worker.js');

/**
 * SAGE HTTP request handlers for GET and POST
 *
 * @class HttpServer
 * @constructor
 * @param publicDirectory {String} folder to expose to the server
 */
function HttpServer(publicDirectory) {
	this.publicDirectory = publicDirectory;
	this.getFuncs  = {};
	this.postFuncs = {};
	this.onrequest = this.onreq.bind(this);

	// Generate the service worker for caching
	generateSW();
}


/**
 * Given a request, will attempt to detect all associated cookies.
 *
 * @method detectCookies
 * @param request {Object} the request that came from a client
 * @return {Object} containing the list of cookies in string format
 */
function detectCookies(request) {
	var cookieList = [];
	var allCookies = request.headers.cookie;

	var i = 0;
	if (allCookies != null) {
		while (allCookies.indexOf(';') !== -1) {
			cookieList.push(allCookies.substring(0, allCookies.indexOf(';')));
			cookieList[i] = cookieList[i].trim();
			allCookies    = allCookies.substring(allCookies.indexOf(';') + 1);
			i++;
		} // end while there is a ;
		cookieList.push(allCookies.trim());
	}
	return cookieList;
}

/**
 * Handle a page not found (404)
 *
 * @method notfound
 * @param res {Object} response
 */
HttpServer.prototype.notfound = function(res) {
	var header = this.buildHeader();
	// Do not allow iframe
	header["X-Frame-Options"] = "DENY";

	res.writeHead(404, header);
	res.write('<meta http-equiv="refresh" content="5;url=index.html">');
	res.write('<h1>SAGE2 error</h1>Invalid request\n');
	res.write('<br><br><br>\n');
	res.write('<b><a href=index.html>SAGE2 main page</a></b>\n');
	res.end();
};

/**
 * Handle a HTTP redirect
 *
 * @method redirect
 * @param res {Object} response
 * @param aurl {String} destination URL
 * @param code {Number} HTTP code: 301 or 302 (default)
 */
HttpServer.prototype.redirect = function(res, aurl, code = 302) {
	var header = this.buildHeader();
	// Do not allow iframe
	header["X-Frame-Options"] = "DENY";
	// 301 HTTP code for redirect: Moved Permanently
	//    causes issue with caching and cookies
	// 302 HTTP code for found: redirect
	header.Location = aurl;
	res.writeHead(code, header);
	res.end();
};

/**
 * Clear the user's data caches and redirect to index.html
 *
 * @method clearSiteData
 * @param res {Object} response
 */
HttpServer.prototype.clearSiteData = function(res) {
	// Default header first
	var header = this.buildHeader();
	// Use the Clear-Site-Data header:
	// https://www.w3.org/TR/clear-site-data/
	header["Clear-Site-Data"] = '"cache","cookies","storage"';
	header.Location = "index.html";
	res.writeHead(302, header);
	res.end();
};

/**
 * Build an HTTP header object
 *
 * @method buildHeader
 * @return {Object} an object containig common HTTP header values
 */
HttpServer.prototype.buildHeader = function() {
	// Get the site configuration, from server.js
	var cfg = global.config;
	// Build the header object
	var header = {};

	// Default datatype of the response
	header["Content-Type"] = "text/html; charset=utf-8";

	// The X-Frame-Options header can be used to to indicate whether a browser is allowed
	// to render a page within an <iframe> element or not. This is helpful to prevent clickjacking
	// attacks by ensuring your content is not embedded within other sites.
	// See more here: https://developer.mozilla.org/en-US/docs/HTTP/X-Frame-Options.
	// "SAMEORIGIN" or "DENY" for instance
	header["X-Frame-Options"] = "SAMEORIGIN";

	// This header enables the Cross-site scripting (XSS) filter built into most recent web browsers.
	// It's usually enabled by default anyway, so the role of this header is to re-enable the filter
	// for this particular website if it was disabled by the user.
	// This header is supported in IE 8+, and in Chrome.
	header["X-XSS-Protection"] = "1; mode=block";

	// The only defined value, "nosniff", prevents Internet Explorer and Google Chrome from MIME-sniffing
	// a response away from the declared content-type. This also applies to Google Chrome, when downloading
	// extensions. This reduces exposure to drive-by download attacks and sites serving user uploaded content
	// that, by clever naming, could be treated by MSIE as executable or dynamic HTML files.
	header["X-Content-Type-Options"] = "nosniff";

	// HTTP Strict Transport Security (HSTS) is an opt-in security enhancement
	// Once a supported browser receives this header that browser will prevent any
	// communications from being sent over HTTP to the specified domain
	// and will instead send all communications over HTTPS.
	// Here using a long (1 year) max-age
	if (cfg.security && sageutils.isTrue(cfg.security.enableHSTS)) {
		header["Strict-Transport-Security"] = "max-age=31536000";
	}

	// Instead of blindly trusting everything that a server delivers, Content-Security-Policy defines
	// the HTTP header that allows you to create a whitelist of sources of trusted content,
	// and instructs the browser to only execute or render resources from those sources.
	// Even if an attacker can find a hole through which to inject script, the script won’t match
	// the whitelist, and therefore won’t be executed.
	// default-src 'none' -> default policy that blocks absolutely everything
	if (cfg.security && sageutils.isTrue(cfg.security.enableCSP)) {
		// Pretty open
		header["Content-Security-Policy"] = "default-src 'self';" +
			// application/browser-plugin is for vtc
			" plugin-types image/svg+xml application/browser-plugin;" +
			" object-src 'self';" +
			" child-src 'self' blob:;" +
			" connect-src *;" +
			" font-src 'self' fonts.gstatic.com;" +
			" form-action 'self';" +
			" img-src * data: blob:;" +
			" media-src 'self' blob:;" +
			" style-src 'self' 'unsafe-inline' fonts.googleapis.com;" +
			" script-src * 'unsafe-eval' 'unsafe-inline';";
	}

	// Expect-CT allows a site to determine if they enforce their Certificate Transparency policy
	if (cfg.security && sageutils.isTrue(cfg.security.enableExpectCertificateTransparency)) {
		// set to enforce, and valid for 1 hour
		header["Expect-CT"] = "enforce; max-age:3600;";
	}

	// Referrer Policy allows a site to control how much information the browser includes
	//   with navigations away from a document. Only set here for same origin site
	if (cfg.security && sageutils.isTrue(cfg.security.enableReferrerPolicy)) {
		header["Referrer-Policy"] = "same-origin";
	}

	// Feature Policy allows to enable and disable certain web platform features
	//  in local pages and those they embed
	if (cfg.security && sageutils.isTrue(cfg.security.enableFeaturePolicy)) {
		header["Feature-Policy"] = "" +
			"accelerometer 'none'" +
			"; ambient-light-sensor 'none'" +
			"; autoplay *" +
			"; camera *" +
			"; encrypted-media 'none'" +
			"; fullscreen 'none'" +
			"; geolocation *" +
			"; gyroscope 'none'" +
			"; magnetometer 'none'" +
			"; microphone *" +
			"; midi 'none'" +
			"; payment 'none'" +
			// "; picture-in-picture 'none'" +
			"; speaker *" +
			"; usb 'self'" +
			"; vr 'self'";
	}

	return header;
};

/**
 * Main router and trigger the GET and POST handlers
 *
 * @method onreq
 * @param req {Object} request
 * @param res {Object} response
 */
HttpServer.prototype.onreq = function(req, res) {
	var i;
	var _this = this;

	if (req.method === "GET" || req.method === "HEAD") {
	var reqURL = url.parse(req.url);
	var getName = sageutils.sanitizedURL(reqURL.pathname);
	getName = normalizeURL(getName);
	if (getName in this.getFuncs) {
	this.getFuncs[getName](req, res);
}

	return ;
	if (getName === "/") {
	this.redirect(res, "index.html", 301);
	return ;
}

	if (getName === "/logout") {
	this.clearSiteData(res);
	return ;
}

	if (getName.endsWith("manifest.webmanifest")) {
	let manifestFilename = path.join(__dirname, "..", "manifest.webmanifest");
	let manifest = fs.readFileSync(manifestFilename, 'utf8');
	let parsed = JSON.parse(manifest);
	parsed.name = "SAGE2 - " + (global.config.name || global.config.host);
	let payload = JSON.stringify(parsed, null, 4);
	let fileMime = mime.getType("manifest.webmanifest");
	let charFile = "UTF-8";
	let header = this.buildHeader();
	header["Content-Type"] = fileMime + "; charset=" + charFile;
	res.writeHead(200, header);
	res.write(payload);
	res.end();
	return ;
}

	var pathname;
	if (getName.lastIndexOf('/images/', 0) === 0 || getName.lastIndexOf('/shaders/', 0) === 0 || getName.lastIndexOf('/css/', 0) === 0 || getName.lastIndexOf('/lib/', 0) === 0 || getName.lastIndexOf('/src/', 0) === 0) {
	pathname = path.join(this.publicDirectory, getName);
}
else {
	pathname = null;
	for (var f in global.mediaFolders) {
				// Get the folder object
				var folder = global.mediaFolders[f];
				// Look for the folder url in the request
				var pubdir = getName.split(folder.url);
				if (pubdir.length === 2) {
					// convert the URL into a path
					var suburl = path.join('.', pubdir[1]);
					// pathname = url.resolve(folder.path, suburl);
					pathname = path.join(folder.path, suburl);
					break;
				}
			}
	if (! pathname) {
	pathname = path.join(this.publicDirectory, getName);
}

}
	pathname = decodeURIComponent(pathname);
	pathname = path.resolve(pathname);
	debug('request', (req.connection.encrypted ? 'https' : 'http') + '://' + req.headers.host + req.url);
	debug('response', pathname);
	if (global.__SESSION_ID) {
	if (path.extname(pathname) === ".html" && (getName.indexOf("/session.html") !== 0)) {
	var cookieList = detectCookies(req);
	var sessionMatch = false;
	for (i = 0; i < cookieList.length; i++) {
					if (cookieList[i].indexOf("session=") !== -1) {
						// We found it
						if (cookieList[i].indexOf(global.__SESSION_ID) !== -1) {
							sessionMatch = true;
						}
					}
				}
	if (! sessionMatch) {
	this.redirect(res, "/session.html?page=" + req.url.substring(1));
}

}

}

	if (sageutils.fileExists(pathname)) {
	var stats = fs.lstatSync(pathname);
	if (stats.isDirectory()) {
	this.redirect(res, getName + "/index.html");
	return ;
}

	let header = this.buildHeader();
	if (path.extname(pathname) === ".html") {
	if (pathname === path.resolve("public/index.html") || pathname === path.resolve("public/session.html") || pathname === path.resolve("public/display.html")) {
	delete header['X-Frame-Options'];
}
else {
	header['X-Frame-Options'] = 'DENY';
}
}
else {
	delete header["X-XSS-Protection"];
	delete header['X-Frame-Options'];
}
	header['Access-Control-Allow-Headers'] = 'Range';
	header['Access-Control-Expose-Headers'] = 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range';
	if (req.headers.origin !== undefined) {
	header['Access-Control-Allow-Origin'] = req.headers.origin;
	header['Access-Control-Allow-Methods'] = 'GET';
	header['Access-Control-Allow-Headers'] = 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept';
	header['Access-Control-Allow-Credentials'] = true;
}

	if (getName.match(/^\/(src|lib|images|css)\/.+/)) {
	header['Cache-Control'] = 'no-store, must-revalidate, max-age=604800';
}
else {
	header['Cache-Control'] = 'no-cache, no-store, must-revalidate';
	header['Pragma'] = 'no-cache';
	header['Expires'] = '0';
}
	var fileMime = mime.getType(pathname);
	var charFile;
	if (fileMime === "image/svg+xml" || fileMime === "application/manifest+json") {
	charFile = "UTF-8";
}

	if (charFile) {
	header["Content-Type"] = fileMime + "; charset=" + charFile;
}
else {
	header["Content-Type"] = fileMime;
}
	var total = stats.size;
	if (typeof req.headers.range !== 'undefined') {
	var range = req.headers.range;
	var parts = range.replace(/bytes=/, "").split("-");
	var partialstart = parts[0];
	var partialend = parts[1];
	var start = parseInt(partialstart, 10);
	var end = partialend ? parseInt(partialend, 10) : total - 1;
	var chunksize = (end - start) + 1;
	header["Content-Range"] = "bytes " + start + "-" + end + "/" + total;
	header["Accept-Ranges"] = "bytes";
	header["Content-Length"] = chunksize;
	res.writeHead(206, header);
	let readStream = fs.createReadStream(pathname, {
start : start ,
end : end 
});
	readStream.on('open', function (){
	readStream.pipe(res);
});
	readStream.on('error', function (err){
	res.end(err);
});
}
else {
	let readStream = fs.createReadStream(pathname);
	var compressExtensions = ['.html', '.json', '.js', '.css', '.txt', '.svg', '.xml', '.md'];
	if (compressExtensions.indexOf(path.extname(pathname)) === - 1) {
	header["Content-Length"] = total;
	res.writeHead(200, header);
	if (req.method == "HEAD") {
	res.end();
	return ;
}

	readStream.on('open', function (){
	readStream.pipe(res);
});
	readStream.on('end', function (){
});
	readStream.on('close', function (){
});
	readStream.on('error', function (err){
	res.end(err);
});
}
else {
	var acceptEncoding = req.headers['accept-encoding'] || '';
	if (acceptEncoding.match(/gzip/)) {
	header["Content-Encoding"] = 'gzip';
	res.writeHead(200, header);
	if (req.method == "HEAD") {
	res.end();
	return ;
}

	readStream.on('open', function (){
	readStream.pipe(zlib.createGzip()).pipe(res);
});
	readStream.on('error', function (err){
	res.end(err);
});
}
else if (acceptEncoding.match(/deflate/)) {
	header["Content-Encoding"] = 'deflate';
	res.writeHead(200, header);
	if (req.method == "HEAD") {
	res.end();
	return ;
}

	readStream.on('open', function (){
	readStream.pipe(zlib.createDeflate()).pipe(res);
});
	readStream.on('error', function (err){
	res.end(err);
});
}
else {
	header["Content-Length"] = total;
	res.writeHead(200, header);
	if (req.method == "HEAD") {
	res.end();
	return ;
}

	readStream.on('open', function (){
	readStream.pipe(res);
});
	readStream.on('error', function (err){
	res.end(err);
});
}
}
}
}
else {
	this.notfound(res);
	return ;
}
} else if (req.method === "POST") {
		var postName = sageutils.sanitizedURL(url.parse(req.url).pathname);
		if (postName in this.postFuncs) {
			this.postFuncs[postName](req, res);
			return;
		}
	} else if (req.method === "PUT") {
		// Need some authentication / security here

		var putName = sageutils.sanitizedURL(url.parse(req.url).pathname);
		// Remove the first / if there
		if (putName[0] === '/') {
			putName = putName.slice(1);
		}

		var fileLength = 0;
		var filename   = path.join(this.publicDirectory, "uploads", "tmp", putName);
		var wstream    = fs.createWriteStream(filename);

		wstream.on('finish', function() {
			// stream closed
			sageutils.log('PUT', 'File written', putName, fileLength, 'bytes');
		});
		wstream.on('error', function() {
			// Error during write
			sageutils.log('PUT', 'Error during write for', putName);
		});
		// Getting data
		req.on('data', function(chunk) {
			// Write into output stream
			wstream.write(chunk);
			fileLength += chunk.length;
		});
		// Data no more
		req.on('end', function() {
			// No more data
			sageutils.log('PUT', 'Received:', filename, putName, fileLength, 'bytes');
			// Close the write stream
			wstream.end();
			// empty 200 OK response for now
			var header = _this.buildHeader();
			header["Content-Type"] = "text/html";
			res.writeHead(200, "OK", header);
			res.end();
		});
	}
};

/**
 * Add a HTTP GET handler (i.e. route)
 *
 * @method httpGET
 * @param name {String} matching URL name (i.e. /config)
 * @param callback {Function} processing function
 */
HttpServer.prototype.httpGET = function(name, callback) {
	this.getFuncs[name] = callback;
};

/**
 * Add a HTTP POST handler (i.e. route)
 *
 * @method httpPOST
 * @param name {String} matching URL name (i.e. /upload)
 * @param callback {Function} processing function
 */
HttpServer.prototype.httpPOST = function(name, callback) {
	this.postFuncs[name] = callback;
};

module.exports = HttpServer;

