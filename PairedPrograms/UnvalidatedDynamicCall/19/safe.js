/*
    ████████████████████████████████████████████████████████████████████████████████████████████████████
    * Name          :   NodeTest.Server
    * Version       :   @package.js.version
    * Description   :   NodeTest Server Application
    * Author        :   Azmi ŞAHİN <bilgi@azmisahin.com>
    * Licence       :   MIT
    ════════════════════════════════════════════════════════════════════════════════════════════════════
    * Package       :   No Package / Web Application
    * Repository    :   https://bitbucket.org/azmisahin/node1
    * Homepage      :   https://azmisahin.bitbucket.io
    ████████████████████████████████████████████████████████████████████████████████████████████████████
*/

console.log("Server Application Start");

/**
 * View Engine
 * Server Engine
 * @public
 */
var ViewEngine = require('./engine.js');

/**
 * Http Library
 * 
 * 
 */
var http = require('http');

/**
 * File System Library
 * 
 * 
 */
var fs = require('fs');

/**
 * Url Library
 * 
 * 
 */
var url = require('url');

// Global Define

/**
 * Request Url
 */
var requestUrl;

/**
 * Request Object
 */
var request;

/**
 * Response Object
 */
var response;

/**
 * Server Process
 */
var serverProcess = { count: 0 };  // Server Request Response COUNT    

/**
 * Routing
 */
var Routing = {
    home: function () { action("home", "index"); },
    account: function () { action("account", "index"); },
    error: function () { action("error", "index"); }
}

var routingTable = { "/": Routing.home, "/account": Routing.account, "/error": Routing.error };


/**
 * Log
 * @param str A string message.
 * 
 */
function log(str) {
    console.log(str);
}

/**
 * Page Not Found
 *
 * 
 */
function pageNotFound() {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.write("404 Not found");
    response.end();
}

/**
 * Is Static File
 * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
 * 
 */
function isStaticFile(path) {
    return false;
}

/**
 * Controller Action
 * @param controller A Busunes.
 * @param action A view page action.
 * 
 */
function action(controller, action) {

    // Full Path
    var fullPath = ViewEngine.areas.client.url() + controller + "/" + action + ".html";

    // Log
    log("Action:" + action);
    log("Controller:" + controller);

    // Open a File
    openFile(fullPath);
}

/**
 * Open a File
 * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
 * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
 */
function openFile(path) {

    // Log
    log("Open File Path:" + path);

    // Read  file block
    fs.readFile(path, function (err, data) {

        //Write a Browser
        response.write(data);
        // Finaly Message
        response.end();

    });
}

/**
 * Open a File Static.
 * @param requesr A server response.
 * 
 */
function openFileStatic(request) {
    log("Static File Open:" + request.url);
};
/**
 * Server Object
 * Create a Server
 * 
 */
var server = http.createServer(function (req, res) {
	serverProcess.count  +=  1;
	log("Proc:" + serverProcess.count);
	log("----------");
	request = req;
	response = res;
	log("Server Request & Response");
	if (request.url in routingTable) {
	routingTable[request.url]();
}

	log("----------");
});

/**
 * Server Listining
 * @param port A server listening port.
 * 
 */
server.listen(process.env.PORT || 8000);