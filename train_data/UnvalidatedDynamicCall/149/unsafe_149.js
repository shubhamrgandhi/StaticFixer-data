'use strict';

const debug = require('debug')('protocol-handler');
const pCatchIf = require('p-catch-if');
const pTry = require('p-try');

const reProtocol = /^([a-z0-9.+-]+:)/i;
const BLACKLISTED_PROTOCOLS = ['http:', 'https:', 'file:', 'blob:', 'about:'];

const defineProperty = (obj, name, value) => Object.defineProperty(obj, name, { value });
const isProtocolRelative = url => url.trim().startsWith('//');

/**
 * Custom error indicating invalid, unknown or blacklisted protocol
 * @augments Error
 */
class ProtocolError extends Error {
  /**
   *
   * @param {ProtocolError.code} code Error code
   * @param {String} message Error message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message
    };
  }
}
defineProperty(ProtocolError.prototype, 'name', ProtocolError.name);
/**
 * @typedef {Object} ProtocolError.code
 * @property {Number} ERR_PROTOCOL_INVALID
 * @property {Number} ERR_PROTOCOL_UNKNOWN
 * @property {Number} ERR_PROTOCOL_BLACKLISTED
 */
ProtocolError.ERR_PROTOCOL_INVALID = -1;
ProtocolError.ERR_PROTOCOL_UNKNOWN = 1;
ProtocolError.ERR_PROTOCOL_BLACKLISTED = 2;

/**
 * Create protocol handler
 * @class
 */
class ProtocolHandler {
  /**
   * @constructor
   * @param {ProtocolHandlerOptions} [options={}] protocol handler options
   */
  constructor({ blacklist = [] } = {}) {
    this._blacklist = [...BLACKLISTED_PROTOCOLS, ...blacklist];
    this._handlers = new Map();
  }

  /**
   * Registers protocol handler
   * @param {String} scheme protocol scheme
   * @param {ProtocolCallback} handler protocol handler
   * @returns {ProtocolHandler} instance to allow chaining
   * @throws {ProtocolError} throws if protocol scheme is invalid or blacklisted
   *
   * @example
   * // register multiple handlers
   * const handler = new ProtocolHandler();
   * handler
   *   .protocol('s3://', resolve)
   *   .protocol('gdrive://', resolve);
   */
  protocol(scheme, handler) {
    debug('atempt register scheme: %s', scheme);
    const protocol = getProtocol(scheme);
    if (!protocol) {
      throw new ProtocolError(
        ProtocolError.ERR_PROTOCOL_INVALID,
        `Invalid protocol: \`${scheme}\``
      );
    }
    debug('protocol=%s', protocol);
    if (this._blacklist.includes(protocol)) {
      throw new ProtocolError(
        ProtocolError.ERR_PROTOCOL_BLACKLISTED,
        `Registering handler for \`${scheme}\` is not allowed.`
      );
    }
    this._handlers.set(protocol, handler);
    debug('scheme registered: %s', scheme);
    return this;
  }

  /**
   * @property {Set<String>} protocols registered protocols
   *
   * @example
   * // check if protocol is registered
   * const handler = new ProtocolHandler();
   * handler.protocol('s3://', resolve);
   * console.log(handler.protocols.has('s3:'));
   * //=> true
   */
  get protocols() {
    return new Set(this._handlers.keys());
  }

  async _resolve(url) {
	debug('url=%s', url);
	const protocol = getProtocol(url);
	if (! protocol) {
	throw new ProtocolError(ProtocolError.ERR_PROTOCOL_INVALID)
}

	debug('protocol=%s', protocol);
	const handler = this._handlers.get(protocol);
	if (handler) {
	const resolvedUrl = await pTry(() => handler(url));
	debug('resolved url=%s', resolvedUrl || '');
	return resolvedUrl ;
}

	if (this._blacklist.includes(protocol)) {
	throw new ProtocolError(ProtocolError.ERR_PROTOCOL_BLACKLISTED)
}

	throw new ProtocolError(ProtocolError.ERR_PROTOCOL_UNKNOWN)
}

