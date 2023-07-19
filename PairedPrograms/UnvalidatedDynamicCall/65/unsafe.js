/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/
define(["require", "exports", "es6-promise", "URIjs/URI", "Common/Debug", "Common/Errors", "./Errors/ExceptionSerialization"], function (require, exports, rsvp, URI, Debug, Errors, ExceptionSerialization_1) {
    "use strict";
    var Promise = rsvp.Promise;
    /**
     * Makes calls to the Cloud host from a provider
     */
    var FrameHostProxy = (function () {
        function FrameHostProxy(provider, hostContainer) {
            var _this = this;
            // TODO: Use a diferent way to identify messages than integers.
            this._messageCount = 0;
            this._operations = {};
            this._eventListeners = {};
            /**
             * Sends a initialization operation to the host to tell it
             * the app is initialized
             */
            this.sendInitializationMessage = function () {
                var initializationOperationId = _this._provider.namespace.toString() + ".initialize";
                var message = {
                    id: initializationOperationId,
                    messageType: 2 /* FunctionResponse */
                };
                _this.sendMessage(message, _this._hostContainer);
            };
            /**
             * Executes the given operation on the host.
             */
            this.executeOperation = function (operationName, args) {
                return new Promise(function (resolve, reject) {
                    var message = {
                        id: _this._messageCount++,
                        messageType: 1 /* FunctionCall */,
                        operationNamespace: operationName,
                        args: args
                    };
                    _this._operations[message.id] = {
                        resolve: resolve,
                        reject: reject
                    };
                    // Send message
                    _this.sendMessage(message, _this._hostContainer);
                });
            };
            this.executeProviderOperation = function (operationName, args) {
                Debug.assert(!Array.isArray(args), "Pass in an arguments object, not an array, to executeProviderOperation");
                return _this.executeOperation(operationName, [args]);
            };
            this.resolveResource = function (namespace, resourceId) {
                return _this.resolveResources(namespace, [resourceId]).then(function (values) { return values[resourceId]; });
            };
            this.resolveResources = function (namespace, resourceIds) {
                return new Promise(function (resolve, reject) {
                    var message = {
                        id: _this._messageCount++,
                        messageType: 4 /* ResolveResourcesCall */,
                        resourceNamespace: namespace,
                        args: resourceIds
                    };
                    _this._operations[message.id] = {
                        resolve: resolve,
                        reject: reject
                    };
                    // Send message
                    _this.sendMessage(message, _this._hostContainer);
                });
            };
            /**
             * Gets called when a new message is received.
             */
            this.messageHandler = function (event) {
	var message = JSON.parse(event.data);
	if (! message) {
	return ;
}

	switch (message.messageType) {
                    case 1 /* FunctionCall */:
                        var operationName = message.operationNamespace.toString();
                        var funct = _this._provider.getFunction(operationName);
                        if (!funct) {
                            funct = _this._provider[operationName];
                        }
                        // Check if we found a valid function
                        if (!funct) {
                            message.response = {
                                type: "error",
                                error: ExceptionSerialization_1.default.serialize(new Errors.FunctionNotFoundError(operationName))
                            };
                            _this.sendMessage(message, event.source);
                            return;
                        }
                        funct.apply(_this._provider, message.args)
                            .then(function (response) {
                            message.response = { type: "result", result: response };
                        }, function (error) {
                            message.response = { type: "error", error: ExceptionSerialization_1.default.serialize(error) };
                        }).then(function () {
                            message.messageType = 2 /* FunctionResponse */;
                            _this.sendMessage(message, event.source);
                        });
                        break;
                    case 2 /* FunctionResponse */:
                    case 5 /* ResolveResourcesResponse */:
                        // Get the operation associated with the message
                        var operation = _this._operations[message.id];
                        // Check the operation
                        if (!operation) {
                            // The message wasn't for this host.
                            return;
                        }
                        // Resolve the operation
                        if (!!message.response) {
                            if (message.response.type === "error") {
                                operation.reject(ExceptionSerialization_1.default.deserialize(message.response.error));
                            }
                            else {
                                operation.resolve(message.response.result);
                            }
                        }
                        else {
                            operation.resolve(null);
                        }
                        delete _this._operations[message.id];
                        break;
                    case 0 /* Event */:
                        var eventListener = _this._eventListeners[message.id];
                        // Check the eventListener
                        if (!eventListener) {
                            // The message wasn't for this host.
                            return;
                        }
                        eventListener(message.event);
                        break;
                }
};
            /**
             * Calls the given call back when the event with the given name happends.
             */
            this.onHostEvent = function (eventNamespace, callback) {
                var message = {
                    id: _this._messageCount++,
                    messageType: 3 /* RegisterEvent */,
                    eventNamespace: eventNamespace
                };
                _this._eventListeners[message.id] = callback;
                _this.sendMessage(message, _this._hostContainer);
            };
            /**
             * Sends a post message to the given container.
             */
            this.sendMessage = function (message, container) {
                // Since IE9 doesn't de/serialize the objects sent using Post Message
                // we need to do it before sending the object.
                var messageString = JSON.stringify(message);
                container.postMessage(messageString, _this._hostUrl);
            };
            this._hostContainer = hostContainer;
            this._provider = provider;
            // The host should pass its url through get query parameters
            var pageUri = URI(window.location.href);
            var pageQueries = pageUri.query(true);
            // If the host wasn't specified we default to *,
            // as that corresponds to a broadcast message in Post Message mechanism.
            this._hostUrl = !!pageQueries.hostUrl ? pageQueries.hostUrl : "*";
            window.addEventListener("message", this.messageHandler);
        }
        return FrameHostProxy;
    }());
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = FrameHostProxy;
});
