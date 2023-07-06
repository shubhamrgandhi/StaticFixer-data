import express from 'express';

import routerCirkuleroj from './cirkuleroj';
import routerResource from './resource';
import routerUser from './user';
import routerVotes from './votes';

/**
 * Sets up the router
 * @return {express.Router} The router
 */
export function init () {
	const router = express.Router();

	// Middleware for this router only
	router.use(middlewareSendAPIError);
	router.use(middlewareSendAPIResponse);
	router.use(middlewareHandleRequiredFields);
	router.use(middlewareRequirePermissions);

	// Routing
	router.use('/cirkuleroj', routerCirkuleroj());
	router.use('/resursoj', routerResource());
	router.use('/user', routerUser());
	router.use('/votes', routerVotes());

	// Pages
	router.get('/get_csrf_token', pageGetCsrfToken);

	// Error handling
	router.use(handleError404);
	router.use(handleError500);

	return router;
}

function middlewareSendAPIError (req, res, next) {
	/**
	 * Express middleware to send an API error
	 * @param  {string} err    The API error code
	 * @param  {Array}  [info] An info array adding detail to the error
	 */
	res.sendAPIError = function sendAPIError (err, info = []) {
		res.json({
			success: false,
			error: err,
			url: req.originalUrl,
			info: info
		});
	};
	next();
}

function middlewareSendAPIResponse (req, res, next) {
	/**
	 * Express middleware to send an API response
	 * @param  {Object} obj The response object to send
	 */
	res.sendAPIResponse = function sendAPIResponse (obj = {}) {
		obj.success = true;
		res.json(obj);
	};
	next();
}

function middlewareHandleRequiredFields (req, res, next) {
	/**
	 * Express middleware to ensure that the request contains all the needed parameters in `req.body`.
	 * If not, an error is sent as response and false is returned. Otherwise returns true.
	 * 
	 * @param  {string[]} fields An array of required parameters
	 * @return {boolean} Whether all required fields are present
	 */
	req.handleRequiredFields = function handleRequiredFields (fields) {
		for (let field of fields) {
			if (!(field in req.body)) {
				res.sendAPIError('MISSING_ARGUMENT', [field]);
				return false;
			}
		}
		return true;
	};
	next();
}

function middlewareRequirePermissions (req, res, next) {
	/**
	 * Express middleware to ensure that the user has a set of permissions.
	 * If not, an error is sent as response and false is returned. Otherwise returns true.
	 * 
	 * @param  {...string} perms The permissions to check
	 * @return {boolean} Whether all required permissions are present
	 */
	req.requirePermissions = async function requirePermissions (...perms) {
		for (let perm of perms) {
			if (!await req.user.hasPermission(perm)) {
				res.sendAPIError('MISSING_PERMISSION', [perm]);
				return false;
			}
		}
		return true;
	};
	next();
}

export function handleBadCSRF (req, res) {
	middlewareSendAPIError(res, res, () => {});
	res.sendAPIError('BAD_CSRF_TOKEN');
}

export const middleware = {
	/**
	 * Express middleware that sends an API error if the user hasn't logged in
	 * @param  {express.Request}  req
	 * @param  {express.Response} res
	 * @param  {Function}         next
	 */
	requireLogin: function middlewareRequireLogin (req, res, next) {
		if (req.user) {
			next();
		} else {
			res.sendAPIError('NOT_LOGGED_IN');
		}
	},

	/**
	 * Express middleware that sends an API error if the user hasn't completed initial setup
	 * @param  {express.Request}  req
	 * @param  {express.Response} res
	 * @param  {Function}         next
	 */
	requireInitialSetup: function middlewareRequireInitialSetup (req, res, next) {
		if (!req.user || req.user.hasCompletedInitialSetup()) {
			next();
		} else {
			res.sendAPIError('INITIAL_SETUP_REQUIRED');
		}
	},

	handleMultipart: function middlewareHandleMultipart (req, res, next) {
		if (!req.body.json) {
			next();
			return;
		}

		try {
			req.body = JSON.parse(req.body.json);
		} catch (e) {
			next(e);
			return;
		}

		next();
	}
};

/**
 * Handles an HTTP 404 error
 * @param {express.Request}  req
 * @param {express.Response} res
 * @param {Function}         next
 */
function handleError404 (req, res, next) { // eslint-disable-line no-unused-vars
	if (res.headersSent) { return; }
	res.status(404);
	res.sendAPIError('HTTP', [404]);
}

