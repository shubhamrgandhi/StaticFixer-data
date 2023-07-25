// API primary file

// Dependencies
const url = require('url');
const http = require('http');
const config = require('./lib/config');
const handlers = require('./lib/handlers');

function serverCallback(req, res) {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
    'Access-Control-Allow-Headers': '*',
  };

  const { pathname, query: queryStringObject } = url.parse(req.url, true);

  const trimmedPath = pathname.replace(/^\/+|\/+$/g, '');

  const method = req.method.toLowerCase();

  const { headers } = req;

  let body = [];

  req.on('data', chunk => {
    body.push(chunk);
  });

  req.on('end', () => {
    if (method === 'options') {
      res.writeHead(200, responseHeaders);
      res.end();
      return;
    }

    const dataAsString = body.length === 0 ? 'null' : Buffer.concat(body).toString();

    let payload;
    try {
      payload = JSON.parse(dataAsString);
    } catch (error) {
      payload = new Error('Invalid Payload');
    }

    const chosenHandler = !(payload instanceof Error)
      ? handlers[trimmedPath.split('/')[0]] ?? handlers.notFound
      : handlers.invalidPayload;

    const AggregatedData = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload,
    };

    (async () => {
      const { statusCode, returnedData, token = null } = await chosenHandler(AggregatedData);
      res.writeHead(statusCode, responseHeaders);
      let serverResponse = JSON.stringify({ response: returnedData });

      if (token) {
        const dataToSend = JSON.stringify({ ...JSON.parse(serverResponse), newToken: token });

        res.end(dataToSend);
      } else res.end(serverResponse);

      console.log(`Responded with ${serverResponse} with a statusCode of ${statusCode}`);
    })();
  });
}

http.createServer(serverCallback).listen(config.httpPort, () => {
  console.log(`Listening on port ${config.httpPort}`);
});
