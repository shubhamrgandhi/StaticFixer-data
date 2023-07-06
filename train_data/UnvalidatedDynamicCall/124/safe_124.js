parcelRequire = (function (e, r, t, n) {
    var i,
        o = "function" == typeof parcelRequire && parcelRequire,
        u = "function" == typeof require && require;
    function f(t, n) {
        if (!r[t]) {
            if (!e[t]) {
                var i = "function" == typeof parcelRequire && parcelRequire;
                if (!n && i) return i(t, !0);
                if (o) return o(t, !0);
                if (u && "string" == typeof t) return u(t);
                var c = new Error("Cannot find module '" + t + "'");
                throw ((c.code = "MODULE_NOT_FOUND"), c);
            }
            (p.resolve = function (r) {
                return e[t][1][r] || r;
            }),
                (p.cache = {});
            var l = (r[t] = new f.Module(t));
            e[t][0].call(l.exports, p, l, l.exports, this);
        }
        return r[t].exports;
        function p(e) {
            return f(p.resolve(e));
        }
    }
    (f.isParcelRequire = !0),
        (f.Module = function (e) {
            (this.id = e), (this.bundle = f), (this.exports = {});
        }),
        (f.modules = e),
        (f.cache = r),
        (f.parent = o),
        (f.register = function (r, t) {
            e[r] = [
                function (e, r) {
                    r.exports = t;
                },
                {},
            ];
        });
    for (var c = 0; c < t.length; c++)
        try {
            f(t[c]);
        } catch (e) {
            i || (i = e);
        }
    if (t.length) {
        var l = f(t[t.length - 1]);
        "object" == typeof exports && "undefined" != typeof module
            ? (module.exports = l)
            : "function" == typeof define && define.amd
            ? define(function () {
                  return l;
              })
            : n && (this[n] = l);
    }
    if (((parcelRequire = f), i)) throw i;
    return f;
})(
    {
        ErvS: [
            function (require, module, exports) {
                var d = "sessionAccessId-";
                function e(e) {
                    var i;
                    return e && e.id && ~e.id.indexOf(d) && (i = e.id), i;
                }
                module.exports = e;
            },
            {},
        ],
        E9bQ: [
            function (require, module, exports) {
                var e = "sessionAccessId-connected";
                module.exports = {
                    get: function (e, o) {
                        e.source.postMessage(
                            { id: o.id, data: window.localStorage.getItem(o.key) },
                            e.origin,
                        );
                    },
                    set: function (e, o) {
                        window.localStorage.setItem(o.key, o.value),
                            e.source.postMessage({ id: o.id }, e.origin);
                    },
                    remove: function (e, o) {
                        window.localStorage.removeItem(o.key),
                            e.source.postMessage({ id: o.id }, e.origin);
                    },
                    connect: function (o) {
                        o.source.postMessage({ id: e }, o.origin);
                    },
                };
            },
            {},
        ],
        OlNd: [
            function (require, module, exports) {
                var e = require("../getId"),
                    o = require("./methods");
                module.exports = function (n) {
                    function r(r) {
                        var i = r.data,
                            t = n.find(function (e) {
                                return new RegExp(e.origin, "i").test(r.origin);
                            }),
                            s = e(i);
                        if (s)
                            if (t) {
                                var a = i.method;
                                ~ t.allowedMethods.indexOf(a) || "connect" === a ? o[a](r, i) : r.source.postMessage({
id : s ,
error : "".concat(a, " is not an allowed method from ").concat(r.origin) 
}, r.origin);
                            } else
                                r.source.postMessage(
                                    {
                                        id: s,
                                        connectError: !0,
                                        error: "".concat(r.origin, " is not an allowed domain"),
                                    },
                                    r.origin,
                                );
                    }
                    return (
                        window.addEventListener("message", r),
                        {
                            close: function () {
                                window.removeEventListener("message", r);
                            },
                        }
                    );
                };
            },
            { "../getId": "ErvS", "./methods": "E9bQ" },
        ],
        epB2: [
            function (require, module, exports) {
                var e = require("./cross-domain-storage/source/host");
                e([
                    {
                        origin: "(github-client-47c49|dev-github-client)--pr\\d+.+\\.web\\.app$",
                        allowedMethods: ["get"],
                    },
                ]);
            },
            { "./cross-domain-storage/source/host": "OlNd" },
        ],
    },
    {},
    ["epB2"],
    null,
);
//# sourceMappingURL=/main.306cbe88.js.map
