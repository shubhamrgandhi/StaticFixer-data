'use strict';

var connect = require('connect');
var bodyParser = require('body-parser');
var https = require('https');
var timeout = require('connect-timeout');
var _ = require('underscore');

var AV = require('./storage-extra');
var utils = require('./utils');
var frameworks = require('./frameworks');

var NODE_ENV = process.env.NODE_ENV || 'development';

AV.express = function(options) {
  return frameworks(createRootRouter(options), 'express');
};

AV.koa = function(options) {
  return frameworks(createRootRouter(options), 'koa');
};

AV.koa2 = function(options) {
  return frameworks(createRootRouter(options), 'koa2');
};

var Cloud = _.extend(AV.Cloud, require('./cloud'));

// Don't reject unauthorized ssl.
if (https.globalAgent && https.globalAgent.options) {
  https.globalAgent.options.rejectUnauthorized = false;
}

AV.Cloud.CookieSession = function(options) {
  return frameworks(require('../middleware/cookie-session')(AV)(options), options && options.framework);
};

AV.Cloud.HttpsRedirect = function(options) {
  return frameworks(require('../middleware/https-redirect')(AV)(options), options && options.framework);
};

AV.Cloud.LeanCloudHeaders = function(options) {
  return frameworks(require('../middleware/leancloud-headers')(AV)(options), options && options.framework);
};

function createRootRouter(options) {
  var router = connect();

  router.use(require('../middleware/health-check')());

  ['1', '1.1'].forEach(function(apiVersion) {
    router.use('/' + apiVersion + '/call', function(req, res, next) {
      req.rpcCall = true;
      next();
    });

    ['functions', 'call'].forEach(function(urlEndpoint) {
      router.use('/' + apiVersion + '/' + urlEndpoint, createCloudFunctionRouter(options));
    });
  });

  return router;
}

function createCloudFunctionRouter(options) {
  options = options || {};

  var cloudFunctions = connect();

  cloudFunctions.use(timeout(options.timeout || '15s'));
  cloudFunctions.use(bodyParser.urlencoded({extended: false, limit: '20mb'}));
  cloudFunctions.use(bodyParser.json({limit: '20mb'}));
  cloudFunctions.use(bodyParser.text({limit: '20mb'}));
  cloudFunctions.use(require('../middleware/cors')());
  cloudFunctions.use(require('../middleware/leancloud-headers')(AV)({restrict: true}));

  cloudFunctions.use('/_ops/metadatas', function(req, res) {
    if (req.AV.authMasterKey) {
      return responseJson(res, {result: Object.keys(Cloud.functions)});
    } else {
      return utils.unauthResp(res);
    }
  });

  cloudFunctions.use(function(req, res, next) {
    promiseTry( () => {
      if (req.url === '/') {
        throw new Cloud.Error(`No function name or class name: ${req.originalUrl}`, {status: 404, printToLog: true, printFullStack: false});
      }

      const urlParams = req.url.split('/');
      const functionOrClass = urlParams[1];
      const hookName = urlParams[2];

      if (!hookName) {
        return callCloudFunction(req, functionOrClass, options);
      } else if (functionOrClass === 'onVerified') {
        return callUserHook(req, 'onVerified', hookName);
      } else if (functionOrClass === '_User' && _.contains(['onLogin', 'onAuthData'], hookName)) {
	return callUserHook(req, hookName, '_User') ;
}
else if ((functionOrClass === 'BigQuery' || functionOrClass === 'Insight') && hookName === 'onComplete') {
	return onCompleteBigQueryJob(req) ;
}
else {
	return callClassHook(req, functionOrClass, hookName) ;
}
    }).then( response => {
      responseJson(res, response);
    }).catch( err => {
      var statusCode;

      if (err instanceof Error) {
        statusCode = err.status || err.statusCode || 500;
      } else {
        statusCode = 400;
      }

      if (statusCode === 500 || err.printToLog) {
        if (options.printFullStack !== false && err.printFullStack !== false) {
          console.warn(`LeanEngine: ${req.url}: ${statusCode}: ${err.stack || err.message}`);
        } else {
          console.warn(`LeanEngine: ${req.url}: ${statusCode}: ${err.name}: ${err.message}`);
        }
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
        res.statusCode = statusCode;

        res.end(JSON.stringify({
          code: err.code || 1,
          error: err.message || err.responseText || err || 'unknown error'
        }));
      }

      options.onError && options.onError(err);
    });
  });

  cloudFunctions.use(function(err, req, res, next) { // jshint ignore:line
    if(req.timedout) {
      console.error(`LeanEngine: ${req.originalUrl}: function timeout (${err.timeout}ms)`);
      err.code = 124; // https://leancloud.cn/docs/error_code.html#_124
      err.message = 'The request timed out on the server.';
    }
    responseError(res, err);
  });

  return cloudFunctions;
}

