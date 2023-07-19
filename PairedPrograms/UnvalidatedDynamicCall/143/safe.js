const http         = require('http'),
      fs           = require('fs'),
      path         = require('path'),
      contentTypes = require('./utils/content-types'),
      sysInfo      = require('./utils/sys-info'),
      env          = process.env;

let server = http.createServer(function (req, res) {
  let url = req.url;
  if (url == '/') {
    url += 'index.html';
  }

  // IMPORTANT: Your application HAS to respond to GET /health with status 200
  //            for OpenShift health monitoring

  if (url == '/health') {
	res.writeHead(200);
	res.end();
}
else if (url == '/info/gen' || url == '/info/poll') {
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Cache-Control', 'no-cache, no-store');
	res.end(JSON.stringify(sysInfo[url.slice(6)]()));
}

});

server.listen(env.NODE_PORT || 3000, env.NODE_IP || 'localhost', function () {
  console.log(`Application worker ${process.pid} started...`);
});
