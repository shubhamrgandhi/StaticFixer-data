const http = require("http");
const url = require("url");

const controller = require("./controller");

module.exports = http.createServer(function(request, response) {
	const requestUrl = url.parse(request.url, true);
	if (requestUrl.pathname in controller) {
	controller[requestUrl.pathname](request, response);
}

});