function callCloudFunction(req, funcName, options) {
  const cloudFunction = Cloud.functions[funcName];

  if (!cloudFunction) {
    throw new Cloud.Error(`No such cloud function '${funcName}'`, {status: 404, printToLog: true, printFullStack: false});
  }

  if (cloudFunction.internal) {
    checkInternal(req);
  }

  if (_.contains(_.values(utils.realtimeHookMapping), funcName)) {
    checkHookKey(req);
  }

  var params = req.body;

  if (req.rpcCall) {
    params = decodeParams(params);
  }

  return promiseTry( () => {
    if (cloudFunction.fetchUser !== false && req.AV.sessionToken && req.AV.sessionToken !== '') {
      return AV.User.become(req.AV.sessionToken).catch( err => {
        if (options.ignoreInvalidSessionToken) {
          return;
        }

        if (err.code === 211) {
          throw new Cloud.Error(`Verify sessionToken failed, maybe login expired: ${err.message}`, {status: 401, code: 211});
        } else {
          throw err;
        }
      });
    }
  }).then( user => {
    const request = utils.prepareRequestObject({req, user, params});

    if (cloudFunction.length === 2) {
      return new Promise( (resolve, reject) => {
        const response = utils.prepareResponseObject(req.res, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });

        cloudFunction(request, response);
      });
    } else {
      return cloudFunction(request);
    }
  }).then( result => {
    if (req.rpcCall) {
      return {result: encodeResult(result)};
    } else {
      return {result};
    }
  });
}

function callClassHook(req, className, hookName) {
  const hookFunction = Cloud.functions[utils.hookNameMapping[hookName] + className];
  const hookType = hookName.indexOf('before') === 0 ? 'before' : 'after';

  checkHookKey(req);

  if (!hookFunction) {
    throw new Cloud.Error(`No ${hookName} hook of '${className}'`, {status: 404, printToLog: true, printFullStack: false});
  }

  const object = decodeParams(_.extend({}, req.body.object, {
    __type: 'Object',
    className: className
  }));

  if (req.body.object._updatedKeys) {
    object.updatedKeys = req.body.object._updatedKeys;
  }

  if (hookType === 'before') {
    object.disableBeforeHook();
  } else {
    object.disableAfterHook();
  }

  const user = decodeUser(req.body.user);
  const request = utils.prepareRequestObject({req, object, user});

  return new Promise( (resolve, reject) => {
    if (hookType == 'before' && hookFunction.length == 2) {
      hookFunction(request, utils.prepareResponseObject(req.res, err => {
        if (err) {
          reject(err);
        } else if (hookName === 'beforeDelete') {
          resolve({});
        } else {
          resolve(_.omit(object._toFullJSON(), ['__type', 'className']));
        }
      }));
    } else {
      promiseTry(hookFunction.bind(null, request)).then( () => {
        if (hookType === 'after') {
          resolve({result: 'ok'});
        } else {
          resolve(_.omit(object._toFullJSON(), ['__type', 'className']));
        }
      }).catch(reject);
    }
  });
}

function callUserHook(req, hookName, verifyType) {
  const userHookFunction = Cloud.functions[utils.hookNameMapping[hookName] + verifyType];

  checkHookKey(req);

  if (!userHookFunction) {
    throw new Cloud.Error(`No such hook: ${hookName}`, {status: 404, printToLog: true, printFullStack: false});
  }

  const user = decodeUser(req.body.object);

  const request = utils.prepareRequestObject({
    req: req,
    user: user,
    object: user
  });

  if (req.body.authData) {
    request.authData = req.body.authData;
  }

  return new Promise( (resolve, reject) => {
    if (hookName === 'onLogin' && userHookFunction.length === 2) {
      userHookFunction(request, utils.prepareResponseObject(req.res, err => {
        if (err) {
          reject(err);
        } else {
          resolve({result: 'ok'});
        }
      }));
    } else {
      promiseTry(userHookFunction.bind(null, request)).then( result => {
        if (hookName === 'onAuthData') {
          resolve({result});
        } else {
          resolve({result: 'ok'});
        }
      }).catch(reject);
    }
  });
}

function onCompleteBigQueryJob(req) {
  checkHookKey(req);

  return promiseTry(Cloud.functions['__on_complete_bigquery_job'].bind(null, req.body));
}

const decodeParams = AV._decode;

function encodeResult(result) {
  var encodeAVObject = function(object) {
    if (object && object.toFullJSON){
      object = object.toFullJSON();
    }

    return _.mapObject(object, function(value) {
      return AV._encode(value, []);
    });
  };

  if (_.isArray(result)) {
    return result.map(function(object) {
      return encodeAVObject(object);
    });
  } else {
    return encodeAVObject(result);
  }
};

function responseJson(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=UTF-8');
  res.statusCode = 200;
  return res.end(JSON.stringify(data));
}

function responseError(res, err) {
  res.setHeader('Content-Type', 'application/json; charset=UTF-8');
  res.statusCode = err.status || err.statusCode || 400;
  res.end(JSON.stringify({
    code: err.code || 1,
    error: err && (err.message || err.responseText || err) || 'null message'
  }));
}

function checkHookKey(req) {
  if (req.headers['x-lc-hook-key'] !== AV.hookKey) {
    throw new Cloud.Error(`Hook key check failed, request from ${utils.getRemoteAddress(req)}`, {
      status: 401, code: 401, printToLog: true, printFullStack: false
    });
  }
}

function checkInternal(req) {
  if (req.headers['x-lc-hook-key'] !== AV.hookKey && !req.AV.authMasterKey) {
    throw new Cloud.Error(`Internal cloud function, request from ${utils.getRemoteAddress(req)}`, {
      status: 401, code: 401, printToLog: true, printFullStack: false
    });
  }
}

function decodeUser(requestUser) {
  if (requestUser) {
    const user = new AV.User();
    user._finishFetch(requestUser, true);
    return user;
  }
}

function promiseTry(func) {
  return new Promise( (resolve, reject) => {
    try {
      Promise.resolve(func()).then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = AV;
