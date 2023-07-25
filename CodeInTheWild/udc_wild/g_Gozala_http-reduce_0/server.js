"use strict";

var http = require("http")
var server = http.createServer(function(request, response) {
  var route = routes[request.url] || routes["404"]
  response.setHeader("Access-Control-Allow-Origin", "*")
  route(request, response)
})
server.listen(8082)

var routes = {
  "404": function(request, response) {
    response.writeHead(404, { "Content-Type": "text/plain" })
    response.end("Not Found")
  },
  "/": function(request, response) {
    response.writeHead(200, { "Content-Type": "text/html" })
    response.end("<html><body></body></html>")
  },
  "/exit": function(request, response) {
    response.end("bye bye")
    request.on("close", process.exit)
    server.close()
  },
  "/get": function(request, response) {
    response.setHeader("content-type", "text/plain")
    response.end("boop")
  },
  "/post": function(request, response) {
    response.setHeader("content-type", "text/plain")
    var data = ""
    request.on("data", function(chunk) { data += chunk.toString() })
    request.on("end", function () {
      var n = parseInt(data, 10) + 1
      response.end(n.toString())
    })
  },
  "/head": function(request, response) {
    response.setHeader("content-type", "text/plain")
    response.setHeader("foo", "bar")
    response.setHeader("bling", request.headers.bling + "-blong")

    response.end("bye")
  },
  "/stream": function(request, response) {
    var data = [
      { index: 1, data: "hello" },
      { index: 2, data: "world" },
      { index: 3, data: "bye" }
    ]

    response.writeHead(200, { "Content-Type": "application/json" })

    setTimeout(function next(index) {
      if (index < data.length) {
        response.write(JSON.stringify(data[index]) + "\n")
        setTimeout(next, 100, index + 1)
      } else {
        response.end()
      }
    }, 100, 0)
  }
}