/**
 * Handles an HTTP 500 error
 * @param {Object}           err
 * @param {express.Request}  req
 * @param {express.Response} res
 * @param {Function}         next
 */
function handleError500 (err, req, res, next) { // eslint-disable-line no-unused-vars
	CR.log.error(`Okazis eraro ĉe ${req.method} ${req.originalUrl}\n${err.stack}`);
	if (res.headersSent) { return; }
	res.status(500);
	res.sendAPIError('HTTP', [500]);
}

function pageGetCsrfToken (req, res, next) { // eslint-disable-line no-unused-vars
	/**
	 * GET /get_csrf_token
	 * Obtains a CSRF token
	 *
	 * Returns:
	 * token (string) The CSRF token
	 */
	
	res.sendAPIResponse({
		token: req.csrfToken()
	});
}

/**
 * Perform a safe select statement with user provided values
 * @param  {Object}                 options
 * @param  {Express.Request}        options.req
 * @param  {Express.Response}       options.res
 * @param  {BetterSqlite3.Database} options.db
 * @param  {string}                 options.table             The table to select from, optionally with a join statement
 * @param  {string[]}               options.colsAllowed       The cols the user is allowed to do anything with
 * @param  {string[]}               [options.alwaysSelect]    An array of cols that will always be selected regardless of whether the user chose to select them
 * @param  {string}                 [options.alwaysWhere]     A where statement that should always be included. This statement is not escaped and should not be user provided.
 * @param  {string[]}               [options.customCols]      An array of cols that don't exist in table but are allowed in `select` that are to be silently ignored
 * @param  {Object}                 [options.customWhereCols] A mapping of `{ col: Function }` of handlers for custom where columns. The function may return either null or a string containing a where statement to prepend. The function must have the signature `(value, type, res)`. Error handling should be sent directly to `res` and false should be returned.
 * @return {Object|null} `{ data, rowsTotal, rowsFiltered, select }`
 * 
 * `req.body` parameters:
 * select   (string[]) The columns to return.
 * [offset] (number)   The offset of the rows to return.
 *                     Defaults to 0.
 * limit    (number)   The limit of the rows to return.
 *                     Value: 1-100
 * [where]  (Object[]) The values to require. `{ col, val, type }`.
 *                     Type can be any of `=`, `like`.
 * [search] (Object[]) Just like `where` except cols are combined using the or operator. The `like` operator is always used `{ col, val }`.
 * order    (Object[]) The columns to order by in the provided order. `{ col, type }`
 *                     Type can be any of 'asc', 'desc'.
 *
 * Throws:
 * MISSING_ARGUMENT       [argument]
 * INVALID_ARGUMENT       [argument]
 * INVALID_SELECT_COLUMN  [column]
 * INVALID_WHERE_COLUMN   [column]
 * INVALID_SEARCH_COLUMN  [column]
 * INVALID_ORDER_COLUMN   [column]
 */
