var http = require('http'),
    URL = require("url"),
    qs = require("querystring"),
    host = 'localhost',
    port = 1337,
    paths = {},
    server;

server = http.createServer(function (req, res) {
	var url = URL.parse(req.url, true), uri = decodeURIComponent(url.pathname), postData = '';
	if (req.method === 'POST') {
	req.on('data', function (chunk){
	postData  +=  chunk.toString();
});
	req.on('end', function (){
	if (! req.headers['content-type'] || req.headers['content-type'].indexOf('multipart') !== 0) postData = qs.parse(postData);

	paths[uri](url, req, res, postData);
});
}
else {
	paths[uri](url, req, res);
}
});

server.on('error', function () {
    console.log("ERROR:", error);
});

server.listen(port);

module.exports = function (path, cb) {
    if (paths[path]) {
        throw new Error("Path " + path + " exists");
    }

    paths[path] = cb;
};

module.exports.host = host;
module.exports.port = port;
module.exports.close = function () {
    server.close();
};
