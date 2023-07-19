const EXPRESS = require('express');
const BASICAUTH = require('express-basic-auth');
const BCRYPT = require('bcrypt');
const HANDLEBARS = require('handlebars');
const FS = require('fs');
const ACCESSORY = require('./accessories/Types');
const UTIL = require('./util');
const CONFIG = require(UTIL.ConfigPath);
const COOKIEPARSER = require('cookie-parser');
const COOKIE = require('cookie');
const PATH = require('path');
const OS = require('os');
const ROUTING = require('./routing');
const QRCODE = require('qrcode');
const HAPPackage = require('hap-nodejs/package.json');
const RouterPackage = require('../package.json');
const RateLimiter = require('express-rate-limit');
const WS = require('ws');

const Server = function (Accesories, Bridge, RouteSetup, AccessoryIniter) {
	// Vars
	const _ConfiguredAccessories = Accesories;
	const _Bridge = Bridge;
	const _RouteSetup = RouteSetup;
	const _AccessoryInitializer = AccessoryIniter;

	let _RestartRequired = false;

	// Template Files
	const Templates = {
		Login: PATH.join(UTIL.RootAppPath, 'ui/login.html'),
		Main: PATH.join(UTIL.RootAppPath, 'ui/main.html'),
		Settings: PATH.join(UTIL.RootAppPath, '/ui/settings.html'),
		Accessories: PATH.join(UTIL.RootAppPath, '/ui/accessories.html'),
		AccessorTypes: PATH.join(UTIL.RootAppPath, '/ui/accessorytypes.html'),
		NewAccessory: PATH.join(UTIL.RootAppPath, '/ui/createaccessory.html'),
		EditAccessory: PATH.join(UTIL.RootAppPath, '/ui/editaccessory.html'),
		Bridge: PATH.join(UTIL.RootAppPath, '/ui/bridge.html'),
		Routes: PATH.join(UTIL.RootAppPath, '/ui/routing.html'),
		RouteTypes: PATH.join(UTIL.RootAppPath, '/ui/routetypes.html'),
		CreateRoute: PATH.join(UTIL.RootAppPath, '/ui/createroute.html'),
		EditRoute: PATH.join(UTIL.RootAppPath, '/ui/editroute.html')
	};

	HANDLEBARS.registerHelper('eq', function (a, b, options) {
		if (a === b) {
			return options.fn(this);
		} else {
			return options.inverse(this);
		}
	});

	const CompiledTemplates = {};
	let RouteStatusSocket;
	const WSClients = {};
	const CookieKey = BCRYPT.genSaltSync(10);

	this.SendRouteStatus = function (status) {
		const Clients = Object.keys(WSClients);
		for (let i = 0; i < Clients.length; i++) {
			const Client = WSClients[Clients[i]];
			Client.send(JSON.stringify(status));
		}
	};

	// Start Server
	this.Start = function (CB) {
		console.log('Starting Web Server');
		console.log(' ');

		const TemplateKeys = Object.keys(Templates);

		// Compile TPLs
		for (let i = 0; i < TemplateKeys.length; i++) {
			CompiledTemplates[TemplateKeys[i]] = HANDLEBARS.compile(
				FS.readFileSync(Templates[TemplateKeys[i]], 'utf8')
			);
		}

		// Express
		const app = EXPRESS();

		// Middlewares
		const IOLimiter = RateLimiter({
			windowMs: 2500,
			max: 100
		});

		app.use(IOLimiter);
		app.use(EXPRESS.json());
		app.use(COOKIEPARSER(CookieKey));

		// Route Status Socket
		RouteStatusSocket = new WS.Server({
			port: parseInt(CONFIG.webInterfacePort) + 1
		});

		function noop() {}
		function heartbeat() {
			this.isAlive = true;
		}

		RouteStatusSocket.on('connection', (Socket, Request) => {
			if (_CheckAuth(Request)) {
				Socket.isAlive = true;
				Socket.on('pong', heartbeat);
				WSClients[Request.socket.remoteAddress] = Socket;
			} else {
				Socket.send("Well that's uncalled for!");
				Socket.terminate();
			}
		});

		setInterval(() => {
			const Clients = Object.keys(WSClients);
			for (let i = 0; i < Clients.length; i++) {
				const Client = WSClients[Clients[i]];
				if (!Client.isAlive) {
					Client.terminate();
					delete WSClients[Clients[i]];
				} else {
					Client.isAlive = false;
					Client.ping(noop);
				}
			}
		}, 30000);

		// UI
		app.use(
			'/ui/static',
			EXPRESS.static(PATH.join(UTIL.RootAppPath, 'ui/static'))
		);
		app.get('/ui/qrcode/', _DOQRCode);
		app.get('/', _Redirect);
		app.get('/ui/resources/accessoryicon/', _DoAccessoryIcon);
		app.get('/ui/resources/routeicon/', _DoRouteIcon);
		app.get('/ui/pairstatus/:ID', _DoCheckPair);
		app.get('/ui/login', _Login);
		app.post('/ui/login', _DoLogin);
		app.get('/ui/main', _Main);
		app.get('/ui/settings', _Settings);
		app.post('/ui/settings', _DoSettings);
		app.get('/ui/accessories', _Accessories);
		app.get('/ui/availableactypes', _ListAccessoryesTypes);
		app.get('/ui/createaccessory/:type', _CreateAccessory);
		app.post('/ui/createaccessory/:type', _DoCreateAccessory);
		app.get('/ui/editaccessory/:id', _EditAccessory);
		app.post('/ui/editaccessory/:id', _DoEditAccessory);
		app.get('/ui/routing', _Routes);
		app.get('/ui/routetypes', _RouteTypes);
		app.get('/ui/createroute', _CreateRoute);
		app.post('/ui/createroute', _DoCreateRoute);
		app.get('/ui/editroute', _EditRoute);
		app.post('/ui/editroute', _DoEditRoute);
		app.get('/ui/bridge', _BridgeWEB);
		app.post('/ui/bridge', _DoBridgeConfig);
		app.get('/ui/delete', _DoDeletion);
		app.get('/ui/accessoryaction', _DoAccessoryAction);

		app.get('/ui/backup', _DoBackup);
		app.post('/ui/restore', _DoRestore);

		// API
		app.get(
			'/api/accessories',
			BASICAUTH({
				authorizer: Authorizer,
				challenge: true,
				realm: 'HAP Router API'
			}),
			_APIAccessories
		);
		app.get(
			'/api/accessories/:ID',
			BASICAUTH({
				authorizer: Authorizer,
				challenge: true,
				realm: 'HAP Router API'
			}),
			_APIAccessory
		);
		app.post(
			'/api/accessories/:ID',
			BASICAUTH({
				authorizer: Authorizer,
				challenge: true,
				realm: 'HAP Router API'
			}),
			_APIAccessorySet
		);

		try {
			if (CONFIG.webInterfaceAddress === 'ALL') {
				app.listen(CONFIG.webInterfacePort);
			} else {
				app.listen(CONFIG.webInterfacePort, CONFIG.webInterfaceAddress);
			}
		} catch (err) {
			console.log('Could not start Web Server : ' + err);
			process.exit(0);
		}

		CB();
	};

	function Authorizer(username, password) {
		return (
			CONFIG.loginUsername === username &&
			BCRYPT.compareSync(password, CONFIG.loginPassword)
		);
	}

	function _DoBackup(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const DATA = UTIL.performBackup();

		res.contentType('application/json');
		res.setHeader(
			'Content-Disposition',
			'attachment; filename=HAPRouter.backup.json'
		);
		res.send(DATA);
	}

	function _DoRestore(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		if (UTIL.restoreBackup(req.body)) {
			res.contentType('application/json');
			res.send({ success: true });
			process.exit(0);
		} else {
			res.contentType('application/json');
			res.send({ success: false });
		}
	}

	function _DoAccessoryAction(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const ID = req.query.aid;
		const Method = req.query.method;

		if (_ConfiguredAccessories[ID][Method] !== undefined) {
	if (typeof _ConfiguredAccessories[ID][Method] === 'function') {
	_ConfiguredAccessories[ID][Method]();
}

	res.contentType('application/json');
	res.send({
success : true 
});
} else {
			res.contentType('application/json');
			res.send({ success: false });
		}
	}

	// API - All Accessories
	function _APIAccessories(req, res) {
		const Response = [];

		CONFIG.accessories.forEach((AC) => {
			const Accessory = {
				AccessoryID: AC.username.replace(/:/g, ''),
				AccessoryType: ACCESSORY.Types[AC.type].Label,
				AccessoryName: AC.name,
				AccessorySerialNumber: AC.serialNumber,
				Manufacturer: AC.manufacturer,
				Model: AC.model,
				Bridged: AC.bridged,
				Characteristics:
					_ConfiguredAccessories[AC.username.replace(/:/g, '')].getProperties()
			};

			Response.push(Accessory);
		});

		res.contentType('application/json');
		res.send(Response);
	}

	// API -  Accessory
	function _APIAccessory(req, res) {
		const Response = [];

		CONFIG.accessories
			.filter((AC) => AC.username.replace(/:/g, '') === req.params.ID)
			.forEach((AC) => {
				const Accessory = {
					AccessoryID: AC.username.replace(/:/g, ''),
					AccessoryType: ACCESSORY.Types[AC.type].Label,
					AccessoryName: AC.name,
					AccessorySerialNumber: AC.serialNumber,
					Manufacturer: AC.manufacturer,
					Model: AC.model,
					Bridged: AC.bridged,
					Characteristics:
						_ConfiguredAccessories[
							AC.username.replace(/:/g, '')
						].getProperties()
				};

				Response.push(Accessory);
			});

		res.contentType('application/json');
		res.send(Response);
	}

	// API -  Accessory Set
	function _APIAccessorySet(req, res) {
		const Accessory = _ConfiguredAccessories[req.params.ID];

		if (Accessory === undefined) {
			res.contentType('application/json');
			res.send({ success: false });
		} else {
			try {
				Accessory.setCharacteristics(req.body);
				res.contentType('application/json');
				res.send({ success: true });
			} catch (Er) {
				res.contentType('application/json');
				res.send({ success: false });
			}
		}
	}

	function _DoDeletion(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Type = req.query.what;
		const ID = req.query.id;

		switch (Type) {
			case 'accessory':
				DeleteAccessory(ID, true);
				res.contentType('application/json');
				res.send({ success: true });
				break;

			case 'route':
				res.contentType('application/json');
				delete CONFIG.routes[ID];
				UTIL.deleteRoute(ID);
				_RouteSetup();
				res.send({ success: true });
				break;
		}
	}

	// edit Route
	function _EditRoute(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const ID = req.query.name;
		const RC = CONFIG.routes[ID];
		const Type = ROUTING.Routes[RC.type];

		const Settings = [];
		Type.Inputs.forEach((RI) => {
			const I = {
				label: RI.label,
				id: RI.id,
				value: RC[RI.id]
			};
			if (RI.hasOwnProperty('type')) {
				I.type = RI.type;
			} else {
				I.type = 'text';
			}
			Settings.push(I);
		});

		const HTML = CompiledTemplates['EditRoute']({
			Settings: Settings,
			name: ID,
			type: RC.type,
			inUse: CONFIG.accessories.filter((AC) => AC.route === ID).length > 0,
			description: Type.Description
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	// Do edit route
	function _DoEditRoute(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const NRD = req.body;
		const Name = NRD.name;
		const ORD = CONFIG.routes[Name];

		delete NRD.name;
		NRD.type = ORD.type;

		CONFIG.routes[Name] = NRD;
		UTIL.updateRouteConfig(Name, NRD);

		_RouteSetup();

		res.contentType('application/json');
		res.send({ success: true });
	}

	// Create Route
	function _CreateRoute(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Settings = [];
		const RP = ROUTING.Routes[req.query.type];
		RP.Inputs.forEach((RI) => {
			const I = {
				label: RI.label,
				id: RI.id
			};
			if (RI.hasOwnProperty('type')) {
				I.type = RI.type;
			} else {
				I.type = 'text';
			}
			Settings.push(I);
		});

		const HTML = CompiledTemplates['CreateRoute']({
			type: req.query.type,
			Settings: Settings,
			description: RP.Description
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	// Do Create Route
	function _DoCreateRoute(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const RI = req.body;

		const Route = {
			type: RI.type
		};

		const ParamKeys = Object.keys(RI).filter(
			(K) => K !== 'name' && K !== 'type'
		);
		ParamKeys.forEach((PK) => {
			Route[PK] = RI[PK];
		});

		CONFIG.routes[RI.name] = Route;
		UTIL.updateRouteConfig(RI.name, Route);

		_RouteSetup();

		res.contentType('application/json');
		res.send({ success: true });
	}

	// Route Types
	function _RouteTypes(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Types = [];
		const RouteTypeKeys = Object.keys(ROUTING.Routes);
		RouteTypeKeys.forEach((RTK) => {
			const Type = {
				type: RTK,
				label: ROUTING.Routes[RTK].Name
			};
			Types.push(Type);
		});

		const HTML = CompiledTemplates['RouteTypes']({
			Types: Types
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	// Check Pair (web)
	function _DoCheckPair(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Result = checkPairStatus(req.params.ID);

		res.contentType('application/json');
		res.send({ paired: Result });
	}

	// Delete Accessory
	function DeleteAccessory(ID, Destroy) {
		const Acc = _ConfiguredAccessories[ID];
		const AccCFG = Acc.getConfig();

		if (AccCFG.bridged) {
			_Bridge.removeAccessory(Acc.getAccessory());
		} else {
			if (Destroy) {
				Acc.unpublish(true);
			} else {
				Acc.unpublish(false);
			}
		}

		delete _ConfiguredAccessories[ID];

		if (Destroy) {
			const WithoutThis = CONFIG.accessories.filter(
				(A) => A.accessoryID !== ID
			);
			CONFIG.accessories = WithoutThis;
			UTIL.deleteAccessory(ID);
		}
	}

	/* Check PairStatus */
	function checkPairStatus(ID) {
		ID = ID.replace(/[.]/g, '').replace(/[/]/g, '').replace(/[\\]/g, '');

		const AccessoryFileName = PATH.join(
			UTIL.HomeKitPath,
			'AccessoryInfo.' + ID + '.json'
		);

		if (FS.existsSync(AccessoryFileName)) {
			delete require.cache[require.resolve(AccessoryFileName)];
			const IsPaired = Object.keys(require(AccessoryFileName).pairedClients);

			return IsPaired.length > 0;
		} else {
			return false;
		}
	}

	/* Check Auth */
	function _CheckAuth(req, res) {
		if (res !== undefined) {
			if (
				req.signedCookies.Authentication === undefined ||
				req.signedCookies.Authentication !== 'Success'
			) {
				res.redirect('../../../ui/login');
				return false;
			} else {
				return true;
			}
		} else {
			if (req.headers.cookie !== undefined) {
				const WSCookies = COOKIE.parse(req.headers.cookie);
				const SignedCookies = COOKIEPARSER.signedCookies(WSCookies, CookieKey);
				if (SignedCookies.Authentication !== undefined) {
					return SignedCookies.Authentication === 'Success';
				} else {
					return false;
				}
			} else {
				return false;
			}
		}
	}

	/* QR Code */
	async function _DOQRCode(req, res) {
		const Text = req.query.data;
		const Width = req.query.width;

		const BUF = await QRCODE.toBuffer(Text, {
			margin: 2,
			width: Width,
			type: 'png'
		});

		res.contentType('image/png');
		res.send(BUF);
	}

	/* Redirect */
	function _Redirect(req, res) {
		res.redirect('./ui/main');
	}

	/* Accessory Icon */
	function _DoAccessoryIcon(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		res.contentType('image/png');

		const Icon = ACCESSORY.Types[req.query.type].Icon;
		res.sendFile(
			PATH.join(UTIL.RootAppPath, 'core', 'accessories', 'Icons', Icon)
		);
	}

	/* Route Icon */
	function _DoRouteIcon(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		res.contentType('image/png');

		const Icon = ROUTING.Routes[req.query.type].Icon;
		res.sendFile(Icon);
	}

	/* Routes */
	function _Routes(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const RouteList = [];
		const RouteNames = Object.keys(CONFIG.routes);

		RouteNames.forEach((RN) => {
			const R = CONFIG.routes[RN];
			const RS = ROUTING.Routes[R.type];

			const UseCount = CONFIG.accessories.filter((A) => A.route === RN).length;

			const CR = {
				name: RN,
				type: RS.Type,
				typeName: RS.Name,
				readyStatus: R.readyStatus,
				readyRGB: R.readyRGB,
				clientId: R.clientID,
				useCount:
					UseCount === 1 ? UseCount + ' Accessory' : UseCount + ' Accessories'
			};
			RouteList.push(CR);
		});

		const HTML = CompiledTemplates['Routes']({
			Routes: RouteList
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	/* Login Page */
	function _Login(req, res) {
		const HTML = CompiledTemplates['Login']({
			RouterPackage: RouterPackage
		});
		res.contentType('text/html');
		res.send(HTML);
	}

	/* Do Login */
	function _DoLogin(req, res) {
		const Data = req.body;

		const Username = Data.username;
		const Password = Data.password;

		if (
			Username === CONFIG.loginUsername &&
			BCRYPT.compareSync(Password, CONFIG.loginPassword)
		) {
			res.cookie('Authentication', 'Success', {
				signed: true
			});

			res.contentType('application/json');

			const Response = {
				success: true,
				destination: '../../../ui/main'
			};
			res.send(JSON.stringify(Response));
		} else {
			res.contentType('application/json');
			const Response = {
				success: false
			};
			res.send(JSON.stringify(Response));
		}
	}

	/* Main Page */
	function _Main(req, res) {
		// Auth, Setup Check
		if (!_CheckAuth(req, res)) {
			return;
		}

		const HTML = CompiledTemplates['Main']({
			HAPPackage: HAPPackage,
			RouterPackage: RouterPackage
		});
		res.contentType('text/html');
		res.send(HTML);
	}

	/* Settings Page */
	function _Settings(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Interfaces = OS.networkInterfaces();
		const Keys = Object.keys(Interfaces);
		const IPs = [];

		for (let i = 0; i < Keys.length; i++) {
			const Net = Interfaces[Keys[i]];
			Net.forEach((AI) => {
				if (AI.family === 'IPv4' && !AI.internal) {
					IPs.push(AI.address);
				}
			});
		}

		const HTML = CompiledTemplates['Settings']({
			Config: CONFIG,
			Interfaces: IPs,
			RestartRequired: _RestartRequired
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	/* Do Settings */
	function _DoSettings(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const CFG = req.body;

		CONFIG.enableIncomingMQTT = CFG.enableIncomingMQTT;
		CONFIG.MQTTBroker = CFG.MQTTBroker;
		CONFIG.MQTTTopic = CFG.MQTTTopic;
		CONFIG.advertiser = CFG.advertiser;
		CONFIG.interface = CFG.interface;
		CONFIG.webInterfaceAddress = CFG.webInterfaceAddress;
		CONFIG.webInterfacePort = CFG.webInterfacePort;
		CONFIG.routeInitDelay = CFG.routeInitDelay;
		CONFIG.MQTTOptions.username = CFG.MQTTOptions.username;
		CONFIG.MQTTOptions.password = CFG.MQTTOptions.password;

		UTIL.updateOptions(CFG);

		_RestartRequired = true;

		const Response = {
			success: true
		};
		res.contentType('application/json');
		res.send(JSON.stringify(Response));
	}

	/* Accessories */
	function _Accessories(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const BridgedAccessories = [];
		const UNBridgedAccessories = [];
		const AccessoryIDs = Object.keys(_ConfiguredAccessories);

		AccessoryIDs.forEach((AID) => {
			const AC = _ConfiguredAccessories[AID];
			const AccessoryCFG = AC.getConfig();

			AccessoryCFG.typeDisplay = ACCESSORY.Types[AccessoryCFG.type].Label;
			AccessoryCFG.isPaired = checkPairStatus(AccessoryCFG.accessoryID);
			AccessoryCFG.SetupURI = AC.getAccessory().setupURI();

			const ConfiguredRoute = CONFIG.routes[AccessoryCFG.route];

			const Element = {
				AccessoryCFG: AccessoryCFG,
				RouteCFG: {
					name: AccessoryCFG.route,
					type: ConfiguredRoute.type
				}
			};

			if (AccessoryCFG.bridged) {
				BridgedAccessories.push(Element);
			} else {
				UNBridgedAccessories.push(Element);
			}
		});

		const HTML = CompiledTemplates['Accessories']({
			BridgedAccessories: BridgedAccessories,
			UNBridgedAccessories: UNBridgedAccessories
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	/* List Accessory Type */
	function _ListAccessoryesTypes(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Available = [];
		const Types = Object.keys(ACCESSORY.Types);
		Types.forEach((T) => {
			Available.push({
				type: T,
				label: ACCESSORY.Types[T].Label
			});
		});

		const HTML = CompiledTemplates['AccessorTypes']({
			Types: Available
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	/* Create Accessory */
	function _CreateAccessory(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Type = req.params.type;

		if (ACCESSORY.Types.hasOwnProperty(Type)) {
			const PL = {
				Specification: ACCESSORY.Types[Type],
				Routes: Object.keys(CONFIG.routes)
			};
			PL.Specification.type = Type;

			const HTML = CompiledTemplates['NewAccessory'](PL);

			res.contentType('text/html');
			res.send(HTML);
		}
	}

	/* DO Create Accessory */
	function _DoCreateAccessory(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const NewAccessoryOBJ = req.body;

		NewAccessoryOBJ.pincode = `${UTIL.getRndInteger(
			100,
			999
		)}-${UTIL.getRndInteger(10, 99)}-${UTIL.getRndInteger(100, 999)}`;
		NewAccessoryOBJ.username = UTIL.genMAC();
		NewAccessoryOBJ.setupID = UTIL.makeID(4);
		if (NewAccessoryOBJ.serialNumber === undefined) {
			NewAccessoryOBJ.serialNumber = UTIL.makeID(12);
		}

		UTIL.appendAccessoryToConfig(NewAccessoryOBJ);
		CONFIG.accessories.push(NewAccessoryOBJ);

		const QR = _AccessoryInitializer(NewAccessoryOBJ);

		res.contentType('application/json');
		res.send({
			success: true,
			SetupURI: QR,
			AID: NewAccessoryOBJ.accessoryID,
			SN: NewAccessoryOBJ.serialNumber,
			Name: NewAccessoryOBJ.name,
			Pincode: NewAccessoryOBJ.pincode,
			type: NewAccessoryOBJ.type
		});
	}

	/* Edit Accessory */
	function _EditAccessory(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const ID = req.params.id;

		const AccessoryCFG = _ConfiguredAccessories[ID].getConfig();

		const PL = {
			AccessoryCFG: AccessoryCFG,
			Specification: ACCESSORY.Types[AccessoryCFG.type],
			Routes: Object.keys(CONFIG.routes)
		};
		PL.Specification.type = AccessoryCFG.type;

		const HTML = CompiledTemplates['EditAccessory'](PL);

		res.contentType('text/html');
		res.send(HTML);
	}

	/* Do Edit Accessory */
	function _DoEditAccessory(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}
		const AID = req.params.id;

		DeleteAccessory(AID, false);

		const CurrentCFG = CONFIG.accessories.filter(
			(A) => A.accessoryID === AID
		)[0];
		delete CurrentCFG.manufacturer;
		delete CurrentCFG.model;
		delete CurrentCFG.serialNumber;

		const NewCFG = req.body;

		Object.keys(NewCFG).forEach((OK) => {
			CurrentCFG[OK] = NewCFG[OK];
		});

		if (CurrentCFG.serialNumber === undefined) {
			CurrentCFG.serialNumber = UTIL.makeID(12);
		}

		UTIL.updateAccessory(CurrentCFG, AID);
		_AccessoryInitializer(CurrentCFG);

		res.contentType('application/json');
		res.send({ success: true });
	}

	function _BridgeWEB(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const AccessoryIDs = Object.keys(_ConfiguredAccessories);
		const BridgedAccessories = [];

		AccessoryIDs.forEach((AID) => {
			const AccessoryCFG = _ConfiguredAccessories[AID].getConfig();
			if (!AccessoryCFG.bridged) {
				return;
			}

			AccessoryCFG.typeDisplay = ACCESSORY.Types[AccessoryCFG.type].Label;
			AccessoryCFG.isPaired = checkPairStatus(AccessoryCFG.accessoryID);

			const ConfiguredRoute = CONFIG.routes[AccessoryCFG.route];

			const Element = {
				AccessoryCFG: AccessoryCFG,
				RouteCFG: {
					name: AccessoryCFG.route,
					type: ConfiguredRoute.type
				}
			};

			BridgedAccessories.push(Element);
		});

		const HTML = CompiledTemplates['Bridge']({
			BridgedAccessories: BridgedAccessories,
			bridgeEnabled: CONFIG.bridgeEnabled,
			bridgeInfo: {
				pinCode: CONFIG.bridgeConfig.pincode,
				serialNumber: CONFIG.bridgeConfig.serialNumber,
				setupURI: _Bridge.getAccessory().setupURI(),
				isPaired: checkPairStatus(
					CONFIG.bridgeConfig.username.replace(/:/g, '')
				),
				accessoryID: CONFIG.bridgeConfig.username.replace(/:/g, '')
			}
		});

		res.contentType('text/html');
		res.send(HTML);
	}

	function _DoBridgeConfig(req, res) {
		if (!_CheckAuth(req, res)) {
			return;
		}

		const Enabled = req.body.enableBridge;

		if (Enabled) {
			console.log(' Publishing Bridge');
			_Bridge.publish();
		} else {
			console.log(' Unpublishing Bridge');
			_Bridge.unpublish(false);
		}

		CONFIG.bridgeEnabled = Enabled;

		UTIL.updateBridgeStatus(Enabled);

		const Response = {
			success: true
		};
		res.contentType('application/json');
		res.send(JSON.stringify(Response));
	}
};

module.exports = {
	Server: Server
};
