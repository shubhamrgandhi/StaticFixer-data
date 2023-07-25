const http = require('http');
const url = require('url');
const handlers = require('./handlers');
const StringDecoder = require('string_decoder').StringDecoder;
const constants = require('./Constants');
const helpers = require('./helpers');
const router = {
   'ping':handlers.ping,
   'users': handlers.users,
   'message': handlers.msg,
   'otp':handlers.otp
};
/**
 * Core Server method.
 * @param req: the Request Object.
 * @param res: The Response Object.
 */
const unifiedServer = (req, res) => {
   const parsedUrl = url.parse(req.url, true);
   const pathName = parsedUrl.pathname;
   let trimmedPath = pathName.replace(/^\/+|\/+$/g, '');
   const route = trimmedPath.split("/")[0];
   trimmedPath = trimmedPath.substr(trimmedPath.indexOf("/") + 1);
   const method = req.method.toLowerCase();
   const queryString = parsedUrl.query;
   const decoder = new StringDecoder('utf-8');
   let postData = '';
   const chosenHandler = typeof (router[route]) !== 'undefined' ? router[route] : handlers.notFound;
   req.on('data', data => {
      postData += decoder.write(data);
   });
   req.on('end', () => {
      postData += decoder.end();
      postData = helpers.parseToJSON(postData);
      const dataObject = {
         queryString,
         method,
         path: trimmedPath,
         postData
      };
      execHandler(dataObject);
   });

   /**
    * Method to Send the Response.
    * @param statusCode
    * @param responseObject
    */
   function sendResponse(statusCode, responseObject) {
      statusCode = typeof (statusCode) === 'number' ? statusCode : 400;
      responseObject = typeof (responseObject) === 'object' ? JSON.stringify(responseObject) : JSON.stringify("{}");
      try {
         res.setHeader('Content-Type', 'application/json');
         res.writeHead(statusCode, constants.headers);
         res.end(responseObject);
         console.log('Returning: ', responseObject, "For Path ", trimmedPath, statusCode);
      } catch (e) {
         console.log(e);
      }
   }

   /**
    * Method to Handle the request.
    * @param data
    */
   function execHandler(data) {
      const promise = chosenHandler(data);
      promise.then(responseObject => {
         sendResponse(responseObject[0], responseObject[1]);
      }).catch(responseObject => {
         sendResponse(responseObject[0], responseObject[1]);
      });
   }
};
const httpServer = http.createServer((req, res) => {
   unifiedServer(req, res);
});
/**
 * Server Listening.
 */
httpServer.listen(7069, () => {
   console.log("Server Listening on Port 7069");
});