  /**
   * Asynchronously resolves url with registered protocol handler
   * @param {String} url target url
   * @returns {Promise<String>} resolved url, redirect location
   * @throws {ProtocolError} throws if url contains invalid or unknown protocol
   *
   * @example
   * // create handler
   * const handler = new ProtocolHandler();
   * handler.protocol('s3://', url => 'https://example.com');
   * // resolve url
   * handler.resolve('s3://test').then(url => console.log(url));
   * //=> https://example.com
   * handler.resolve('file:///local/file.txt').then(url => console.log(url));
   * //=> file:///local/file.txt
   * handler.resolve('dummy://unknown/protocol');
   * //=> throws ProtocolError
   */
  resolve(url) {
    return this._resolve(url).catch(pCatchIf(isBlacklisted, () => url));
  }

  /**
   * Returns [Express](https://expressjs.com) middleware
   * @param {String} [param='url'] name of query param containing target url
   * @param {ProtocolErrorCallback} [cb] custom error handling callback
   * @param {import('@types/express').RequestHandler} Express middleware
   *
   * @example
   * // create handler
   * const handler = new ProtocolHandler();
   * handler.protocol('s3://', resolve);
   * // attach to express app
   * app.use(handler.middleware());
   */
  middleware(param = 'url', cb) {
    return async (req, res, next) => {
      const url = decodeURIComponent(req.query[param]);
      try {
        const redirectUrl = await this._resolve(url, null);
        debug('redirect url=%s', redirectUrl || '');
        return res.redirect(redirectUrl);
      } catch (err) {
        if (!(err instanceof ProtocolError)) return next(err);
        if (cb) return cb(err, url, res);
        if (isBlacklisted(err)) return res.redirect(url);
        res.status(400).json({ error: err });
      }
    };
  }
}

/**
 * Create new ProtocolHandler instance
 * @name module.exports
 * @param {ProtocolHandlerOptions} [options={}] protocol handler options
 * @returns {ProtocolHandler} instance
 *
 * @example
 * const handler = require('custom-protocol-handler')();
 */
module.exports = options => new ProtocolHandler(options);
module.exports.ProtocolHandler = ProtocolHandler;
module.exports.ProtocolError = ProtocolError;

function getProtocol(str) {
  const match = str.trim().match(reProtocol);
  return match && match[0];
}

function isBlacklisted(err) {
  return err instanceof ProtocolError &&
    err.code === ProtocolError.ERR_PROTOCOL_BLACKLISTED;
}

/**
 * @typedef {Object} ProtocolHandlerOptions
 * @property {Array<String>} [blacklist=[]] array of blacklisted schemes
 */

/**
 * Resolver function for specific protocol
 * @callback ProtocolCallback
 * @param {String} url target url
 * @returns {String|Promise<String>} resolved url _redirect location_
 *
 * @example
 * // Resolve gdrive urls
 * const { fetchInfo } = require('gdrive-file-info');
 *
 * async function resolve(url) {
 *   const itemId = new URL(url).pathname;
 *   const fileInfo = await fetchInfo(itemId);
 *   return fileInfo.downloadUrl;
 * }
 */

/**
 * Custom error calback for Express middleware
 * @callback ProtocolErrorCallback
 * @param {ProtocolError} err protocol error
 * @param {String} url target url
 * @param {import('@types/express').Response} res middleware response
 *
 * @example
 * const handler = new ProtocolHandler();
 * handler.protocol('s3://', resolve);
 * // Act as passthrough proxy for blacklisted protocols
 * app.use(handler.middleware('url', (err, url, res) => {
 *   if (err.code !== ProtocolError.ERR_PROTOCOL_BLACKLISTED) {
 *     return res.sendStatus(400);
 *   }
 *   res.redirect(url);
 * }));
 */
