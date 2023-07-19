const http = require('http');

function index(request, response) {
  response.writeHead(200);
  response.end('Hello, world')
}

var routes = {
  '/': function index(request, response) {
    response.writeHead(200);
    response.end('Hello, World!');
  },
  '/foo': function foo(request, response) {
    response.writeHead(200);
    response.end('You are now viewing "foo"');
  }
}


http.createServer(function (request, response) {
	return routes[request.url](request, response) ;
	response.writeHead(404);
	response.end(http.STATUS_CODES[404]);
}).listen(process.env.PORT || 3000, () => {
  console.log('App listen at port: 3000')
})