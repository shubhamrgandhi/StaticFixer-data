var Url = require('url');

// require node-static
var JohnnysStatic = require('johnnys-node-static'),
  http = require('http'),
  util = require('util');

// set webroot
var port = process.env.PORT || 8080;

// set file variable
JohnnysStatic.setStaticServer({root: "./public"});
JohnnysStatic.setRoutes({
    "/": {
        url: "/html/index.html"
    }
});

var apis = require("./lib/api");

// create server
http.createServer(function(req, res) {

    // get the url
    var pathName = Url.parse(req.url, true).pathname;
    // verify if it doesn't end with '/'
    if (pathName.slice(-1) !== "/") {
        // if yes, add '/'
        pathName += "/";
    }

    // if it exists
    if (JohnnysStatic.exists(req, res)) {

        // serve the file
        JohnnysStatic.serve(req, res, function (err) {

            // not found error
            if (err.code === "ENOENT") {
                res.end("404 - Not found.");
            }

            // other error
            res.end(err.toString());
        });

        return;
    }

    // maybe the route is an api url
    var api = apis[pathName];
    if (typeof api === "function") {
        api(req, res);
        return;
    }

    // serve file
    JohnnysStatic.serveAll(req, res, function(err, result) {
        // check for error
        if (err) {
            res.writeHead(err.status, err.headers);
            res.end();
        } else {
            console.log('%s - %s', req.url, result.message);
        }
    });
}).listen(port);

// print some output
console.log('node-static running at http://localhost:%d', port);
