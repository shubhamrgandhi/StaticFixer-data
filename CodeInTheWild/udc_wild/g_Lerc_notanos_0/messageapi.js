(function() {
	/*global Module sys log FileIO DivWin */
	var MessageApi = new Module("messageapi");
	var messageHandlers = {};
	var messageFunctions = {};

	var messagesAwaitingResponses = [];

	function sendResponse(message,err,answer) {
		//log("sending Response to frame "+message.window.origin);
		var response = {"messageType" : "callResponse",
			"responseId" : message.data.responseId};

		if (err) response.err=err; else response.response=answer;

		message.window.postMessage(response,"*");
		messagesAwaitingResponses.remove(message);
	}

	messageHandlers.functionCall = function (message) {
		function respond(err,answer){sendResponse(message,err,answer);}
		var func = messageFunctions[message.data.callName];
		if (func) {
			//log("calling "+message.data.callName);
			func(message,respond);
		}
	};

/*
    messageHandlers.yoohoo = function (message) {
		var seenit = messagesAwaitingResponses.some(message)
		sendResponse(message,seenit);
	}
*/
	messageHandlers.hostmessage = function (message) {
		//var frame = message.window.frameElement;
		var win=message.frame.win;
		win.connection.send(message.data.data);
	};

	/*
	function getIframeFromWindow(frameWindow) {
		var allFrames = document.getElementsByTagName("IFRAME");
	}*/

	function findIframeElementFromwindow(frameWindow) {
		var iframes= document.querySelectorAll("iframe");
		for (var i=0; i<iframes.length; i++) {
			if (iframes[i].contentWindow==frameWindow) return iframes[i];
		}
		return null;
	}
	function receiveMessage(e) {
		//console.log("Message recieved ", e);
		//console.log("Target ", e.target.frame);
		//console.log("source ", e.source.frame);

		var frameElement = findIframeElementFromwindow(e.source);

		var handler = messageHandlers[e.data.messageType];
		if (handler) {
			var apiMessage = {window:e.source, frame:frameElement, origin:e.origin, data:e.data};
			messagesAwaitingResponses.push(apiMessage);
			handler(apiMessage);
		}
	}

	messageFunctions.loadFile = function(message,callback) {
		var parameters=message.data.parameters;
		FileIO.getFileAsString(parameters.filename,callback);
		//WebDav.loadFile_async(parameters.filename, callback);
	};

	messageFunctions.saveFile = function(message,callback) {
		var parameters=message.data.parameters;
		FileIO.writeFile(parameters.filename,parameters.content,callback);
	//WebDav.saveFile_async(parameters.filename,parameters.content,callback);
	};

	messageFunctions.openFileDialog = function(message,callback) {
		var parameters=message.data.parameters;
		sys.modules.requesters.openFileDialog(parameters.initialFilename,parameters.options,callback);
	};

	messageFunctions.saveFileDialog = function(message,callback) {
		var parameters=message.data.parameters;
		sys.modules.requesters.saveFileDialog(parameters.initialFilename,parameters.options,callback);
	};

	messageFunctions.setWindowTitle = function (message,callback) {
		var parameters=message.data.parameters;
		var frame = findIframeElementFromwindow(message.window);
		var win=frame.win;
		var caption=win.decorations.caption;
		caption.innerHTML=parameters.text;
		callback();
	};

	messageFunctions.exit = function (message,callback) {
		//var parameters=message.data.parameters;
		var frame = message.window.frameElement;
		var win=frame.win;
		DivWin.closeWindow(win);
		callback();
	};

	log("installing message listener");
	addEventListener("message",receiveMessage,false);

	return MessageApi;
}());
