const logger = require('../mod/logger')

const login = require('../mod/user/login')

const register = require('../mod/user/register')

const auth = require('../mod/user/auth')

const saml = process.env.SAML_ENTITY_ID && require('../mod/user/saml')

const workspaceCache = require('../mod/workspace/cache')

const proxy = require('../mod/proxy')

const provider = require('../mod/provider/_provider')

const routes = {
  layer: require('../mod/layer/_layer'),
  location: require('../mod/location/_location'),
  workspace: require('../mod/workspace/_workspace'),
  user: require('../mod/user/_user'),
  view: require('../mod/view'),
  query: require('../mod/query'),
  gazetteer: require('../mod/gazetteer'),
  provider: provider,
}

process.env.COOKIE_TTL = process.env.COOKIE_TTL || 3600

process.env.TITLE = process.env.TITLE || 'GEOLYTIX | XYZ'

process.env.DIR = process.env.DIR || ''

function IEdetect(sUsrAg) {
  if (sUsrAg.indexOf("Firefox") > -1) return false

  if (sUsrAg.indexOf("SamsungBrowser") > -1) return false
  
  if (sUsrAg.indexOf("Opera") > -1 || sUsrAg.indexOf("OPR") > -1) return false
  
  if (sUsrAg.indexOf("Trident") > -1) return true
}

module.exports = async (req, res) => {
	if (process.env.DIR && ! req.url.match(process.env.DIR)) {
	res.setHeader('location', `${process.env.DIR}`);
	return res.status(302).send() ;
}

	if (req.headers && req.headers['user-agent'] && IEdetect(req.headers['user-agent'])) return res.send('Uh Oh... It looks like your request comes from an unsupported user agent (e.g. Internet Explorer)') ;

	logger(req, 'req');
	logger(req.url, 'req_url');
	if (req.url.match(/\/saml/)) {
	if (! saml) return ;

	saml(req, res);
	return ;
}

	req.params = Object.assign(req.params || {

}, req.query || {

});
	if (Object.keys(req.params).some(key => !key.match(/^[A-Za-z0-9_-]*$/))) {
	return res.status(403).send('Query params validation failed.') ;
}

	req.params.language = req.params.language || 'en';
	req.params.template = req.params._template || req.params.template;
	Object.entries(req.params).filter(entry => typeof entry[1] === 'string').forEach(entry => {
      req.params[entry[0]] = decodeURIComponent(entry[1])
    });
	if (req.params.login || req.body && req.body.login) return login(req, res) ;

	if (req.params.register || req.body && req.body.register) return register(req, res) ;

	if (req.params.logout) {
	res.setHeader('Set-Cookie', `${process.env.TITLE}=null;HttpOnly;Max-Age=0;Path=${process.env.DIR || '/'}`);
	res.setHeader('location', req.url && decodeURIComponent(req.url).replace(/logout\=true/, ''));
	return res.status(302).send() ;
}

	const user = await auth(req, res);
	delete req.params.token;
	if (user && user instanceof Error) {
	res.setHeader('Set-Cookie', `${process.env.TITLE}=null;HttpOnly;Max-Age=0;Path=${process.env.DIR || '/'};SameSite=Strict${! req.headers.host.includes('localhost') && ';Secure' || ''}`);
	return login(req, res, user.msg) ;
}

	req.params.user = user;
	const path = req.url.match(/(?<=\/api\/)(.*?)[\/\?]/);
	if (path && path[0] === 'proxy?') return proxy(req, res) ;

	if (path && path[1] === 'user') {
	const msg = routes.user(req, res);
	msg && login(req, res, msg);
	return ;
}

	if (! user && process.env.PRIVATE) {
	if (process.env.SAML_LOGIN) {
	res.setHeader('location', `${process.env.DIR}/saml/login`);
	res.status(302).send();
	return ;
}

	login(req, res);
	return ;
}

	const workspace = await workspaceCache(req);
	if (workspace instanceof Error) return res.status(500).send(workspace.message) ;

	req.params.workspace = workspace;
	if (req.params.template) {
	const template = workspace.templates[req.params.template];
	if (! template) return res.status(404).send('Template not found.') ;

	if (template.err) return res.status(500).send(template.err.message) ;

	if (! user && (template.login || template.admin)) return login(req, res, 'Route requires login') ;

	if (user && (! user.admin && template.admin)) return login(req, res, 'Route requires admin priviliges') ;

	req.params.template = template;
}

	if (path && path[1] && routes[path[1]]) return routes[path[1]](req, res) ;

	routes.view(req, res);
}}