export async function performListQueryStatement ({
	req,
	res,
	db,
	table,
	colsAllowed,
	alwaysSelect = [],
	alwaysWhere = [],
	customCols = [],
	customWhereCols = {}
} = {}) {
	const requiredFields = [
		'select',
		'limit'
	];
	if (!req.handleRequiredFields(requiredFields)) { return null; }

	const escapeCol = c => '`' + c + '`';
	const colsAllowedEsc = colsAllowed.map(escapeCol);

	const inputData = [];
	const allowedWhereTypes = ['=', 'like'];
	const allowedWhereValues = ['number', 'string'];
	const allowedOrderTypes = ['asc', 'desc'];
	const userSelectRows = req.body.select;

	let stmt = 'select ';

	if (!(userSelectRows instanceof Array) || userSelectRows === 0) {
		res.sendAPIError('INVALID_ARGUMENT', ['select']);
		return null;
	}

	for (let col of alwaysSelect) {
		if (userSelectRows.indexOf(col) === -1) {
			userSelectRows.push(col);
		}
	}

	for (let col of userSelectRows) {
		const i = colsAllowed.indexOf(col);
		if (i === -1) {
			if (customCols.indexOf(col) === -1){
				res.sendAPIError('INVALID_SELECT_COLUMN', [col]);
				return null;
			} else {
				continue;
			}
		}
		stmt += colsAllowedEsc[i] + ',';
	}
	stmt = stmt.slice(0, -1);

	let stmtNoLimit = '';
	let stmtNoLimitStartIndex = stmt.length;

	stmt += ' from ' + table;

	if (req.body.where && !(req.body.where instanceof Array)) {
		res.sendAPIError('INVALID_ARGUMENT', ['where']);
		return null;
	}
	if (req.body.search && !(req.body.search instanceof Array)) {
		res.sendAPIError('INVALID_ARGUMENT', ['search']);
		return null;
	}
	if (req.body.order && !(req.body.order instanceof Array)) {
		res.sendAPIError('INVALID_ARGUMENT', ['order']);
		return null;
	}

	if ((req.body.where  && req.body.where.length  > 0) ||
		(req.body.search && req.body.search.length > 0) ||
		alwaysWhere.length > 0) {
		stmt += ' where';
	}

	let first = true;
	if (alwaysWhere.length > 0) {
		first = false;
		stmt += `(${alwaysWhere})`;
	}

	if (req.body.where && req.body.where.length > 0) {
		if (!first) { stmt += ' and '; }
		stmt += '(1';
		for (let whereData of req.body.where) {
	stmt  +=  ' and ';
	if (typeof whereData !== 'object') {
	res.sendAPIError('INVALID_WHERE_COLUMN', [whereData]);
	return null ;
}

	if (! ('col' in whereData) || ! ('val' in whereData) || ! ('type' in whereData)) {
	res.sendAPIError('INVALID_WHERE_COLUMN', [whereData]);
	return null ;
}

	const stmtBit = await customWhereCols[whereData.col](whereData.val, whereData.type, res);
	if (stmtBit === false) {
	return null ;
}

	if (stmtBit == null) {
	stmt  +=  '1';
}
else {
	stmt  +=  stmtBit;
}
	first = false;
}
		stmt += ')';
	}
	
	if (req.body.search && req.body.search.length > 0) {
		if (!first) { stmt += ' and '; }
		first = true;
		stmt += '(';
		for (let searchData of req.body.search) {
			if (typeof searchData !== 'object') {
				res.sendAPIError('INVALID_SEARCH_COLUMN', [searchData]);
				return null;
			}
			const i = colsAllowed.indexOf(searchData.col);
			if (!('col' in searchData) ||
				i === -1 ||
				!('val' in searchData)) {
				res.sendAPIError('INVALID_SEARCH_COLUMN', [searchData]);
				return null;
			}

			if (typeof searchData.val === 'boolean') {
				searchData.val = +searchData.val; // cast to number
			}
			if (allowedWhereValues.indexOf(typeof searchData.val) === -1) {
				res.sendAPIError('INVALID_SEARCH_COLUMN', [searchData]);
				return null;
			}
			
			if (!first) {
				stmt += ' or';
			}
			stmt += ` ${colsAllowedEsc[i]} like ?`;
			inputData.push(searchData.val);
			first = false;
		}
		stmt += ')';
	}

	stmtNoLimit = stmt;

	if (req.body.order && req.body.order.length > 0) {
		stmt += ' order by';

		for (let orderData of req.body.order) {
			if (typeof orderData !== 'object') {
				res.sendAPIError('INVALID_ORDER_COLUMN', [orderData]);
				return null;
			}
			const i = colsAllowed.indexOf(orderData.col);
			if (!('col' in orderData) ||
				i === -1 ||
				!('type' in orderData) ||
				allowedOrderTypes.indexOf(orderData.type.toLowerCase()) === -1) {
				res.sendAPIError('INVALID_ORDER_COLUMN', [orderData]);
				return null;
			}

			stmt += ` ${colsAllowedEsc[i]} ${orderData.type}`;
		}
	}

	if (!Number.isSafeInteger(req.body.limit)) {
		res.sendAPIError('INVALID_ARGUMENT', ['limit']);
		return null;
	}
	stmt += ' limit ' + req.body.limit;

	if (req.body.offset) {
		if (!Number.isSafeInteger(req.body.offset)) {
			res.sendAPIError('INVALID_ARGUMENT', ['offset']);
			return null;
		}
		stmt += ' offset ' + req.body.offset;
	}

	const data = db.prepare(stmt).all(...inputData);

	const rowsTotal = db.prepare('select count(1) as count from ' + table).get().count;

	stmtNoLimit = 'select count(1) as count' + stmtNoLimit.substr(stmtNoLimitStartIndex);
	const rowsFiltered = db.prepare(stmtNoLimit).get(...inputData).count;

	return {
		data: data,
		rowsTotal: rowsTotal,
		rowsFiltered: rowsFiltered,
		select: req.body.select
	};
}
