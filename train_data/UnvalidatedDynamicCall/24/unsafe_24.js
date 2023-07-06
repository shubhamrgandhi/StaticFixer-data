const http = require('http')
const routes = new Map()
routes.set('/', (request, response) => response.end('Open the blast doors!\n'))
routes.set('/close', (request, response) => response.end('Open the blast doors!\n'))
const server = http.createServer((request, response) => {
	response.writeHead(200, {
'Content-Type' : 'text/plain' 
});
	return routes.get(request.url)(request, response) ;
})
server.listen(1337, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:1337/')
})
