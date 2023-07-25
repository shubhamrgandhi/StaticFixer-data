/**
 * Dark Reader v4.9.31
 * https://darkreader.org/
 */
 "use strict";
 var DarkReader = (() => {
   var __defProp = Object.defineProperty;
   var __export = (target, all) => {
     for (var name in all)
       __defProp(target, name, {get: all[name], enumerable: !0});
   };
 
   // src/api/index.ts
   var api_exports = {};
   __export(api_exports, {
     auto: () => auto,
     disable: () => disable,
     enable: () => enable,
     exportGeneratedCSS: () => exportGeneratedCSS,
     isEnabled: () => isEnabled2,
     setFetchMethod: () => setFetchMethod2,
     setupIFrameListener: () => setupIFrameListener
   });
 
   // src/utils/platform.ts
   var userAgent = typeof navigator == "undefined" ? "some useragent" : navigator.userAgent.toLowerCase(), platform = typeof navigator == "undefined" ? "some platform" : navigator.platform.toLowerCase(), isChromium = userAgent.includes("chrome") || userAgent.includes("chromium"), isThunderbird = userAgent.includes("thunderbird"), isFirefox = userAgent.includes("firefox") || isThunderbird, isVivaldi = userAgent.includes("vivaldi"), isYaBrowser = userAgent.includes("yabrowser"), isOpera = userAgent.includes("opr") || userAgent.includes("opera"), isEdge = userAgent.includes("edg"), isSafari = userAgent.includes("safari") && !isChromium, isWindows = platform.startsWith("win"), isMacOS = platform.startsWith("mac"), isMobile = userAgent.includes("mobile"), isShadowDomSupported = typeof ShadowRoot == "function", isMatchMediaChangeEventListenerSupported = typeof MediaQueryList == "function" && typeof MediaQueryList.prototype.addEventListener == "function", chromiumVersion = (() => {
     let m = userAgent.match(/chrom[e|ium]\/([^ ]+)/);
     return m && m[1] ? m[1] : "";
   })(), isDefinedSelectorSupported = (() => {
     try {
       return document.querySelector(":defined"), !0;
     } catch (err) {
       return !1;
     }
   })(), isCSSStyleSheetConstructorSupported = (() => {
     try {
       return new CSSStyleSheet(), !0;
     } catch (err) {
       return !1;
     }
   })();
 
   // src/utils/network.ts
   async function getOKResponse(url, mimeType) {
     let response = await fetch(url, {
       cache: "force-cache",
       credentials: "omit"
     });
     if (isFirefox && mimeType === "text/css" && url.startsWith("moz-extension://") && url.endsWith(".css"))
       return response;
     if (mimeType && !response.headers.get("Content-Type").startsWith(mimeType))
       throw new Error(`Mime type mismatch when loading ${url}`);
     if (!response.ok)
       throw new Error(`Unable to load ${url} ${response.status} ${response.statusText}`);
     return response;
   }
   async function loadAsDataURL(url, mimeType) {
     let response = await getOKResponse(url, mimeType);
     return await readResponseAsDataURL(response);
   }
   async function readResponseAsDataURL(response) {
     let blob = await response.blob();
     return await new Promise((resolve) => {
       let reader = new FileReader();
       reader.onloadend = () => resolve(reader.result), reader.readAsDataURL(blob);
     });
   }
 
   // src/utils/time.ts
   function getDuration(time) {
     let duration = 0;
     return time.seconds && (duration += time.seconds * 1e3), time.minutes && (duration += time.minutes * 60 * 1e3), time.hours && (duration += time.hours * 60 * 60 * 1e3), time.days && (duration += time.days * 24 * 60 * 60 * 1e3), duration;
   }
 
   // src/api/iframes.ts
   function getAllIFrames(workingDocument) {
     if (!workingDocument)
       return [];
     let IFrames = [];
     return IFrames = [...IFrames, ...workingDocument.getElementsByTagName("iframe")], IFrames.forEach((IFrame) => {
       IFrames = [...IFrames, ...getAllIFrames(IFrame.contentDocument)];
     }), IFrames;
   }
   var IFrameDetectedCallback = null, isEnabled, getStore, onNewIFrame = (IFrame) => {
     let {contentDocument} = IFrame;
     if (IFrameDetectedCallback(contentDocument), setupIFrameObserver(contentDocument), IFrame.setAttribute("isdarkreaderactived", "1"), isEnabled()) {
       contentDocument.dispatchEvent(new CustomEvent("__darkreader__enableDynamicTheme", {detail: getStore()}));
       let dispatchCustomEvent = () => {
         isEnabled() && (contentDocument.dispatchEvent(new CustomEvent("__darkreader__enableDynamicTheme", {detail: getStore()})), contentDocument.removeEventListener("__darkreader__IAmReady", dispatchCustomEvent));
       };
       contentDocument.addEventListener("__darkreader__IAmReady", dispatchCustomEvent);
     }
   }, onMutation = (workingDocument) => {
     getAllIFrames(workingDocument).forEach((IFrame) => {
       IFrame.getAttribute("isdarkreaderactived") || ensureIFrameIsLoaded(IFrame, () => !IFrame.getAttribute("isdarkreaderactived") && onNewIFrame(IFrame));
     });
   };
   function setupIFrameData(listener, getOptions, isDarkReaderEnabled2) {
     IFrameDetectedCallback = listener, getStore = getOptions, isEnabled = isDarkReaderEnabled2, onMutation(document);
   }
   function setupIFrameObserver(workingDocument = document) {
     let observerDocument = workingDocument;
     new MutationObserver(() => {
       onMutation(observerDocument);
     }).observe(observerDocument.documentElement, {childList: !0, subtree: !0});
   }
   var maxTimeoutDuration = getDuration({seconds: 5});
   function ensureIFrameIsLoaded(IFrame, callback) {
     let timeoutID, maxTimeoutID, fired = !1;
     function ready() {
       fired || (fired = !0, clearTimeout(timeoutID), callback(IFrame.contentDocument));
     }
     IFrame.addEventListener("load", () => {
       ready();
     });
     function checkLoaded() {
       let doc = IFrame.contentDocument;
       doc && doc.URL.indexOf("about:") !== 0 ? doc.readyState === "complete" ? ready.call(doc) : (doc.addEventListener("DOMContentLoaded", ready), doc.addEventListener("readystatechange", ready)) : (timeoutID = setTimeout(checkLoaded), maxTimeoutID || setTimeout(() => {
         clearTimeout(timeoutID);
       }, maxTimeoutDuration));
     }
     checkLoaded();
   }
   var isIFrame = (() => {
     try {
       return window.self !== window.top;
     } catch (err) {
       return console.warn(err), !0;
     }
   })();
 
   // src/api/fetch.ts
   var throwCORSError = async (url) => Promise.reject(new Error([
     "Embedded Dark Reader cannot access a cross-origin resource",
     url,
     "Overview your URLs and CORS policies or use",
     "`DarkReader.setFetchMethod(fetch: (url) => Promise<Response>))`.",
     "See if using `DarkReader.setFetchMethod(window.fetch)`",
     "before `DarkReader.enable()` works."
   ].join(" "))), fetcher = throwCORSError;
   function setFetchMethod(fetch2) {
     fetch2 ? fetcher = fetch2 : fetcher = throwCORSError;
   }
   async function callFetchMethod(url, responseType) {
     return isIFrame ? await apiFetch(url, responseType) : await fetcher(url);
   }
   var counter = 0, resolvers = new Map();
   async function apiFetch(url, responseType) {
     return new Promise((resolve) => {
       let id = `${++counter}-${window.location.href}`;
       resolvers.set(id, resolve), window.top.postMessage({type: "fetch-api", url, id, responseType});
     });
   }
   isIFrame && window.addEventListener("message", async (event) => {
     let {type, data, id} = event.data;
     if (!(type !== "fetch-api-response" || event.origin !== window.location.origin)) {
       let resolve = resolvers.get(id);
       resolvers.delete(id), resolve && resolve(data);
     }
   });
   async function readResponseAsDataURL2(response) {
     let blob = await response.blob();
     return await new Promise((resolve) => {
       let reader = new FileReader();
       reader.onloadend = () => resolve(reader.result), reader.readAsDataURL(blob);
     });
   }
   isIFrame || window.addEventListener("message", async (event) => {
     let {type, url, id, responseType} = event.data;
     if (!(type !== "fetch-api" || event.origin !== window.location.origin)) {
       let response = await fetcher(url), data;
       responseType === "data-url" ? data = await readResponseAsDataURL2(response) : data = await response.text(), event.source.postMessage({type: "fetch-api-response", data, id}, event.origin);
     }
   });
 
   // src/api/chrome.ts
   window.chrome || (window.chrome = {});
   chrome.runtime || (chrome.runtime = {});
   var messageListeners = new Set();
   async function sendMessage(...args) {
     if (args[0] && args[0].type === "fetch") {
       let {id} = args[0];
       try {
         let {url, responseType} = args[0].data, response = await callFetchMethod(url, responseType), text;
         typeof response == "string" ? text = response : responseType === "data-url" ? text = await readResponseAsDataURL(response) : text = await response.text(), messageListeners.forEach((cb) => cb({type: "fetch-response", data: text, error: null, id}));
       } catch (err) {
         console.error(err), messageListeners.forEach((cb) => cb({type: "fetch-response", data: null, err, id}));
       }
     }
   }
   function addMessageListener(callback) {
     messageListeners.add(callback);
   }
   if (typeof chrome.runtime.sendMessage == "function") {
     let nativeSendMessage = chrome.runtime.sendMessage;
     chrome.runtime.sendMessage = (...args) => {
       sendMessage(...args), nativeSendMessage.apply(chrome.runtime, args);
     };
   } else
     chrome.runtime.sendMessage = sendMessage;
   chrome.runtime.onMessage || (chrome.runtime.onMessage = {});
   if (typeof chrome.runtime.onMessage.addListener == "function") {
     let nativeAddListener = chrome.runtime.onMessage.addListener;
     chrome.runtime.onMessage.addListener = (...args) => {
       addMessageListener(...args), nativeAddListener.apply(chrome.runtime.onMessage, args);
     };
   } else
     chrome.runtime.onMessage.addListener = addMessageListener;
 
   // src/generators/theme-engines.ts
   var theme_engines_default = {
     cssFilter: "cssFilter",
     svgFilter: "svgFilter",
     staticTheme: "staticTheme",
     dynamicTheme: "dynamicTheme"
   };
 
   // src/defaults.ts
   var DEFAULT_COLORS = {
     darkScheme: {
       background: "#181a1b",
       text: "#e8e6e3"
     },
     lightScheme: {
       background: "#dcdad7",
       text: "#181a1b"
     }
   }, DEFAULT_THEME = {
     mode: 1,
     brightness: 100,
     contrast: 100,
     grayscale: 0,
     sepia: 0,
     useFont: !1,
     fontFamily: isMacOS ? "Helvetica Neue" : isWindows ? "Segoe UI" : "Open Sans",
     textStroke: 0,
     engine: theme_engines_default.dynamicTheme,
     stylesheet: "",
     darkSchemeBackgroundColor: DEFAULT_COLORS.darkScheme.background,
     darkSchemeTextColor: DEFAULT_COLORS.darkScheme.text,
     lightSchemeBackgroundColor: DEFAULT_COLORS.lightScheme.background,
     lightSchemeTextColor: DEFAULT_COLORS.lightScheme.text,
     scrollbarColor: isMacOS ? "" : "auto",
     selectionColor: "auto",
     styleSystemControls: !0
   };
 
   // src/utils/array.ts
   function isArrayLike(items) {
     return items.length != null;
   }
   function forEach(items, iterator) {
     if (isArrayLike(items))
       for (let i = 0, len = items.length; i < len; i++)
         iterator(items[i]);
     else
       for (let item of items)
         iterator(item);
   }
   function push(array, addition) {
     forEach(addition, (a) => array.push(a));
   }
   function toArray(items) {
     let results = [];
     for (let i = 0, len = items.length; i < len; i++)
       results.push(items[i]);
     return results;
   }
 
   // src/inject/utils/log.ts
   function logInfo(...args) {
   }
   function logWarn(...args) {
   }
 
   // src/inject/utils/throttle.ts
   function throttle(callback) {
     let pending = !1, frameId = null, lastArgs;
     return Object.assign((...args) => {
       lastArgs = args, frameId ? pending = !0 : (callback(...lastArgs), frameId = requestAnimationFrame(() => {
         frameId = null, pending && (callback(...lastArgs), pending = !1);
       }));
     }, {cancel: () => {
       cancelAnimationFrame(frameId), pending = !1, frameId = null;
     }});
   }
   function createAsyncTasksQueue() {
     let tasks = [], frameId = null;
     function runTasks() {
       let task;
       for (; task = tasks.shift(); )
         task();
       frameId = null;
     }
     function add(task) {
       tasks.push(task), frameId || (frameId = requestAnimationFrame(runTasks));
     }
     function cancel() {
       tasks.splice(0), cancelAnimationFrame(frameId), frameId = null;
     }
     return {add, cancel};
   }
 
   // src/inject/utils/dom.ts
   function removeNode(node) {
     node && node.parentNode && node.parentNode.removeChild(node);
   }
   function watchForNodePosition(node, mode, onRestore = Function.prototype) {
     let MAX_ATTEMPTS_COUNT = 10, RETRY_TIMEOUT = getDuration({seconds: 2}), ATTEMPTS_INTERVAL = getDuration({seconds: 10}), prevSibling = node.previousSibling, parent = node.parentNode;
     if (!parent)
       throw new Error("Unable to watch for node position: parent element not found");
     if (mode === "prev-sibling" && !prevSibling)
       throw new Error("Unable to watch for node position: there is no previous sibling");
     let attempts = 0, start = null, timeoutId = null, restore = throttle(() => {
       if (timeoutId)
         return;
       attempts++;
       let now = Date.now();
       if (start == null)
         start = now;
       else if (attempts >= MAX_ATTEMPTS_COUNT) {
         if (now - start < ATTEMPTS_INTERVAL) {
           logWarn(`Node position watcher paused: retry in ${RETRY_TIMEOUT}ms`, node, prevSibling), timeoutId = setTimeout(() => {
             start = null, attempts = 0, timeoutId = null, restore();
           }, RETRY_TIMEOUT);
           return;
         }
         start = now, attempts = 1;
       }
       if (mode === "parent" && prevSibling && prevSibling.parentNode !== parent) {
         logWarn("Unable to restore node position: sibling parent changed", node, prevSibling, parent), stop();
         return;
       }
       if (mode === "prev-sibling") {
         if (prevSibling.parentNode == null) {
           logWarn("Unable to restore node position: sibling was removed", node, prevSibling, parent), stop();
           return;
         }
         prevSibling.parentNode !== parent && (logWarn("Style was moved to another parent", node, prevSibling, parent), updateParent(prevSibling.parentNode));
       }
       logWarn("Restoring node position", node, prevSibling, parent), parent.insertBefore(node, prevSibling ? prevSibling.nextSibling : parent.firstChild), observer2.takeRecords(), onRestore && onRestore();
     }), observer2 = new MutationObserver(() => {
       (mode === "parent" && node.parentNode !== parent || mode === "prev-sibling" && node.previousSibling !== prevSibling) && restore();
     }), run = () => {
       observer2.observe(parent, {childList: !0});
     }, stop = () => {
       clearTimeout(timeoutId), observer2.disconnect(), restore.cancel();
     }, skip = () => {
       observer2.takeRecords();
     }, updateParent = (parentNode) => {
       parent = parentNode, stop(), run();
     };
     return run(), {run, stop, skip};
   }
   function iterateShadowHosts(root, iterator) {
     if (root == null)
       return;
     let walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
       acceptNode(node) {
         return node.shadowRoot == null ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
       }
     });
     for (let node = root.shadowRoot ? walker.currentNode : walker.nextNode(); node != null; node = walker.nextNode())
       iterator(node), iterateShadowHosts(node.shadowRoot, iterator);
   }
   function isDOMReady() {
     return document.readyState === "complete" || document.readyState === "interactive";
   }
   var readyStateListeners = new Set();
   function addDOMReadyListener(listener) {
     readyStateListeners.add(listener);
   }
   function removeDOMReadyListener(listener) {
     readyStateListeners.delete(listener);
   }
   if (!isDOMReady()) {
     let onReadyStateChange = () => {
       isDOMReady() && (document.removeEventListener("readystatechange", onReadyStateChange), readyStateListeners.forEach((listener) => listener()), readyStateListeners.clear());
     };
     document.addEventListener("readystatechange", onReadyStateChange);
   }
   var HUGE_MUTATIONS_COUNT = 1e3;
   function isHugeMutation(mutations) {
     if (mutations.length > HUGE_MUTATIONS_COUNT)
       return !0;
     let addedNodesCount = 0;
     for (let i = 0; i < mutations.length; i++)
       if (addedNodesCount += mutations[i].addedNodes.length, addedNodesCount > HUGE_MUTATIONS_COUNT)
         return !0;
     return !1;
   }
   function getElementsTreeOperations(mutations) {
     let additions = new Set(), deletions = new Set(), moves = new Set();
     mutations.forEach((m) => {
       forEach(m.addedNodes, (n) => {
         n instanceof Element && n.isConnected && additions.add(n);
       }), forEach(m.removedNodes, (n) => {
         n instanceof Element && (n.isConnected ? moves.add(n) : deletions.add(n));
       });
     }), moves.forEach((n) => additions.delete(n));
     let duplicateAdditions = [], duplicateDeletions = [];
     return additions.forEach((node) => {
       additions.has(node.parentElement) && duplicateAdditions.push(node);
     }), deletions.forEach((node) => {
       deletions.has(node.parentElement) && duplicateDeletions.push(node);
     }), duplicateAdditions.forEach((node) => additions.delete(node)), duplicateDeletions.forEach((node) => deletions.delete(node)), {additions, moves, deletions};
   }
   var optimizedTreeObservers = new Map(), optimizedTreeCallbacks = new WeakMap();
   function createOptimizedTreeObserver(root, callbacks) {
     let observer2, observerCallbacks, domReadyListener;
     if (optimizedTreeObservers.has(root))
       observer2 = optimizedTreeObservers.get(root), observerCallbacks = optimizedTreeCallbacks.get(observer2);
     else {
       let hadHugeMutationsBefore = !1, subscribedForReadyState = !1;
       observer2 = new MutationObserver((mutations) => {
         if (isHugeMutation(mutations))
           !hadHugeMutationsBefore || isDOMReady() ? observerCallbacks.forEach(({onHugeMutations}) => onHugeMutations(root)) : subscribedForReadyState || (domReadyListener = () => observerCallbacks.forEach(({onHugeMutations}) => onHugeMutations(root)), addDOMReadyListener(domReadyListener), subscribedForReadyState = !0), hadHugeMutationsBefore = !0;
         else {
           let elementsOperations = getElementsTreeOperations(mutations);
           observerCallbacks.forEach(({onMinorMutations}) => onMinorMutations(elementsOperations));
         }
       }), observer2.observe(root, {childList: !0, subtree: !0}), optimizedTreeObservers.set(root, observer2), observerCallbacks = new Set(), optimizedTreeCallbacks.set(observer2, observerCallbacks);
     }
     return observerCallbacks.add(callbacks), {
       disconnect() {
         observerCallbacks.delete(callbacks), domReadyListener && removeDOMReadyListener(domReadyListener), observerCallbacks.size === 0 && (observer2.disconnect(), optimizedTreeCallbacks.delete(observer2), optimizedTreeObservers.delete(root));
       }
     };
   }
 
   // src/utils/url.ts
   var anchor, parsedURLCache = new Map();
   function fixBaseURL($url) {
     return anchor || (anchor = document.createElement("a")), anchor.href = $url, anchor.href;
   }
   function parseURL($url, $base = null) {
     let key = `${$url}${$base ? ";" + $base : ""}`;
     if (parsedURLCache.has(key))
       return parsedURLCache.get(key);
     if ($base) {
       let parsedURL2 = new URL($url, fixBaseURL($base));
       return parsedURLCache.set(key, parsedURL2), parsedURL2;
     }
     let parsedURL = new URL(fixBaseURL($url));
     return parsedURLCache.set($url, parsedURL), parsedURL;
   }
   function getAbsoluteURL($base, $relative) {
     if ($relative.match(/^data\:/))
       return $relative;
     let b = parseURL($base);
     return parseURL($relative, b.href).href;
   }
 
   // src/inject/dynamic-theme/css-rules.ts
   function iterateCSSRules(rules, iterate) {
     forEach(rules, (rule) => {
       if (rule instanceof CSSMediaRule) {
         let media = Array.from(rule.media), isScreenOrAll = media.some((m) => m.startsWith("screen") || m.startsWith("all")), isPrintOrSpeech = media.some((m) => m.startsWith("print") || m.startsWith("speech"));
         (isScreenOrAll || !isPrintOrSpeech) && iterateCSSRules(rule.cssRules, iterate);
       } else if (rule instanceof CSSStyleRule)
         iterate(rule);
       else if (rule instanceof CSSImportRule)
         try {
           iterateCSSRules(rule.styleSheet.cssRules, iterate);
         } catch (err) {
           logWarn(err);
         }
       else
         rule instanceof CSSSupportsRule ? CSS.supports(rule.conditionText) && iterateCSSRules(rule.cssRules, iterate) : logWarn("CSSRule type not supported", rule);
     });
   }
   var shorthandVarDependantProperties = [
     "background",
     "border",
     "border-color",
     "border-bottom",
     "border-left",
     "border-right",
     "border-top",
     "outline",
     "outline-color"
   ], shorthandVarDepPropRegexps = isSafari ? shorthandVarDependantProperties.map((prop) => {
     let regexp = new RegExp(`${prop}:s*(.*?)s*;`);
     return [prop, regexp];
   }) : null;
   function iterateCSSDeclarations(style, iterate) {
     forEach(style, (property) => {
       let value = style.getPropertyValue(property).trim();
       !value || iterate(property, value);
     }), isSafari && style.cssText.includes("var(") ? shorthandVarDepPropRegexps.forEach(([prop, regexp]) => {
       let match = style.cssText.match(regexp);
       if (match && match[1]) {
         let val = match[1].trim();
         iterate(prop, val);
       }
     }) : shorthandVarDependantProperties.forEach((prop) => {
       let val = style.getPropertyValue(prop);
       val && val.includes("var(") && iterate(prop, val);
     });
   }
   var cssURLRegex = /url\((('.+?')|(".+?")|([^\)]*?))\)/g, cssImportRegex = /@import\s*(url\()?(('.+?')|(".+?")|([^\)]*?))\)?;?/g;
   function getCSSURLValue(cssURL) {
     return cssURL.replace(/^url\((.*)\)$/, "$1").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
   }
   function getCSSBaseBath(url) {
     let cssURL = parseURL(url);
     return `${cssURL.origin}${cssURL.pathname.replace(/\?.*$/, "").replace(/(\/)([^\/]+)$/i, "$1")}`;
   }
   function replaceCSSRelativeURLsWithAbsolute($css, cssBasePath) {
     return $css.replace(cssURLRegex, (match) => {
       let pathValue = getCSSURLValue(match);
       return `url("${getAbsoluteURL(cssBasePath, pathValue)}")`;
     });
   }
   var cssCommentsRegex = /\/\*[\s\S]*?\*\//g;
   function removeCSSComments($css) {
     return $css.replace(cssCommentsRegex, "");
   }
   var fontFaceRegex = /@font-face\s*{[^}]*}/g;
   function replaceCSSFontFace($css) {
     return $css.replace(fontFaceRegex, "");
   }
 
   // src/utils/color.ts
   function hslToRGB({h, s, l, a = 1}) {
     if (s === 0) {
       let [r2, b2, g2] = [l, l, l].map((x2) => Math.round(x2 * 255));
       return {r: r2, g: g2, b: b2, a};
     }
     let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l - c / 2, [r, g, b] = (h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]).map((n) => Math.round((n + m) * 255));
     return {r, g, b, a};
   }
   function rgbToHSL({r: r255, g: g255, b: b255, a = 1}) {
     let r = r255 / 255, g = g255 / 255, b = b255 / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min, l = (max + min) / 2;
     if (c === 0)
       return {h: 0, s: 0, l, a};
     let h = (max === r ? (g - b) / c % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4) * 60;
     h < 0 && (h += 360);
     let s = c / (1 - Math.abs(2 * l - 1));
     return {h, s, l, a};
   }
   function toFixed(n, digits = 0) {
     let fixed = n.toFixed(digits);
     if (digits === 0)
       return fixed;
     let dot = fixed.indexOf(".");
     if (dot >= 0) {
       let zerosMatch = fixed.match(/0+$/);
       if (zerosMatch)
         return zerosMatch.index === dot + 1 ? fixed.substring(0, dot) : fixed.substring(0, zerosMatch.index);
     }
     return fixed;
   }
   function rgbToString(rgb) {
     let {r, g, b, a} = rgb;
     return a != null && a < 1 ? `rgba(${toFixed(r)}, ${toFixed(g)}, ${toFixed(b)}, ${toFixed(a, 2)})` : `rgb(${toFixed(r)}, ${toFixed(g)}, ${toFixed(b)})`;
   }
   function rgbToHexString({r, g, b, a}) {
     return `#${(a != null && a < 1 ? [r, g, b, Math.round(a * 255)] : [r, g, b]).map((x) => `${x < 16 ? "0" : ""}${x.toString(16)}`).join("")}`;
   }
   function hslToString(hsl) {
     let {h, s, l, a} = hsl;
     return a != null && a < 1 ? `hsla(${toFixed(h)}, ${toFixed(s * 100)}%, ${toFixed(l * 100)}%, ${toFixed(a, 2)})` : `hsl(${toFixed(h)}, ${toFixed(s * 100)}%, ${toFixed(l * 100)}%)`;
   }
   var rgbMatch = /^rgba?\([^\(\)]+\)$/, hslMatch = /^hsla?\([^\(\)]+\)$/, hexMatch = /^#[0-9a-f]+$/i;
   function parse($color) {
     let c = $color.trim().toLowerCase();
     if (c.match(rgbMatch))
       return parseRGB(c);
     if (c.match(hslMatch))
       return parseHSL(c);
     if (c.match(hexMatch))
       return parseHex(c);
     if (knownColors.has(c))
       return getColorByName(c);
     if (systemColors.has(c))
       return getSystemColor(c);
     if ($color === "transparent")
       return {r: 0, g: 0, b: 0, a: 0};
     throw new Error(`Unable to parse ${$color}`);
   }
   function getNumbersFromString(str, splitter, range, units) {
     let raw = str.split(splitter).filter((x) => x), unitsList = Object.entries(units);
     return raw.map((r) => r.trim()).map((r, i) => {
       let n, unit = unitsList.find(([u]) => r.endsWith(u));
       return unit ? n = parseFloat(r.substring(0, r.length - unit[0].length)) / unit[1] * range[i] : n = parseFloat(r), range[i] > 1 ? Math.round(n) : n;
     });
   }
   var rgbSplitter = /rgba?|\(|\)|\/|,|\s/ig, rgbRange = [255, 255, 255, 1], rgbUnits = {"%": 100};
   function parseRGB($rgb) {
     let [r, g, b, a = 1] = getNumbersFromString($rgb, rgbSplitter, rgbRange, rgbUnits);
     return {r, g, b, a};
   }
   var hslSplitter = /hsla?|\(|\)|\/|,|\s/ig, hslRange = [360, 1, 1, 1], hslUnits = {"%": 100, deg: 360, rad: 2 * Math.PI, turn: 1};
   function parseHSL($hsl) {
     let [h, s, l, a = 1] = getNumbersFromString($hsl, hslSplitter, hslRange, hslUnits);
     return hslToRGB({h, s, l, a});
   }
   function parseHex($hex) {
     let h = $hex.substring(1);
     switch (h.length) {
       case 3:
       case 4: {
         let [r, g, b] = [0, 1, 2].map((i) => parseInt(`${h[i]}${h[i]}`, 16)), a = h.length === 3 ? 1 : parseInt(`${h[3]}${h[3]}`, 16) / 255;
         return {r, g, b, a};
       }
       case 6:
       case 8: {
         let [r, g, b] = [0, 2, 4].map((i) => parseInt(h.substring(i, i + 2), 16)), a = h.length === 6 ? 1 : parseInt(h.substring(6, 8), 16) / 255;
         return {r, g, b, a};
       }
     }
     throw new Error(`Unable to parse ${$hex}`);
   }
   function getColorByName($color) {
     let n = knownColors.get($color);
     return {
       r: n >> 16 & 255,
       g: n >> 8 & 255,
       b: n >> 0 & 255,
       a: 1
     };
   }
   function getSystemColor($color) {
     let n = systemColors.get($color);
     return {
       r: n >> 16 & 255,
       g: n >> 8 & 255,
       b: n >> 0 & 255,
       a: 1
     };
   }
   var knownColors = new Map(Object.entries({
     aliceblue: 15792383,
     antiquewhite: 16444375,
     aqua: 65535,
     aquamarine: 8388564,
     azure: 15794175,
     beige: 16119260,
     bisque: 16770244,
     black: 0,
     blanchedalmond: 16772045,
     blue: 255,
     blueviolet: 9055202,
     brown: 10824234,
     burlywood: 14596231,
     cadetblue: 6266528,
     chartreuse: 8388352,
     chocolate: 13789470,
     coral: 16744272,
     cornflowerblue: 6591981,
     cornsilk: 16775388,
     crimson: 14423100,
     cyan: 65535,
     darkblue: 139,
     darkcyan: 35723,
     darkgoldenrod: 12092939,
     darkgray: 11119017,
     darkgrey: 11119017,
     darkgreen: 25600,
     darkkhaki: 12433259,
     darkmagenta: 9109643,
     darkolivegreen: 5597999,
     darkorange: 16747520,
     darkorchid: 10040012,
     darkred: 9109504,
     darksalmon: 15308410,
     darkseagreen: 9419919,
     darkslateblue: 4734347,
     darkslategray: 3100495,
     darkslategrey: 3100495,
     darkturquoise: 52945,
     darkviolet: 9699539,
     deeppink: 16716947,
     deepskyblue: 49151,
     dimgray: 6908265,
     dimgrey: 6908265,
     dodgerblue: 2003199,
     firebrick: 11674146,
     floralwhite: 16775920,
     forestgreen: 2263842,
     fuchsia: 16711935,
     gainsboro: 14474460,
     ghostwhite: 16316671,
     gold: 16766720,
     goldenrod: 14329120,
     gray: 8421504,
     grey: 8421504,
     green: 32768,
     greenyellow: 11403055,
     honeydew: 15794160,
     hotpink: 16738740,
     indianred: 13458524,
     indigo: 4915330,
     ivory: 16777200,
     khaki: 15787660,
     lavender: 15132410,
     lavenderblush: 16773365,
     lawngreen: 8190976,
     lemonchiffon: 16775885,
     lightblue: 11393254,
     lightcoral: 15761536,
     lightcyan: 14745599,
     lightgoldenrodyellow: 16448210,
     lightgray: 13882323,
     lightgrey: 13882323,
     lightgreen: 9498256,
     lightpink: 16758465,
     lightsalmon: 16752762,
     lightseagreen: 2142890,
     lightskyblue: 8900346,
     lightslategray: 7833753,
     lightslategrey: 7833753,
     lightsteelblue: 11584734,
     lightyellow: 16777184,
     lime: 65280,
     limegreen: 3329330,
     linen: 16445670,
     magenta: 16711935,
     maroon: 8388608,
     mediumaquamarine: 6737322,
     mediumblue: 205,
     mediumorchid: 12211667,
     mediumpurple: 9662683,
     mediumseagreen: 3978097,
     mediumslateblue: 8087790,
     mediumspringgreen: 64154,
     mediumturquoise: 4772300,
     mediumvioletred: 13047173,
     midnightblue: 1644912,
     mintcream: 16121850,
     mistyrose: 16770273,
     moccasin: 16770229,
     navajowhite: 16768685,
     navy: 128,
     oldlace: 16643558,
     olive: 8421376,
     olivedrab: 7048739,
     orange: 16753920,
     orangered: 16729344,
     orchid: 14315734,
     palegoldenrod: 15657130,
     palegreen: 10025880,
     paleturquoise: 11529966,
     palevioletred: 14381203,
     papayawhip: 16773077,
     peachpuff: 16767673,
     peru: 13468991,
     pink: 16761035,
     plum: 14524637,
     powderblue: 11591910,
     purple: 8388736,
     rebeccapurple: 6697881,
     red: 16711680,
     rosybrown: 12357519,
     royalblue: 4286945,
     saddlebrown: 9127187,
     salmon: 16416882,
     sandybrown: 16032864,
     seagreen: 3050327,
     seashell: 16774638,
     sienna: 10506797,
     silver: 12632256,
     skyblue: 8900331,
     slateblue: 6970061,
     slategray: 7372944,
     slategrey: 7372944,
     snow: 16775930,
     springgreen: 65407,
     steelblue: 4620980,
     tan: 13808780,
     teal: 32896,
     thistle: 14204888,
     tomato: 16737095,
     turquoise: 4251856,
     violet: 15631086,
     wheat: 16113331,
     white: 16777215,
     whitesmoke: 16119285,
     yellow: 16776960,
     yellowgreen: 10145074
   })), systemColors = new Map(Object.entries({
     ActiveBorder: 3906044,
     ActiveCaption: 0,
     AppWorkspace: 11184810,
     Background: 6513614,
     ButtonFace: 16777215,
     ButtonHighlight: 15329769,
     ButtonShadow: 10461343,
     ButtonText: 0,
     CaptionText: 0,
     GrayText: 8355711,
     Highlight: 11720703,
     HighlightText: 0,
     InactiveBorder: 16777215,
     InactiveCaption: 16777215,
     InactiveCaptionText: 0,
     InfoBackground: 16514245,
     InfoText: 0,
     Menu: 16185078,
     MenuText: 16777215,
     Scrollbar: 11184810,
     ThreeDDarkShadow: 0,
     ThreeDFace: 12632256,
     ThreeDHighlight: 16777215,
     ThreeDLightShadow: 16777215,
     ThreeDShadow: 0,
     Window: 15527148,
     WindowFrame: 11184810,
     WindowText: 0,
     "-webkit-focus-ring-color": 15046400
   }).map(([key, value]) => [key.toLowerCase(), value]));
 
   // src/utils/math.ts
   function scale(x, inLow, inHigh, outLow, outHigh) {
     return (x - inLow) * (outHigh - outLow) / (inHigh - inLow) + outLow;
   }
   function clamp(x, min, max) {
     return Math.min(max, Math.max(min, x));
   }
   function multiplyMatrices(m1, m2) {
     let result = [];
     for (let i = 0, len = m1.length; i < len; i++) {
       result[i] = [];
       for (let j = 0, len2 = m2[0].length; j < len2; j++) {
         let sum = 0;
         for (let k = 0, len3 = m1[0].length; k < len3; k++)
           sum += m1[i][k] * m2[k][j];
         result[i][j] = sum;
       }
     }
     return result;
   }
 
   // src/utils/text.ts
   function getMatches(regex, input, group = 0) {
     let matches = [], m;
     for (; m = regex.exec(input); )
       matches.push(m[group]);
     return matches;
   }
   function formatCSS(text) {
     function trimLeft(text2) {
       return text2.replace(/^\s+/, "");
     }
     function getIndent(depth2) {
       return depth2 === 0 ? "" : " ".repeat(4 * depth2);
     }
     let emptyRuleRegexp = /[^{}]+{\s*}/g;
     for (; emptyRuleRegexp.test(text); )
       text = text.replace(emptyRuleRegexp, "");
     let css = text.replace(/\s{2,}/g, " ").replace(/\{/g, `{
 `).replace(/\}/g, `
 }
 `).replace(/\;(?![^\(|\"]*(\)|\"))/g, `;
 `).replace(/\,(?![^\(|\"]*(\)|\"))/g, `,
 `).replace(/\n\s*\n/g, `
 `).split(`
 `), depth = 0, formatted = [];
     for (let x = 0, len = css.length; x < len; x++) {
       let line = css[x] + `
 `;
       line.match(/\{/) ? formatted.push(getIndent(depth++) + trimLeft(line)) : line.match(/\}/) ? formatted.push(getIndent(--depth) + trimLeft(line)) : formatted.push(getIndent(depth) + trimLeft(line));
     }
     return formatted.join("").trim();
   }
   function getParenthesesRange(input, searchStartIndex = 0) {
     let length = input.length, depth = 0, firstOpenIndex = -1;
     for (let i = searchStartIndex; i < length; i++)
       if (depth === 0) {
         let openIndex = input.indexOf("(", i);
         if (openIndex < 0)
           break;
         firstOpenIndex = openIndex, depth++, i = openIndex;
       } else {
         let closingIndex = input.indexOf(")", i);
         if (closingIndex < 0)
           break;
         let openIndex = input.indexOf("(", i);
         if (openIndex < 0 || closingIndex < openIndex) {
           if (depth--, depth === 0)
             return {start: firstOpenIndex, end: closingIndex + 1};
           i = closingIndex;
         } else
           depth++, i = openIndex;
       }
     return null;
   }
 
   // src/generators/utils/matrix.ts
   function createFilterMatrix(config) {
     let m = Matrix.identity();
     return config.sepia !== 0 && (m = multiplyMatrices(m, Matrix.sepia(config.sepia / 100))), config.grayscale !== 0 && (m = multiplyMatrices(m, Matrix.grayscale(config.grayscale / 100))), config.contrast !== 100 && (m = multiplyMatrices(m, Matrix.contrast(config.contrast / 100))), config.brightness !== 100 && (m = multiplyMatrices(m, Matrix.brightness(config.brightness / 100))), config.mode === 1 && (m = multiplyMatrices(m, Matrix.invertNHue())), m;
   }
   function applyColorMatrix([r, g, b], matrix) {
     let rgb = [[r / 255], [g / 255], [b / 255], [1], [1]], result = multiplyMatrices(matrix, rgb);
     return [0, 1, 2].map((i) => clamp(Math.round(result[i][0] * 255), 0, 255));
   }
   var Matrix = {
     identity() {
       return [
         [1, 0, 0, 0, 0],
         [0, 1, 0, 0, 0],
         [0, 0, 1, 0, 0],
         [0, 0, 0, 1, 0],
         [0, 0, 0, 0, 1]
       ];
     },
     invertNHue() {
       return [
         [0.333, -0.667, -0.667, 0, 1],
         [-0.667, 0.333, -0.667, 0, 1],
         [-0.667, -0.667, 0.333, 0, 1],
         [0, 0, 0, 1, 0],
         [0, 0, 0, 0, 1]
       ];
     },
     brightness(v) {
       return [
         [v, 0, 0, 0, 0],
         [0, v, 0, 0, 0],
         [0, 0, v, 0, 0],
         [0, 0, 0, 1, 0],
         [0, 0, 0, 0, 1]
       ];
     },
     contrast(v) {
       let t = (1 - v) / 2;
       return [
         [v, 0, 0, 0, t],
         [0, v, 0, 0, t],
         [0, 0, v, 0, t],
         [0, 0, 0, 1, 0],
         [0, 0, 0, 0, 1]
       ];
     },
     sepia(v) {
       return [
         [0.393 + 0.607 * (1 - v), 0.769 - 0.769 * (1 - v), 0.189 - 0.189 * (1 - v), 0, 0],
         [0.349 - 0.349 * (1 - v), 0.686 + 0.314 * (1 - v), 0.168 - 0.168 * (1 - v), 0, 0],
         [0.272 - 0.272 * (1 - v), 0.534 - 0.534 * (1 - v), 0.131 + 0.869 * (1 - v), 0, 0],
         [0, 0, 0, 1, 0],
         [0, 0, 0, 0, 1]
       ];
     },
     grayscale(v) {
       return [
         [0.2126 + 0.7874 * (1 - v), 0.7152 - 0.7152 * (1 - v), 0.0722 - 0.0722 * (1 - v), 0, 0],
         [0.2126 - 0.2126 * (1 - v), 0.7152 + 0.2848 * (1 - v), 0.0722 - 0.0722 * (1 - v), 0, 0],
         [0.2126 - 0.2126 * (1 - v), 0.7152 - 0.7152 * (1 - v), 0.0722 + 0.9278 * (1 - v), 0, 0],
         [0, 0, 0, 1, 0],
         [0, 0, 0, 0, 1]
       ];
     }
   };
 
   // src/generators/modify-colors.ts
   function getBgPole(theme) {
     let prop = theme.mode === 1 ? "darkSchemeBackgroundColor" : "lightSchemeBackgroundColor";
     return theme[prop];
   }
   function getFgPole(theme) {
     let prop = theme.mode === 1 ? "darkSchemeTextColor" : "lightSchemeTextColor";
     return theme[prop];
   }
   var colorModificationCache = new Map(), colorParseCache = new Map();
   function parseToHSLWithCache(color) {
     if (colorParseCache.has(color))
       return colorParseCache.get(color);
     let rgb = parse(color), hsl = rgbToHSL(rgb);
     return colorParseCache.set(color, hsl), hsl;
   }
   function clearColorModificationCache() {
     colorModificationCache.clear(), colorParseCache.clear();
   }
   var rgbCacheKeys = ["r", "g", "b", "a"], themeCacheKeys = ["mode", "brightness", "contrast", "grayscale", "sepia", "darkSchemeBackgroundColor", "darkSchemeTextColor", "lightSchemeBackgroundColor", "lightSchemeTextColor"];
   function getCacheId(rgb, theme) {
     return rgbCacheKeys.map((k) => rgb[k]).concat(themeCacheKeys.map((k) => theme[k])).join(";");
   }
   function modifyColorWithCache(rgb, theme, modifyHSL, poleColor, anotherPoleColor) {
     let fnCache;
     colorModificationCache.has(modifyHSL) ? fnCache = colorModificationCache.get(modifyHSL) : (fnCache = new Map(), colorModificationCache.set(modifyHSL, fnCache));
     let id = getCacheId(rgb, theme);
     if (fnCache.has(id))
       return fnCache.get(id);
     let hsl = rgbToHSL(rgb), pole = poleColor == null ? null : parseToHSLWithCache(poleColor), anotherPole = anotherPoleColor == null ? null : parseToHSLWithCache(anotherPoleColor), modified = modifyHSL(hsl, pole, anotherPole), {r, g, b, a} = hslToRGB(modified), matrix = createFilterMatrix(theme), [rf, gf, bf] = applyColorMatrix([r, g, b], matrix), color = a === 1 ? rgbToHexString({r: rf, g: gf, b: bf}) : rgbToString({r: rf, g: gf, b: bf, a});
     return fnCache.set(id, color), color;
   }
   function noopHSL(hsl) {
     return hsl;
   }
   function modifyColor(rgb, theme) {
     return modifyColorWithCache(rgb, theme, noopHSL);
   }
   function modifyLightSchemeColor(rgb, theme) {
     let poleBg = getBgPole(theme), poleFg = getFgPole(theme);
     return modifyColorWithCache(rgb, theme, modifyLightModeHSL, poleFg, poleBg);
   }
   function modifyLightModeHSL({h, s, l, a}, poleFg, poleBg) {
     let isDark = l < 0.5, isNeutral;
     if (isDark)
       isNeutral = l < 0.2 || s < 0.12;
     else {
       let isBlue = h > 200 && h < 280;
       isNeutral = s < 0.24 || l > 0.8 && isBlue;
     }
     let hx = h, sx = l;
     isNeutral && (isDark ? (hx = poleFg.h, sx = poleFg.s) : (hx = poleBg.h, sx = poleBg.s));
     let lx = scale(l, 0, 1, poleFg.l, poleBg.l);
     return {h: hx, s: sx, l: lx, a};
   }
   var MAX_BG_LIGHTNESS = 0.4;
   function modifyBgHSL({h, s, l, a}, pole) {
     let isDark = l < 0.5, isBlue = h > 200 && h < 280, isNeutral = s < 0.12 || l > 0.8 && isBlue;
     if (isDark) {
       let lx2 = scale(l, 0, 0.5, 0, MAX_BG_LIGHTNESS);
       if (isNeutral) {
         let hx2 = pole.h, sx = pole.s;
         return {h: hx2, s: sx, l: lx2, a};
       }
       return {h, s, l: lx2, a};
     }
     let lx = scale(l, 0.5, 1, MAX_BG_LIGHTNESS, pole.l);
     if (isNeutral) {
       let hx2 = pole.h, sx = pole.s;
       return {h: hx2, s: sx, l: lx, a};
     }
     let hx = h;
     return h > 60 && h < 180 && (h > 120 ? hx = scale(h, 120, 180, 135, 180) : hx = scale(h, 60, 120, 60, 105)), {h: hx, s, l: lx, a};
   }
   function modifyBackgroundColor(rgb, theme) {
     if (theme.mode === 0)
       return modifyLightSchemeColor(rgb, theme);
     let pole = getBgPole(theme);
     return modifyColorWithCache(rgb, {...theme, mode: 0}, modifyBgHSL, pole);
   }
   var MIN_FG_LIGHTNESS = 0.55;
   function modifyBlueFgHue(hue) {
     return scale(hue, 205, 245, 205, 220);
   }
   function modifyFgHSL({h, s, l, a}, pole) {
     let isLight = l > 0.5, isNeutral = l < 0.2 || s < 0.24, isBlue = !isNeutral && h > 205 && h < 245;
     if (isLight) {
       let lx2 = scale(l, 0.5, 1, MIN_FG_LIGHTNESS, pole.l);
       if (isNeutral) {
         let hx3 = pole.h, sx = pole.s;
         return {h: hx3, s: sx, l: lx2, a};
       }
       let hx2 = h;
       return isBlue && (hx2 = modifyBlueFgHue(h)), {h: hx2, s, l: lx2, a};
     }
     if (isNeutral) {
       let hx2 = pole.h, sx = pole.s, lx2 = scale(l, 0, 0.5, pole.l, MIN_FG_LIGHTNESS);
       return {h: hx2, s: sx, l: lx2, a};
     }
     let hx = h, lx;
     return isBlue ? (hx = modifyBlueFgHue(h), lx = scale(l, 0, 0.5, pole.l, Math.min(1, MIN_FG_LIGHTNESS + 0.05))) : lx = scale(l, 0, 0.5, pole.l, MIN_FG_LIGHTNESS), {h: hx, s, l: lx, a};
   }
   function modifyForegroundColor(rgb, theme) {
     if (theme.mode === 0)
       return modifyLightSchemeColor(rgb, theme);
     let pole = getFgPole(theme);
     return modifyColorWithCache(rgb, {...theme, mode: 0}, modifyFgHSL, pole);
   }
   function modifyBorderHSL({h, s, l, a}, poleFg, poleBg) {
     let isDark = l < 0.5, isNeutral = l < 0.2 || s < 0.24, hx = h, sx = s;
     isNeutral && (isDark ? (hx = poleFg.h, sx = poleFg.s) : (hx = poleBg.h, sx = poleBg.s));
     let lx = scale(l, 0, 1, 0.5, 0.2);
     return {h: hx, s: sx, l: lx, a};
   }
   function modifyBorderColor(rgb, theme) {
     if (theme.mode === 0)
       return modifyLightSchemeColor(rgb, theme);
     let poleFg = getFgPole(theme), poleBg = getBgPole(theme);
     return modifyColorWithCache(rgb, {...theme, mode: 0}, modifyBorderHSL, poleFg, poleBg);
   }
   function modifyShadowColor(rgb, filter2) {
     return modifyBackgroundColor(rgb, filter2);
   }
   function modifyGradientColor(rgb, filter2) {
     return modifyBackgroundColor(rgb, filter2);
   }
 
   // src/generators/text-style.ts
   function createTextStyle(config) {
     let lines = [];
     return lines.push("*:not(pre) {"), config.useFont && config.fontFamily && lines.push(`  font-family: ${config.fontFamily} !important;`), config.textStroke > 0 && (lines.push(`  -webkit-text-stroke: ${config.textStroke}px !important;`), lines.push(`  text-stroke: ${config.textStroke}px !important;`)), lines.push("}"), lines.join(`
 `);
   }
 
   // src/generators/css-filter.ts
   var FilterMode;
   (function(FilterMode2) {
     FilterMode2[FilterMode2.light = 0] = "light", FilterMode2[FilterMode2.dark = 1] = "dark";
   })(FilterMode || (FilterMode = {}));
   function getCSSFilterValue(config) {
     let filters = [];
     return config.mode === 1 && filters.push("invert(100%) hue-rotate(180deg)"), config.brightness !== 100 && filters.push(`brightness(${config.brightness}%)`), config.contrast !== 100 && filters.push(`contrast(${config.contrast}%)`), config.grayscale !== 0 && filters.push(`grayscale(${config.grayscale}%)`), config.sepia !== 0 && filters.push(`sepia(${config.sepia}%)`), filters.length === 0 ? null : filters.join(" ");
   }
 
   // src/generators/svg-filter.ts
   function toSVGMatrix(matrix) {
     return matrix.slice(0, 4).map((m) => m.map((m2) => m2.toFixed(3)).join(" ")).join(" ");
   }
   function getSVGFilterMatrixValue(config) {
     return toSVGMatrix(createFilterMatrix(config));
   }
 
   // src/inject/dynamic-theme/network.ts
   var counter2 = 0, resolvers2 = new Map(), rejectors = new Map();
   async function bgFetch(request) {
     return new Promise((resolve, reject) => {
       let id = ++counter2;
       resolvers2.set(id, resolve), rejectors.set(id, reject), chrome.runtime.sendMessage({type: "fetch", data: request, id});
     });
   }
   chrome.runtime.onMessage.addListener(({type, data, error, id}) => {
     if (type === "fetch-response") {
       let resolve = resolvers2.get(id), reject = rejectors.get(id);
       resolvers2.delete(id), rejectors.delete(id), error ? reject && reject(error) : resolve && resolve(data);
     }
   });
 
   // src/inject/dynamic-theme/image.ts
   async function getImageDetails(url) {
     let dataURL;
     url.startsWith("data:") ? dataURL = url : dataURL = await getImageDataURL(url);
     let image = await urlToImage(dataURL), info = analyzeImage(image);
     return {
       src: url,
       dataURL,
       width: image.naturalWidth,
       height: image.naturalHeight,
       ...info
     };
   }
   async function getImageDataURL(url) {
     return new URL(url).origin === location.origin ? await loadAsDataURL(url) : await bgFetch({url, responseType: "data-url"});
   }
   async function urlToImage(url) {
     return new Promise((resolve, reject) => {
       let image = new Image();
       image.onload = () => resolve(image), image.onerror = () => reject(`Unable to load image ${url}`), image.src = url;
     });
   }
   var MAX_ANALIZE_PIXELS_COUNT = 32 * 32, canvas, context;
   function createCanvas() {
     let maxWidth = MAX_ANALIZE_PIXELS_COUNT, maxHeight = MAX_ANALIZE_PIXELS_COUNT;
     canvas = document.createElement("canvas"), canvas.width = maxWidth, canvas.height = maxHeight, context = canvas.getContext("2d"), context.imageSmoothingEnabled = !1;
   }
   function removeCanvas() {
     canvas = null, context = null;
   }
   function analyzeImage(image) {
     canvas || createCanvas();
     let {naturalWidth, naturalHeight} = image;
     if (naturalHeight === 0 || naturalWidth === 0)
       return logWarn(`logWarn(Image is empty ${image.currentSrc})`), null;
     let naturalPixelsCount = naturalWidth * naturalHeight, k = Math.min(1, Math.sqrt(MAX_ANALIZE_PIXELS_COUNT / naturalPixelsCount)), width = Math.ceil(naturalWidth * k), height = Math.ceil(naturalHeight * k);
     context.clearRect(0, 0, width, height), context.drawImage(image, 0, 0, naturalWidth, naturalHeight, 0, 0, width, height);
     let d = context.getImageData(0, 0, width, height).data, TRANSPARENT_ALPHA_THRESHOLD = 0.05, DARK_LIGHTNESS_THRESHOLD = 0.4, LIGHT_LIGHTNESS_THRESHOLD = 0.7, transparentPixelsCount = 0, darkPixelsCount = 0, lightPixelsCount = 0, i, x, y, r, g, b, a, l;
     for (y = 0; y < height; y++)
       for (x = 0; x < width; x++)
         i = 4 * (y * width + x), r = d[i + 0] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, a = d[i + 3] / 255, a < TRANSPARENT_ALPHA_THRESHOLD ? transparentPixelsCount++ : (l = 0.2126 * r + 0.7152 * g + 0.0722 * b, l < DARK_LIGHTNESS_THRESHOLD && darkPixelsCount++, l > LIGHT_LIGHTNESS_THRESHOLD && lightPixelsCount++);
     let totalPixelsCount = width * height, opaquePixelsCount = totalPixelsCount - transparentPixelsCount, DARK_IMAGE_THRESHOLD = 0.7, LIGHT_IMAGE_THRESHOLD = 0.7, TRANSPARENT_IMAGE_THRESHOLD = 0.1, LARGE_IMAGE_PIXELS_COUNT = 800 * 600;
     return {
       isDark: darkPixelsCount / opaquePixelsCount >= DARK_IMAGE_THRESHOLD,
       isLight: lightPixelsCount / opaquePixelsCount >= LIGHT_IMAGE_THRESHOLD,
       isTransparent: transparentPixelsCount / totalPixelsCount >= TRANSPARENT_IMAGE_THRESHOLD,
       isLarge: naturalPixelsCount >= LARGE_IMAGE_PIXELS_COUNT
     };
   }
   var objectURLs = new Set();
   function getFilteredImageDataURL({dataURL, width, height}, filter2) {
     let matrix = getSVGFilterMatrixValue(filter2), svg = [
       `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">`,
       "<defs>",
       '<filter id="darkreader-image-filter">',
       `<feColorMatrix type="matrix" values="${matrix}" />`,
       "</filter>",
       "</defs>",
       `<image width="${width}" height="${height}" filter="url(#darkreader-image-filter)" xlink:href="${dataURL}" />`,
       "</svg>"
     ].join(""), bytes = new Uint8Array(svg.length);
     for (let i = 0; i < svg.length; i++)
       bytes[i] = svg.charCodeAt(i);
     let blob = new Blob([bytes], {type: "image/svg+xml"}), objectURL = URL.createObjectURL(blob);
     return objectURLs.add(objectURL), objectURL;
   }
   function cleanImageProcessingCache() {
     removeCanvas(), objectURLs.forEach((u) => URL.revokeObjectURL(u)), objectURLs.clear();
   }
 
   // src/inject/dynamic-theme/modify-css.ts
   function getModifiableCSSDeclaration(property, value, rule, variablesStore2, ignoreImageSelectors, isCancelled) {
     let important = Boolean(rule && rule.style && rule.style.getPropertyPriority(property)), sourceValue = value;
     if (property.startsWith("--")) {
       let modifier = getVariableModifier(variablesStore2, property, value, rule, ignoreImageSelectors, isCancelled);
       if (modifier)
         return {property, value: modifier, important, sourceValue};
     } else if (value.includes("var(")) {
       let modifier = getVariableDependantModifier(variablesStore2, property, value);
       if (modifier)
         return {property, value: modifier, important, sourceValue};
     } else if (property.includes("color") && property !== "-webkit-print-color-adjust" || property === "fill" || property === "stroke" || property === "stop-color") {
       let modifier = getColorModifier(property, value);
       if (modifier)
         return {property, value: modifier, important, sourceValue};
     } else if (property === "background-image" || property === "list-style-image") {
       let modifier = getBgImageModifier(value, rule, ignoreImageSelectors, isCancelled);
       if (modifier)
         return {property, value: modifier, important, sourceValue};
     } else if (property.includes("shadow")) {
       let modifier = getShadowModifier(value);
       if (modifier)
         return {property, value: modifier, important, sourceValue};
     }
     return null;
   }
   function getModifiedUserAgentStyle(theme, isIFrame3, styleSystemControls) {
     let lines = [];
     return isIFrame3 || (lines.push("html {"), lines.push(`    background-color: ${modifyBackgroundColor({r: 255, g: 255, b: 255}, theme)} !important;`), lines.push("}")), lines.push(`${isIFrame3 ? "" : "html, body, "}${styleSystemControls ? "input, textarea, select, button" : ""} {`), lines.push(`    background-color: ${modifyBackgroundColor({r: 255, g: 255, b: 255}, theme)};`), lines.push("}"), lines.push(`html, body, ${styleSystemControls ? "input, textarea, select, button" : ""} {`), lines.push(`    border-color: ${modifyBorderColor({r: 76, g: 76, b: 76}, theme)};`), lines.push(`    color: ${modifyForegroundColor({r: 0, g: 0, b: 0}, theme)};`), lines.push("}"), lines.push("a {"), lines.push(`    color: ${modifyForegroundColor({r: 0, g: 64, b: 255}, theme)};`), lines.push("}"), lines.push("table {"), lines.push(`    border-color: ${modifyBorderColor({r: 128, g: 128, b: 128}, theme)};`), lines.push("}"), lines.push("::placeholder {"), lines.push(`    color: ${modifyForegroundColor({r: 169, g: 169, b: 169}, theme)};`), lines.push("}"), lines.push("input:-webkit-autofill,"), lines.push("textarea:-webkit-autofill,"), lines.push("select:-webkit-autofill {"), lines.push(`    background-color: ${modifyBackgroundColor({r: 250, g: 255, b: 189}, theme)} !important;`), lines.push(`    color: ${modifyForegroundColor({r: 0, g: 0, b: 0}, theme)} !important;`), lines.push("}"), theme.scrollbarColor && lines.push(getModifiedScrollbarStyle(theme)), theme.selectionColor && lines.push(getModifiedSelectionStyle(theme)), lines.join(`
 `);
   }
   function getSelectionColor(theme) {
     let backgroundColorSelection, foregroundColorSelection;
     if (theme.selectionColor === "auto")
       backgroundColorSelection = modifyBackgroundColor({r: 0, g: 96, b: 212}, {...theme, grayscale: 0}), foregroundColorSelection = modifyForegroundColor({r: 255, g: 255, b: 255}, {...theme, grayscale: 0});
     else {
       let rgb = parse(theme.selectionColor), hsl = rgbToHSL(rgb);
       backgroundColorSelection = theme.selectionColor, hsl.l < 0.5 ? foregroundColorSelection = "#FFF" : foregroundColorSelection = "#000";
     }
     return {backgroundColorSelection, foregroundColorSelection};
   }
   function getModifiedSelectionStyle(theme) {
     let lines = [], modifiedSelectionColor = getSelectionColor(theme), backgroundColorSelection = modifiedSelectionColor.backgroundColorSelection, foregroundColorSelection = modifiedSelectionColor.foregroundColorSelection;
     return ["::selection", "::-moz-selection"].forEach((selection) => {
       lines.push(`${selection} {`), lines.push(`    background-color: ${backgroundColorSelection} !important;`), lines.push(`    color: ${foregroundColorSelection} !important;`), lines.push("}");
     }), lines.join(`
 `);
   }
   function getModifiedScrollbarStyle(theme) {
     let lines = [], colorTrack, colorIcons, colorThumb, colorThumbHover, colorThumbActive, colorCorner;
     if (theme.scrollbarColor === "auto")
       colorTrack = modifyBackgroundColor({r: 241, g: 241, b: 241}, theme), colorIcons = modifyForegroundColor({r: 96, g: 96, b: 96}, theme), colorThumb = modifyBackgroundColor({r: 176, g: 176, b: 176}, theme), colorThumbHover = modifyBackgroundColor({r: 144, g: 144, b: 144}, theme), colorThumbActive = modifyBackgroundColor({r: 96, g: 96, b: 96}, theme), colorCorner = modifyBackgroundColor({r: 255, g: 255, b: 255}, theme);
     else {
       let rgb = parse(theme.scrollbarColor), hsl = rgbToHSL(rgb), isLight = hsl.l > 0.5, lighten = (lighter) => ({...hsl, l: clamp(hsl.l + lighter, 0, 1)}), darken = (darker) => ({...hsl, l: clamp(hsl.l - darker, 0, 1)});
       colorTrack = hslToString(darken(0.4)), colorIcons = hslToString(isLight ? darken(0.4) : lighten(0.4)), colorThumb = hslToString(hsl), colorThumbHover = hslToString(lighten(0.1)), colorThumbActive = hslToString(lighten(0.2));
     }
     return lines.push("::-webkit-scrollbar {"), lines.push(`    background-color: ${colorTrack};`), lines.push(`    color: ${colorIcons};`), lines.push("}"), lines.push("::-webkit-scrollbar-thumb {"), lines.push(`    background-color: ${colorThumb};`), lines.push("}"), lines.push("::-webkit-scrollbar-thumb:hover {"), lines.push(`    background-color: ${colorThumbHover};`), lines.push("}"), lines.push("::-webkit-scrollbar-thumb:active {"), lines.push(`    background-color: ${colorThumbActive};`), lines.push("}"), lines.push("::-webkit-scrollbar-corner {"), lines.push(`    background-color: ${colorCorner};`), lines.push("}"), isFirefox && (lines.push("* {"), lines.push(`    scrollbar-color: ${colorThumb} ${colorTrack};`), lines.push("}")), lines.join(`
 `);
   }
   function getModifiedFallbackStyle(filter2, {strict}) {
     let lines = [];
     return lines.push(`html, body, ${strict ? "body :not(iframe)" : "body > :not(iframe)"} {`), lines.push(`    background-color: ${modifyBackgroundColor({r: 255, g: 255, b: 255}, filter2)} !important;`), lines.push(`    border-color: ${modifyBorderColor({r: 64, g: 64, b: 64}, filter2)} !important;`), lines.push(`    color: ${modifyForegroundColor({r: 0, g: 0, b: 0}, filter2)} !important;`), lines.push("}"), lines.join(`
 `);
   }
   var unparsableColors = new Set([
     "inherit",
     "transparent",
     "initial",
     "currentcolor",
     "none",
     "unset"
   ]), colorParseCache2 = new Map();
   function parseColorWithCache($color) {
     if ($color = $color.trim(), colorParseCache2.has($color))
       return colorParseCache2.get($color);
     let color = parse($color);
     return colorParseCache2.set($color, color), color;
   }
   function tryParseColor($color) {
     try {
       return parseColorWithCache($color);
     } catch (err) {
       return null;
     }
   }
   function getColorModifier(prop, value) {
     if (unparsableColors.has(value.toLowerCase()))
       return value;
     try {
       let rgb = parseColorWithCache(value);
       return prop.includes("background") ? (filter2) => modifyBackgroundColor(rgb, filter2) : prop.includes("border") || prop.includes("outline") ? (filter2) => modifyBorderColor(rgb, filter2) : (filter2) => modifyForegroundColor(rgb, filter2);
     } catch (err) {
       return logWarn("Color parse error", err), null;
     }
   }
   var gradientRegex = /[\-a-z]+gradient\(([^\(\)]*(\(([^\(\)]*(\(.*?\)))*[^\(\)]*\))){0,15}[^\(\)]*\)/g, imageDetailsCache = new Map(), awaitingForImageLoading = new Map();
   function shouldIgnoreImage(selectorText, selectors) {
     if (!selectorText || selectors.length === 0)
       return !1;
     if (selectors.some((s) => s === "*"))
       return !0;
     let ruleSelectors = selectorText.split(/,\s*/g);
     for (let i = 0; i < selectors.length; i++) {
       let ignoredSelector = selectors[i];
       if (ruleSelectors.some((s) => s === ignoredSelector))
         return !0;
     }
     return !1;
   }
   function getBgImageModifier(value, rule, ignoreImageSelectors, isCancelled) {
     try {
       let gradients = getMatches(gradientRegex, value), urls = getMatches(cssURLRegex, value);
       if (urls.length === 0 && gradients.length === 0)
         return value;
       let getIndices = (matches2) => {
         let index2 = 0;
         return matches2.map((match) => {
           let valueIndex = value.indexOf(match, index2);
           return index2 = valueIndex + match.length, {match, index: valueIndex};
         });
       }, matches = getIndices(urls).map((i) => ({type: "url", ...i})).concat(getIndices(gradients).map((i) => ({type: "gradient", ...i}))).sort((a, b) => a.index - b.index), getGradientModifier = (gradient) => {
         let match = gradient.match(/^(.*-gradient)\((.*)\)$/), type = match[1], content = match[2], partsRegex = /([^\(\),]+(\([^\(\)]*(\([^\(\)]*\)*[^\(\)]*)?\))?[^\(\),]*),?/g, colorStopRegex = /^(from|color-stop|to)\(([^\(\)]*?,\s*)?(.*?)\)$/, parts = getMatches(partsRegex, content, 1).map((part) => {
           part = part.trim();
           let rgb = tryParseColor(part);
           if (rgb)
             return (filter2) => modifyGradientColor(rgb, filter2);
           let space = part.lastIndexOf(" ");
           if (rgb = tryParseColor(part.substring(0, space)), rgb)
             return (filter2) => `${modifyGradientColor(rgb, filter2)} ${part.substring(space + 1)}`;
           let colorStopMatch = part.match(colorStopRegex);
           return colorStopMatch && (rgb = tryParseColor(colorStopMatch[3]), rgb) ? (filter2) => `${colorStopMatch[1]}(${colorStopMatch[2] ? `${colorStopMatch[2]}, ` : ""}${modifyGradientColor(rgb, filter2)})` : () => part;
         });
         return (filter2) => `${type}(${parts.map((modify) => modify(filter2)).join(", ")})`;
       }, getURLModifier = (urlValue) => {
         if (shouldIgnoreImage(rule.selectorText, ignoreImageSelectors))
           return null;
         let url = getCSSURLValue(urlValue), {parentStyleSheet} = rule, baseURL = parentStyleSheet.href ? getCSSBaseBath(parentStyleSheet.href) : parentStyleSheet.ownerNode?.baseURI || location.origin;
         url = getAbsoluteURL(baseURL, url);
         let absoluteValue = `url("${url}")`;
         return async (filter2) => {
           let imageDetails;
           if (imageDetailsCache.has(url))
             imageDetails = imageDetailsCache.get(url);
           else
             try {
               if (awaitingForImageLoading.has(url)) {
                 let awaiters = awaitingForImageLoading.get(url);
                 if (imageDetails = await new Promise((resolve) => awaiters.push(resolve)), !imageDetails)
                   return null;
               } else
                 awaitingForImageLoading.set(url, []), imageDetails = await getImageDetails(url), imageDetailsCache.set(url, imageDetails), awaitingForImageLoading.get(url).forEach((resolve) => resolve(imageDetails)), awaitingForImageLoading.delete(url);
               if (isCancelled())
                 return null;
             } catch (err) {
               return logWarn(err), awaitingForImageLoading.has(url) && (awaitingForImageLoading.get(url).forEach((resolve) => resolve(null)), awaitingForImageLoading.delete(url)), absoluteValue;
             }
           return getBgImageValue(imageDetails, filter2) || absoluteValue;
         };
       }, getBgImageValue = (imageDetails, filter2) => {
         let {isDark, isLight, isTransparent, isLarge, width} = imageDetails, result;
         return isDark && isTransparent && filter2.mode === 1 && !isLarge && width > 2 ? (logInfo(`Inverting dark image ${imageDetails.src}`), result = `url("${getFilteredImageDataURL(imageDetails, {...filter2, sepia: clamp(filter2.sepia + 10, 0, 100)})}")`) : isLight && !isTransparent && filter2.mode === 1 ? isLarge ? result = "none" : (logInfo(`Dimming light image ${imageDetails.src}`), result = `url("${getFilteredImageDataURL(imageDetails, filter2)}")`) : filter2.mode === 0 && isLight && !isLarge ? (logInfo(`Applying filter to image ${imageDetails.src}`), result = `url("${getFilteredImageDataURL(imageDetails, {...filter2, brightness: clamp(filter2.brightness - 10, 5, 200), sepia: clamp(filter2.sepia + 10, 0, 100)})}")`) : result = null, result;
       }, modifiers = [], index = 0;
       return matches.forEach(({match, type, index: matchStart}, i) => {
         let prefixStart = index, matchEnd = matchStart + match.length;
         index = matchEnd, modifiers.push(() => value.substring(prefixStart, matchStart)), modifiers.push(type === "url" ? getURLModifier(match) : getGradientModifier(match)), i === matches.length - 1 && modifiers.push(() => value.substring(matchEnd));
       }), (filter2) => {
         let results = modifiers.filter(Boolean).map((modify) => modify(filter2));
         return results.some((r) => r instanceof Promise) ? Promise.all(results).then((asyncResults) => asyncResults.join("")) : results.join("");
       };
     } catch (err) {
       return logWarn(`Unable to parse gradient ${value}`, err), null;
     }
   }
   function getShadowModifier(value) {
     try {
       let index = 0, colorMatches = getMatches(/(^|\s)([a-z]+\(.+?\)|#[0-9a-f]+|[a-z]+)(.*?(inset|outset)?($|,))/ig, value, 2), modifiers = colorMatches.map((match, i) => {
         let prefixIndex = index, matchIndex = value.indexOf(match, index), matchEnd = matchIndex + match.length;
         index = matchEnd;
         let rgb = tryParseColor(match);
         return rgb ? (filter2) => `${value.substring(prefixIndex, matchIndex)}${modifyShadowColor(rgb, filter2)}${i === colorMatches.length - 1 ? value.substring(matchEnd) : ""}` : () => value.substring(prefixIndex, matchEnd);
       });
       return (filter2) => modifiers.map((modify) => modify(filter2)).join("");
     } catch (err) {
       return logWarn(`Unable to parse shadow ${value}`, err), null;
     }
   }
   function getVariableModifier(variablesStore2, prop, value, rule, ignoredImgSelectors, isCancelled) {
     return variablesStore2.getModifierForVariable({
       varName: prop,
       sourceValue: value,
       rule,
       ignoredImgSelectors,
       isCancelled
     });
   }
   function getVariableDependantModifier(variablesStore2, prop, value) {
     return variablesStore2.getModifierForVarDependant(prop, value);
   }
   function cleanModificationCache() {
     colorParseCache2.clear(), clearColorModificationCache(), imageDetailsCache.clear(), cleanImageProcessingCache(), awaitingForImageLoading.clear();
   }
 
   // src/inject/dynamic-theme/variables.ts
   var VAR_TYPE_BGCOLOR = 1 << 0, VAR_TYPE_TEXTCOLOR = 1 << 1, VAR_TYPE_BORDERCOLOR = 1 << 2, VAR_TYPE_BGIMG = 1 << 3, VariablesStore = class {
     constructor() {
       this.varTypes = new Map();
       this.rulesQueue = [];
       this.definedVars = new Set();
       this.varRefs = new Map();
       this.unknownColorVars = new Set();
       this.unknownBgVars = new Set();
       this.undefinedVars = new Set();
       this.initialVarTypes = new Map();
       this.changedTypeVars = new Set();
       this.typeChangeSubscriptions = new Map();
       this.unstableVarValues = new Map();
     }
     clear() {
       this.varTypes.clear(), this.rulesQueue.splice(0), this.definedVars.clear(), this.varRefs.clear(), this.unknownColorVars.clear(), this.unknownBgVars.clear(), this.undefinedVars.clear(), this.initialVarTypes.clear(), this.changedTypeVars.clear(), this.typeChangeSubscriptions.clear(), this.unstableVarValues.clear();
     }
     isVarType(varName, typeNum) {
       return this.varTypes.has(varName) && (this.varTypes.get(varName) & typeNum) > 0;
     }
     addRulesForMatching(rules) {
       this.rulesQueue.push(rules);
     }
     matchVariablesAndDependants() {
       this.changedTypeVars.clear(), this.initialVarTypes = new Map(this.varTypes), this.collectRootVariables(), this.rulesQueue.forEach((rules) => this.collectVariables(rules)), this.rulesQueue.forEach((rules) => this.collectVarDependants(rules)), this.rulesQueue.splice(0), this.collectRootVarDependants(), this.varRefs.forEach((refs, v) => {
         refs.forEach((r) => {
           this.varTypes.has(v) && this.resolveVariableType(r, this.varTypes.get(v));
         });
       }), this.unknownColorVars.forEach((v) => {
         this.unknownBgVars.has(v) ? (this.unknownColorVars.delete(v), this.unknownBgVars.delete(v), this.resolveVariableType(v, VAR_TYPE_BGCOLOR)) : this.isVarType(v, VAR_TYPE_BGCOLOR | VAR_TYPE_TEXTCOLOR | VAR_TYPE_BORDERCOLOR) ? this.unknownColorVars.delete(v) : this.undefinedVars.add(v);
       }), this.unknownBgVars.forEach((v) => {
         this.findVarRef(v, (ref) => this.unknownColorVars.has(ref)) != null ? this.itarateVarRefs(v, (ref) => {
           this.resolveVariableType(ref, VAR_TYPE_BGCOLOR);
         }) : this.isVarType(v, VAR_TYPE_BGCOLOR | VAR_TYPE_BGIMG) ? this.unknownBgVars.delete(v) : this.undefinedVars.add(v);
       }), this.changedTypeVars.forEach((varName) => {
         this.typeChangeSubscriptions.has(varName) && this.typeChangeSubscriptions.get(varName).forEach((callback) => {
           callback();
         });
       }), this.changedTypeVars.clear();
     }
     getModifierForVariable(options) {
       return (theme) => {
         let {varName, sourceValue, rule, ignoredImgSelectors, isCancelled} = options, getDeclarations = () => {
           let declarations = [], addModifiedValue = (typeNum, varNameWrapper, colorModifier) => {
             if (!this.isVarType(varName, typeNum))
               return;
             let property = varNameWrapper(varName), modifiedValue;
             if (isVarDependant(sourceValue))
               if (isConstructedColorVar(sourceValue)) {
                 let value = insertVarValues(sourceValue, this.unstableVarValues);
                 value || (value = typeNum === VAR_TYPE_BGCOLOR ? "#ffffff" : "#000000"), modifiedValue = colorModifier(value, theme);
               } else
                 modifiedValue = replaceCSSVariablesNames(sourceValue, (v) => varNameWrapper(v), (fallback) => colorModifier(fallback, theme));
             else
               modifiedValue = colorModifier(sourceValue, theme);
             declarations.push({
               property,
               value: modifiedValue
             });
           };
           if (addModifiedValue(VAR_TYPE_BGCOLOR, wrapBgColorVariableName, tryModifyBgColor), addModifiedValue(VAR_TYPE_TEXTCOLOR, wrapTextColorVariableName, tryModifyTextColor), addModifiedValue(VAR_TYPE_BORDERCOLOR, wrapBorderColorVariableName, tryModifyBorderColor), this.isVarType(varName, VAR_TYPE_BGIMG)) {
             let property = wrapBgImgVariableName(varName), modifiedValue = sourceValue;
             isVarDependant(sourceValue) && (modifiedValue = replaceCSSVariablesNames(sourceValue, (v) => wrapBgColorVariableName(v), (fallback) => tryModifyBgColor(fallback, theme)));
             let bgModifier = getBgImageModifier(modifiedValue, rule, ignoredImgSelectors, isCancelled);
             modifiedValue = typeof bgModifier == "function" ? bgModifier(theme) : bgModifier, declarations.push({
               property,
               value: modifiedValue
             });
           }
           return declarations;
         }, callbacks = new Set(), addListener = (onTypeChange) => {
           let callback = () => {
             let decs = getDeclarations();
             onTypeChange(decs);
           };
           callbacks.add(callback), this.subscribeForVarTypeChange(varName, callback);
         }, removeListeners = () => {
           callbacks.forEach((callback) => {
             this.unsubscribeFromVariableTypeChanges(varName, callback);
           });
         };
         return {
           declarations: getDeclarations(),
           onTypeChange: {addListener, removeListeners}
         };
       };
     }
     getModifierForVarDependant(property, sourceValue) {
       if (sourceValue.match(/^\s*(rgb|hsl)a?\(/)) {
         let isBg = property.startsWith("background"), isText = property === "color";
         return (theme) => {
           let value = insertVarValues(sourceValue, this.unstableVarValues);
           return value || (value = isBg ? "#ffffff" : "#000000"), (isBg ? tryModifyBgColor : isText ? tryModifyTextColor : tryModifyBorderColor)(value, theme);
         };
       }
       if (property === "background-color")
         return (theme) => replaceCSSVariablesNames(sourceValue, (v) => wrapBgColorVariableName(v), (fallback) => tryModifyBgColor(fallback, theme));
       if (property === "color")
         return (theme) => replaceCSSVariablesNames(sourceValue, (v) => wrapTextColorVariableName(v), (fallback) => tryModifyTextColor(fallback, theme));
       if (property === "background" || property === "background-image" || property === "box-shadow")
         return (theme) => {
           let unknownVars = new Set(), modify = () => replaceCSSVariablesNames(sourceValue, (v) => this.isVarType(v, VAR_TYPE_BGCOLOR) ? wrapBgColorVariableName(v) : this.isVarType(v, VAR_TYPE_BGIMG) ? wrapBgImgVariableName(v) : (unknownVars.add(v), v), (fallback) => tryModifyBgColor(fallback, theme)), modified = modify();
           return unknownVars.size > 0 ? new Promise((resolve) => {
             let firstUnknownVar = unknownVars.values().next().value, callback = () => {
               this.unsubscribeFromVariableTypeChanges(firstUnknownVar, callback);
               let newValue = modify();
               resolve(newValue);
             };
             this.subscribeForVarTypeChange(firstUnknownVar, callback);
           }) : modified;
         };
       if (property.startsWith("border") || property.startsWith("outline")) {
         if (sourceValue.endsWith(")")) {
           let colorTypeMatch = sourceValue.match(/((rgb|hsl)a?)\(/);
           if (colorTypeMatch) {
             let index = colorTypeMatch.index;
             return (theme) => {
               if (!insertVarValues(sourceValue, this.unstableVarValues))
                 return sourceValue;
               let beginning = sourceValue.substring(0, index), color = sourceValue.substring(index, sourceValue.length), inserted = insertVarValues(color, this.unstableVarValues), modified = tryModifyBorderColor(inserted, theme);
               return `${beginning}${modified}`;
             };
           }
         }
         return (theme) => replaceCSSVariablesNames(sourceValue, (v) => wrapBorderColorVariableName(v), (fallback) => tryModifyTextColor(fallback, theme));
       }
       return null;
     }
     subscribeForVarTypeChange(varName, callback) {
       this.typeChangeSubscriptions.has(varName) || this.typeChangeSubscriptions.set(varName, new Set()), this.typeChangeSubscriptions.get(varName).add(callback);
     }
     unsubscribeFromVariableTypeChanges(varName, callback) {
       this.typeChangeSubscriptions.has(varName) && this.typeChangeSubscriptions.get(varName).delete(callback);
     }
     collectVariables(rules) {
       iterateVariables(rules, (varName, value) => {
         this.inspectVariable(varName, value);
       });
     }
     collectRootVariables() {
       iterateCSSDeclarations(document.documentElement.style, (property, value) => {
         isVariable(property) && this.inspectVariable(property, value);
       });
     }
     inspectVariable(varName, value) {
       if (this.unstableVarValues.set(varName, value), isVarDependant(value) && isConstructedColorVar(value) && (this.unknownColorVars.add(varName), this.definedVars.add(varName)), this.definedVars.has(varName))
         return;
       this.definedVars.add(varName), tryParseColor(value) ? this.unknownColorVars.add(varName) : (value.includes("url(") || value.includes("linear-gradient(") || value.includes("radial-gradient(")) && this.resolveVariableType(varName, VAR_TYPE_BGIMG);
     }
     resolveVariableType(varName, typeNum) {
       let initialType = this.initialVarTypes.get(varName) || 0, newType = (this.varTypes.get(varName) || 0) | typeNum;
       this.varTypes.set(varName, newType), (newType !== initialType || this.undefinedVars.has(varName)) && (this.changedTypeVars.add(varName), this.undefinedVars.delete(varName)), this.unknownColorVars.delete(varName), this.unknownBgVars.delete(varName);
     }
     collectVarDependants(rules) {
       iterateVarDependants(rules, (property, value) => {
         this.inspectVerDependant(property, value);
       });
     }
     collectRootVarDependants() {
       iterateCSSDeclarations(document.documentElement.style, (property, value) => {
         isVarDependant(value) && this.inspectVerDependant(property, value);
       });
     }
     inspectVerDependant(property, value) {
       isVariable(property) ? this.iterateVarDeps(value, (ref) => {
         this.varRefs.has(property) || this.varRefs.set(property, new Set()), this.varRefs.get(property).add(ref);
       }) : property === "background-color" || property === "box-shadow" ? this.iterateVarDeps(value, (v) => this.resolveVariableType(v, VAR_TYPE_BGCOLOR)) : property === "color" ? this.iterateVarDeps(value, (v) => this.resolveVariableType(v, VAR_TYPE_TEXTCOLOR)) : property.startsWith("border") || property.startsWith("outline") ? this.iterateVarDeps(value, (v) => this.resolveVariableType(v, VAR_TYPE_BORDERCOLOR)) : (property === "background" || property === "background-image") && this.iterateVarDeps(value, (v) => {
         if (this.isVarType(v, VAR_TYPE_BGCOLOR | VAR_TYPE_BGIMG))
           return;
         let isBgColor = this.findVarRef(v, (ref) => this.unknownColorVars.has(ref) || this.isVarType(ref, VAR_TYPE_TEXTCOLOR | VAR_TYPE_BORDERCOLOR)) != null;
         this.itarateVarRefs(v, (ref) => {
           isBgColor ? this.resolveVariableType(ref, VAR_TYPE_BGCOLOR) : this.unknownBgVars.add(ref);
         });
       });
     }
     iterateVarDeps(value, iterator) {
       let varDeps = new Set();
       iterateVarDependencies(value, (v) => varDeps.add(v)), varDeps.forEach((v) => iterator(v));
     }
     findVarRef(varName, iterator, stack = new Set()) {
       if (stack.has(varName))
         return null;
       if (stack.add(varName), iterator(varName))
         return varName;
       let refs = this.varRefs.get(varName);
       if (!refs || refs.size === 0)
         return null;
       for (let ref of refs) {
         let found = this.findVarRef(ref, iterator, stack);
         if (found)
           return found;
       }
       return null;
     }
     itarateVarRefs(varName, iterator) {
       this.findVarRef(varName, (ref) => (iterator(ref), !1));
     }
     putRootVars(styleElement, theme) {
       let sheet = styleElement.sheet;
       sheet.cssRules.length > 0 && sheet.deleteRule(0);
       let declarations = new Map();
       iterateCSSDeclarations(document.documentElement.style, (property, value) => {
         isVariable(property) && (this.isVarType(property, VAR_TYPE_BGCOLOR) && declarations.set(wrapBgColorVariableName(property), tryModifyBgColor(value, theme)), this.isVarType(property, VAR_TYPE_TEXTCOLOR) && declarations.set(wrapTextColorVariableName(property), tryModifyTextColor(value, theme)), this.isVarType(property, VAR_TYPE_BORDERCOLOR) && declarations.set(wrapBorderColorVariableName(property), tryModifyBorderColor(value, theme)));
       });
       let cssLines = [];
       cssLines.push(":root {");
       for (let [property, value] of declarations)
         cssLines.push(`    ${property}: ${value};`);
       cssLines.push("}");
       let cssText = cssLines.join(`
 `);
       sheet.insertRule(cssText);
     }
   }, variablesStore = new VariablesStore();
   function getVariableRange(input, searchStart = 0) {
     let start = input.indexOf("var(", searchStart);
     if (start >= 0) {
       let range = getParenthesesRange(input, start + 3);
       return range ? {start, end: range.end} : null;
     }
   }
   function getVariablesMatches(input) {
     let ranges = [], i = 0, range;
     for (; range = getVariableRange(input, i); ) {
       let {start, end} = range;
       ranges.push({start, end, value: input.substring(start, end)}), i = range.end + 1;
     }
     return ranges;
   }
   function replaceVariablesMatches(input, replacer) {
     let matches = getVariablesMatches(input), matchesCount = matches.length;
     if (matchesCount === 0)
       return input;
     let inputLength = input.length, replacements = matches.map((m) => replacer(m.value)), parts = [];
     parts.push(input.substring(0, matches[0].start));
     for (let i = 0; i < matchesCount; i++) {
       parts.push(replacements[i]);
       let start = matches[i].end, end = i < matchesCount - 1 ? matches[i + 1].start : inputLength;
       parts.push(input.substring(start, end));
     }
     return parts.join("");
   }
   function getVariableNameAndFallback(match) {
     let commaIndex = match.indexOf(","), name, fallback;
     return commaIndex >= 0 ? (name = match.substring(4, commaIndex).trim(), fallback = match.substring(commaIndex + 1, match.length - 1).trim()) : (name = match.substring(4, match.length - 1), fallback = ""), {name, fallback};
   }
   function replaceCSSVariablesNames(value, nemeReplacer, fallbackReplacer) {
     return replaceVariablesMatches(value, (match) => {
       let {name, fallback} = getVariableNameAndFallback(match), newName = nemeReplacer(name);
       if (!fallback)
         return `var(${newName})`;
       let newFallback;
       return isVarDependant(fallback) ? newFallback = replaceCSSVariablesNames(fallback, nemeReplacer, fallbackReplacer) : fallbackReplacer ? newFallback = fallbackReplacer(fallback) : newFallback = fallback, `var(${newName}, ${newFallback})`;
     });
   }
   function iterateVariables(rules, iterator) {
     iterateCSSRules(rules, (rule) => {
       rule.style && iterateCSSDeclarations(rule.style, (property, value) => {
         property.startsWith("--") && iterator(property, value);
       });
     });
   }
   function iterateVarDependants(rules, iterator) {
     iterateCSSRules(rules, (rule) => {
       rule.style && iterateCSSDeclarations(rule.style, (property, value) => {
         isVarDependant(value) && iterator(property, value);
       });
     });
   }
   function iterateVarDependencies(value, iterator) {
     replaceCSSVariablesNames(value, (varName) => (iterator(varName), varName));
   }
   function wrapBgColorVariableName(name) {
     return `--darkreader-bg${name}`;
   }
   function wrapTextColorVariableName(name) {
     return `--darkreader-text${name}`;
   }
   function wrapBorderColorVariableName(name) {
     return `--darkreader-border${name}`;
   }
   function wrapBgImgVariableName(name) {
     return `--darkreader-bgimg${name}`;
   }
   function isVariable(property) {
     return property.startsWith("--");
   }
   function isVarDependant(value) {
     return value.includes("var(");
   }
   function isConstructedColorVar(value) {
     return value.match(/^\s*(rgb|hsl)a?\(/);
   }
   function tryModifyBgColor(color, theme) {
     let rgb = tryParseColor(color);
     return rgb ? modifyBackgroundColor(rgb, theme) : color;
   }
   function tryModifyTextColor(color, theme) {
     let rgb = tryParseColor(color);
     return rgb ? modifyForegroundColor(rgb, theme) : color;
   }
   function tryModifyBorderColor(color, theme) {
     let rgb = tryParseColor(color);
     return rgb ? modifyBorderColor(rgb, theme) : color;
   }
   function insertVarValues(source, varValues, stack = new Set()) {
     let containsUnresolvedVar = !1, replaced = replaceVariablesMatches(source, (match) => {
       let {name, fallback} = getVariableNameAndFallback(match);
       if (stack.has(name))
         return containsUnresolvedVar = !0, null;
       stack.add(name);
       let varValue = varValues.get(name) || fallback, inserted = null;
       return varValue && (isVarDependant(varValue) ? inserted = insertVarValues(varValue, varValues, stack) : inserted = varValue), inserted || (containsUnresolvedVar = !0, null);
     });
     return containsUnresolvedVar ? null : replaced;
   }
 
   // src/inject/dynamic-theme/inline-style.ts
   var overrides = {
     "background-color": {
       customProp: "--darkreader-inline-bgcolor",
       cssProp: "background-color",
       dataAttr: "data-darkreader-inline-bgcolor"
     },
     "background-image": {
       customProp: "--darkreader-inline-bgimage",
       cssProp: "background-image",
       dataAttr: "data-darkreader-inline-bgimage"
     },
     "border-color": {
       customProp: "--darkreader-inline-border",
       cssProp: "border-color",
       dataAttr: "data-darkreader-inline-border"
     },
     "border-bottom-color": {
       customProp: "--darkreader-inline-border-bottom",
       cssProp: "border-bottom-color",
       dataAttr: "data-darkreader-inline-border-bottom"
     },
     "border-left-color": {
       customProp: "--darkreader-inline-border-left",
       cssProp: "border-left-color",
       dataAttr: "data-darkreader-inline-border-left"
     },
     "border-right-color": {
       customProp: "--darkreader-inline-border-right",
       cssProp: "border-right-color",
       dataAttr: "data-darkreader-inline-border-right"
     },
     "border-top-color": {
       customProp: "--darkreader-inline-border-top",
       cssProp: "border-top-color",
       dataAttr: "data-darkreader-inline-border-top"
     },
     "box-shadow": {
       customProp: "--darkreader-inline-boxshadow",
       cssProp: "box-shadow",
       dataAttr: "data-darkreader-inline-boxshadow"
     },
     color: {
       customProp: "--darkreader-inline-color",
       cssProp: "color",
       dataAttr: "data-darkreader-inline-color"
     },
     fill: {
       customProp: "--darkreader-inline-fill",
       cssProp: "fill",
       dataAttr: "data-darkreader-inline-fill"
     },
     stroke: {
       customProp: "--darkreader-inline-stroke",
       cssProp: "stroke",
       dataAttr: "data-darkreader-inline-stroke"
     },
     "outline-color": {
       customProp: "--darkreader-inline-outline",
       cssProp: "outline-color",
       dataAttr: "data-darkreader-inline-outline"
     },
     "stop-color": {
       customProp: "--darkreader-inline-stopcolor",
       cssProp: "stop-color",
       dataAttr: "data-darkreader-inline-stopcolor"
     }
   }, overridesList = Object.values(overrides), INLINE_STYLE_ATTRS = ["style", "fill", "stop-color", "stroke", "bgcolor", "color"], INLINE_STYLE_SELECTOR = INLINE_STYLE_ATTRS.map((attr) => `[${attr}]`).join(", ");
   function getInlineOverrideStyle() {
     return overridesList.map(({dataAttr, customProp, cssProp}) => [
       `[${dataAttr}] {`,
       `  ${cssProp}: var(${customProp}) !important;`,
       "}"
     ].join(`
 `)).join(`
 `);
   }
   function getInlineStyleElements(root) {
     let results = [];
     return root instanceof Element && root.matches(INLINE_STYLE_SELECTOR) && results.push(root), (root instanceof Element || isShadowDomSupported && root instanceof ShadowRoot || root instanceof Document) && push(results, root.querySelectorAll(INLINE_STYLE_SELECTOR)), results;
   }
   var treeObservers = new Map(), attrObservers = new Map();
   function watchForInlineStyles(elementStyleDidChange, shadowRootDiscovered) {
     deepWatchForInlineStyles(document, elementStyleDidChange, shadowRootDiscovered), iterateShadowHosts(document.documentElement, (host) => {
       deepWatchForInlineStyles(host.shadowRoot, elementStyleDidChange, shadowRootDiscovered);
     });
   }
   function deepWatchForInlineStyles(root, elementStyleDidChange, shadowRootDiscovered) {
     treeObservers.has(root) && (treeObservers.get(root).disconnect(), attrObservers.get(root).disconnect());
     let discoveredNodes = new WeakSet();
     function discoverNodes(node) {
       getInlineStyleElements(node).forEach((el) => {
         discoveredNodes.has(el) || (discoveredNodes.add(el), elementStyleDidChange(el));
       }), iterateShadowHosts(node, (n) => {
         discoveredNodes.has(node) || (discoveredNodes.add(node), shadowRootDiscovered(n.shadowRoot), deepWatchForInlineStyles(n.shadowRoot, elementStyleDidChange, shadowRootDiscovered));
       });
     }
     let treeObserver = createOptimizedTreeObserver(root, {
       onMinorMutations: ({additions}) => {
         additions.forEach((added) => discoverNodes(added));
       },
       onHugeMutations: () => {
         discoverNodes(root);
       }
     });
     treeObservers.set(root, treeObserver);
     let attemptCount = 0, start = null, ATTEMPTS_INTERVAL = getDuration({seconds: 10}), RETRY_TIMEOUT = getDuration({seconds: 2}), MAX_ATTEMPTS_COUNT = 50, cache = [], timeoutId = null, handleAttributeMutations = throttle((mutations) => {
       mutations.forEach((m) => {
         INLINE_STYLE_ATTRS.includes(m.attributeName) && elementStyleDidChange(m.target);
       });
     }), attrObserver = new MutationObserver((mutations) => {
       if (timeoutId) {
         cache.push(...mutations);
         return;
       }
       attemptCount++;
       let now = Date.now();
       if (start == null)
         start = now;
       else if (attemptCount >= MAX_ATTEMPTS_COUNT) {
         if (now - start < ATTEMPTS_INTERVAL) {
           timeoutId = setTimeout(() => {
             start = null, attemptCount = 0, timeoutId = null;
             let attributeCache = cache;
             cache = [], handleAttributeMutations(attributeCache);
           }, RETRY_TIMEOUT), cache.push(...mutations);
           return;
         }
         start = now, attemptCount = 1;
       }
       handleAttributeMutations(mutations);
     });
     attrObserver.observe(root, {
       attributes: !0,
       attributeFilter: INLINE_STYLE_ATTRS.concat(overridesList.map(({dataAttr}) => dataAttr)),
       subtree: !0
     }), attrObservers.set(root, attrObserver);
   }
   function stopWatchingForInlineStyles() {
     treeObservers.forEach((o) => o.disconnect()), attrObservers.forEach((o) => o.disconnect()), treeObservers.clear(), attrObservers.clear();
   }
   var inlineStyleCache = new WeakMap(), filterProps = ["brightness", "contrast", "grayscale", "sepia", "mode"];
   function getInlineStyleCacheKey(el, theme) {
     return INLINE_STYLE_ATTRS.map((attr) => `${attr}="${el.getAttribute(attr)}"`).concat(filterProps.map((prop) => `${prop}="${theme[prop]}"`)).join(" ");
   }
   function shouldIgnoreInlineStyle(element, selectors) {
     for (let i = 0, len = selectors.length; i < len; i++) {
       let ingnoredSelector = selectors[i];
       if (element.matches(ingnoredSelector))
         return !0;
     }
     return !1;
   }
   function overrideInlineStyle(element, theme, ignoreInlineSelectors, ignoreImageSelectors) {
     if (getInlineStyleCacheKey(element, theme) === inlineStyleCache.get(element))
       return;
     let unsetProps = new Set(Object.keys(overrides));
     function setCustomProp(targetCSSProp, modifierCSSProp, cssVal) {
       let {customProp, dataAttr} = overrides[targetCSSProp], mod = getModifiableCSSDeclaration(modifierCSSProp, cssVal, null, variablesStore, ignoreImageSelectors, null);
       if (!mod)
         return;
       let value = mod.value;
       typeof value == "function" && (value = value(theme)), element.style.setProperty(customProp, value), element.hasAttribute(dataAttr) || element.setAttribute(dataAttr, ""), unsetProps.delete(targetCSSProp);
     }
     if (ignoreInlineSelectors.length > 0 && shouldIgnoreInlineStyle(element, ignoreInlineSelectors)) {
       unsetProps.forEach((cssProp) => {
         element.removeAttribute(overrides[cssProp].dataAttr);
       });
       return;
     }
     if (element.hasAttribute("bgcolor")) {
       let value = element.getAttribute("bgcolor");
       (value.match(/^[0-9a-f]{3}$/i) || value.match(/^[0-9a-f]{6}$/i)) && (value = `#${value}`), setCustomProp("background-color", "background-color", value);
     }
     if (element.hasAttribute("color")) {
       let value = element.getAttribute("color");
       (value.match(/^[0-9a-f]{3}$/i) || value.match(/^[0-9a-f]{6}$/i)) && (value = `#${value}`), setCustomProp("color", "color", value);
     }
     if (element instanceof SVGElement) {
       if (element.hasAttribute("fill")) {
         let SMALL_SVG_LIMIT = 32, value = element.getAttribute("fill"), isBg = !1;
         if (!(element instanceof SVGTextElement)) {
           let {width, height} = element.getBoundingClientRect();
           isBg = width > SMALL_SVG_LIMIT || height > SMALL_SVG_LIMIT;
         }
         setCustomProp("fill", isBg ? "background-color" : "color", value);
       }
       element.hasAttribute("stop-color") && setCustomProp("stop-color", "background-color", element.getAttribute("stop-color"));
     }
     if (element.hasAttribute("stroke")) {
       let value = element.getAttribute("stroke");
       setCustomProp("stroke", element instanceof SVGLineElement || element instanceof SVGTextElement ? "border-color" : "color", value);
     }
     element.style && iterateCSSDeclarations(element.style, (property, value) => {
       property === "background-image" && value.includes("url") || overrides.hasOwnProperty(property) && setCustomProp(property, property, value);
     }), element.style && element instanceof SVGTextElement && element.style.fill && setCustomProp("fill", "color", element.style.getPropertyValue("fill")), forEach(unsetProps, (cssProp) => {
       element.removeAttribute(overrides[cssProp].dataAttr);
     }), inlineStyleCache.set(element, getInlineStyleCacheKey(element, theme));
   }
 
   // src/inject/dynamic-theme/meta-theme-color.ts
   var metaThemeColorName = "theme-color", metaThemeColorSelector = `meta[name="${metaThemeColorName}"]`, srcMetaThemeColor = null, observer = null;
   function changeMetaThemeColor(meta, theme) {
     srcMetaThemeColor = srcMetaThemeColor || meta.content;
     try {
       let color = parse(srcMetaThemeColor);
       meta.content = modifyBackgroundColor(color, theme);
     } catch (err) {
       logWarn(err);
     }
   }
   function changeMetaThemeColorWhenAvailable(theme) {
     let meta = document.querySelector(metaThemeColorSelector);
     meta ? changeMetaThemeColor(meta, theme) : (observer && observer.disconnect(), observer = new MutationObserver((mutations) => {
       loop:
         for (let i = 0; i < mutations.length; i++) {
           let {addedNodes} = mutations[i];
           for (let j = 0; j < addedNodes.length; j++) {
             let node = addedNodes[j];
             if (node instanceof HTMLMetaElement && node.name === metaThemeColorName) {
               observer.disconnect(), observer = null, changeMetaThemeColor(node, theme);
               break loop;
             }
           }
         }
     }), observer.observe(document.head, {childList: !0}));
   }
   function restoreMetaThemeColor() {
     observer && (observer.disconnect(), observer = null);
     let meta = document.querySelector(metaThemeColorSelector);
     meta && srcMetaThemeColor && (meta.content = srcMetaThemeColor);
   }
 
   // src/inject/dynamic-theme/stylesheet-modifier.ts
   var themeCacheKeys2 = [
     "mode",
     "brightness",
     "contrast",
     "grayscale",
     "sepia",
     "darkSchemeBackgroundColor",
     "darkSchemeTextColor",
     "lightSchemeBackgroundColor",
     "lightSchemeTextColor"
   ];
   function getThemeKey(theme) {
     return themeCacheKeys2.map((p) => `${p}:${theme[p]}`).join(";");
   }
   var asyncQueue = createAsyncTasksQueue();
   function createStyleSheetModifier() {
     let renderId = 0, rulesTextCache = new Map(), rulesModCache = new Map(), varTypeChangeCleaners = new Set(), prevFilterKey = null;
     function modifySheet(options) {
       let rules = options.sourceCSSRules, {theme, ignoreImageAnalysis, force, prepareSheet, isAsyncCancelled} = options, rulesChanged = rulesModCache.size === 0, notFoundCacheKeys = new Set(rulesModCache.keys()), themeKey = getThemeKey(theme), themeChanged = themeKey !== prevFilterKey, modRules = [];
       if (iterateCSSRules(rules, (rule) => {
         let cssText = rule.cssText, textDiffersFromPrev = !1;
         if (notFoundCacheKeys.delete(cssText), rulesTextCache.has(cssText) || (rulesTextCache.set(cssText, cssText), textDiffersFromPrev = !0), textDiffersFromPrev)
           rulesChanged = !0;
         else {
           modRules.push(rulesModCache.get(cssText));
           return;
         }
         let modDecs = [];
         rule.style && iterateCSSDeclarations(rule.style, (property, value) => {
           let mod = getModifiableCSSDeclaration(property, value, rule, variablesStore, ignoreImageAnalysis, isAsyncCancelled);
           mod && modDecs.push(mod);
         });
         let modRule = null;
         if (modDecs.length > 0) {
           let parentRule = rule.parentRule;
           modRule = {selector: rule.selectorText, declarations: modDecs, parentRule}, modRules.push(modRule);
         }
         rulesModCache.set(cssText, modRule);
       }), notFoundCacheKeys.forEach((key) => {
         rulesTextCache.delete(key), rulesModCache.delete(key);
       }), prevFilterKey = themeKey, !force && !rulesChanged && !themeChanged)
         return;
       renderId++;
       function setRule(target, index, rule) {
         let {selector, declarations} = rule, getDeclarationText = (dec) => {
           let {property, value, important, sourceValue} = dec;
           return `${property}: ${value ?? sourceValue}${important ? " !important" : ""};`;
         }, ruleText = `${selector} { ${declarations.map(getDeclarationText).join(" ")} }`;
         target.insertRule(ruleText, index);
       }
       let asyncDeclarations = new Map(), varDeclarations = new Map(), asyncDeclarationCounter = 0, varDeclarationCounter = 0, rootReadyGroup = {rule: null, rules: [], isGroup: !0}, groupRefs = new WeakMap();
       function getGroup(rule) {
         if (rule == null)
           return rootReadyGroup;
         if (groupRefs.has(rule))
           return groupRefs.get(rule);
         let group = {rule, rules: [], isGroup: !0};
         return groupRefs.set(rule, group), getGroup(rule.parentRule).rules.push(group), group;
       }
       varTypeChangeCleaners.forEach((clear) => clear()), varTypeChangeCleaners.clear(), modRules.filter((r) => r).forEach(({selector, declarations, parentRule}) => {
         let group = getGroup(parentRule), readyStyleRule = {selector, declarations: [], isGroup: !1}, readyDeclarations = readyStyleRule.declarations;
         group.rules.push(readyStyleRule);
         function handleAsyncDeclaration(property, modified, important, sourceValue) {
           let asyncKey = ++asyncDeclarationCounter, asyncDeclaration = {property, value: null, important, asyncKey, sourceValue};
           readyDeclarations.push(asyncDeclaration);
           let currentRenderId = renderId;
           modified.then((asyncValue) => {
             !asyncValue || isAsyncCancelled() || currentRenderId !== renderId || (asyncDeclaration.value = asyncValue, asyncQueue.add(() => {
               isAsyncCancelled() || currentRenderId !== renderId || rebuildAsyncRule(asyncKey);
             }));
           });
         }
         function handleVarDeclarations(property, modified, important, sourceValue) {
           let {declarations: varDecs, onTypeChange} = modified, varKey = ++varDeclarationCounter, currentRenderId = renderId, initialIndex = readyDeclarations.length, oldDecs = [];
           if (varDecs.length === 0) {
             let tempDec = {property, value: sourceValue, important, sourceValue, varKey};
             readyDeclarations.push(tempDec), oldDecs = [tempDec];
           }
           varDecs.forEach((mod) => {
             if (mod.value instanceof Promise)
               handleAsyncDeclaration(mod.property, mod.value, important, sourceValue);
             else {
               let readyDec = {property: mod.property, value: mod.value, important, sourceValue, varKey};
               readyDeclarations.push(readyDec), oldDecs.push(readyDec);
             }
           }), onTypeChange.addListener((newDecs) => {
             if (isAsyncCancelled() || currentRenderId !== renderId)
               return;
             let readyVarDecs = newDecs.map((mod) => ({property: mod.property, value: mod.value, important, sourceValue, varKey})), index = readyDeclarations.indexOf(oldDecs[0], initialIndex);
             readyDeclarations.splice(index, oldDecs.length, ...readyVarDecs), oldDecs = readyVarDecs, rebuildVarRule(varKey);
           }), varTypeChangeCleaners.add(() => onTypeChange.removeListeners());
         }
         declarations.forEach(({property, value, important, sourceValue}) => {
           if (typeof value == "function") {
             let modified = value(theme);
             modified instanceof Promise ? handleAsyncDeclaration(property, modified, important, sourceValue) : property.startsWith("--") ? handleVarDeclarations(property, modified, important, sourceValue) : readyDeclarations.push({property, value: modified, important, sourceValue});
           } else
             readyDeclarations.push({property, value, important, sourceValue});
         });
       });
       let sheet = prepareSheet();
       function buildStyleSheet() {
         function createTarget(group, parent) {
           let {rule} = group;
           if (rule instanceof CSSMediaRule) {
             let {media} = rule, index = parent.cssRules.length;
             return parent.insertRule(`@media ${media.mediaText} {}`, index), parent.cssRules[index];
           }
           return parent;
         }
         function iterateReadyRules(group, target, styleIterator) {
           group.rules.forEach((r) => {
             if (r.isGroup) {
               let t = createTarget(r, target);
               iterateReadyRules(r, t, styleIterator);
             } else
               styleIterator(r, target);
           });
         }
         iterateReadyRules(rootReadyGroup, sheet, (rule, target) => {
           let index = target.cssRules.length;
           rule.declarations.forEach(({asyncKey, varKey}) => {
             asyncKey != null && asyncDeclarations.set(asyncKey, {rule, target, index}), varKey != null && varDeclarations.set(varKey, {rule, target, index});
           }), setRule(target, index, rule);
         });
       }
       function rebuildAsyncRule(key) {
         let {rule, target, index} = asyncDeclarations.get(key);
         target.deleteRule(index), setRule(target, index, rule), asyncDeclarations.delete(key);
       }
       function rebuildVarRule(key) {
         let {rule, target, index} = varDeclarations.get(key);
         target.deleteRule(index), setRule(target, index, rule);
       }
       buildStyleSheet();
     }
     return {modifySheet};
   }
 
   // src/inject/dynamic-theme/style-manager.ts
   var STYLE_SELECTOR = 'style, link[rel*="stylesheet" i]:not([disabled])';
   function shouldManageStyle(element) {
     return (element instanceof HTMLStyleElement || element instanceof SVGStyleElement || element instanceof HTMLLinkElement && element.rel && element.rel.toLowerCase().includes("stylesheet") && !element.disabled) && !element.classList.contains("darkreader") && element.media !== "print" && !element.classList.contains("stylus");
   }
   function getManageableStyles(node, results = [], deep = !0) {
     return shouldManageStyle(node) ? results.push(node) : (node instanceof Element || isShadowDomSupported && node instanceof ShadowRoot || node === document) && (forEach(node.querySelectorAll(STYLE_SELECTOR), (style) => getManageableStyles(style, results, !1)), deep && iterateShadowHosts(node, (host) => getManageableStyles(host.shadowRoot, results, !1))), results;
   }
   var syncStyleSet = new WeakSet(), corsStyleSet = new WeakSet(), canOptimizeUsingProxy = !1;
   document.addEventListener("__darkreader__inlineScriptsAllowed", () => {
     canOptimizeUsingProxy = !0;
   });
   function manageStyle(element, {update, loadingStart, loadingEnd}) {
     let prevStyles = [], next = element;
     for (; (next = next.nextElementSibling) && next.matches(".darkreader"); )
       prevStyles.push(next);
     let corsCopy = prevStyles.find((el) => el.matches(".darkreader--cors") && !corsStyleSet.has(el)) || null, syncStyle = prevStyles.find((el) => el.matches(".darkreader--sync") && !syncStyleSet.has(el)) || null, corsCopyPositionWatcher = null, syncStylePositionWatcher = null, cancelAsyncOperations = !1, isOverrideEmpty = !0, sheetModifier = createStyleSheetModifier(), observer2 = new MutationObserver(() => {
       update();
     }), observerOptions = {attributes: !0, childList: !0, subtree: !0, characterData: !0};
     function containsCSSImport() {
       return element instanceof HTMLStyleElement && element.textContent.trim().match(cssImportRegex);
     }
     function getRulesSync() {
       return corsCopy ? corsCopy.sheet.cssRules : containsCSSImport() ? null : safeGetSheetRules();
     }
     function insertStyle() {
       corsCopy ? (element.nextSibling !== corsCopy && element.parentNode.insertBefore(corsCopy, element.nextSibling), corsCopy.nextSibling !== syncStyle && element.parentNode.insertBefore(syncStyle, corsCopy.nextSibling)) : element.nextSibling !== syncStyle && element.parentNode.insertBefore(syncStyle, element.nextSibling);
     }
     function createSyncStyle() {
       syncStyle = element instanceof SVGStyleElement ? document.createElementNS("http://www.w3.org/2000/svg", "style") : document.createElement("style"), syncStyle.classList.add("darkreader"), syncStyle.classList.add("darkreader--sync"), syncStyle.media = "screen", !isChromium && element.title && (syncStyle.title = element.title), syncStyleSet.add(syncStyle);
     }
     let isLoadingRules = !1, wasLoadingError = !1;
     async function getRulesAsync() {
       let cssText, cssBasePath;
       if (element instanceof HTMLLinkElement) {
         let [cssRules, accessError] = getRulesOrError();
         if (accessError && logWarn(accessError), !cssRules && !accessError && !isSafari || isSafari && !element.sheet || isStillLoadingError(accessError)) {
           try {
             await linkLoading(element);
           } catch (err) {
             logWarn(err), wasLoadingError = !0;
           }
           if (cancelAsyncOperations)
             return null;
           [cssRules, accessError] = getRulesOrError(), accessError && logWarn(accessError);
         }
         if (cssRules != null)
           return cssRules;
         if (cssText = await loadText(element.href), cssBasePath = getCSSBaseBath(element.href), cancelAsyncOperations)
           return null;
       } else if (containsCSSImport())
         cssText = element.textContent.trim(), cssBasePath = getCSSBaseBath(location.href);
       else
         return null;
       if (cssText) {
         try {
           let fullCSSText = await replaceCSSImports(cssText, cssBasePath);
           corsCopy = createCORSCopy(element, fullCSSText);
         } catch (err) {
           logWarn(err);
         }
         if (corsCopy)
           return corsCopyPositionWatcher = watchForNodePosition(corsCopy, "prev-sibling"), corsCopy.sheet.cssRules;
       }
       return null;
     }
     function details() {
       let rules = getRulesSync();
       return rules ? {rules} : (isLoadingRules || wasLoadingError || (isLoadingRules = !0, loadingStart(), getRulesAsync().then((results) => {
         isLoadingRules = !1, loadingEnd(), results && update();
       }).catch((err) => {
         logWarn(err), isLoadingRules = !1, loadingEnd();
       })), null);
     }
     let forceRenderStyle = !1;
     function render(theme, ignoreImageAnalysis) {
       let rules = getRulesSync();
       if (!rules)
         return;
       cancelAsyncOperations = !1;
       function prepareOverridesSheet() {
         syncStyle || createSyncStyle(), syncStylePositionWatcher && syncStylePositionWatcher.stop(), insertStyle(), syncStyle.sheet == null && (syncStyle.textContent = "");
         let sheet = syncStyle.sheet;
         for (let i = sheet.cssRules.length - 1; i >= 0; i--)
           sheet.deleteRule(i);
         return syncStylePositionWatcher ? syncStylePositionWatcher.run() : syncStylePositionWatcher = watchForNodePosition(syncStyle, "prev-sibling", () => {
           forceRenderStyle = !0, buildOverrides();
         }), syncStyle.sheet;
       }
       function buildOverrides() {
         let force = forceRenderStyle;
         forceRenderStyle = !1, sheetModifier.modifySheet({
           prepareSheet: prepareOverridesSheet,
           sourceCSSRules: rules,
           theme,
           ignoreImageAnalysis,
           force,
           isAsyncCancelled: () => cancelAsyncOperations
         }), isOverrideEmpty = syncStyle.sheet.cssRules.length === 0;
       }
       buildOverrides();
     }
     function getRulesOrError() {
       try {
         return element.sheet == null ? [null, null] : [element.sheet.cssRules, null];
       } catch (err) {
         return [null, err];
       }
     }
     function isStillLoadingError(error) {
       return error && error.message && error.message.includes("loading");
     }
     function safeGetSheetRules() {
       let [cssRules, err] = getRulesOrError();
       return err ? (logWarn(err), null) : cssRules;
     }
     function watchForSheetChanges() {
       watchForSheetChangesUsingProxy(), !isThunderbird && !(canOptimizeUsingProxy && element.sheet) && watchForSheetChangesUsingRAF();
     }
     let rulesChangeKey = null, rulesCheckFrameId = null;
     function getRulesChangeKey() {
       let rules = safeGetSheetRules();
       return rules ? rules.length : null;
     }
     function didRulesKeyChange() {
       return getRulesChangeKey() !== rulesChangeKey;
     }
     function watchForSheetChangesUsingRAF() {
       rulesChangeKey = getRulesChangeKey(), stopWatchingForSheetChangesUsingRAF();
       let checkForUpdate = () => {
         if (didRulesKeyChange() && (rulesChangeKey = getRulesChangeKey(), update()), canOptimizeUsingProxy && element.sheet) {
           stopWatchingForSheetChangesUsingRAF();
           return;
         }
         rulesCheckFrameId = requestAnimationFrame(checkForUpdate);
       };
       checkForUpdate();
     }
     function stopWatchingForSheetChangesUsingRAF() {
       cancelAnimationFrame(rulesCheckFrameId);
     }
     let areSheetChangesPending = !1;
     function onSheetChange() {
       if (canOptimizeUsingProxy = !0, stopWatchingForSheetChangesUsingRAF(), areSheetChangesPending)
         return;
       function handleSheetChanges() {
         areSheetChangesPending = !1, !cancelAsyncOperations && update();
       }
       areSheetChangesPending = !0, typeof queueMicrotask == "function" ? queueMicrotask(handleSheetChanges) : requestAnimationFrame(handleSheetChanges);
     }
     function watchForSheetChangesUsingProxy() {
       element.addEventListener("__darkreader__updateSheet", onSheetChange);
     }
     function stopWatchingForSheetChangesUsingProxy() {
       element.removeEventListener("__darkreader__updateSheet", onSheetChange);
     }
     function stopWatchingForSheetChanges() {
       stopWatchingForSheetChangesUsingProxy(), stopWatchingForSheetChangesUsingRAF();
     }
     function pause() {
       observer2.disconnect(), cancelAsyncOperations = !0, corsCopyPositionWatcher && corsCopyPositionWatcher.stop(), syncStylePositionWatcher && syncStylePositionWatcher.stop(), stopWatchingForSheetChanges();
     }
     function destroy() {
       pause(), removeNode(corsCopy), removeNode(syncStyle);
     }
     function watch() {
       observer2.observe(element, observerOptions), element instanceof HTMLStyleElement && watchForSheetChanges();
     }
     let maxMoveCount = 10, moveCount = 0;
     function restore() {
       if (!!syncStyle) {
         if (moveCount++, moveCount > maxMoveCount) {
           logWarn("Style sheet was moved multiple times", element);
           return;
         }
         logWarn("Restore style", syncStyle, element), insertStyle(), corsCopyPositionWatcher && corsCopyPositionWatcher.skip(), syncStylePositionWatcher && syncStylePositionWatcher.skip(), isOverrideEmpty || (forceRenderStyle = !0, update());
       }
     }
     return {
       details,
       render,
       pause,
       destroy,
       watch,
       restore
     };
   }
   async function linkLoading(link) {
     return new Promise((resolve, reject) => {
       let cleanUp = () => {
         link.removeEventListener("load", onLoad), link.removeEventListener("error", onError);
       }, onLoad = () => {
         cleanUp(), resolve();
       }, onError = () => {
         cleanUp(), reject(`Link loading failed ${link.href}`);
       };
       link.addEventListener("load", onLoad), link.addEventListener("error", onError);
     });
   }
   function getCSSImportURL(importDeclaration) {
     return getCSSURLValue(importDeclaration.substring(8).replace(/;$/, ""));
   }
   async function loadText(url) {
     return url.startsWith("data:") ? await (await fetch(url)).text() : await bgFetch({url, responseType: "text", mimeType: "text/css"});
   }
   async function replaceCSSImports(cssText, basePath, cache = new Map()) {
     cssText = removeCSSComments(cssText), cssText = replaceCSSFontFace(cssText), cssText = replaceCSSRelativeURLsWithAbsolute(cssText, basePath);
     let importMatches = getMatches(cssImportRegex, cssText);
     for (let match of importMatches) {
       let importURL = getCSSImportURL(match), absoluteURL = getAbsoluteURL(basePath, importURL), importedCSS;
       if (cache.has(absoluteURL))
         importedCSS = cache.get(absoluteURL);
       else
         try {
           importedCSS = await loadText(absoluteURL), cache.set(absoluteURL, importedCSS), importedCSS = await replaceCSSImports(importedCSS, getCSSBaseBath(absoluteURL), cache);
         } catch (err) {
           logWarn(err), importedCSS = "";
         }
       cssText = cssText.split(match).join(importedCSS);
     }
     return cssText = cssText.trim(), cssText;
   }
   function createCORSCopy(srcElement, cssText) {
     if (!cssText)
       return null;
     let cors = document.createElement("style");
     return cors.classList.add("darkreader"), cors.classList.add("darkreader--cors"), cors.media = "screen", cors.textContent = cssText, srcElement.parentNode.insertBefore(cors, srcElement.nextSibling), cors.sheet.disabled = !0, corsStyleSet.add(cors), cors;
   }
 
   // src/inject/dynamic-theme/watch.ts
   var observers = [], observedRoots, undefinedGroups = new Map(), elementsDefinitionCallback;
   function collectUndefinedElements(root) {
     !isDefinedSelectorSupported || forEach(root.querySelectorAll(":not(:defined)"), (el) => {
       let tag = el.tagName.toLowerCase();
       undefinedGroups.has(tag) || (undefinedGroups.set(tag, new Set()), customElementsWhenDefined(tag).then(() => {
         if (elementsDefinitionCallback) {
           let elements = undefinedGroups.get(tag);
           undefinedGroups.delete(tag), elementsDefinitionCallback(Array.from(elements));
         }
       })), undefinedGroups.get(tag).add(el);
     });
   }
   var canOptimizeUsingProxy2 = !1;
   document.addEventListener("__darkreader__inlineScriptsAllowed", () => {
     canOptimizeUsingProxy2 = !0;
   });
   var resolvers3 = new Map();
   function handleIsDefined(e) {
     canOptimizeUsingProxy2 = !0, resolvers3.has(e.detail.tag) && resolvers3.get(e.detail.tag)();
   }
   async function customElementsWhenDefined(tag) {
     return new Promise((resolve) => {
       if (window.customElements && typeof customElements.whenDefined == "function")
         customElements.whenDefined(tag).then(resolve);
       else if (canOptimizeUsingProxy2)
         resolvers3.set(tag, resolve), document.dispatchEvent(new CustomEvent("__darkreader__addUndefinedResolver", {detail: {tag}}));
       else {
         let checkIfDefined = () => {
           let elements = undefinedGroups.get(tag);
           elements && elements.size > 0 && (elements.values().next().value.matches(":defined") ? resolve() : requestAnimationFrame(checkIfDefined));
         };
         requestAnimationFrame(checkIfDefined);
       }
     });
   }
   function watchWhenCustomElementsDefined(callback) {
     elementsDefinitionCallback = callback;
   }
   function unsubscribeFromDefineCustomElements() {
     elementsDefinitionCallback = null, undefinedGroups.clear(), document.removeEventListener("__darkreader__isDefined", handleIsDefined);
   }
   function watchForStyleChanges(currentStyles, update, shadowRootDiscovered) {
     stopWatchingForStyleChanges();
     let prevStyles = new Set(currentStyles), prevStyleSiblings = new WeakMap(), nextStyleSiblings = new WeakMap();
     function saveStylePosition(style) {
       prevStyleSiblings.set(style, style.previousElementSibling), nextStyleSiblings.set(style, style.nextElementSibling);
     }
     function forgetStylePosition(style) {
       prevStyleSiblings.delete(style), nextStyleSiblings.delete(style);
     }
     function didStylePositionChange(style) {
       return style.previousElementSibling !== prevStyleSiblings.get(style) || style.nextElementSibling !== nextStyleSiblings.get(style);
     }
     currentStyles.forEach(saveStylePosition);
     function handleStyleOperations(operations) {
       let {createdStyles, removedStyles, movedStyles} = operations;
       createdStyles.forEach((s) => saveStylePosition(s)), movedStyles.forEach((s) => saveStylePosition(s)), removedStyles.forEach((s) => forgetStylePosition(s)), createdStyles.forEach((s) => prevStyles.add(s)), removedStyles.forEach((s) => prevStyles.delete(s)), createdStyles.size + removedStyles.size + movedStyles.size > 0 && update({
         created: Array.from(createdStyles),
         removed: Array.from(removedStyles),
         moved: Array.from(movedStyles),
         updated: []
       });
     }
     function handleMinorTreeMutations({additions, moves, deletions}) {
       let createdStyles = new Set(), removedStyles = new Set(), movedStyles = new Set();
       additions.forEach((node) => getManageableStyles(node).forEach((style) => createdStyles.add(style))), deletions.forEach((node) => getManageableStyles(node).forEach((style) => removedStyles.add(style))), moves.forEach((node) => getManageableStyles(node).forEach((style) => movedStyles.add(style))), handleStyleOperations({createdStyles, removedStyles, movedStyles}), additions.forEach((n) => {
         iterateShadowHosts(n, subscribeForShadowRootChanges), collectUndefinedElements(n);
       });
     }
     function handleHugeTreeMutations(root) {
       let styles = new Set(getManageableStyles(root)), createdStyles = new Set(), removedStyles = new Set(), movedStyles = new Set();
       styles.forEach((s) => {
         prevStyles.has(s) || createdStyles.add(s);
       }), prevStyles.forEach((s) => {
         styles.has(s) || removedStyles.add(s);
       }), styles.forEach((s) => {
         !createdStyles.has(s) && !removedStyles.has(s) && didStylePositionChange(s) && movedStyles.add(s);
       }), handleStyleOperations({createdStyles, removedStyles, movedStyles}), iterateShadowHosts(root, subscribeForShadowRootChanges), collectUndefinedElements(root);
     }
     function handleAttributeMutations(mutations) {
       let updatedStyles = new Set(), removedStyles = new Set();
       mutations.forEach((m) => {
         let {target} = m;
         target.isConnected && (shouldManageStyle(target) ? updatedStyles.add(target) : target instanceof HTMLLinkElement && target.disabled && removedStyles.add(target));
       }), updatedStyles.size + removedStyles.size > 0 && update({
         updated: Array.from(updatedStyles),
         created: [],
         removed: Array.from(removedStyles),
         moved: []
       });
     }
     function observe(root) {
       let treeObserver = createOptimizedTreeObserver(root, {
         onMinorMutations: handleMinorTreeMutations,
         onHugeMutations: handleHugeTreeMutations
       }), attrObserver = new MutationObserver(handleAttributeMutations);
       attrObserver.observe(root, {attributes: !0, attributeFilter: ["rel", "disabled", "media"], subtree: !0}), observers.push(treeObserver, attrObserver), observedRoots.add(root);
     }
     function subscribeForShadowRootChanges(node) {
       let {shadowRoot} = node;
       shadowRoot == null || observedRoots.has(shadowRoot) || (observe(shadowRoot), shadowRootDiscovered(shadowRoot));
     }
     observe(document), iterateShadowHosts(document.documentElement, subscribeForShadowRootChanges), watchWhenCustomElementsDefined((hosts) => {
       let newStyles = [];
       hosts.forEach((host) => push(newStyles, getManageableStyles(host.shadowRoot))), update({created: newStyles, updated: [], removed: [], moved: []}), hosts.forEach((host) => {
         let {shadowRoot} = host;
         shadowRoot != null && (subscribeForShadowRootChanges(host), iterateShadowHosts(shadowRoot, subscribeForShadowRootChanges), collectUndefinedElements(shadowRoot));
       });
     }), document.addEventListener("__darkreader__isDefined", handleIsDefined), collectUndefinedElements(document);
   }
   function resetObservers() {
     observers.forEach((o) => o.disconnect()), observers.splice(0, observers.length), observedRoots = new WeakSet();
   }
   function stopWatchingForStyleChanges() {
     resetObservers(), unsubscribeFromDefineCustomElements();
   }
 
   // src/utils/uid.ts
   function hexify(number) {
     return (number < 16 ? "0" : "") + number.toString(16);
   }
   function generateUID() {
     return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((x) => hexify(x)).join("");
   }
 
   // src/inject/dynamic-theme/adopted-style-manger.ts
   var adoptedStyleOverrides = new WeakMap(), overrideList = new WeakSet();
   function createAdoptedStyleSheetOverride(node) {
     let cancelAsyncOperations = !1;
     function injectSheet(sheet, override) {
       let newSheets = [...node.adoptedStyleSheets], sheetIndex = newSheets.indexOf(sheet), existingIndex = newSheets.indexOf(override);
       sheetIndex !== existingIndex - 1 && (existingIndex >= 0 && newSheets.splice(existingIndex, 1), newSheets.splice(sheetIndex + 1, 0, override), node.adoptedStyleSheets = newSheets);
     }
     function destroy() {
       cancelAsyncOperations = !0;
       let newSheets = [...node.adoptedStyleSheets];
       node.adoptedStyleSheets.forEach((adoptedStyleSheet) => {
         if (overrideList.has(adoptedStyleSheet)) {
           let existingIndex = newSheets.indexOf(adoptedStyleSheet);
           existingIndex >= 0 && newSheets.splice(existingIndex, 1), adoptedStyleOverrides.delete(adoptedStyleSheet), overrideList.delete(adoptedStyleSheet);
         }
       }), node.adoptedStyleSheets = newSheets;
     }
     function render(theme, ignoreImageAnalysis) {
       node.adoptedStyleSheets.forEach((sheet) => {
         if (overrideList.has(sheet))
           return;
         let rules = sheet.rules, override = new CSSStyleSheet();
         function prepareOverridesSheet() {
           for (let i = override.cssRules.length - 1; i >= 0; i--)
             override.deleteRule(i);
           return injectSheet(sheet, override), adoptedStyleOverrides.set(sheet, override), overrideList.add(override), override;
         }
         createStyleSheetModifier().modifySheet({
           prepareSheet: prepareOverridesSheet,
           sourceCSSRules: rules,
           theme,
           ignoreImageAnalysis,
           force: !1,
           isAsyncCancelled: () => cancelAsyncOperations
         });
       });
     }
     return {
       render,
       destroy
     };
   }
 
   // src/inject/dynamic-theme/stylesheet-proxy.ts
   function injectProxy() {
     document.dispatchEvent(new CustomEvent("__darkreader__inlineScriptsAllowed"));
     let addRuleDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "addRule"), insertRuleDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "insertRule"), deleteRuleDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "deleteRule"), removeRuleDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "removeRule"), shouldWrapDocStyleSheets = location.hostname.endsWith("pushbullet.com"), documentStyleSheetsDescriptor = shouldWrapDocStyleSheets ? Object.getOwnPropertyDescriptor(Document.prototype, "styleSheets") : null, cleanUp = () => {
       Object.defineProperty(CSSStyleSheet.prototype, "addRule", addRuleDescriptor), Object.defineProperty(CSSStyleSheet.prototype, "insertRule", insertRuleDescriptor), Object.defineProperty(CSSStyleSheet.prototype, "deleteRule", deleteRuleDescriptor), Object.defineProperty(CSSStyleSheet.prototype, "removeRule", removeRuleDescriptor), document.removeEventListener("__darkreader__cleanUp", cleanUp), document.removeEventListener("__darkreader__addUndefinedResolver", addUndefinedResolver), shouldWrapDocStyleSheets && Object.defineProperty(Document.prototype, "styleSheets", documentStyleSheetsDescriptor);
     }, addUndefinedResolver = (e) => {
       customElements.whenDefined(e.detail.tag).then(() => {
         document.dispatchEvent(new CustomEvent("__darkreader__isDefined", {detail: {tag: e.detail.tag}}));
       });
     };
     document.addEventListener("__darkreader__cleanUp", cleanUp), document.addEventListener("__darkreader__addUndefinedResolver", addUndefinedResolver);
     let updateSheetEvent = new Event("__darkreader__updateSheet");
     function proxyAddRule(selector, style, index) {
       return addRuleDescriptor.value.call(this, selector, style, index), this.ownerNode && !this.ownerNode.classList.contains("darkreader") && this.ownerNode.dispatchEvent(updateSheetEvent), -1;
     }
     function proxyInsertRule(rule, index) {
       let returnValue = insertRuleDescriptor.value.call(this, rule, index);
       return this.ownerNode && !this.ownerNode.classList.contains("darkreader") && this.ownerNode.dispatchEvent(updateSheetEvent), returnValue;
     }
     function proxyDeleteRule(index) {
       deleteRuleDescriptor.value.call(this, index), this.ownerNode && !this.ownerNode.classList.contains("darkreader") && this.ownerNode.dispatchEvent(updateSheetEvent);
     }
     function proxyRemoveRule(index) {
       removeRuleDescriptor.value.call(this, index), this.ownerNode && !this.ownerNode.classList.contains("darkreader") && this.ownerNode.dispatchEvent(updateSheetEvent);
     }
     function proxyDocumentStyleSheets() {
       let filtered = [...documentStyleSheetsDescriptor.get.call(this)].filter((styleSheet) => !styleSheet.ownerNode.classList.contains("darkreader"));
       return Object.setPrototypeOf(filtered, StyleSheetList.prototype);
     }
     Object.defineProperty(CSSStyleSheet.prototype, "addRule", Object.assign({}, addRuleDescriptor, {value: proxyAddRule})), Object.defineProperty(CSSStyleSheet.prototype, "insertRule", Object.assign({}, insertRuleDescriptor, {value: proxyInsertRule})), Object.defineProperty(CSSStyleSheet.prototype, "deleteRule", Object.assign({}, deleteRuleDescriptor, {value: proxyDeleteRule})), Object.defineProperty(CSSStyleSheet.prototype, "removeRule", Object.assign({}, removeRuleDescriptor, {value: proxyRemoveRule})), shouldWrapDocStyleSheets && Object.defineProperty(Document.prototype, "styleSheets", Object.assign({}, documentStyleSheetsDescriptor, {get: proxyDocumentStyleSheets}));
   }
 
   // src/inject/dynamic-theme/index.ts
   var INSTANCE_ID = generateUID(), styleManagers = new Map(), adoptedStyleManagers = [], filter = null, fixes = null, isIFrame2 = null, ignoredImageAnalysisSelectors = null, ignoredInlineSelectors = null;
   function createOrUpdateStyle(className, root = document.head || document) {
     let element = root.querySelector(`.${className}`);
     return element || (element = document.createElement("style"), element.classList.add("darkreader"), element.classList.add(className), element.media = "screen", element.textContent = ""), element;
   }
   function createOrUpdateScript(className, root = document.head || document) {
     let element = root.querySelector(`.${className}`);
     return element || (element = document.createElement("script"), element.classList.add("darkreader"), element.classList.add(className)), element;
   }
   var nodePositionWatchers = new Map();
   function setupNodePositionWatcher(node, alias) {
     nodePositionWatchers.has(alias) && nodePositionWatchers.get(alias).stop(), nodePositionWatchers.set(alias, watchForNodePosition(node, "parent"));
   }
   function stopStylePositionWatchers() {
     forEach(nodePositionWatchers.values(), (watcher) => watcher.stop()), nodePositionWatchers.clear();
   }
   function createStaticStyleOverrides() {
     let fallbackStyle = createOrUpdateStyle("darkreader--fallback", document);
     fallbackStyle.textContent = getModifiedFallbackStyle(filter, {strict: !0}), document.head.insertBefore(fallbackStyle, document.head.firstChild), setupNodePositionWatcher(fallbackStyle, "fallback");
     let userAgentStyle = createOrUpdateStyle("darkreader--user-agent");
     userAgentStyle.textContent = getModifiedUserAgentStyle(filter, isIFrame2, filter.styleSystemControls), document.head.insertBefore(userAgentStyle, fallbackStyle.nextSibling), setupNodePositionWatcher(userAgentStyle, "user-agent");
     let textStyle = createOrUpdateStyle("darkreader--text");
     filter.useFont || filter.textStroke > 0 ? textStyle.textContent = createTextStyle(filter) : textStyle.textContent = "", document.head.insertBefore(textStyle, fallbackStyle.nextSibling), setupNodePositionWatcher(textStyle, "text");
     let invertStyle = createOrUpdateStyle("darkreader--invert");
     fixes && Array.isArray(fixes.invert) && fixes.invert.length > 0 ? invertStyle.textContent = [
       `${fixes.invert.join(", ")} {`,
       `    filter: ${getCSSFilterValue({
         ...filter,
         contrast: filter.mode === 0 ? filter.contrast : clamp(filter.contrast - 10, 0, 100)
       })} !important;`,
       "}"
     ].join(`
 `) : invertStyle.textContent = "", document.head.insertBefore(invertStyle, textStyle.nextSibling), setupNodePositionWatcher(invertStyle, "invert");
     let inlineStyle = createOrUpdateStyle("darkreader--inline");
     inlineStyle.textContent = getInlineOverrideStyle(), document.head.insertBefore(inlineStyle, invertStyle.nextSibling), setupNodePositionWatcher(inlineStyle, "inline");
     let overrideStyle = createOrUpdateStyle("darkreader--override");
     overrideStyle.textContent = fixes && fixes.css ? replaceCSSTemplates(fixes.css) : "", document.head.appendChild(overrideStyle), setupNodePositionWatcher(overrideStyle, "override");
     let variableStyle = createOrUpdateStyle("darkreader--variables"), selectionColors = getSelectionColor(filter), {darkSchemeBackgroundColor, darkSchemeTextColor, lightSchemeBackgroundColor, lightSchemeTextColor, mode} = filter, schemeBackgroundColor = mode === 0 ? lightSchemeBackgroundColor : darkSchemeBackgroundColor, schemeTextColor = mode === 0 ? lightSchemeTextColor : darkSchemeTextColor;
     schemeBackgroundColor = modifyBackgroundColor(parse(schemeBackgroundColor), filter), schemeTextColor = modifyForegroundColor(parse(schemeTextColor), filter), variableStyle.textContent = [
       ":root {",
       `   --darkreader-neutral-background: ${schemeBackgroundColor};`,
       `   --darkreader-neutral-text: ${schemeTextColor};`,
       `   --darkreader-selection-background: ${selectionColors.backgroundColorSelection};`,
       `   --darkreader-selection-text: ${selectionColors.foregroundColorSelection};`,
       "}"
     ].join(`
 `), document.head.insertBefore(variableStyle, inlineStyle.nextSibling), setupNodePositionWatcher(variableStyle, "variables");
     let rootVarsStyle = createOrUpdateStyle("darkreader--root-vars");
     document.head.insertBefore(rootVarsStyle, variableStyle.nextSibling);
     let proxyScript = createOrUpdateScript("darkreader--proxy");
     proxyScript.textContent = `(${injectProxy})()`, document.head.insertBefore(proxyScript, rootVarsStyle.nextSibling);
   }
   var shadowRootsWithOverrides = new Set();
   function createShadowStaticStyleOverrides(root) {
     let inlineStyle = createOrUpdateStyle("darkreader--inline", root);
     inlineStyle.textContent = getInlineOverrideStyle(), root.insertBefore(inlineStyle, root.firstChild);
     let overrideStyle = createOrUpdateStyle("darkreader--override", root);
     overrideStyle.textContent = fixes && fixes.css ? replaceCSSTemplates(fixes.css) : "", root.insertBefore(overrideStyle, inlineStyle.nextSibling), shadowRootsWithOverrides.add(root);
   }
   function replaceCSSTemplates($cssText) {
     return $cssText.replace(/\${(.+?)}/g, (m0, $color) => {
       try {
         let color = parseColorWithCache($color);
         return modifyColor(color, filter);
       } catch (err) {
         return logWarn(err), $color;
       }
     });
   }
   function cleanFallbackStyle() {
     let fallback = document.querySelector(".darkreader--fallback");
     fallback && (fallback.textContent = "");
   }
   function createDynamicStyleOverrides() {
     cancelRendering();
     let newManagers = getManageableStyles(document).filter((style) => !styleManagers.has(style)).map((style) => createManager(style));
     newManagers.map((manager) => manager.details()).filter((detail) => detail && detail.rules.length > 0).forEach((detail) => {
       variablesStore.addRulesForMatching(detail.rules);
     }), variablesStore.matchVariablesAndDependants(), variablesStore.putRootVars(document.head.querySelector(".darkreader--root-vars"), filter), styleManagers.forEach((manager) => manager.render(filter, ignoredImageAnalysisSelectors)), loadingStyles.size === 0 && cleanFallbackStyle(), newManagers.forEach((manager) => manager.watch());
     let inlineStyleElements = toArray(document.querySelectorAll(INLINE_STYLE_SELECTOR));
     iterateShadowHosts(document.documentElement, (host) => {
       createShadowStaticStyleOverrides(host.shadowRoot);
       let elements = host.shadowRoot.querySelectorAll(INLINE_STYLE_SELECTOR);
       elements.length > 0 && push(inlineStyleElements, elements);
     }), inlineStyleElements.forEach((el) => overrideInlineStyle(el, filter, ignoredInlineSelectors, ignoredImageAnalysisSelectors)), handleAdoptedStyleSheets(document);
   }
   var loadingStylesCounter = 0, loadingStyles = new Set();
   function createManager(element) {
     let loadingStyleId = ++loadingStylesCounter;
     function loadingStart() {
       if (!isDOMReady() || !didDocumentShowUp) {
         loadingStyles.add(loadingStyleId);
         let fallbackStyle = document.querySelector(".darkreader--fallback");
         fallbackStyle.textContent || (fallbackStyle.textContent = getModifiedFallbackStyle(filter, {strict: !1}));
       }
     }
     function loadingEnd() {
       loadingStyles.delete(loadingStyleId), loadingStyles.size === 0 && isDOMReady() && cleanFallbackStyle();
     }
     function update() {
       let details = manager.details();
       !details || (variablesStore.addRulesForMatching(details.rules), variablesStore.matchVariablesAndDependants(), manager.render(filter, ignoredImageAnalysisSelectors));
     }
     let manager = manageStyle(element, {update, loadingStart, loadingEnd});
     return styleManagers.set(element, manager), manager;
   }
   function removeManager(element) {
     let manager = styleManagers.get(element);
     manager && (manager.destroy(), styleManagers.delete(element));
   }
   var throttledRenderAllStyles = throttle((callback) => {
     styleManagers.forEach((manager) => manager.render(filter, ignoredImageAnalysisSelectors)), adoptedStyleManagers.forEach((manager) => manager.render(filter, ignoredImageAnalysisSelectors)), callback && callback();
   }), cancelRendering = function() {
     throttledRenderAllStyles.cancel();
   };
   function onDOMReady() {
     loadingStyles.size === 0 && cleanFallbackStyle();
   }
   var documentVisibilityListener = null, didDocumentShowUp = !document.hidden;
   function watchForDocumentVisibility(callback) {
     let alreadyWatching = Boolean(documentVisibilityListener);
     documentVisibilityListener = () => {
       document.hidden || (stopWatchingForDocumentVisibility(), callback(), didDocumentShowUp = !0);
     }, alreadyWatching || document.addEventListener("visibilitychange", documentVisibilityListener);
   }
   function stopWatchingForDocumentVisibility() {
     document.removeEventListener("visibilitychange", documentVisibilityListener), documentVisibilityListener = null;
   }
   function createThemeAndWatchForUpdates() {
     createStaticStyleOverrides();
     function runDynamicStyle() {
       createDynamicStyleOverrides(), watchForUpdates();
     }
     document.hidden ? watchForDocumentVisibility(runDynamicStyle) : runDynamicStyle(), changeMetaThemeColorWhenAvailable(filter);
   }
   function handleAdoptedStyleSheets(node) {
     if (Array.isArray(node.adoptedStyleSheets) && node.adoptedStyleSheets.length > 0) {
       let newManger = createAdoptedStyleSheetOverride(node);
       adoptedStyleManagers.push(newManger), newManger.render(filter, ignoredImageAnalysisSelectors);
     }
   }
   function watchForUpdates() {
     let managedStyles = Array.from(styleManagers.keys());
     watchForStyleChanges(managedStyles, ({created, updated, removed, moved}) => {
       let stylesToRemove = removed, stylesToManage = created.concat(updated).concat(moved).filter((style) => !styleManagers.has(style)), stylesToRestore = moved.filter((style) => styleManagers.has(style));
       stylesToRemove.forEach((style) => removeManager(style));
       let newManagers = stylesToManage.map((style) => createManager(style));
       newManagers.map((manager) => manager.details()).filter((detail) => detail && detail.rules.length > 0).forEach((detail) => {
         variablesStore.addRulesForMatching(detail.rules);
       }), variablesStore.matchVariablesAndDependants(), newManagers.forEach((manager) => manager.render(filter, ignoredImageAnalysisSelectors)), newManagers.forEach((manager) => manager.watch()), stylesToRestore.forEach((style) => styleManagers.get(style).restore());
     }, (shadowRoot) => {
       createShadowStaticStyleOverrides(shadowRoot), handleAdoptedStyleSheets(shadowRoot);
     }), watchForInlineStyles((element) => {
       overrideInlineStyle(element, filter, ignoredInlineSelectors, ignoredImageAnalysisSelectors), element === document.documentElement && element.getAttribute("style").includes("--") && (variablesStore.matchVariablesAndDependants(), variablesStore.putRootVars(document.head.querySelector(".darkreader--root-vars"), filter));
     }, (root) => {
       createShadowStaticStyleOverrides(root);
       let inlineStyleElements = root.querySelectorAll(INLINE_STYLE_SELECTOR);
       inlineStyleElements.length > 0 && forEach(inlineStyleElements, (el) => overrideInlineStyle(el, filter, ignoredInlineSelectors, ignoredImageAnalysisSelectors));
     }), addDOMReadyListener(onDOMReady);
   }
   function stopWatchingForUpdates() {
     styleManagers.forEach((manager) => manager.pause()), stopStylePositionWatchers(), stopWatchingForStyleChanges(), stopWatchingForInlineStyles(), removeDOMReadyListener(onDOMReady);
   }
   function createDarkReaderInstanceMarker() {
     let metaElement = document.createElement("meta");
     metaElement.name = "darkreader", metaElement.content = INSTANCE_ID, document.head.appendChild(metaElement);
   }
   function isAnotherDarkReaderInstanceActive() {
     let meta = document.querySelector('meta[name="darkreader"]');
     return meta ? meta.content !== INSTANCE_ID : (createDarkReaderInstanceMarker(), !1);
   }
   function createOrUpdateDynamicTheme(filterConfig, dynamicThemeFixes, iframe) {
     if (filter = filterConfig, fixes = dynamicThemeFixes, fixes ? (ignoredImageAnalysisSelectors = Array.isArray(fixes.ignoreImageAnalysis) ? fixes.ignoreImageAnalysis : [], ignoredInlineSelectors = Array.isArray(fixes.ignoreInlineStyle) ? fixes.ignoreInlineStyle : []) : (ignoredImageAnalysisSelectors = [], ignoredInlineSelectors = []), isIFrame2 = iframe, document.head) {
       if (isAnotherDarkReaderInstanceActive())
         return;
       document.documentElement.setAttribute("data-darkreader-mode", "dynamic"), document.documentElement.setAttribute("data-darkreader-scheme", filter.mode ? "dark" : "dimmed"), createThemeAndWatchForUpdates();
     } else {
       if (!isFirefox) {
         let fallbackStyle = createOrUpdateStyle("darkreader--fallback");
         document.documentElement.appendChild(fallbackStyle), fallbackStyle.textContent = getModifiedFallbackStyle(filter, {strict: !0});
       }
       let headObserver = new MutationObserver(() => {
         if (document.head) {
           if (headObserver.disconnect(), isAnotherDarkReaderInstanceActive()) {
             removeDynamicTheme();
             return;
           }
           createThemeAndWatchForUpdates();
         }
       });
       headObserver.observe(document, {childList: !0, subtree: !0});
     }
   }
   function removeProxy() {
     document.dispatchEvent(new CustomEvent("__darkreader__cleanUp")), removeNode(document.head.querySelector(".darkreader--proxy"));
   }
   function removeDynamicTheme() {
     document.documentElement.removeAttribute("data-darkreader-mode"), document.documentElement.removeAttribute("data-darkreader-scheme"), cleanDynamicThemeCache(), removeNode(document.querySelector(".darkreader--fallback")), document.head && (restoreMetaThemeColor(), removeNode(document.head.querySelector(".darkreader--user-agent")), removeNode(document.head.querySelector(".darkreader--text")), removeNode(document.head.querySelector(".darkreader--invert")), removeNode(document.head.querySelector(".darkreader--inline")), removeNode(document.head.querySelector(".darkreader--override")), removeNode(document.head.querySelector(".darkreader--variables")), removeNode(document.head.querySelector(".darkreader--root-vars")), removeNode(document.head.querySelector('meta[name="darkreader"]')), removeProxy()), shadowRootsWithOverrides.forEach((root) => {
       removeNode(root.querySelector(".darkreader--inline")), removeNode(root.querySelector(".darkreader--override"));
     }), shadowRootsWithOverrides.clear(), forEach(styleManagers.keys(), (el) => removeManager(el)), forEach(document.querySelectorAll(".darkreader"), removeNode), adoptedStyleManagers.forEach((manager) => {
       manager.destroy();
     }), adoptedStyleManagers.splice(0);
   }
   function cleanDynamicThemeCache() {
     variablesStore.clear(), parsedURLCache.clear(), stopWatchingForDocumentVisibility(), cancelRendering(), stopWatchingForUpdates(), cleanModificationCache();
   }
   {
     let addEnableDynamicTheme = (e) => {
       createOrUpdateDynamicTheme(e.detail.theme, e.detail.fixes, !0);
     };
     document.addEventListener("__darkreader__removeDynamicTheme", () => removeDynamicTheme()), document.addEventListener("__darkreader__enableDynamicTheme", addEnableDynamicTheme), document.dispatchEvent(new CustomEvent("__darkreader__IAmReady"));
   }
 
   // src/inject/dynamic-theme/css-collection.ts
   var blobRegex = /url\(\"(blob\:.*?)\"\)/g;
   async function replaceBlobs(text) {
     let promises = [];
     getMatches(blobRegex, text, 1).forEach((url) => {
       let promise = loadAsDataURL(url);
       promises.push(promise);
     });
     let data = await Promise.all(promises);
     return text.replace(blobRegex, () => `url("${data.shift()}")`);
   }
   var banner = `/*
                         _______
                        /       \\
                       .==.    .==.
                      ((  ))==((  ))
                     / "=="    "=="\\
                    /____|| || ||___\\
        ________     ____    ________  ___    ___
        |  ___  \\   /    \\   |  ___  \\ |  |  /  /
        |  |  \\  \\ /  /\\  \\  |  |  \\  \\|  |_/  /
        |  |   )  /  /__\\  \\ |  |__/  /|  ___  \\
        |  |__/  /  ______  \\|  ____  \\|  |  \\  \\
 _______|_______/__/ ____ \\__\\__|___\\__\\__|___\\__\\____
 |  ___  \\ |  ____/ /    \\   |  ___  \\ |  ____|  ___  \\
 |  |  \\  \\|  |___ /  /\\  \\  |  |  \\  \\|  |___|  |  \\  \\
 |  |__/  /|  ____/  /__\\  \\ |  |   )  |  ____|  |__/  /
 |  ____  \\|  |__/  ______  \\|  |__/  /|  |___|  ____  \\
 |__|   \\__\\____/__/      \\__\\_______/ |______|__|   \\__\\
                 https://darkreader.org
 */`;
   async function collectCSS() {
     let css = [banner];
     function addStaticCSS(selector, comment) {
       let staticStyle = document.querySelector(selector);
       staticStyle && staticStyle.textContent && (css.push(`/* ${comment} */`), css.push(staticStyle.textContent), css.push(""));
     }
     addStaticCSS(".darkreader--fallback", "Fallback Style"), addStaticCSS(".darkreader--user-agent", "User-Agent Style"), addStaticCSS(".darkreader--text", "Text Style"), addStaticCSS(".darkreader--invert", "Invert Style"), addStaticCSS(".darkreader--variables", "Variables Style");
     let modifiedCSS = [];
     if (document.querySelectorAll(".darkreader--sync").forEach((element) => {
       forEach(element.sheet.cssRules, (rule) => {
         rule && rule.cssText && modifiedCSS.push(rule.cssText);
       });
     }), modifiedCSS.length != 0) {
       let formattedCSS = formatCSS(modifiedCSS.join(`
 `));
       css.push("/* Modified CSS */"), css.push(await replaceBlobs(formattedCSS)), css.push("");
     }
     return addStaticCSS(".darkreader--override", "Override Style"), css.join(`
 `);
   }
 
   // src/api/index.ts
   var isDarkReaderEnabled = !1, usesIFrames = !1;
   function enable(themeOptions = {}, fixes2 = null) {
     let theme = {...DEFAULT_THEME, ...themeOptions};
     if (theme.engine !== theme_engines_default.dynamicTheme)
       throw new Error("Theme engine is not supported.");
     store = {theme, fixes: fixes2}, createOrUpdateDynamicTheme(theme, fixes2, isIFrame), isDarkReaderEnabled = !0;
     let enableDynamicThemeEvent = new CustomEvent("__darkreader__enableDynamicTheme", {detail: {theme, fixes: fixes2}});
     usesIFrames && getAllIFrames(document).forEach((IFrame) => ensureIFrameIsLoaded(IFrame, (IFrameDocument) => IFrameDocument.dispatchEvent(enableDynamicThemeEvent)));
   }
   function isEnabled2() {
     return isDarkReaderEnabled;
   }
   function disable() {
     removeDynamicTheme(), isDarkReaderEnabled = !1;
     let removeDynamicThemeEvent = new CustomEvent("__darkreader__removeDynamicTheme");
     usesIFrames && getAllIFrames(document).forEach((IFrame) => ensureIFrameIsLoaded(IFrame, (IFrameDocument) => IFrameDocument.dispatchEvent(removeDynamicThemeEvent)));
   }
   var darkScheme = matchMedia("(prefers-color-scheme: dark)"), store = {
     theme: null,
     fixes: null
   }, getStore2 = () => store;
   function handleColorScheme() {
     darkScheme.matches ? enable(store.theme, store.fixes) : disable();
   }
   function auto(themeOptions = {}, fixes2 = null) {
     themeOptions ? (store = {theme: {...DEFAULT_THEME, ...themeOptions}, fixes: fixes2}, handleColorScheme(), isMatchMediaChangeEventListenerSupported ? darkScheme.addEventListener("change", handleColorScheme) : darkScheme.addListener(handleColorScheme)) : (isMatchMediaChangeEventListenerSupported ? darkScheme.removeEventListener("change", handleColorScheme) : darkScheme.removeListener(handleColorScheme), disable());
   }
   async function exportGeneratedCSS() {
     return await collectCSS();
   }
   function setupIFrameListener(listener) {
     if (!listener || listener.length !== 1)
       throw new Error('Must provide an listener with 1 argument, the literatal template should follow "(IFrameDocument: Document) => void".');
     usesIFrames = !0, setupIFrameObserver(), setupIFrameData(listener, getStore2, () => isDarkReaderEnabled);
   }
   var setFetchMethod2 = setFetchMethod;
   return api_exports;
 })();
 