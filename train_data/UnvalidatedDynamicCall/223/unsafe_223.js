!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports["cg-player"]=e():t["cg-player"]=e()}(self,(()=>(()=>{var t={897:t=>{t.exports=function(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,n=new Array(e);r<e;r++)n[r]=t[r];return n},t.exports.__esModule=!0,t.exports.default=t.exports},405:(t,e,r)=>{var n=r(897);t.exports=function(t){if(Array.isArray(t))return n(t)},t.exports.__esModule=!0,t.exports.default=t.exports},156:t=>{function e(t,e,r,n,o,a,i){try{var u=t[a](i),s=u.value}catch(t){return void r(t)}u.done?e(s):Promise.resolve(s).then(n,o)}t.exports=function(t){return function(){var r=this,n=arguments;return new Promise((function(o,a){var i=t.apply(r,n);function u(t){e(i,o,a,u,s,"next",t)}function s(t){e(i,o,a,u,s,"throw",t)}u(void 0)}))}},t.exports.__esModule=!0,t.exports.default=t.exports},836:t=>{t.exports=function(t){return t&&t.__esModule?t:{default:t}},t.exports.__esModule=!0,t.exports.default=t.exports},498:t=>{t.exports=function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)},t.exports.__esModule=!0,t.exports.default=t.exports},281:t=>{t.exports=function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")},t.exports.__esModule=!0,t.exports.default=t.exports},61:(t,e,r)=>{var n=r(698).default;function o(){"use strict";t.exports=o=function(){return e},t.exports.__esModule=!0,t.exports.default=t.exports;var e={},r=Object.prototype,a=r.hasOwnProperty,i="function"==typeof Symbol?Symbol:{},u=i.iterator||"@@iterator",s=i.asyncIterator||"@@asyncIterator",c=i.toStringTag||"@@toStringTag";function l(t,e,r){return Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}),t[e]}try{l({},"")}catch(t){l=function(t,e,r){return t[e]=r}}function f(t,e,r,n){var o=e&&e.prototype instanceof h?e:h,a=Object.create(o.prototype),i=new k(n||[]);return a._invoke=function(t,e,r){var n="suspendedStart";return function(o,a){if("executing"===n)throw new Error("Generator is already running");if("completed"===n){if("throw"===o)throw a;return{value:void 0,done:!0}}for(r.method=o,r.arg=a;;){var i=r.delegate;if(i){var u=E(i,r);if(u){if(u===d)continue;return u}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if("suspendedStart"===n)throw n="completed",r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);n="executing";var s=p(t,e,r);if("normal"===s.type){if(n=r.done?"completed":"suspendedYield",s.arg===d)continue;return{value:s.arg,done:r.done}}"throw"===s.type&&(n="completed",r.method="throw",r.arg=s.arg)}}}(t,r,i),a}function p(t,e,r){try{return{type:"normal",arg:t.call(e,r)}}catch(t){return{type:"throw",arg:t}}}e.wrap=f;var d={};function h(){}function y(){}function v(){}var m={};l(m,u,(function(){return this}));var g=Object.getPrototypeOf,w=g&&g(g(O([])));w&&w!==r&&a.call(w,u)&&(m=w);var x=v.prototype=h.prototype=Object.create(m);function b(t){["next","throw","return"].forEach((function(e){l(t,e,(function(t){return this._invoke(e,t)}))}))}function _(t,e){function r(o,i,u,s){var c=p(t[o],t,i);if("throw"!==c.type){var l=c.arg,f=l.value;return f&&"object"==n(f)&&a.call(f,"__await")?e.resolve(f.__await).then((function(t){r("next",t,u,s)}),(function(t){r("throw",t,u,s)})):e.resolve(f).then((function(t){l.value=t,u(l)}),(function(t){return r("throw",t,u,s)}))}s(c.arg)}var o;this._invoke=function(t,n){function a(){return new e((function(e,o){r(t,n,e,o)}))}return o=o?o.then(a,a):a()}}function E(t,e){var r=t.iterator[e.method];if(void 0===r){if(e.delegate=null,"throw"===e.method){if(t.iterator.return&&(e.method="return",e.arg=void 0,E(t,e),"throw"===e.method))return d;e.method="throw",e.arg=new TypeError("The iterator does not provide a 'throw' method")}return d}var n=p(r,t.iterator,e.arg);if("throw"===n.type)return e.method="throw",e.arg=n.arg,e.delegate=null,d;var o=n.arg;return o?o.done?(e[t.resultName]=o.value,e.next=t.nextLoc,"return"!==e.method&&(e.method="next",e.arg=void 0),e.delegate=null,d):o:(e.method="throw",e.arg=new TypeError("iterator result is not an object"),e.delegate=null,d)}function L(t){var e={tryLoc:t[0]};1 in t&&(e.catchLoc=t[1]),2 in t&&(e.finallyLoc=t[2],e.afterLoc=t[3]),this.tryEntries.push(e)}function S(t){var e=t.completion||{};e.type="normal",delete e.arg,t.completion=e}function k(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(L,this),this.reset(!0)}function O(t){if(t){var e=t[u];if(e)return e.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var r=-1,n=function e(){for(;++r<t.length;)if(a.call(t,r))return e.value=t[r],e.done=!1,e;return e.value=void 0,e.done=!0,e};return n.next=n}}return{next:P}}function P(){return{value:void 0,done:!0}}return y.prototype=v,l(x,"constructor",v),l(v,"constructor",y),y.displayName=l(v,c,"GeneratorFunction"),e.isGeneratorFunction=function(t){var e="function"==typeof t&&t.constructor;return!!e&&(e===y||"GeneratorFunction"===(e.displayName||e.name))},e.mark=function(t){return Object.setPrototypeOf?Object.setPrototypeOf(t,v):(t.__proto__=v,l(t,c,"GeneratorFunction")),t.prototype=Object.create(x),t},e.awrap=function(t){return{__await:t}},b(_.prototype),l(_.prototype,s,(function(){return this})),e.AsyncIterator=_,e.async=function(t,r,n,o,a){void 0===a&&(a=Promise);var i=new _(f(t,r,n,o),a);return e.isGeneratorFunction(r)?i:i.next().then((function(t){return t.done?t.value:i.next()}))},b(x),l(x,c,"Generator"),l(x,u,(function(){return this})),l(x,"toString",(function(){return"[object Generator]"})),e.keys=function(t){var e=[];for(var r in t)e.push(r);return e.reverse(),function r(){for(;e.length;){var n=e.pop();if(n in t)return r.value=n,r.done=!1,r}return r.done=!0,r}},e.values=O,k.prototype={constructor:k,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=void 0,this.done=!1,this.delegate=null,this.method="next",this.arg=void 0,this.tryEntries.forEach(S),!t)for(var e in this)"t"===e.charAt(0)&&a.call(this,e)&&!isNaN(+e.slice(1))&&(this[e]=void 0)},stop:function(){this.done=!0;var t=this.tryEntries[0].completion;if("throw"===t.type)throw t.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var e=this;function r(r,n){return i.type="throw",i.arg=t,e.next=r,n&&(e.method="next",e.arg=void 0),!!n}for(var n=this.tryEntries.length-1;n>=0;--n){var o=this.tryEntries[n],i=o.completion;if("root"===o.tryLoc)return r("end");if(o.tryLoc<=this.prev){var u=a.call(o,"catchLoc"),s=a.call(o,"finallyLoc");if(u&&s){if(this.prev<o.catchLoc)return r(o.catchLoc,!0);if(this.prev<o.finallyLoc)return r(o.finallyLoc)}else if(u){if(this.prev<o.catchLoc)return r(o.catchLoc,!0)}else{if(!s)throw new Error("try statement without catch or finally");if(this.prev<o.finallyLoc)return r(o.finallyLoc)}}}},abrupt:function(t,e){for(var r=this.tryEntries.length-1;r>=0;--r){var n=this.tryEntries[r];if(n.tryLoc<=this.prev&&a.call(n,"finallyLoc")&&this.prev<n.finallyLoc){var o=n;break}}o&&("break"===t||"continue"===t)&&o.tryLoc<=e&&e<=o.finallyLoc&&(o=null);var i=o?o.completion:{};return i.type=t,i.arg=e,o?(this.method="next",this.next=o.finallyLoc,d):this.complete(i)},complete:function(t,e){if("throw"===t.type)throw t.arg;return"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type?(this.rval=this.arg=t.arg,this.method="return",this.next="end"):"normal"===t.type&&e&&(this.next=e),d},finish:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.finallyLoc===t)return this.complete(r.completion,r.afterLoc),S(r),d}},catch:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.tryLoc===t){var n=r.completion;if("throw"===n.type){var o=n.arg;S(r)}return o}}throw new Error("illegal catch attempt")},delegateYield:function(t,e,r){return this.delegate={iterator:O(t),resultName:e,nextLoc:r},"next"===this.method&&(this.arg=void 0),d}},e}t.exports=o,t.exports.__esModule=!0,t.exports.default=t.exports},861:(t,e,r)=>{var n=r(405),o=r(498),a=r(116),i=r(281);t.exports=function(t){return n(t)||o(t)||a(t)||i()},t.exports.__esModule=!0,t.exports.default=t.exports},698:t=>{function e(r){return t.exports=e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},t.exports.__esModule=!0,t.exports.default=t.exports,e(r)}t.exports=e,t.exports.__esModule=!0,t.exports.default=t.exports},116:(t,e,r)=>{var n=r(897);t.exports=function(t,e){if(t){if("string"==typeof t)return n(t,e);var r=Object.prototype.toString.call(t).slice(8,-1);return"Object"===r&&t.constructor&&(r=t.constructor.name),"Map"===r||"Set"===r?Array.from(t):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?n(t,e):void 0}},t.exports.__esModule=!0,t.exports.default=t.exports},687:(t,e,r)=>{var n=r(61)();t.exports=n;try{regeneratorRuntime=n}catch(t){"object"==typeof globalThis?globalThis.regeneratorRuntime=n:Function("r","regeneratorRuntime = r")(n)}}},e={};function r(n){var o=e[n];if(void 0!==o)return o.exports;var a=e[n]={exports:{}};return t[n](a,a.exports,r),a.exports}var n={};return(()=>{"use strict";var t=n,e=r(836);Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0;var o=e(r(687)),a=e(r(861)),i=e(r(156));t.default=function(t){var e,r,n,u,s,c,l,f,p,d=t.viewer,h=t.viewerUrl,y=t.customDemo,v=null,m=null,g=[],w=new Promise((function(t){e=t})),x=new Promise((function(t){r=t})),b={},_=function(t){return b[t]||[]},E=!1,L={ready:function(){E||(E=!0,T({type:"libraries",libraries:t.libraries}),T({type:"baseUrl",baseUrl:window.location.origin}),T({type:"loggedUserId",loggedUserId:f}),W(),(d||h)&&T({type:"viewer",viewer:d,viewerUrl:h,customDemo:y}),e())},resize:function(t){v.parentElement.style.paddingTop=t.iframeHeight,R("resize",t)},progress:function(t){g.forEach((function(e){return e(t.frame,t.progress,t.playing,t.isSubFrame,t.isTurnBasedGame,t.atEnd)})),n=t.atEnd,u=t.playing},viewerOptions:function(t){var e,r;s=t.playerColors,c=t.canSwapPlayers,l=t.gameName,e=N(),T({type:"gameParams",gameParams:(r=z())[e]||(r[e]={})})},parsedGameInfo:function(t){R("parsedGameInfo",t)},play:function(t){u=!0,R("play",t.data)},pause:function(t){u=!1,R("pause",t.data)},gameParams:function(e){!function(e){var r=z();r[N()]=e;try{window.localStorage.setItem(t.localStorageKey,JSON.stringify(r))}catch(t){console.log.error("Error while saving player settings to localStorage.")}}(e.gameParams)},analyticsOpenReplay:function(t){R("analyticsOpenReplay",t)},error:function(t){R("error",t.error)}};return{createIframe:function(e){return(v=document.createElement("iframe")).src=t.src,v.setAttribute("allowfullscreen",""),v.sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox",v.style.position="absolute",v.style.left=0,v.style.top=0,v.style.width="100%",v.style.height="100%",v.style.border=0,v.style.display="block",e.style.position="relative",e.innerHTML="",e.appendChild(v),window.addEventListener("message",C),T({type:"ready"}),v},setViewer:function(t){return S.apply(this,arguments)},setLoggedUserId:function(t){f=t},setCurrentLanguage:function(t){p=t,W()},sendFrames:function(t,e){return k.apply(this,arguments)},setOptions:function(t){return O.apply(this,arguments)},setFrame:P,first:function(){return I.apply(this,arguments)},play:M,pause:G,setSpeed:function(t){return F.apply(this,arguments)},on:function(t,e){b[t]=[].concat((0,a.default)(_(t)),[e])},off:function(t,e){b[t]=_(t).filter((function(t){return t!==e}))},waitReady:D,destroy:function(){window.removeEventListener("message",C)},subscribe:function(t){g=[].concat((0,a.default)(g),[t])},unsubscribe:function(t){g=g.filter((function(e){return e!==t}))},clear:function(){g=[]},getFrameCount:function(){return m?m.frames.length:0},isPlaying:function(){return u},isAtEnd:function(){return n},canSwapPlayers:function(){return c},getPlayerColors:function(){return s},isGameLoaded:function(){return null!=m}};function S(){return(S=(0,i.default)(o.default.mark((function t(e){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return d=e,t.next=3,D();case 3:T({type:"viewer",viewer:d});case 4:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function k(){return(k=(0,i.default)(o.default.mark((function t(e,n){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return x=new Promise((function(t){r=t})),m=e,t.next=4,D();case 4:if(T({type:"frames",gameInfo:null}),!e.agents){t.next=10;break}return t.next=8,Promise.all(e.agents.map((function(t){return H(t)})));case 8:t.next=12;break;case 10:return t.next=12,H(e);case 12:T({type:"frames",gameInfo:e,isUserGame:n}),r(),u?M():G();case 15:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function O(){return(O=(0,i.default)(o.default.mark((function t(e){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,D();case 2:T({type:"options",options:e});case 3:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function P(t,e){return j.apply(this,arguments)}function j(){return(j=(0,i.default)(o.default.mark((function t(e,r){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,x;case 2:T({type:"frame",frame:e,progress:r});case 3:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function I(){return(I=(0,i.default)(o.default.mark((function t(){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,P(0);case 2:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function M(){return U.apply(this,arguments)}function U(){return(U=(0,i.default)(o.default.mark((function t(){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return u=!0,t.next=3,x;case 3:T({type:"play"});case 4:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function G(){return A.apply(this,arguments)}function A(){return(A=(0,i.default)(o.default.mark((function t(){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return u=!1,t.next=3,x;case 3:T({type:"pause"});case 4:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function F(){return(F=(0,i.default)(o.default.mark((function t(e){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,D();case 2:T({type:"speed",speed:e});case 3:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function N(){return(l||(d||h).split("").reduce((function(t,e){return(t=(t<<5)-t+e.charCodeAt(0))&t}),0).toString()).toLowerCase().replace(/ /g,"")}function T(t){null!=v&&null!=v.contentWindow&&v.contentWindow.postMessage(t,"*")}function C(t){null != L[t.data.type] && L[t.data.type](t.data)}function R(t,e){_(t).forEach((function(t){return t(e)}))}function D(){return K.apply(this,arguments)}function K(){return(K=(0,i.default)(o.default.mark((function t(){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.abrupt("return",w);case 1:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function W(){T({type:"language",lang:p})}function z(){var e={};try{var r=window.localStorage.getItem(t.localStorageKey);null==r?window.localStorage.setItem(t.localStorageKey,"{}"):e=JSON.parse(r)}catch(t){console.log.error("Error while accessing player settings from localStorage.")}return e}function H(t){return J.apply(this,arguments)}function J(){return(J=(0,i.default)(o.default.mark((function t(e){return o.default.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(null==e.avatarUrl){t.next=11;break}return t.prev=1,t.next=4,Y(e.avatarUrl);case 4:e.avatarUrl=t.sent,t.next=11;break;case 7:t.prev=7,t.t0=t.catch(1),console.error("Failed to load avatar!",e.avatarUrl),e.avatarUrl=null;case 11:case"end":return t.stop()}}),t,null,[[1,7]])})))).apply(this,arguments)}function Y(t){return new Promise((function(e,r){var n=new window.Image;n.crossOrigin="anonymous",n.onload=function(){var t=document.createElement("canvas"),r=t.getContext("2d");t.width=n.width,t.height=n.height,r.drawImage(n,0,0,n.width,n.height),e(t.toDataURL())},n.onerror=function(){r(new Error)},n.src=t}))}}})(),n})()));