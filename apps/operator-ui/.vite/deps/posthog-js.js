import "./chunk-V4OQ3NZ2.js";

// node_modules/posthog-js/dist/module.js
var t = "undefined" != typeof window ? window : void 0;
var i = "undefined" != typeof globalThis ? globalThis : t;
var e = Array.prototype;
var r = e.forEach;
var s = e.indexOf;
var n = null == i ? void 0 : i.navigator;
var o = null == i ? void 0 : i.document;
var a = null == i ? void 0 : i.location;
var l = null == i ? void 0 : i.fetch;
var u = null != i && i.XMLHttpRequest && "withCredentials" in new i.XMLHttpRequest() ? i.XMLHttpRequest : void 0;
var h = null == i ? void 0 : i.AbortController;
var d = null == n ? void 0 : n.userAgent;
var v = null != t ? t : {};
var c = { DEBUG: false, LIB_VERSION: "1.260.1" };
var f = "$copy_autocapture";
var p = ["$snapshot", "$pageview", "$pageleave", "$set", "survey dismissed", "survey sent", "survey shown", "$identify", "$groupidentify", "$create_alias", "$$client_ingestion_warning", "$web_experiment_applied", "$feature_enrollment_update", "$feature_flag_called"];
var _ = (function(t2) {
  return t2.GZipJS = "gzip-js", t2.Base64 = "base64", t2;
})({});
var g = ["fatal", "error", "warning", "log", "info", "debug"];
function m(t2, i2) {
  return -1 !== t2.indexOf(i2);
}
var b = function(t2) {
  return t2.trim();
};
var y = function(t2) {
  return t2.replace(/^\$/, "");
};
var w = Array.isArray;
var S = Object.prototype;
var $ = S.hasOwnProperty;
var x = S.toString;
var k = w || function(t2) {
  return "[object Array]" === x.call(t2);
};
var E = (t2) => "function" == typeof t2;
var I = (t2) => t2 === Object(t2) && !k(t2);
var P = (t2) => {
  if (I(t2)) {
    for (var i2 in t2) if ($.call(t2, i2)) return false;
    return true;
  }
  return false;
};
var R = (t2) => void 0 === t2;
var T = (t2) => "[object String]" == x.call(t2);
var C = (t2) => T(t2) && 0 === t2.trim().length;
var M = (t2) => null === t2;
var F = (t2) => R(t2) || M(t2);
var O = (t2) => "[object Number]" == x.call(t2);
var A = (t2) => "[object Boolean]" === x.call(t2);
var D = (t2) => t2 instanceof FormData;
var j = (t2) => m(p, t2);
var L = (i2) => {
  var e2 = { t: function(e3) {
    if (t && (c.DEBUG || v.POSTHOG_DEBUG) && !R(t.console) && t.console) {
      for (var r2 = ("__rrweb_original__" in t.console[e3]) ? t.console[e3].__rrweb_original__ : t.console[e3], s2 = arguments.length, n2 = new Array(s2 > 1 ? s2 - 1 : 0), o2 = 1; o2 < s2; o2++) n2[o2 - 1] = arguments[o2];
      r2(i2, ...n2);
    }
  }, info: function() {
    for (var t2 = arguments.length, i3 = new Array(t2), r2 = 0; r2 < t2; r2++) i3[r2] = arguments[r2];
    e2.t("log", ...i3);
  }, warn: function() {
    for (var t2 = arguments.length, i3 = new Array(t2), r2 = 0; r2 < t2; r2++) i3[r2] = arguments[r2];
    e2.t("warn", ...i3);
  }, error: function() {
    for (var t2 = arguments.length, i3 = new Array(t2), r2 = 0; r2 < t2; r2++) i3[r2] = arguments[r2];
    e2.t("error", ...i3);
  }, critical: function() {
    for (var t2 = arguments.length, e3 = new Array(t2), r2 = 0; r2 < t2; r2++) e3[r2] = arguments[r2];
    console.error(i2, ...e3);
  }, uninitializedWarning: (t2) => {
    e2.error("You must initialize PostHog before calling " + t2);
  }, createLogger: (t2) => L(i2 + " " + t2) };
  return e2;
};
var N = L("[PostHog.js]");
var z = N.createLogger;
var U = z("[ExternalScriptsLoader]");
var q = (t2, i2, e2) => {
  if (t2.config.disable_external_dependency_loading) return U.warn(i2 + " was requested but loading of external scripts is disabled."), e2("Loading of external scripts is disabled");
  var r2 = null == o ? void 0 : o.querySelectorAll("script");
  if (r2) {
    for (var s2 = 0; s2 < r2.length; s2++) if (r2[s2].src === i2) return e2();
  }
  var n2 = () => {
    if (!o) return e2("document not found");
    var r3 = o.createElement("script");
    if (r3.type = "text/javascript", r3.crossOrigin = "anonymous", r3.src = i2, r3.onload = (t3) => e2(void 0, t3), r3.onerror = (t3) => e2(t3), t2.config.prepare_external_dependency_script && (r3 = t2.config.prepare_external_dependency_script(r3)), !r3) return e2("prepare_external_dependency_script returned null");
    var s3, n3 = o.querySelectorAll("body > script");
    n3.length > 0 ? null == (s3 = n3[0].parentNode) || s3.insertBefore(r3, n3[0]) : o.body.appendChild(r3);
  };
  null != o && o.body ? n2() : null == o || o.addEventListener("DOMContentLoaded", n2);
};
function B() {
  return B = Object.assign ? Object.assign.bind() : function(t2) {
    for (var i2 = 1; i2 < arguments.length; i2++) {
      var e2 = arguments[i2];
      for (var r2 in e2) ({}).hasOwnProperty.call(e2, r2) && (t2[r2] = e2[r2]);
    }
    return t2;
  }, B.apply(null, arguments);
}
function H(t2, i2) {
  if (null == t2) return {};
  var e2 = {};
  for (var r2 in t2) if ({}.hasOwnProperty.call(t2, r2)) {
    if (-1 !== i2.indexOf(r2)) continue;
    e2[r2] = t2[r2];
  }
  return e2;
}
v.__PosthogExtensions__ = v.__PosthogExtensions__ || {}, v.__PosthogExtensions__.loadExternalDependency = (t2, i2, e2) => {
  var r2 = "/static/" + i2 + ".js?v=" + t2.version;
  if ("remote-config" === i2 && (r2 = "/array/" + t2.config.token + "/config.js"), "toolbar" === i2) {
    var s2 = 3e5;
    r2 = r2 + "&t=" + Math.floor(Date.now() / s2) * s2;
  }
  var n2 = t2.requestRouter.endpointFor("assets", r2);
  q(t2, n2, e2);
}, v.__PosthogExtensions__.loadSiteApp = (t2, i2, e2) => {
  var r2 = t2.requestRouter.endpointFor("api", i2);
  q(t2, r2, e2);
};
var W = {};
function G(t2, i2, e2) {
  if (k(t2)) {
    if (r && t2.forEach === r) t2.forEach(i2, e2);
    else if ("length" in t2 && t2.length === +t2.length) {
      for (var s2 = 0, n2 = t2.length; s2 < n2; s2++) if (s2 in t2 && i2.call(e2, t2[s2], s2) === W) return;
    }
  }
}
function J(t2, i2, e2) {
  if (!F(t2)) {
    if (k(t2)) return G(t2, i2, e2);
    if (D(t2)) {
      for (var r2 of t2.entries()) if (i2.call(e2, r2[1], r2[0]) === W) return;
    } else for (var s2 in t2) if ($.call(t2, s2) && i2.call(e2, t2[s2], s2) === W) return;
  }
}
var V = function(t2) {
  for (var i2 = arguments.length, e2 = new Array(i2 > 1 ? i2 - 1 : 0), r2 = 1; r2 < i2; r2++) e2[r2 - 1] = arguments[r2];
  return G(e2, (function(i3) {
    for (var e3 in i3) void 0 !== i3[e3] && (t2[e3] = i3[e3]);
  })), t2;
};
var K = function(t2) {
  for (var i2 = arguments.length, e2 = new Array(i2 > 1 ? i2 - 1 : 0), r2 = 1; r2 < i2; r2++) e2[r2 - 1] = arguments[r2];
  return G(e2, (function(i3) {
    G(i3, (function(i4) {
      t2.push(i4);
    }));
  })), t2;
};
function Y(t2) {
  for (var i2 = Object.keys(t2), e2 = i2.length, r2 = new Array(e2); e2--; ) r2[e2] = [i2[e2], t2[i2[e2]]];
  return r2;
}
var X = function(t2) {
  try {
    return t2();
  } catch (t3) {
    return;
  }
};
var Q = function(t2) {
  return function() {
    try {
      for (var i2 = arguments.length, e2 = new Array(i2), r2 = 0; r2 < i2; r2++) e2[r2] = arguments[r2];
      return t2.apply(this, e2);
    } catch (t3) {
      N.critical("Implementation error. Please turn on debug mode and open a ticket on https://app.posthog.com/home#panel=support%3Asupport%3A."), N.critical(t3);
    }
  };
};
var Z = function(t2) {
  var i2 = {};
  return J(t2, (function(t3, e2) {
    (T(t3) && t3.length > 0 || O(t3)) && (i2[e2] = t3);
  })), i2;
};
function tt(t2, i2) {
  return e2 = t2, r2 = (t3) => T(t3) && !M(i2) ? t3.slice(0, i2) : t3, s2 = /* @__PURE__ */ new Set(), (function t3(i3, e3) {
    return i3 !== Object(i3) ? r2 ? r2(i3, e3) : i3 : s2.has(i3) ? void 0 : (s2.add(i3), k(i3) ? (n2 = [], G(i3, ((i4) => {
      n2.push(t3(i4));
    }))) : (n2 = {}, J(i3, ((i4, e4) => {
      s2.has(i4) || (n2[e4] = t3(i4, e4));
    }))), n2);
    var n2;
  })(e2);
  var e2, r2, s2;
}
var it = ["herokuapp.com", "vercel.app", "netlify.app"];
function et(t2) {
  var i2 = null == t2 ? void 0 : t2.hostname;
  if (!T(i2)) return false;
  var e2 = i2.split(".").slice(-2).join(".");
  for (var r2 of it) if (e2 === r2) return false;
  return true;
}
function rt(t2, i2) {
  for (var e2 = 0; e2 < t2.length; e2++) if (i2(t2[e2])) return t2[e2];
}
function st(t2, i2, e2, r2) {
  var { capture: s2 = false, passive: n2 = true } = null != r2 ? r2 : {};
  null == t2 || t2.addEventListener(i2, e2, { capture: s2, passive: n2 });
}
var nt = "$people_distinct_id";
var ot = "__alias";
var at = "__timers";
var lt = "$autocapture_disabled_server_side";
var ut = "$heatmaps_enabled_server_side";
var ht = "$exception_capture_enabled_server_side";
var dt = "$error_tracking_suppression_rules";
var vt = "$error_tracking_capture_extension_exceptions";
var ct = "$web_vitals_enabled_server_side";
var ft = "$dead_clicks_enabled_server_side";
var pt = "$web_vitals_allowed_metrics";
var _t = "$session_recording_enabled_server_side";
var gt = "$console_log_recording_enabled_server_side";
var mt = "$session_recording_network_payload_capture";
var bt = "$session_recording_masking";
var yt = "$session_recording_canvas_recording";
var wt = "$replay_sample_rate";
var St = "$replay_minimum_duration";
var $t = "$replay_script_config";
var xt = "$sesid";
var kt = "$session_is_sampled";
var Et = "$session_recording_url_trigger_activated_session";
var It = "$session_recording_event_trigger_activated_session";
var Pt = "$enabled_feature_flags";
var Rt = "$early_access_features";
var Tt = "$feature_flag_details";
var Ct = "$stored_person_properties";
var Mt = "$stored_group_properties";
var Ft = "$surveys";
var Ot = "$surveys_activated";
var At = "$flag_call_reported";
var Dt = "$user_state";
var jt = "$client_session_props";
var Lt = "$capture_rate_limit";
var Nt = "$initial_campaign_params";
var zt = "$initial_referrer_info";
var Ut = "$initial_person_info";
var qt = "$epp";
var Bt = "__POSTHOG_TOOLBAR__";
var Ht = "$posthog_cookieless";
var Wt = [nt, ot, "__cmpns", at, _t, ut, xt, Pt, dt, Dt, Rt, Tt, Mt, Ct, Ft, At, jt, Lt, Nt, zt, qt, Ut];
function Gt(t2) {
  return t2 instanceof Element && (t2.id === Bt || !(null == t2.closest || !t2.closest(".toolbar-global-fade-container")));
}
function Jt(t2) {
  return !!t2 && 1 === t2.nodeType;
}
function Vt(t2, i2) {
  return !!t2 && !!t2.tagName && t2.tagName.toLowerCase() === i2.toLowerCase();
}
function Kt(t2) {
  return !!t2 && 3 === t2.nodeType;
}
function Yt(t2) {
  return !!t2 && 11 === t2.nodeType;
}
function Xt(t2) {
  return t2 ? b(t2).split(/\s+/) : [];
}
function Qt(i2) {
  var e2 = null == t ? void 0 : t.location.href;
  return !!(e2 && i2 && i2.some(((t2) => e2.match(t2))));
}
function Zt(t2) {
  var i2 = "";
  switch (typeof t2.className) {
    case "string":
      i2 = t2.className;
      break;
    case "object":
      i2 = (t2.className && "baseVal" in t2.className ? t2.className.baseVal : null) || t2.getAttribute("class") || "";
      break;
    default:
      i2 = "";
  }
  return Xt(i2);
}
function ti(t2) {
  return F(t2) ? null : b(t2).split(/(\s+)/).filter(((t3) => fi(t3))).join("").replace(/[\r\n]/g, " ").replace(/[ ]+/g, " ").substring(0, 255);
}
function ii(t2) {
  var i2 = "";
  return oi(t2) && !ai(t2) && t2.childNodes && t2.childNodes.length && J(t2.childNodes, (function(t3) {
    var e2;
    Kt(t3) && t3.textContent && (i2 += null !== (e2 = ti(t3.textContent)) && void 0 !== e2 ? e2 : "");
  })), b(i2);
}
function ei(t2) {
  return R(t2.target) ? t2.srcElement || null : null != (i2 = t2.target) && i2.shadowRoot ? t2.composedPath()[0] || null : t2.target || null;
  var i2;
}
var ri = ["a", "button", "form", "input", "select", "textarea", "label"];
function si(t2) {
  var i2 = t2.parentNode;
  return !(!i2 || !Jt(i2)) && i2;
}
function ni(i2, e2, r2, s2, n2) {
  var o2, a2, l2;
  if (void 0 === r2 && (r2 = void 0), !t || !i2 || Vt(i2, "html") || !Jt(i2)) return false;
  if (null != (o2 = r2) && o2.url_allowlist && !Qt(r2.url_allowlist)) return false;
  if (null != (a2 = r2) && a2.url_ignorelist && Qt(r2.url_ignorelist)) return false;
  if (null != (l2 = r2) && l2.dom_event_allowlist) {
    var u2 = r2.dom_event_allowlist;
    if (u2 && !u2.some(((t2) => e2.type === t2))) return false;
  }
  for (var h2 = false, d2 = [i2], v2 = true, c2 = i2; c2.parentNode && !Vt(c2, "body"); ) if (Yt(c2.parentNode)) d2.push(c2.parentNode.host), c2 = c2.parentNode.host;
  else {
    if (!(v2 = si(c2))) break;
    if (s2 || ri.indexOf(v2.tagName.toLowerCase()) > -1) h2 = true;
    else {
      var f2 = t.getComputedStyle(v2);
      f2 && "pointer" === f2.getPropertyValue("cursor") && (h2 = true);
    }
    d2.push(v2), c2 = v2;
  }
  if (!(function(t2, i3) {
    var e3 = null == i3 ? void 0 : i3.element_allowlist;
    if (R(e3)) return true;
    var r3, s3 = function(t3) {
      if (e3.some(((i4) => t3.tagName.toLowerCase() === i4))) return { v: true };
    };
    for (var n3 of t2) if (r3 = s3(n3)) return r3.v;
    return false;
  })(d2, r2)) return false;
  if (!(function(t2, i3) {
    var e3 = null == i3 ? void 0 : i3.css_selector_allowlist;
    if (R(e3)) return true;
    var r3, s3 = function(t3) {
      if (e3.some(((i4) => t3.matches(i4)))) return { v: true };
    };
    for (var n3 of t2) if (r3 = s3(n3)) return r3.v;
    return false;
  })(d2, r2)) return false;
  var p2 = t.getComputedStyle(i2);
  if (p2 && "pointer" === p2.getPropertyValue("cursor") && "click" === e2.type) return true;
  var _2 = i2.tagName.toLowerCase();
  switch (_2) {
    case "html":
      return false;
    case "form":
      return (n2 || ["submit"]).indexOf(e2.type) >= 0;
    case "input":
    case "select":
    case "textarea":
      return (n2 || ["change", "click"]).indexOf(e2.type) >= 0;
    default:
      return h2 ? (n2 || ["click"]).indexOf(e2.type) >= 0 : (n2 || ["click"]).indexOf(e2.type) >= 0 && (ri.indexOf(_2) > -1 || "true" === i2.getAttribute("contenteditable"));
  }
}
function oi(t2) {
  for (var i2 = t2; i2.parentNode && !Vt(i2, "body"); i2 = i2.parentNode) {
    var e2 = Zt(i2);
    if (m(e2, "ph-sensitive") || m(e2, "ph-no-capture")) return false;
  }
  if (m(Zt(t2), "ph-include")) return true;
  var r2 = t2.type || "";
  if (T(r2)) switch (r2.toLowerCase()) {
    case "hidden":
    case "password":
      return false;
  }
  var s2 = t2.name || t2.id || "";
  if (T(s2)) {
    if (/^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i.test(s2.replace(/[^a-zA-Z0-9]/g, ""))) return false;
  }
  return true;
}
function ai(t2) {
  return !!(Vt(t2, "input") && !["button", "checkbox", "submit", "reset"].includes(t2.type) || Vt(t2, "select") || Vt(t2, "textarea") || "true" === t2.getAttribute("contenteditable"));
}
var li = "(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11})";
var ui = new RegExp("^(?:" + li + ")$");
var hi = new RegExp(li);
var di = "\\d{3}-?\\d{2}-?\\d{4}";
var vi = new RegExp("^(" + di + ")$");
var ci = new RegExp("(" + di + ")");
function fi(t2, i2) {
  if (void 0 === i2 && (i2 = true), F(t2)) return false;
  if (T(t2)) {
    if (t2 = b(t2), (i2 ? ui : hi).test((t2 || "").replace(/[- ]/g, ""))) return false;
    if ((i2 ? vi : ci).test(t2)) return false;
  }
  return true;
}
function pi(t2) {
  var i2 = ii(t2);
  return fi(i2 = (i2 + " " + _i(t2)).trim()) ? i2 : "";
}
function _i(t2) {
  var i2 = "";
  return t2 && t2.childNodes && t2.childNodes.length && J(t2.childNodes, (function(t3) {
    var e2;
    if (t3 && "span" === (null == (e2 = t3.tagName) ? void 0 : e2.toLowerCase())) try {
      var r2 = ii(t3);
      i2 = (i2 + " " + r2).trim(), t3.childNodes && t3.childNodes.length && (i2 = (i2 + " " + _i(t3)).trim());
    } catch (t4) {
      N.error("[AutoCapture]", t4);
    }
  })), i2;
}
function gi(t2) {
  return (function(t3) {
    var i2 = t3.map(((t4) => {
      var i3, e2, r2 = "";
      if (t4.tag_name && (r2 += t4.tag_name), t4.attr_class) for (var s2 of (t4.attr_class.sort(), t4.attr_class)) r2 += "." + s2.replace(/"/g, "");
      var n2 = B({}, t4.text ? { text: t4.text } : {}, { "nth-child": null !== (i3 = t4.nth_child) && void 0 !== i3 ? i3 : 0, "nth-of-type": null !== (e2 = t4.nth_of_type) && void 0 !== e2 ? e2 : 0 }, t4.href ? { href: t4.href } : {}, t4.attr_id ? { attr_id: t4.attr_id } : {}, t4.attributes), o2 = {};
      return Y(n2).sort(((t5, i4) => {
        var [e3] = t5, [r3] = i4;
        return e3.localeCompare(r3);
      })).forEach(((t5) => {
        var [i4, e3] = t5;
        return o2[mi(i4.toString())] = mi(e3.toString());
      })), r2 += ":", r2 += Y(o2).map(((t5) => {
        var [i4, e3] = t5;
        return i4 + '="' + e3 + '"';
      })).join("");
    }));
    return i2.join(";");
  })((function(t3) {
    return t3.map(((t4) => {
      var i2, e2, r2 = { text: null == (i2 = t4.$el_text) ? void 0 : i2.slice(0, 400), tag_name: t4.tag_name, href: null == (e2 = t4.attr__href) ? void 0 : e2.slice(0, 2048), attr_class: bi(t4), attr_id: t4.attr__id, nth_child: t4.nth_child, nth_of_type: t4.nth_of_type, attributes: {} };
      return Y(t4).filter(((t5) => {
        var [i3] = t5;
        return 0 === i3.indexOf("attr__");
      })).forEach(((t5) => {
        var [i3, e3] = t5;
        return r2.attributes[i3] = e3;
      })), r2;
    }));
  })(t2));
}
function mi(t2) {
  return t2.replace(/"|\\"/g, '\\"');
}
function bi(t2) {
  var i2 = t2.attr__class;
  return i2 ? k(i2) ? i2 : Xt(i2) : void 0;
}
var yi = class {
  constructor() {
    this.clicks = [];
  }
  isRageClick(t2, i2, e2) {
    var r2 = this.clicks[this.clicks.length - 1];
    if (r2 && Math.abs(t2 - r2.x) + Math.abs(i2 - r2.y) < 30 && e2 - r2.timestamp < 1e3) {
      if (this.clicks.push({ x: t2, y: i2, timestamp: e2 }), 3 === this.clicks.length) return true;
    } else this.clicks = [{ x: t2, y: i2, timestamp: e2 }];
    return false;
  }
};
var wi = ["localhost", "127.0.0.1"];
var Si = (t2) => {
  var i2 = null == o ? void 0 : o.createElement("a");
  return R(i2) ? null : (i2.href = t2, i2);
};
var $i = function(t2, i2) {
  var e2, r2;
  void 0 === i2 && (i2 = "&");
  var s2 = [];
  return J(t2, (function(t3, i3) {
    R(t3) || R(i3) || "undefined" === i3 || (e2 = encodeURIComponent(((t4) => t4 instanceof File)(t3) ? t3.name : t3.toString()), r2 = encodeURIComponent(i3), s2[s2.length] = r2 + "=" + e2);
  })), s2.join(i2);
};
var xi = function(t2, i2) {
  for (var e2, r2 = ((t2.split("#")[0] || "").split(/\?(.*)/)[1] || "").replace(/^\?+/g, "").split("&"), s2 = 0; s2 < r2.length; s2++) {
    var n2 = r2[s2].split("=");
    if (n2[0] === i2) {
      e2 = n2;
      break;
    }
  }
  if (!k(e2) || e2.length < 2) return "";
  var o2 = e2[1];
  try {
    o2 = decodeURIComponent(o2);
  } catch (t3) {
    N.error("Skipping decoding for malformed query param: " + o2);
  }
  return o2.replace(/\+/g, " ");
};
var ki = function(t2, i2, e2) {
  if (!t2 || !i2 || !i2.length) return t2;
  for (var r2 = t2.split("#"), s2 = r2[0] || "", n2 = r2[1], o2 = s2.split("?"), a2 = o2[1], l2 = o2[0], u2 = (a2 || "").split("&"), h2 = [], d2 = 0; d2 < u2.length; d2++) {
    var v2 = u2[d2].split("=");
    k(v2) && (i2.includes(v2[0]) ? h2.push(v2[0] + "=" + e2) : h2.push(u2[d2]));
  }
  var c2 = l2;
  return null != a2 && (c2 += "?" + h2.join("&")), null != n2 && (c2 += "#" + n2), c2;
};
var Ei = function(t2, i2) {
  var e2 = t2.match(new RegExp(i2 + "=([^&]*)"));
  return e2 ? e2[1] : null;
};
var Ii = z("[AutoCapture]");
function Pi(t2, i2) {
  return i2.length > t2 ? i2.slice(0, t2) + "..." : i2;
}
function Ri(t2) {
  if (t2.previousElementSibling) return t2.previousElementSibling;
  var i2 = t2;
  do {
    i2 = i2.previousSibling;
  } while (i2 && !Jt(i2));
  return i2;
}
function Ti(t2, i2, e2, r2) {
  var s2 = t2.tagName.toLowerCase(), n2 = { tag_name: s2 };
  ri.indexOf(s2) > -1 && !e2 && ("a" === s2.toLowerCase() || "button" === s2.toLowerCase() ? n2.$el_text = Pi(1024, pi(t2)) : n2.$el_text = Pi(1024, ii(t2)));
  var o2 = Zt(t2);
  o2.length > 0 && (n2.classes = o2.filter((function(t3) {
    return "" !== t3;
  }))), J(t2.attributes, (function(e3) {
    var s3;
    if ((!ai(t2) || -1 !== ["name", "id", "class", "aria-label"].indexOf(e3.name)) && ((null == r2 || !r2.includes(e3.name)) && !i2 && fi(e3.value) && (s3 = e3.name, !T(s3) || "_ngcontent" !== s3.substring(0, 10) && "_nghost" !== s3.substring(0, 7)))) {
      var o3 = e3.value;
      "class" === e3.name && (o3 = Xt(o3).join(" ")), n2["attr__" + e3.name] = Pi(1024, o3);
    }
  }));
  for (var a2 = 1, l2 = 1, u2 = t2; u2 = Ri(u2); ) a2++, u2.tagName === t2.tagName && l2++;
  return n2.nth_child = a2, n2.nth_of_type = l2, n2;
}
function Ci(i2, e2) {
  for (var r2, s2, { e: n2, maskAllElementAttributes: o2, maskAllText: a2, elementAttributeIgnoreList: l2, elementsChainAsString: u2 } = e2, h2 = [i2], d2 = i2; d2.parentNode && !Vt(d2, "body"); ) Yt(d2.parentNode) ? (h2.push(d2.parentNode.host), d2 = d2.parentNode.host) : (h2.push(d2.parentNode), d2 = d2.parentNode);
  var v2, c2 = [], f2 = {}, p2 = false, _2 = false;
  if (J(h2, ((t2) => {
    var i3 = oi(t2);
    "a" === t2.tagName.toLowerCase() && (p2 = t2.getAttribute("href"), p2 = i3 && p2 && fi(p2) && p2), m(Zt(t2), "ph-no-capture") && (_2 = true), c2.push(Ti(t2, o2, a2, l2));
    var e3 = (function(t3) {
      if (!oi(t3)) return {};
      var i4 = {};
      return J(t3.attributes, (function(t4) {
        if (t4.name && 0 === t4.name.indexOf("data-ph-capture-attribute")) {
          var e4 = t4.name.replace("data-ph-capture-attribute-", ""), r3 = t4.value;
          e4 && r3 && fi(r3) && (i4[e4] = r3);
        }
      })), i4;
    })(t2);
    V(f2, e3);
  })), _2) return { props: {}, explicitNoCapture: _2 };
  if (a2 || ("a" === i2.tagName.toLowerCase() || "button" === i2.tagName.toLowerCase() ? c2[0].$el_text = pi(i2) : c2[0].$el_text = ii(i2)), p2) {
    var g2, b2;
    c2[0].attr__href = p2;
    var y2 = null == (g2 = Si(p2)) ? void 0 : g2.host, w2 = null == t || null == (b2 = t.location) ? void 0 : b2.host;
    y2 && w2 && y2 !== w2 && (v2 = p2);
  }
  return { props: V({ $event_type: n2.type, $ce_version: 1 }, u2 ? {} : { $elements: c2 }, { $elements_chain: gi(c2) }, null != (r2 = c2[0]) && r2.$el_text ? { $el_text: null == (s2 = c2[0]) ? void 0 : s2.$el_text } : {}, v2 && "click" === n2.type ? { $external_click_url: v2 } : {}, f2) };
}
var Mi = class {
  constructor(t2) {
    this.i = false, this.o = null, this.rageclicks = new yi(), this.h = false, this.instance = t2, this.m = null;
  }
  get S() {
    var t2, i2, e2 = I(this.instance.config.autocapture) ? this.instance.config.autocapture : {};
    return e2.url_allowlist = null == (t2 = e2.url_allowlist) ? void 0 : t2.map(((t3) => new RegExp(t3))), e2.url_ignorelist = null == (i2 = e2.url_ignorelist) ? void 0 : i2.map(((t3) => new RegExp(t3))), e2;
  }
  $() {
    if (this.isBrowserSupported()) {
      if (t && o) {
        var i2 = (i3) => {
          i3 = i3 || (null == t ? void 0 : t.event);
          try {
            this.k(i3);
          } catch (t2) {
            Ii.error("Failed to capture event", t2);
          }
        };
        if (st(o, "submit", i2, { capture: true }), st(o, "change", i2, { capture: true }), st(o, "click", i2, { capture: true }), this.S.capture_copied_text) {
          var e2 = (i3) => {
            i3 = i3 || (null == t ? void 0 : t.event), this.k(i3, f);
          };
          st(o, "copy", e2, { capture: true }), st(o, "cut", e2, { capture: true });
        }
      }
    } else Ii.info("Disabling Automatic Event Collection because this browser is not supported");
  }
  startIfEnabled() {
    this.isEnabled && !this.i && (this.$(), this.i = true);
  }
  onRemoteConfig(t2) {
    t2.elementsChainAsString && (this.h = t2.elementsChainAsString), this.instance.persistence && this.instance.persistence.register({ [lt]: !!t2.autocapture_opt_out }), this.o = !!t2.autocapture_opt_out, this.startIfEnabled();
  }
  setElementSelectors(t2) {
    this.m = t2;
  }
  getElementSelectors(t2) {
    var i2, e2 = [];
    return null == (i2 = this.m) || i2.forEach(((i3) => {
      var r2 = null == o ? void 0 : o.querySelectorAll(i3);
      null == r2 || r2.forEach(((r3) => {
        t2 === r3 && e2.push(i3);
      }));
    })), e2;
  }
  get isEnabled() {
    var t2, i2, e2 = null == (t2 = this.instance.persistence) ? void 0 : t2.props[lt], r2 = this.o;
    if (M(r2) && !A(e2) && !this.instance.I()) return false;
    var s2 = null !== (i2 = this.o) && void 0 !== i2 ? i2 : !!e2;
    return !!this.instance.config.autocapture && !s2;
  }
  k(i2, e2) {
    if (void 0 === e2 && (e2 = "$autocapture"), this.isEnabled) {
      var r2, s2 = ei(i2);
      if (Kt(s2) && (s2 = s2.parentNode || null), "$autocapture" === e2 && "click" === i2.type && i2 instanceof MouseEvent) this.instance.config.rageclick && null != (r2 = this.rageclicks) && r2.isRageClick(i2.clientX, i2.clientY, (/* @__PURE__ */ new Date()).getTime()) && this.k(i2, "$rageclick");
      var n2 = e2 === f;
      if (s2 && ni(s2, i2, this.S, n2, n2 ? ["copy", "cut"] : void 0)) {
        var { props: o2, explicitNoCapture: a2 } = Ci(s2, { e: i2, maskAllElementAttributes: this.instance.config.mask_all_element_attributes, maskAllText: this.instance.config.mask_all_text, elementAttributeIgnoreList: this.S.element_attribute_ignorelist, elementsChainAsString: this.h });
        if (a2) return false;
        var l2 = this.getElementSelectors(s2);
        if (l2 && l2.length > 0 && (o2.$element_selectors = l2), e2 === f) {
          var u2, h2 = ti(null == t || null == (u2 = t.getSelection()) ? void 0 : u2.toString()), d2 = i2.type || "clipboard";
          if (!h2) return false;
          o2.$selected_content = h2, o2.$copy_type = d2;
        }
        return this.instance.capture(e2, o2), true;
      }
    }
  }
  isBrowserSupported() {
    return E(null == o ? void 0 : o.querySelectorAll);
  }
};
Math.trunc || (Math.trunc = function(t2) {
  return t2 < 0 ? Math.ceil(t2) : Math.floor(t2);
}), Number.isInteger || (Number.isInteger = function(t2) {
  return O(t2) && isFinite(t2) && Math.floor(t2) === t2;
});
var Fi = "0123456789abcdef";
var Oi = class _Oi {
  constructor(t2) {
    if (this.bytes = t2, 16 !== t2.length) throw new TypeError("not 128-bit length");
  }
  static fromFieldsV7(t2, i2, e2, r2) {
    if (!Number.isInteger(t2) || !Number.isInteger(i2) || !Number.isInteger(e2) || !Number.isInteger(r2) || t2 < 0 || i2 < 0 || e2 < 0 || r2 < 0 || t2 > 281474976710655 || i2 > 4095 || e2 > 1073741823 || r2 > 4294967295) throw new RangeError("invalid field value");
    var s2 = new Uint8Array(16);
    return s2[0] = t2 / Math.pow(2, 40), s2[1] = t2 / Math.pow(2, 32), s2[2] = t2 / Math.pow(2, 24), s2[3] = t2 / Math.pow(2, 16), s2[4] = t2 / Math.pow(2, 8), s2[5] = t2, s2[6] = 112 | i2 >>> 8, s2[7] = i2, s2[8] = 128 | e2 >>> 24, s2[9] = e2 >>> 16, s2[10] = e2 >>> 8, s2[11] = e2, s2[12] = r2 >>> 24, s2[13] = r2 >>> 16, s2[14] = r2 >>> 8, s2[15] = r2, new _Oi(s2);
  }
  toString() {
    for (var t2 = "", i2 = 0; i2 < this.bytes.length; i2++) t2 = t2 + Fi.charAt(this.bytes[i2] >>> 4) + Fi.charAt(15 & this.bytes[i2]), 3 !== i2 && 5 !== i2 && 7 !== i2 && 9 !== i2 || (t2 += "-");
    if (36 !== t2.length) throw new Error("Invalid UUIDv7 was generated");
    return t2;
  }
  clone() {
    return new _Oi(this.bytes.slice(0));
  }
  equals(t2) {
    return 0 === this.compareTo(t2);
  }
  compareTo(t2) {
    for (var i2 = 0; i2 < 16; i2++) {
      var e2 = this.bytes[i2] - t2.bytes[i2];
      if (0 !== e2) return Math.sign(e2);
    }
    return 0;
  }
};
var Ai = class {
  constructor() {
    this.P = 0, this.R = 0, this.T = new Li();
  }
  generate() {
    var t2 = this.generateOrAbort();
    if (R(t2)) {
      this.P = 0;
      var i2 = this.generateOrAbort();
      if (R(i2)) throw new Error("Could not generate UUID after timestamp reset");
      return i2;
    }
    return t2;
  }
  generateOrAbort() {
    var t2 = Date.now();
    if (t2 > this.P) this.P = t2, this.C();
    else {
      if (!(t2 + 1e4 > this.P)) return;
      this.R++, this.R > 4398046511103 && (this.P++, this.C());
    }
    return Oi.fromFieldsV7(this.P, Math.trunc(this.R / Math.pow(2, 30)), this.R & Math.pow(2, 30) - 1, this.T.nextUint32());
  }
  C() {
    this.R = 1024 * this.T.nextUint32() + (1023 & this.T.nextUint32());
  }
};
var Di;
var ji = (t2) => {
  if ("undefined" != typeof UUIDV7_DENY_WEAK_RNG && UUIDV7_DENY_WEAK_RNG) throw new Error("no cryptographically strong RNG available");
  for (var i2 = 0; i2 < t2.length; i2++) t2[i2] = 65536 * Math.trunc(65536 * Math.random()) + Math.trunc(65536 * Math.random());
  return t2;
};
t && !R(t.crypto) && crypto.getRandomValues && (ji = (t2) => crypto.getRandomValues(t2));
var Li = class {
  constructor() {
    this.M = new Uint32Array(8), this.F = 1 / 0;
  }
  nextUint32() {
    return this.F >= this.M.length && (ji(this.M), this.F = 0), this.M[this.F++];
  }
};
var Ni = () => zi().toString();
var zi = () => (Di || (Di = new Ai())).generate();
var Ui = "";
var qi = /[a-z0-9][a-z0-9-]+\.[a-z]{2,}$/i;
function Bi(t2, i2) {
  if (i2) {
    var e2 = (function(t3, i3) {
      if (void 0 === i3 && (i3 = o), Ui) return Ui;
      if (!i3) return "";
      if (["localhost", "127.0.0.1"].includes(t3)) return "";
      for (var e3 = t3.split("."), r3 = Math.min(e3.length, 8), s2 = "dmn_chk_" + Ni(); !Ui && r3--; ) {
        var n2 = e3.slice(r3).join("."), a2 = s2 + "=1;domain=." + n2 + ";path=/";
        i3.cookie = a2 + ";max-age=3", i3.cookie.includes(s2) && (i3.cookie = a2 + ";max-age=0", Ui = n2);
      }
      return Ui;
    })(t2);
    if (!e2) {
      var r2 = ((t3) => {
        var i3 = t3.match(qi);
        return i3 ? i3[0] : "";
      })(t2);
      r2 !== e2 && N.info("Warning: cookie subdomain discovery mismatch", r2, e2), e2 = r2;
    }
    return e2 ? "; domain=." + e2 : "";
  }
  return "";
}
var Hi = { O: () => !!o, A: function(t2) {
  N.error("cookieStore error: " + t2);
}, D: function(t2) {
  if (o) {
    try {
      for (var i2 = t2 + "=", e2 = o.cookie.split(";").filter(((t3) => t3.length)), r2 = 0; r2 < e2.length; r2++) {
        for (var s2 = e2[r2]; " " == s2.charAt(0); ) s2 = s2.substring(1, s2.length);
        if (0 === s2.indexOf(i2)) return decodeURIComponent(s2.substring(i2.length, s2.length));
      }
    } catch (t3) {
    }
    return null;
  }
}, j: function(t2) {
  var i2;
  try {
    i2 = JSON.parse(Hi.D(t2)) || {};
  } catch (t3) {
  }
  return i2;
}, L: function(t2, i2, e2, r2, s2) {
  if (o) try {
    var n2 = "", a2 = "", l2 = Bi(o.location.hostname, r2);
    if (e2) {
      var u2 = /* @__PURE__ */ new Date();
      u2.setTime(u2.getTime() + 24 * e2 * 60 * 60 * 1e3), n2 = "; expires=" + u2.toUTCString();
    }
    s2 && (a2 = "; secure");
    var h2 = t2 + "=" + encodeURIComponent(JSON.stringify(i2)) + n2 + "; SameSite=Lax; path=/" + l2 + a2;
    return h2.length > 3686.4 && N.warn("cookieStore warning: large cookie, len=" + h2.length), o.cookie = h2, h2;
  } catch (t3) {
    return;
  }
}, N: function(t2, i2) {
  if (null != o && o.cookie) try {
    Hi.L(t2, "", -1, i2);
  } catch (t3) {
    return;
  }
} };
var Wi = null;
var Gi = { O: function() {
  if (!M(Wi)) return Wi;
  var i2 = true;
  if (R(t)) i2 = false;
  else try {
    var e2 = "__mplssupport__";
    Gi.L(e2, "xyz"), '"xyz"' !== Gi.D(e2) && (i2 = false), Gi.N(e2);
  } catch (t2) {
    i2 = false;
  }
  return i2 || N.error("localStorage unsupported; falling back to cookie store"), Wi = i2, i2;
}, A: function(t2) {
  N.error("localStorage error: " + t2);
}, D: function(i2) {
  try {
    return null == t ? void 0 : t.localStorage.getItem(i2);
  } catch (t2) {
    Gi.A(t2);
  }
  return null;
}, j: function(t2) {
  try {
    return JSON.parse(Gi.D(t2)) || {};
  } catch (t3) {
  }
  return null;
}, L: function(i2, e2) {
  try {
    null == t || t.localStorage.setItem(i2, JSON.stringify(e2));
  } catch (t2) {
    Gi.A(t2);
  }
}, N: function(i2) {
  try {
    null == t || t.localStorage.removeItem(i2);
  } catch (t2) {
    Gi.A(t2);
  }
} };
var Ji = ["distinct_id", xt, kt, qt, Ut];
var Vi = B({}, Gi, { j: function(t2) {
  try {
    var i2 = {};
    try {
      i2 = Hi.j(t2) || {};
    } catch (t3) {
    }
    var e2 = V(i2, JSON.parse(Gi.D(t2) || "{}"));
    return Gi.L(t2, e2), e2;
  } catch (t3) {
  }
  return null;
}, L: function(t2, i2, e2, r2, s2, n2) {
  try {
    Gi.L(t2, i2, void 0, void 0, n2);
    var o2 = {};
    Ji.forEach(((t3) => {
      i2[t3] && (o2[t3] = i2[t3]);
    })), Object.keys(o2).length && Hi.L(t2, o2, e2, r2, s2, n2);
  } catch (t3) {
    Gi.A(t3);
  }
}, N: function(i2, e2) {
  try {
    null == t || t.localStorage.removeItem(i2), Hi.N(i2, e2);
  } catch (t2) {
    Gi.A(t2);
  }
} });
var Ki = {};
var Yi = { O: function() {
  return true;
}, A: function(t2) {
  N.error("memoryStorage error: " + t2);
}, D: function(t2) {
  return Ki[t2] || null;
}, j: function(t2) {
  return Ki[t2] || null;
}, L: function(t2, i2) {
  Ki[t2] = i2;
}, N: function(t2) {
  delete Ki[t2];
} };
var Xi = null;
var Qi = { O: function() {
  if (!M(Xi)) return Xi;
  if (Xi = true, R(t)) Xi = false;
  else try {
    var i2 = "__support__";
    Qi.L(i2, "xyz"), '"xyz"' !== Qi.D(i2) && (Xi = false), Qi.N(i2);
  } catch (t2) {
    Xi = false;
  }
  return Xi;
}, A: function(t2) {
  N.error("sessionStorage error: ", t2);
}, D: function(i2) {
  try {
    return null == t ? void 0 : t.sessionStorage.getItem(i2);
  } catch (t2) {
    Qi.A(t2);
  }
  return null;
}, j: function(t2) {
  try {
    return JSON.parse(Qi.D(t2)) || null;
  } catch (t3) {
  }
  return null;
}, L: function(i2, e2) {
  try {
    null == t || t.sessionStorage.setItem(i2, JSON.stringify(e2));
  } catch (t2) {
    Qi.A(t2);
  }
}, N: function(i2) {
  try {
    null == t || t.sessionStorage.removeItem(i2);
  } catch (t2) {
    Qi.A(t2);
  }
} };
var Zi = (function(t2) {
  return t2[t2.PENDING = -1] = "PENDING", t2[t2.DENIED = 0] = "DENIED", t2[t2.GRANTED = 1] = "GRANTED", t2;
})({});
var te = class {
  constructor(t2) {
    this._instance = t2;
  }
  get S() {
    return this._instance.config;
  }
  get consent() {
    return this.U() ? Zi.DENIED : this.q;
  }
  isOptedOut() {
    return "always" === this.S.cookieless_mode || (this.consent === Zi.DENIED || this.consent === Zi.PENDING && (this.S.opt_out_capturing_by_default || "on_reject" === this.S.cookieless_mode));
  }
  isOptedIn() {
    return !this.isOptedOut();
  }
  isExplicitlyOptedOut() {
    return this.consent === Zi.DENIED;
  }
  optInOut(t2) {
    this.B.L(this.H, t2 ? 1 : 0, this.S.cookie_expiration, this.S.cross_subdomain_cookie, this.S.secure_cookie);
  }
  reset() {
    this.B.N(this.H, this.S.cross_subdomain_cookie);
  }
  get H() {
    var { token: t2, opt_out_capturing_cookie_prefix: i2, consent_persistence_name: e2 } = this._instance.config;
    return e2 || (i2 ? i2 + t2 : "__ph_opt_in_out_" + t2);
  }
  get q() {
    var t2 = this.B.D(this.H);
    return "1" === t2 ? Zi.GRANTED : "0" === t2 ? Zi.DENIED : Zi.PENDING;
  }
  get B() {
    if (!this.W) {
      var t2 = this.S.opt_out_capturing_persistence_type;
      this.W = "localStorage" === t2 ? Gi : Hi;
      var i2 = "localStorage" === t2 ? Hi : Gi;
      i2.D(this.H) && (this.W.D(this.H) || this.optInOut("1" === i2.D(this.H)), i2.N(this.H, this.S.cross_subdomain_cookie));
    }
    return this.W;
  }
  U() {
    return !!this.S.respect_dnt && !!rt([null == n ? void 0 : n.doNotTrack, null == n ? void 0 : n.msDoNotTrack, v.doNotTrack], ((t2) => m([true, 1, "1", "yes"], t2)));
  }
};
var ie = z("[Dead Clicks]");
var ee = () => true;
var re = (t2) => {
  var i2, e2 = !(null == (i2 = t2.instance.persistence) || !i2.get_property(ft)), r2 = t2.instance.config.capture_dead_clicks;
  return A(r2) ? r2 : e2;
};
var se = class {
  get lazyLoadedDeadClicksAutocapture() {
    return this.G;
  }
  constructor(t2, i2, e2) {
    this.instance = t2, this.isEnabled = i2, this.onCapture = e2, this.startIfEnabled();
  }
  onRemoteConfig(t2) {
    this.instance.persistence && this.instance.persistence.register({ [ft]: null == t2 ? void 0 : t2.captureDeadClicks }), this.startIfEnabled();
  }
  startIfEnabled() {
    this.isEnabled(this) && this.J((() => {
      this.V();
    }));
  }
  J(t2) {
    var i2, e2;
    null != (i2 = v.__PosthogExtensions__) && i2.initDeadClicksAutocapture && t2(), null == (e2 = v.__PosthogExtensions__) || null == e2.loadExternalDependency || e2.loadExternalDependency(this.instance, "dead-clicks-autocapture", ((i3) => {
      i3 ? ie.error("failed to load script", i3) : t2();
    }));
  }
  V() {
    var t2;
    if (o) {
      if (!this.G && null != (t2 = v.__PosthogExtensions__) && t2.initDeadClicksAutocapture) {
        var i2 = I(this.instance.config.capture_dead_clicks) ? this.instance.config.capture_dead_clicks : {};
        i2.__onCapture = this.onCapture, this.G = v.__PosthogExtensions__.initDeadClicksAutocapture(this.instance, i2), this.G.start(o), ie.info("starting...");
      }
    } else ie.error("`document` not found. Cannot start.");
  }
  stop() {
    this.G && (this.G.stop(), this.G = void 0, ie.info("stopping..."));
  }
};
function ne(t2, i2, e2, r2, s2) {
  return i2 > e2 && (N.warn("min cannot be greater than max."), i2 = e2), O(t2) ? t2 > e2 ? (r2 && N.warn(r2 + " cannot be  greater than max: " + e2 + ". Using max value instead."), e2) : t2 < i2 ? (r2 && N.warn(r2 + " cannot be less than min: " + i2 + ". Using min value instead."), i2) : t2 : (r2 && N.warn(r2 + " must be a number. using max or fallback. max: " + e2 + ", fallback: " + s2), ne(s2 || e2, i2, e2, r2));
}
var oe = class {
  constructor(t2) {
    this.K = {}, this.Y = () => {
      Object.keys(this.K).forEach(((t3) => {
        var i2 = this.X(t3) + this.Z;
        i2 >= this.tt ? delete this.K[t3] : this.it(t3, i2);
      }));
    }, this.X = (t3) => this.K[String(t3)], this.it = (t3, i2) => {
      this.K[String(t3)] = i2;
    }, this.consumeRateLimit = (t3) => {
      var i2, e2 = null !== (i2 = this.X(t3)) && void 0 !== i2 ? i2 : this.tt;
      if (0 === (e2 = Math.max(e2 - 1, 0))) return true;
      this.it(t3, e2);
      var r2, s2 = 0 === e2;
      s2 && (null == (r2 = this.et) || r2.call(this, t3));
      return s2;
    }, this.rt = t2, this.et = this.rt.et, this.tt = ne(this.rt.bucketSize, 0, 100, "rate limiter bucket size"), this.Z = ne(this.rt.refillRate, 0, this.tt, "rate limiter refill rate"), this.st = ne(this.rt.refillInterval, 0, 864e5, "rate limiter refill interval"), setInterval((() => {
      this.Y();
    }), this.st);
  }
};
var ae = z("[ExceptionAutocapture]");
var le = class {
  constructor(i2) {
    var e2, r2, s2;
    this.nt = () => {
      var i3;
      if (t && this.isEnabled && null != (i3 = v.__PosthogExtensions__) && i3.errorWrappingFunctions) {
        var e3 = v.__PosthogExtensions__.errorWrappingFunctions.wrapOnError, r3 = v.__PosthogExtensions__.errorWrappingFunctions.wrapUnhandledRejection, s3 = v.__PosthogExtensions__.errorWrappingFunctions.wrapConsoleError;
        try {
          !this.ot && this.S.capture_unhandled_errors && (this.ot = e3(this.captureException.bind(this))), !this.lt && this.S.capture_unhandled_rejections && (this.lt = r3(this.captureException.bind(this))), !this.ut && this.S.capture_console_errors && (this.ut = s3(this.captureException.bind(this)));
        } catch (t2) {
          ae.error("failed to start", t2), this.ht();
        }
      }
    }, this._instance = i2, this.dt = !(null == (e2 = this._instance.persistence) || !e2.props[ht]), this.S = this.vt(), this.ct = new oe({ refillRate: null !== (r2 = this._instance.config.error_tracking.__exceptionRateLimiterRefillRate) && void 0 !== r2 ? r2 : 1, bucketSize: null !== (s2 = this._instance.config.error_tracking.__exceptionRateLimiterBucketSize) && void 0 !== s2 ? s2 : 10, refillInterval: 1e4 }), this.startIfEnabled();
  }
  vt() {
    var t2 = this._instance.config.capture_exceptions, i2 = { capture_unhandled_errors: false, capture_unhandled_rejections: false, capture_console_errors: false };
    return I(t2) ? i2 = B({}, i2, t2) : (R(t2) ? this.dt : t2) && (i2 = B({}, i2, { capture_unhandled_errors: true, capture_unhandled_rejections: true })), i2;
  }
  get isEnabled() {
    return this.S.capture_console_errors || this.S.capture_unhandled_errors || this.S.capture_unhandled_rejections;
  }
  startIfEnabled() {
    this.isEnabled && (ae.info("enabled"), this.J(this.nt));
  }
  J(t2) {
    var i2, e2;
    null != (i2 = v.__PosthogExtensions__) && i2.errorWrappingFunctions && t2(), null == (e2 = v.__PosthogExtensions__) || null == e2.loadExternalDependency || e2.loadExternalDependency(this._instance, "exception-autocapture", ((i3) => {
      if (i3) return ae.error("failed to load script", i3);
      t2();
    }));
  }
  ht() {
    var t2, i2, e2;
    null == (t2 = this.ot) || t2.call(this), this.ot = void 0, null == (i2 = this.lt) || i2.call(this), this.lt = void 0, null == (e2 = this.ut) || e2.call(this), this.ut = void 0;
  }
  onRemoteConfig(t2) {
    var i2 = t2.autocaptureExceptions;
    this.dt = !!i2 || false, this.S = this.vt(), this._instance.persistence && this._instance.persistence.register({ [ht]: this.dt }), this.startIfEnabled();
  }
  captureException(t2) {
    var i2, e2 = this._instance.requestRouter.endpointFor("ui");
    t2.$exception_personURL = e2 + "/project/" + this._instance.config.token + "/person/" + this._instance.get_distinct_id();
    var r2 = null !== (i2 = t2.$exception_list[0].type) && void 0 !== i2 ? i2 : "Exception";
    this.ct.consumeRateLimit(r2) ? ae.info("Skipping exception capture because of client rate limiting.", { exception: t2.$exception_list[0].type }) : this._instance.exceptions.sendExceptionEvent(t2);
  }
};
function ue(t2) {
  return !R(Event) && he(t2, Event);
}
function he(t2, i2) {
  try {
    return t2 instanceof i2;
  } catch (t3) {
    return false;
  }
}
function de(t2) {
  switch (Object.prototype.toString.call(t2)) {
    case "[object Error]":
    case "[object Exception]":
    case "[object DOMException]":
    case "[object DOMError]":
      return true;
    default:
      return he(t2, Error);
  }
}
function ve(t2, i2) {
  return Object.prototype.toString.call(t2) === "[object " + i2 + "]";
}
function ce(t2) {
  return ve(t2, "DOMError");
}
var fe = /\(error: (.*)\)/;
var pe = 50;
var _e = "?";
function ge(t2, i2, e2, r2) {
  var s2 = { platform: "web:javascript", filename: t2, function: "<anonymous>" === i2 ? _e : i2, in_app: true };
  return R(e2) || (s2.lineno = e2), R(r2) || (s2.colno = r2), s2;
}
var me = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
var be = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
var ye = /\((\S*)(?::(\d+))(?::(\d+))\)/;
var we = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
var Se = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
var $e = (function() {
  for (var t2 = arguments.length, i2 = new Array(t2), e2 = 0; e2 < t2; e2++) i2[e2] = arguments[e2];
  var r2 = i2.sort(((t3, i3) => t3[0] - i3[0])).map(((t3) => t3[1]));
  return function(t3, i3) {
    void 0 === i3 && (i3 = 0);
    for (var e3 = [], s2 = t3.split("\n"), n2 = i3; n2 < s2.length; n2++) {
      var o2 = s2[n2];
      if (!(o2.length > 1024)) {
        var a2 = fe.test(o2) ? o2.replace(fe, "$1") : o2;
        if (!a2.match(/\S*Error: /)) {
          for (var l2 of r2) {
            var u2 = l2(a2);
            if (u2) {
              e3.push(u2);
              break;
            }
          }
          if (e3.length >= pe) break;
        }
      }
    }
    return (function(t4) {
      if (!t4.length) return [];
      var i4 = Array.from(t4);
      return i4.reverse(), i4.slice(0, pe).map(((t5) => B({}, t5, { filename: t5.filename || xe(i4).filename, function: t5.function || _e })));
    })(e3);
  };
})(...[[30, (t2) => {
  var i2 = me.exec(t2);
  if (i2) {
    var [, e2, r2, s2] = i2;
    return ge(e2, _e, +r2, +s2);
  }
  var n2 = be.exec(t2);
  if (n2) {
    if (n2[2] && 0 === n2[2].indexOf("eval")) {
      var o2 = ye.exec(n2[2]);
      o2 && (n2[2] = o2[1], n2[3] = o2[2], n2[4] = o2[3]);
    }
    var [a2, l2] = Pe(n2[1] || _e, n2[2]);
    return ge(l2, a2, n2[3] ? +n2[3] : void 0, n2[4] ? +n2[4] : void 0);
  }
}], [50, (t2) => {
  var i2 = we.exec(t2);
  if (i2) {
    if (i2[3] && i2[3].indexOf(" > eval") > -1) {
      var e2 = Se.exec(i2[3]);
      e2 && (i2[1] = i2[1] || "eval", i2[3] = e2[1], i2[4] = e2[2], i2[5] = "");
    }
    var r2 = i2[3], s2 = i2[1] || _e;
    return [s2, r2] = Pe(s2, r2), ge(r2, s2, i2[4] ? +i2[4] : void 0, i2[5] ? +i2[5] : void 0);
  }
}]]);
function xe(t2) {
  return t2[t2.length - 1] || {};
}
var ke;
var Ee;
var Ie;
var Pe = (t2, i2) => {
  var e2 = -1 !== t2.indexOf("safari-extension"), r2 = -1 !== t2.indexOf("safari-web-extension");
  return e2 || r2 ? [-1 !== t2.indexOf("@") ? t2.split("@")[0] : _e, e2 ? "safari-extension:" + i2 : "safari-web-extension:" + i2] : [t2, i2];
};
var Re = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
function Te(t2, i2) {
  void 0 === i2 && (i2 = 0);
  var e2 = t2.stacktrace || t2.stack || "", r2 = (function(t3) {
    if (t3 && Ce.test(t3.message)) return 1;
    return 0;
  })(t2);
  try {
    var s2 = $e, n2 = (function(t3, i3) {
      var e3 = (function(t4) {
        var i4 = globalThis._posthogChunkIds;
        if (!i4) return {};
        var e4 = Object.keys(i4);
        return Ie && e4.length === Ee || (Ee = e4.length, Ie = e4.reduce(((e5, r3) => {
          ke || (ke = {});
          var s3 = ke[r3];
          if (s3) e5[s3[0]] = s3[1];
          else for (var n3 = t4(r3), o2 = n3.length - 1; o2 >= 0; o2--) {
            var a2 = n3[o2], l2 = null == a2 ? void 0 : a2.filename, u2 = i4[r3];
            if (l2 && u2) {
              e5[l2] = u2, ke[r3] = [l2, u2];
              break;
            }
          }
          return e5;
        }), {})), Ie;
      })(i3);
      return t3.forEach(((t4) => {
        t4.filename && (t4.chunk_id = e3[t4.filename]);
      })), t3;
    })(s2(e2, r2), s2);
    return n2.slice(0, n2.length - i2);
  } catch (t3) {
  }
  return [];
}
var Ce = /Minified React error #\d+;/i;
function Me(t2, i2) {
  var e2, r2, s2 = Te(t2), n2 = null === (e2 = null == i2 ? void 0 : i2.handled) || void 0 === e2 || e2, o2 = null !== (r2 = null == i2 ? void 0 : i2.synthetic) && void 0 !== r2 && r2;
  return { type: null != i2 && i2.overrideExceptionType ? i2.overrideExceptionType : t2.name, value: (function(t3) {
    var i3 = t3.message;
    if (i3.error && "string" == typeof i3.error.message) return String(i3.error.message);
    return String(i3);
  })(t2), stacktrace: { frames: s2, type: "raw" }, mechanism: { handled: n2, synthetic: o2 } };
}
function Fe(t2, i2) {
  var e2 = Me(t2, i2);
  return t2.cause && de(t2.cause) && t2.cause !== t2 ? [e2, ...Fe(t2.cause, { handled: null == i2 ? void 0 : i2.handled, synthetic: null == i2 ? void 0 : i2.synthetic })] : [e2];
}
function Oe(t2, i2) {
  return { $exception_list: Fe(t2, i2), $exception_level: "error" };
}
function Ae(t2, i2) {
  var e2, r2, s2, n2 = null === (e2 = null == i2 ? void 0 : i2.handled) || void 0 === e2 || e2, o2 = null === (r2 = null == i2 ? void 0 : i2.synthetic) || void 0 === r2 || r2, a2 = { type: null != i2 && i2.overrideExceptionType ? i2.overrideExceptionType : null !== (s2 = null == i2 ? void 0 : i2.defaultExceptionType) && void 0 !== s2 ? s2 : "Error", value: t2 || (null == i2 ? void 0 : i2.defaultExceptionMessage), mechanism: { handled: n2, synthetic: o2 } };
  if (null != i2 && i2.syntheticException) {
    var l2 = Te(i2.syntheticException, 1);
    l2.length && (a2.stacktrace = { frames: l2, type: "raw" });
  }
  return { $exception_list: [a2], $exception_level: "error" };
}
function De(t2) {
  return T(t2) && !C(t2) && g.indexOf(t2) >= 0;
}
function je(t2, i2) {
  var e2, r2, s2 = null === (e2 = null == i2 ? void 0 : i2.handled) || void 0 === e2 || e2, n2 = null === (r2 = null == i2 ? void 0 : i2.synthetic) || void 0 === r2 || r2, o2 = null != i2 && i2.overrideExceptionType ? i2.overrideExceptionType : ue(t2) ? t2.constructor.name : "Error", a2 = "Non-Error 'exception' captured with keys: " + (function(t3, i3) {
    void 0 === i3 && (i3 = 40);
    var e3 = Object.keys(t3);
    if (e3.sort(), !e3.length) return "[object has no keys]";
    for (var r3 = e3.length; r3 > 0; r3--) {
      var s3 = e3.slice(0, r3).join(", ");
      if (!(s3.length > i3)) return r3 === e3.length || s3.length <= i3 ? s3 : s3.slice(0, i3) + "...";
    }
    return "";
  })(t2), l2 = { type: o2, value: a2, mechanism: { handled: s2, synthetic: n2 } };
  if (null != i2 && i2.syntheticException) {
    var u2 = Te(null == i2 ? void 0 : i2.syntheticException, 1);
    u2.length && (l2.stacktrace = { frames: u2, type: "raw" });
  }
  return { $exception_list: [l2], $exception_level: De(t2.level) ? t2.level : "error" };
}
function Le(t2, i2) {
  var { error: e2, event: r2 } = t2, s2 = { $exception_list: [] }, n2 = e2 || r2;
  if (ce(n2) || (function(t3) {
    return ve(t3, "DOMException");
  })(n2)) {
    var o2 = n2;
    if ((function(t3) {
      return "stack" in t3;
    })(n2)) s2 = Oe(n2, i2);
    else {
      var a2 = o2.name || (ce(o2) ? "DOMError" : "DOMException"), l2 = o2.message ? a2 + ": " + o2.message : a2;
      s2 = Ae(l2, B({}, i2, { overrideExceptionType: ce(o2) ? "DOMError" : "DOMException", defaultExceptionMessage: l2 }));
    }
    return "code" in o2 && (s2.$exception_DOMException_code = "" + o2.code), s2;
  }
  if ((function(t3) {
    return ve(t3, "ErrorEvent");
  })(n2) && n2.error) return Oe(n2.error, i2);
  if (de(n2)) return Oe(n2, i2);
  if ((function(t3) {
    return ve(t3, "Object");
  })(n2) || ue(n2)) return je(n2, i2);
  if (R(e2) && T(r2)) {
    var u2 = "Error", h2 = r2, d2 = r2.match(Re);
    return d2 && (u2 = d2[1], h2 = d2[2]), Ae(h2, B({}, i2, { overrideExceptionType: u2, defaultExceptionMessage: h2 }));
  }
  return Ae(n2, i2);
}
function Ne(t2, i2, e2) {
  try {
    if (!(i2 in t2)) return () => {
    };
    var r2 = t2[i2], s2 = e2(r2);
    return E(s2) && (s2.prototype = s2.prototype || {}, Object.defineProperties(s2, { __posthog_wrapped__: { enumerable: false, value: true } })), t2[i2] = s2, () => {
      t2[i2] = r2;
    };
  } catch (t3) {
    return () => {
    };
  }
}
var ze = class {
  constructor(i2) {
    var e2;
    this._instance = i2, this.ft = (null == t || null == (e2 = t.location) ? void 0 : e2.pathname) || "";
  }
  get isEnabled() {
    return "history_change" === this._instance.config.capture_pageview;
  }
  startIfEnabled() {
    this.isEnabled && (N.info("History API monitoring enabled, starting..."), this.monitorHistoryChanges());
  }
  stop() {
    this._t && this._t(), this._t = void 0, N.info("History API monitoring stopped");
  }
  monitorHistoryChanges() {
    var i2, e2;
    if (t && t.history) {
      var r2 = this;
      null != (i2 = t.history.pushState) && i2.__posthog_wrapped__ || Ne(t.history, "pushState", ((t2) => function(i3, e3, s2) {
        t2.call(this, i3, e3, s2), r2.gt("pushState");
      })), null != (e2 = t.history.replaceState) && e2.__posthog_wrapped__ || Ne(t.history, "replaceState", ((t2) => function(i3, e3, s2) {
        t2.call(this, i3, e3, s2), r2.gt("replaceState");
      })), this.bt();
    }
  }
  gt(i2) {
    try {
      var e2, r2 = null == t || null == (e2 = t.location) ? void 0 : e2.pathname;
      if (!r2) return;
      r2 !== this.ft && this.isEnabled && this._instance.capture("$pageview", { navigation_type: i2 }), this.ft = r2;
    } catch (t2) {
      N.error("Error capturing " + i2 + " pageview", t2);
    }
  }
  bt() {
    if (!this._t) {
      var i2 = () => {
        this.gt("popstate");
      };
      st(t, "popstate", i2), this._t = () => {
        t && t.removeEventListener("popstate", i2);
      };
    }
  }
};
function Ue(t2) {
  var i2, e2;
  return (null == (i2 = JSON.stringify(t2, (e2 = [], function(t3, i3) {
    if (I(i3)) {
      for (; e2.length > 0 && e2[e2.length - 1] !== this; ) e2.pop();
      return e2.includes(i3) ? "[Circular]" : (e2.push(i3), i3);
    }
    return i3;
  }))) ? void 0 : i2.length) || 0;
}
function qe(t2, i2) {
  if (void 0 === i2 && (i2 = 66060288e-1), t2.size >= i2 && t2.data.length > 1) {
    var e2 = Math.floor(t2.data.length / 2), r2 = t2.data.slice(0, e2), s2 = t2.data.slice(e2);
    return [qe({ size: Ue(r2), data: r2, sessionId: t2.sessionId, windowId: t2.windowId }), qe({ size: Ue(s2), data: s2, sessionId: t2.sessionId, windowId: t2.windowId })].flatMap(((t3) => t3));
  }
  return [t2];
}
var Be = ((t2) => (t2[t2.DomContentLoaded = 0] = "DomContentLoaded", t2[t2.Load = 1] = "Load", t2[t2.FullSnapshot = 2] = "FullSnapshot", t2[t2.IncrementalSnapshot = 3] = "IncrementalSnapshot", t2[t2.Meta = 4] = "Meta", t2[t2.Custom = 5] = "Custom", t2[t2.Plugin = 6] = "Plugin", t2))(Be || {});
var He = ((t2) => (t2[t2.Mutation = 0] = "Mutation", t2[t2.MouseMove = 1] = "MouseMove", t2[t2.MouseInteraction = 2] = "MouseInteraction", t2[t2.Scroll = 3] = "Scroll", t2[t2.ViewportResize = 4] = "ViewportResize", t2[t2.Input = 5] = "Input", t2[t2.TouchMove = 6] = "TouchMove", t2[t2.MediaInteraction = 7] = "MediaInteraction", t2[t2.StyleSheetRule = 8] = "StyleSheetRule", t2[t2.CanvasMutation = 9] = "CanvasMutation", t2[t2.Font = 10] = "Font", t2[t2.Log = 11] = "Log", t2[t2.Drag = 12] = "Drag", t2[t2.StyleDeclaration = 13] = "StyleDeclaration", t2[t2.Selection = 14] = "Selection", t2[t2.AdoptedStyleSheet = 15] = "AdoptedStyleSheet", t2[t2.CustomElement = 16] = "CustomElement", t2))(He || {});
var We = "[SessionRecording]";
var Ge = "redacted";
var Je = { initiatorTypes: ["audio", "beacon", "body", "css", "early-hint", "embed", "fetch", "frame", "iframe", "icon", "image", "img", "input", "link", "navigation", "object", "ping", "script", "track", "video", "xmlhttprequest"], maskRequestFn: (t2) => t2, recordHeaders: false, recordBody: false, recordInitialRequests: false, recordPerformance: false, performanceEntryTypeToObserve: ["first-input", "navigation", "paint", "resource"], payloadSizeLimitBytes: 1e6, payloadHostDenyList: [".lr-ingest.io", ".ingest.sentry.io", ".clarity.ms", "analytics.google.com", "bam.nr-data.net"] };
var Ve = ["authorization", "x-forwarded-for", "authorization", "cookie", "set-cookie", "x-api-key", "x-real-ip", "remote-addr", "forwarded", "proxy-authorization", "x-csrf-token", "x-csrftoken", "x-xsrf-token"];
var Ke = ["password", "secret", "passwd", "api_key", "apikey", "auth", "credentials", "mysql_pwd", "privatekey", "private_key", "token"];
var Ye = ["/s/", "/e/", "/i/"];
function Xe(t2, i2, e2, r2) {
  if (F(t2)) return t2;
  var s2 = (null == i2 ? void 0 : i2["content-length"]) || (function(t3) {
    return new Blob([t3]).size;
  })(t2);
  return T(s2) && (s2 = parseInt(s2)), s2 > e2 ? We + " " + r2 + " body too large to record (" + s2 + " bytes)" : t2;
}
function Qe(t2, i2) {
  if (F(t2)) return t2;
  var e2 = t2;
  return fi(e2, false) || (e2 = We + " " + i2 + " body " + Ge), J(Ke, ((t3) => {
    var r2, s2;
    null != (r2 = e2) && r2.length && -1 !== (null == (s2 = e2) ? void 0 : s2.indexOf(t3)) && (e2 = We + " " + i2 + " body " + Ge + " as might contain: " + t3);
  })), e2;
}
var Ze = (t2, i2) => {
  var e2, r2, s2, n2 = { payloadSizeLimitBytes: Je.payloadSizeLimitBytes, performanceEntryTypeToObserve: [...Je.performanceEntryTypeToObserve], payloadHostDenyList: [...i2.payloadHostDenyList || [], ...Je.payloadHostDenyList] }, o2 = false !== t2.session_recording.recordHeaders && i2.recordHeaders, a2 = false !== t2.session_recording.recordBody && i2.recordBody, l2 = false !== t2.capture_performance && i2.recordPerformance, u2 = (e2 = n2, s2 = Math.min(1e6, null !== (r2 = e2.payloadSizeLimitBytes) && void 0 !== r2 ? r2 : 1e6), (t3) => (null != t3 && t3.requestBody && (t3.requestBody = Xe(t3.requestBody, t3.requestHeaders, s2, "Request")), null != t3 && t3.responseBody && (t3.responseBody = Xe(t3.responseBody, t3.responseHeaders, s2, "Response")), t3)), h2 = (i3) => {
    return u2(((t3, i4) => {
      var e4, r4 = Si(t3.name), s3 = 0 === i4.indexOf("http") ? null == (e4 = Si(i4)) ? void 0 : e4.pathname : i4;
      "/" === s3 && (s3 = "");
      var n3 = null == r4 ? void 0 : r4.pathname.replace(s3 || "", "");
      if (!(r4 && n3 && Ye.some(((t4) => 0 === n3.indexOf(t4))))) return t3;
    })((r3 = (e3 = i3).requestHeaders, F(r3) || J(Object.keys(null != r3 ? r3 : {}), ((t3) => {
      Ve.includes(t3.toLowerCase()) && (r3[t3] = Ge);
    })), e3), t2.api_host));
    var e3, r3;
  }, d2 = E(t2.session_recording.maskNetworkRequestFn);
  return d2 && E(t2.session_recording.maskCapturedNetworkRequestFn) && N.warn("Both `maskNetworkRequestFn` and `maskCapturedNetworkRequestFn` are defined. `maskNetworkRequestFn` will be ignored."), d2 && (t2.session_recording.maskCapturedNetworkRequestFn = (i3) => {
    var e3 = t2.session_recording.maskNetworkRequestFn({ url: i3.name });
    return B({}, i3, { name: null == e3 ? void 0 : e3.url });
  }), n2.maskRequestFn = E(t2.session_recording.maskCapturedNetworkRequestFn) ? (i3) => {
    var e3, r3 = h2(i3);
    return r3 && null !== (e3 = null == t2.session_recording.maskCapturedNetworkRequestFn ? void 0 : t2.session_recording.maskCapturedNetworkRequestFn(r3)) && void 0 !== e3 ? e3 : void 0;
  } : (t3) => (function(t4) {
    if (!R(t4)) return t4.requestBody = Qe(t4.requestBody, "Request"), t4.responseBody = Qe(t4.responseBody, "Response"), t4;
  })(h2(t3)), B({}, Je, n2, { recordHeaders: o2, recordBody: a2, recordPerformance: l2, recordInitialRequests: l2 });
};
var tr = class {
  constructor(t2, i2) {
    var e2, r2;
    void 0 === i2 && (i2 = {}), this.yt = {}, this.wt = (t3) => {
      if (!this.yt[t3]) {
        var i3, e3;
        this.yt[t3] = true;
        var r3 = this.St(t3);
        null == (i3 = (e3 = this.rt).onBlockedNode) || i3.call(e3, t3, r3);
      }
    }, this.$t = (t3) => {
      var i3 = this.St(t3);
      if ("svg" !== (null == i3 ? void 0 : i3.nodeName) && i3 instanceof Element) {
        var e3 = i3.closest("svg");
        if (e3) return [this._rrweb.mirror.getId(e3), e3];
      }
      return [t3, i3];
    }, this.St = (t3) => this._rrweb.mirror.getNode(t3), this.xt = (t3) => {
      var i3, e3, r3, s2, n2, o2, a2, l2;
      return (null !== (i3 = null == (e3 = t3.removes) ? void 0 : e3.length) && void 0 !== i3 ? i3 : 0) + (null !== (r3 = null == (s2 = t3.attributes) ? void 0 : s2.length) && void 0 !== r3 ? r3 : 0) + (null !== (n2 = null == (o2 = t3.texts) ? void 0 : o2.length) && void 0 !== n2 ? n2 : 0) + (null !== (a2 = null == (l2 = t3.adds) ? void 0 : l2.length) && void 0 !== a2 ? a2 : 0);
    }, this.throttleMutations = (t3) => {
      if (3 !== t3.type || 0 !== t3.data.source) return t3;
      var i3 = t3.data, e3 = this.xt(i3);
      i3.attributes && (i3.attributes = i3.attributes.filter(((t4) => {
        var [i4] = this.$t(t4.id);
        return !this.ct.consumeRateLimit(i4) && t4;
      })));
      var r3 = this.xt(i3);
      return 0 !== r3 || e3 === r3 ? t3 : void 0;
    }, this._rrweb = t2, this.rt = i2, this.ct = new oe({ bucketSize: null !== (e2 = this.rt.bucketSize) && void 0 !== e2 ? e2 : 100, refillRate: null !== (r2 = this.rt.refillRate) && void 0 !== r2 ? r2 : 10, refillInterval: 1e3, et: this.wt });
  }
};
var ir = Uint8Array;
var er = Uint16Array;
var rr = Uint32Array;
var sr = new ir([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
var nr = new ir([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
var or = new ir([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var ar = function(t2, i2) {
  for (var e2 = new er(31), r2 = 0; r2 < 31; ++r2) e2[r2] = i2 += 1 << t2[r2 - 1];
  var s2 = new rr(e2[30]);
  for (r2 = 1; r2 < 30; ++r2) for (var n2 = e2[r2]; n2 < e2[r2 + 1]; ++n2) s2[n2] = n2 - e2[r2] << 5 | r2;
  return [e2, s2];
};
var lr = ar(sr, 2);
var ur = lr[0];
var hr = lr[1];
ur[28] = 258, hr[258] = 28;
for (dr = ar(nr, 0)[1], vr = new er(32768), cr = 0; cr < 32768; ++cr) {
  fr = (43690 & cr) >>> 1 | (21845 & cr) << 1;
  fr = (61680 & (fr = (52428 & fr) >>> 2 | (13107 & fr) << 2)) >>> 4 | (3855 & fr) << 4, vr[cr] = ((65280 & fr) >>> 8 | (255 & fr) << 8) >>> 1;
}
var fr;
var dr;
var vr;
var cr;
var pr = function(t2, i2, e2) {
  for (var r2 = t2.length, s2 = 0, n2 = new er(i2); s2 < r2; ++s2) ++n2[t2[s2] - 1];
  var o2, a2 = new er(i2);
  for (s2 = 0; s2 < i2; ++s2) a2[s2] = a2[s2 - 1] + n2[s2 - 1] << 1;
  if (e2) {
    o2 = new er(1 << i2);
    var l2 = 15 - i2;
    for (s2 = 0; s2 < r2; ++s2) if (t2[s2]) for (var u2 = s2 << 4 | t2[s2], h2 = i2 - t2[s2], d2 = a2[t2[s2] - 1]++ << h2, v2 = d2 | (1 << h2) - 1; d2 <= v2; ++d2) o2[vr[d2] >>> l2] = u2;
  } else for (o2 = new er(r2), s2 = 0; s2 < r2; ++s2) o2[s2] = vr[a2[t2[s2] - 1]++] >>> 15 - t2[s2];
  return o2;
};
var _r = new ir(288);
for (cr = 0; cr < 144; ++cr) _r[cr] = 8;
for (cr = 144; cr < 256; ++cr) _r[cr] = 9;
for (cr = 256; cr < 280; ++cr) _r[cr] = 7;
for (cr = 280; cr < 288; ++cr) _r[cr] = 8;
var gr = new ir(32);
for (cr = 0; cr < 32; ++cr) gr[cr] = 5;
var mr = pr(_r, 9, 0);
var br = pr(gr, 5, 0);
var yr = function(t2) {
  return (t2 / 8 >> 0) + (7 & t2 && 1);
};
var wr = function(t2, i2, e2) {
  (null == e2 || e2 > t2.length) && (e2 = t2.length);
  var r2 = new (t2 instanceof er ? er : t2 instanceof rr ? rr : ir)(e2 - i2);
  return r2.set(t2.subarray(i2, e2)), r2;
};
var Sr = function(t2, i2, e2) {
  e2 <<= 7 & i2;
  var r2 = i2 / 8 >> 0;
  t2[r2] |= e2, t2[r2 + 1] |= e2 >>> 8;
};
var $r = function(t2, i2, e2) {
  e2 <<= 7 & i2;
  var r2 = i2 / 8 >> 0;
  t2[r2] |= e2, t2[r2 + 1] |= e2 >>> 8, t2[r2 + 2] |= e2 >>> 16;
};
var xr = function(t2, i2) {
  for (var e2 = [], r2 = 0; r2 < t2.length; ++r2) t2[r2] && e2.push({ s: r2, f: t2[r2] });
  var s2 = e2.length, n2 = e2.slice();
  if (!s2) return [new ir(0), 0];
  if (1 == s2) {
    var o2 = new ir(e2[0].s + 1);
    return o2[e2[0].s] = 1, [o2, 1];
  }
  e2.sort((function(t3, i3) {
    return t3.f - i3.f;
  })), e2.push({ s: -1, f: 25001 });
  var a2 = e2[0], l2 = e2[1], u2 = 0, h2 = 1, d2 = 2;
  for (e2[0] = { s: -1, f: a2.f + l2.f, l: a2, r: l2 }; h2 != s2 - 1; ) a2 = e2[e2[u2].f < e2[d2].f ? u2++ : d2++], l2 = e2[u2 != h2 && e2[u2].f < e2[d2].f ? u2++ : d2++], e2[h2++] = { s: -1, f: a2.f + l2.f, l: a2, r: l2 };
  var v2 = n2[0].s;
  for (r2 = 1; r2 < s2; ++r2) n2[r2].s > v2 && (v2 = n2[r2].s);
  var c2 = new er(v2 + 1), f2 = kr(e2[h2 - 1], c2, 0);
  if (f2 > i2) {
    r2 = 0;
    var p2 = 0, _2 = f2 - i2, g2 = 1 << _2;
    for (n2.sort((function(t3, i3) {
      return c2[i3.s] - c2[t3.s] || t3.f - i3.f;
    })); r2 < s2; ++r2) {
      var m2 = n2[r2].s;
      if (!(c2[m2] > i2)) break;
      p2 += g2 - (1 << f2 - c2[m2]), c2[m2] = i2;
    }
    for (p2 >>>= _2; p2 > 0; ) {
      var b2 = n2[r2].s;
      c2[b2] < i2 ? p2 -= 1 << i2 - c2[b2]++ - 1 : ++r2;
    }
    for (; r2 >= 0 && p2; --r2) {
      var y2 = n2[r2].s;
      c2[y2] == i2 && (--c2[y2], ++p2);
    }
    f2 = i2;
  }
  return [new ir(c2), f2];
};
var kr = function(t2, i2, e2) {
  return -1 == t2.s ? Math.max(kr(t2.l, i2, e2 + 1), kr(t2.r, i2, e2 + 1)) : i2[t2.s] = e2;
};
var Er = function(t2) {
  for (var i2 = t2.length; i2 && !t2[--i2]; ) ;
  for (var e2 = new er(++i2), r2 = 0, s2 = t2[0], n2 = 1, o2 = function(t3) {
    e2[r2++] = t3;
  }, a2 = 1; a2 <= i2; ++a2) if (t2[a2] == s2 && a2 != i2) ++n2;
  else {
    if (!s2 && n2 > 2) {
      for (; n2 > 138; n2 -= 138) o2(32754);
      n2 > 2 && (o2(n2 > 10 ? n2 - 11 << 5 | 28690 : n2 - 3 << 5 | 12305), n2 = 0);
    } else if (n2 > 3) {
      for (o2(s2), --n2; n2 > 6; n2 -= 6) o2(8304);
      n2 > 2 && (o2(n2 - 3 << 5 | 8208), n2 = 0);
    }
    for (; n2--; ) o2(s2);
    n2 = 1, s2 = t2[a2];
  }
  return [e2.subarray(0, r2), i2];
};
var Ir = function(t2, i2) {
  for (var e2 = 0, r2 = 0; r2 < i2.length; ++r2) e2 += t2[r2] * i2[r2];
  return e2;
};
var Pr = function(t2, i2, e2) {
  var r2 = e2.length, s2 = yr(i2 + 2);
  t2[s2] = 255 & r2, t2[s2 + 1] = r2 >>> 8, t2[s2 + 2] = 255 ^ t2[s2], t2[s2 + 3] = 255 ^ t2[s2 + 1];
  for (var n2 = 0; n2 < r2; ++n2) t2[s2 + n2 + 4] = e2[n2];
  return 8 * (s2 + 4 + r2);
};
var Rr = function(t2, i2, e2, r2, s2, n2, o2, a2, l2, u2, h2) {
  Sr(i2, h2++, e2), ++s2[256];
  for (var d2 = xr(s2, 15), v2 = d2[0], c2 = d2[1], f2 = xr(n2, 15), p2 = f2[0], _2 = f2[1], g2 = Er(v2), m2 = g2[0], b2 = g2[1], y2 = Er(p2), w2 = y2[0], S2 = y2[1], $2 = new er(19), x2 = 0; x2 < m2.length; ++x2) $2[31 & m2[x2]]++;
  for (x2 = 0; x2 < w2.length; ++x2) $2[31 & w2[x2]]++;
  for (var k2 = xr($2, 7), E2 = k2[0], I2 = k2[1], P2 = 19; P2 > 4 && !E2[or[P2 - 1]]; --P2) ;
  var R2, T2, C2, M2, F2 = u2 + 5 << 3, O2 = Ir(s2, _r) + Ir(n2, gr) + o2, A2 = Ir(s2, v2) + Ir(n2, p2) + o2 + 14 + 3 * P2 + Ir($2, E2) + (2 * $2[16] + 3 * $2[17] + 7 * $2[18]);
  if (F2 <= O2 && F2 <= A2) return Pr(i2, h2, t2.subarray(l2, l2 + u2));
  if (Sr(i2, h2, 1 + (A2 < O2)), h2 += 2, A2 < O2) {
    R2 = pr(v2, c2, 0), T2 = v2, C2 = pr(p2, _2, 0), M2 = p2;
    var D2 = pr(E2, I2, 0);
    Sr(i2, h2, b2 - 257), Sr(i2, h2 + 5, S2 - 1), Sr(i2, h2 + 10, P2 - 4), h2 += 14;
    for (x2 = 0; x2 < P2; ++x2) Sr(i2, h2 + 3 * x2, E2[or[x2]]);
    h2 += 3 * P2;
    for (var j2 = [m2, w2], L2 = 0; L2 < 2; ++L2) {
      var N2 = j2[L2];
      for (x2 = 0; x2 < N2.length; ++x2) {
        var z2 = 31 & N2[x2];
        Sr(i2, h2, D2[z2]), h2 += E2[z2], z2 > 15 && (Sr(i2, h2, N2[x2] >>> 5 & 127), h2 += N2[x2] >>> 12);
      }
    }
  } else R2 = mr, T2 = _r, C2 = br, M2 = gr;
  for (x2 = 0; x2 < a2; ++x2) if (r2[x2] > 255) {
    z2 = r2[x2] >>> 18 & 31;
    $r(i2, h2, R2[z2 + 257]), h2 += T2[z2 + 257], z2 > 7 && (Sr(i2, h2, r2[x2] >>> 23 & 31), h2 += sr[z2]);
    var U2 = 31 & r2[x2];
    $r(i2, h2, C2[U2]), h2 += M2[U2], U2 > 3 && ($r(i2, h2, r2[x2] >>> 5 & 8191), h2 += nr[U2]);
  } else $r(i2, h2, R2[r2[x2]]), h2 += T2[r2[x2]];
  return $r(i2, h2, R2[256]), h2 + T2[256];
};
var Tr = new rr([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var Cr = (function() {
  for (var t2 = new rr(256), i2 = 0; i2 < 256; ++i2) {
    for (var e2 = i2, r2 = 9; --r2; ) e2 = (1 & e2 && 3988292384) ^ e2 >>> 1;
    t2[i2] = e2;
  }
  return t2;
})();
var Mr = function() {
  var t2 = 4294967295;
  return { p: function(i2) {
    for (var e2 = t2, r2 = 0; r2 < i2.length; ++r2) e2 = Cr[255 & e2 ^ i2[r2]] ^ e2 >>> 8;
    t2 = e2;
  }, d: function() {
    return 4294967295 ^ t2;
  } };
};
var Fr = function(t2, i2, e2, r2, s2) {
  return (function(t3, i3, e3, r3, s3, n2) {
    var o2 = t3.length, a2 = new ir(r3 + o2 + 5 * (1 + Math.floor(o2 / 7e3)) + s3), l2 = a2.subarray(r3, a2.length - s3), u2 = 0;
    if (!i3 || o2 < 8) for (var h2 = 0; h2 <= o2; h2 += 65535) {
      var d2 = h2 + 65535;
      d2 < o2 ? u2 = Pr(l2, u2, t3.subarray(h2, d2)) : (l2[h2] = n2, u2 = Pr(l2, u2, t3.subarray(h2, o2)));
    }
    else {
      for (var v2 = Tr[i3 - 1], c2 = v2 >>> 13, f2 = 8191 & v2, p2 = (1 << e3) - 1, _2 = new er(32768), g2 = new er(p2 + 1), m2 = Math.ceil(e3 / 3), b2 = 2 * m2, y2 = function(i4) {
        return (t3[i4] ^ t3[i4 + 1] << m2 ^ t3[i4 + 2] << b2) & p2;
      }, w2 = new rr(25e3), S2 = new er(288), $2 = new er(32), x2 = 0, k2 = 0, E2 = (h2 = 0, 0), I2 = 0, P2 = 0; h2 < o2; ++h2) {
        var R2 = y2(h2), T2 = 32767 & h2, C2 = g2[R2];
        if (_2[T2] = C2, g2[R2] = T2, I2 <= h2) {
          var M2 = o2 - h2;
          if ((x2 > 7e3 || E2 > 24576) && M2 > 423) {
            u2 = Rr(t3, l2, 0, w2, S2, $2, k2, E2, P2, h2 - P2, u2), E2 = x2 = k2 = 0, P2 = h2;
            for (var F2 = 0; F2 < 286; ++F2) S2[F2] = 0;
            for (F2 = 0; F2 < 30; ++F2) $2[F2] = 0;
          }
          var O2 = 2, A2 = 0, D2 = f2, j2 = T2 - C2 & 32767;
          if (M2 > 2 && R2 == y2(h2 - j2)) for (var L2 = Math.min(c2, M2) - 1, N2 = Math.min(32767, h2), z2 = Math.min(258, M2); j2 <= N2 && --D2 && T2 != C2; ) {
            if (t3[h2 + O2] == t3[h2 + O2 - j2]) {
              for (var U2 = 0; U2 < z2 && t3[h2 + U2] == t3[h2 + U2 - j2]; ++U2) ;
              if (U2 > O2) {
                if (O2 = U2, A2 = j2, U2 > L2) break;
                var q2 = Math.min(j2, U2 - 2), B2 = 0;
                for (F2 = 0; F2 < q2; ++F2) {
                  var H2 = h2 - j2 + F2 + 32768 & 32767, W2 = H2 - _2[H2] + 32768 & 32767;
                  W2 > B2 && (B2 = W2, C2 = H2);
                }
              }
            }
            j2 += (T2 = C2) - (C2 = _2[T2]) + 32768 & 32767;
          }
          if (A2) {
            w2[E2++] = 268435456 | hr[O2] << 18 | dr[A2];
            var G2 = 31 & hr[O2], J2 = 31 & dr[A2];
            k2 += sr[G2] + nr[J2], ++S2[257 + G2], ++$2[J2], I2 = h2 + O2, ++x2;
          } else w2[E2++] = t3[h2], ++S2[t3[h2]];
        }
      }
      u2 = Rr(t3, l2, n2, w2, S2, $2, k2, E2, P2, h2 - P2, u2);
    }
    return wr(a2, 0, r3 + yr(u2) + s3);
  })(t2, null == i2.level ? 6 : i2.level, null == i2.mem ? Math.ceil(1.5 * Math.max(8, Math.min(13, Math.log(t2.length)))) : 12 + i2.mem, e2, r2, !s2);
};
var Or = function(t2, i2, e2) {
  for (; e2; ++i2) t2[i2] = e2, e2 >>>= 8;
};
var Ar = function(t2, i2) {
  var e2 = i2.filename;
  if (t2[0] = 31, t2[1] = 139, t2[2] = 8, t2[8] = i2.level < 2 ? 4 : 9 == i2.level ? 2 : 0, t2[9] = 3, 0 != i2.mtime && Or(t2, 4, Math.floor(new Date(i2.mtime || Date.now()) / 1e3)), e2) {
    t2[3] = 8;
    for (var r2 = 0; r2 <= e2.length; ++r2) t2[r2 + 10] = e2.charCodeAt(r2);
  }
};
var Dr = function(t2) {
  return 10 + (t2.filename && t2.filename.length + 1 || 0);
};
function jr(t2, i2) {
  void 0 === i2 && (i2 = {});
  var e2 = Mr(), r2 = t2.length;
  e2.p(t2);
  var s2 = Fr(t2, i2, Dr(i2), 8), n2 = s2.length;
  return Ar(s2, i2), Or(s2, n2 - 8, e2.d()), Or(s2, n2 - 4, r2), s2;
}
function Lr(t2, i2) {
  var e2 = t2.length;
  if ("undefined" != typeof TextEncoder) return new TextEncoder().encode(t2);
  for (var r2 = new ir(t2.length + (t2.length >>> 1)), s2 = 0, n2 = function(t3) {
    r2[s2++] = t3;
  }, o2 = 0; o2 < e2; ++o2) {
    if (s2 + 5 > r2.length) {
      var a2 = new ir(s2 + 8 + (e2 - o2 << 1));
      a2.set(r2), r2 = a2;
    }
    var l2 = t2.charCodeAt(o2);
    l2 < 128 || i2 ? n2(l2) : l2 < 2048 ? (n2(192 | l2 >>> 6), n2(128 | 63 & l2)) : l2 > 55295 && l2 < 57344 ? (n2(240 | (l2 = 65536 + (1047552 & l2) | 1023 & t2.charCodeAt(++o2)) >>> 18), n2(128 | l2 >>> 12 & 63), n2(128 | l2 >>> 6 & 63), n2(128 | 63 & l2)) : (n2(224 | l2 >>> 12), n2(128 | l2 >>> 6 & 63), n2(128 | 63 & l2));
  }
  return wr(r2, 0, s2);
}
function Nr(t2, i2) {
  return (function(t3) {
    for (var i3 = 0, e2 = 0; e2 < t3.length; e2++) i3 = (i3 << 5) - i3 + t3.charCodeAt(e2), i3 |= 0;
    return Math.abs(i3);
  })(t2) % 100 < ne(100 * i2, 0, 100);
}
var zr = "disabled";
var Ur = "sampled";
var qr = "active";
var Br = "buffering";
var Hr = "paused";
var Wr = "trigger";
var Gr = Wr + "_activated";
var Jr = Wr + "_pending";
var Vr = Wr + "_" + zr;
function Kr(t2, i2) {
  return i2.some(((i3) => "regex" === i3.matching && new RegExp(i3.url).test(t2)));
}
var Yr = class {
  constructor(t2) {
    this.kt = t2;
  }
  triggerStatus(t2) {
    var i2 = this.kt.map(((i3) => i3.triggerStatus(t2)));
    return i2.includes(Gr) ? Gr : i2.includes(Jr) ? Jr : Vr;
  }
  stop() {
    this.kt.forEach(((t2) => t2.stop()));
  }
};
var Xr = class {
  constructor(t2) {
    this.kt = t2;
  }
  triggerStatus(t2) {
    var i2 = /* @__PURE__ */ new Set();
    for (var e2 of this.kt) i2.add(e2.triggerStatus(t2));
    switch (i2.delete(Vr), i2.size) {
      case 0:
        return Vr;
      case 1:
        return Array.from(i2)[0];
      default:
        return Jr;
    }
  }
  stop() {
    this.kt.forEach(((t2) => t2.stop()));
  }
};
var Qr = class {
  triggerStatus() {
    return Jr;
  }
  stop() {
  }
};
var Zr = class {
  constructor(t2) {
    this.Et = [], this.It = [], this.urlBlocked = false, this._instance = t2;
  }
  onRemoteConfig(t2) {
    var i2, e2;
    this.Et = (null == (i2 = t2.sessionRecording) ? void 0 : i2.urlTriggers) || [], this.It = (null == (e2 = t2.sessionRecording) ? void 0 : e2.urlBlocklist) || [];
  }
  Pt(t2) {
    var i2;
    return 0 === this.Et.length ? Vr : (null == (i2 = this._instance) ? void 0 : i2.get_property(Et)) === t2 ? Gr : Jr;
  }
  triggerStatus(t2) {
    var i2 = this.Pt(t2), e2 = i2 === Gr ? Gr : i2 === Jr ? Jr : Vr;
    return this._instance.register_for_session({ $sdk_debug_replay_url_trigger_status: e2 }), e2;
  }
  checkUrlTriggerConditions(i2, e2, r2) {
    if (void 0 !== t && t.location.href) {
      var s2 = t.location.href, n2 = this.urlBlocked, o2 = Kr(s2, this.It);
      n2 && o2 || (o2 && !n2 ? i2() : !o2 && n2 && e2(), Kr(s2, this.Et) && r2("url"));
    }
  }
  stop() {
  }
};
var ts = class {
  constructor(t2) {
    this.linkedFlag = null, this.linkedFlagSeen = false, this.Rt = () => {
    }, this._instance = t2;
  }
  triggerStatus() {
    var t2 = Jr;
    return F(this.linkedFlag) && (t2 = Vr), this.linkedFlagSeen && (t2 = Gr), this._instance.register_for_session({ $sdk_debug_replay_linked_flag_trigger_status: t2 }), t2;
  }
  onRemoteConfig(t2, i2) {
    var e2;
    if (this.linkedFlag = (null == (e2 = t2.sessionRecording) ? void 0 : e2.linkedFlag) || null, !F(this.linkedFlag) && !this.linkedFlagSeen) {
      var r2 = T(this.linkedFlag) ? this.linkedFlag : this.linkedFlag.flag, s2 = T(this.linkedFlag) ? null : this.linkedFlag.variant;
      this.Rt = this._instance.onFeatureFlags(((t3, e3) => {
        var n2 = false;
        if (I(e3) && r2 in e3) {
          var o2 = e3[r2];
          n2 = A(o2) ? true === o2 : s2 ? o2 === s2 : !!o2;
        }
        this.linkedFlagSeen = n2, n2 && i2(r2, s2);
      }));
    }
  }
  stop() {
    this.Rt();
  }
};
var is = class {
  constructor(t2) {
    this.Tt = [], this._instance = t2;
  }
  onRemoteConfig(t2) {
    var i2;
    this.Tt = (null == (i2 = t2.sessionRecording) ? void 0 : i2.eventTriggers) || [];
  }
  Ct(t2) {
    var i2;
    return 0 === this.Tt.length ? Vr : (null == (i2 = this._instance) ? void 0 : i2.get_property(It)) === t2 ? Gr : Jr;
  }
  triggerStatus(t2) {
    var i2 = this.Ct(t2), e2 = i2 === Gr ? Gr : i2 === Jr ? Jr : Vr;
    return this._instance.register_for_session({ $sdk_debug_replay_event_trigger_status: e2 }), e2;
  }
  stop() {
  }
};
function es(t2) {
  return t2.isRecordingEnabled ? Br : zr;
}
function rs(t2) {
  if (!t2.receivedFlags) return Br;
  if (!t2.isRecordingEnabled) return zr;
  if (t2.urlTriggerMatching.urlBlocked) return Hr;
  var i2 = true === t2.isSampled, e2 = new Yr([t2.eventTriggerMatching, t2.urlTriggerMatching, t2.linkedFlagMatching]).triggerStatus(t2.sessionId);
  return i2 ? Ur : e2 === Gr ? qr : e2 === Jr ? Br : false === t2.isSampled ? zr : qr;
}
function ss(t2) {
  if (!t2.receivedFlags) return Br;
  if (!t2.isRecordingEnabled) return zr;
  if (t2.urlTriggerMatching.urlBlocked) return Hr;
  var i2 = new Xr([t2.eventTriggerMatching, t2.urlTriggerMatching, t2.linkedFlagMatching]).triggerStatus(t2.sessionId), e2 = i2 !== Vr, r2 = A(t2.isSampled);
  return e2 && i2 === Jr ? Br : e2 && i2 === Vr || r2 && !t2.isSampled ? zr : true === t2.isSampled ? Ur : qr;
}
var ns = "[SessionRecording]";
var os = z(ns);
function as() {
  var t2;
  return null == v || null == (t2 = v.__PosthogExtensions__) || null == (t2 = t2.rrweb) ? void 0 : t2.record;
}
var ls = 3e5;
var us = [He.MouseMove, He.MouseInteraction, He.Scroll, He.ViewportResize, He.Input, He.TouchMove, He.MediaInteraction, He.Drag];
var hs = (t2) => ({ rrwebMethod: t2, enqueuedAt: Date.now(), attempt: 1 });
function ds(t2) {
  return (function(t3, i2) {
    for (var e2 = "", r2 = 0; r2 < t3.length; ) {
      var s2 = t3[r2++];
      s2 < 128 || i2 ? e2 += String.fromCharCode(s2) : s2 < 224 ? e2 += String.fromCharCode((31 & s2) << 6 | 63 & t3[r2++]) : s2 < 240 ? e2 += String.fromCharCode((15 & s2) << 12 | (63 & t3[r2++]) << 6 | 63 & t3[r2++]) : (s2 = ((15 & s2) << 18 | (63 & t3[r2++]) << 12 | (63 & t3[r2++]) << 6 | 63 & t3[r2++]) - 65536, e2 += String.fromCharCode(55296 | s2 >> 10, 56320 | 1023 & s2));
    }
    return e2;
  })(jr(Lr(JSON.stringify(t2))), true);
}
function vs(t2) {
  return t2.type === Be.Custom && "sessionIdle" === t2.data.tag;
}
var cs = class {
  get sessionId() {
    return this.Mt;
  }
  get Ft() {
    return this._instance.config.session_recording.session_idle_threshold_ms || 3e5;
  }
  get started() {
    return this.Ot;
  }
  get At() {
    if (!this._instance.sessionManager) throw new Error(ns + " must be started with a valid sessionManager.");
    return this._instance.sessionManager;
  }
  get Dt() {
    var t2, i2;
    return this.jt.triggerStatus(this.sessionId) === Jr ? 6e4 : null !== (t2 = null == (i2 = this._instance.config.session_recording) ? void 0 : i2.full_snapshot_interval_millis) && void 0 !== t2 ? t2 : ls;
  }
  get Lt() {
    var t2 = this._instance.get_property(kt);
    return A(t2) ? t2 : null;
  }
  get Nt() {
    var t2, i2, e2 = null == (t2 = this.M) ? void 0 : t2.data[(null == (i2 = this.M) ? void 0 : i2.data.length) - 1], { sessionStartTimestamp: r2 } = this.At.checkAndGetSessionAndWindowId(true);
    return e2 ? e2.timestamp - r2 : null;
  }
  get zt() {
    var i2 = !!this._instance.get_property(_t), e2 = !this._instance.config.disable_session_recording;
    return t && i2 && e2;
  }
  get Ut() {
    var t2 = !!this._instance.get_property(gt), i2 = this._instance.config.enable_recording_console_log;
    return null != i2 ? i2 : t2;
  }
  get qt() {
    var t2, i2, e2, r2, s2, n2, o2 = this._instance.config.session_recording.captureCanvas, a2 = this._instance.get_property(yt), l2 = null !== (t2 = null !== (i2 = null == o2 ? void 0 : o2.recordCanvas) && void 0 !== i2 ? i2 : null == a2 ? void 0 : a2.enabled) && void 0 !== t2 && t2, u2 = null !== (e2 = null !== (r2 = null == o2 ? void 0 : o2.canvasFps) && void 0 !== r2 ? r2 : null == a2 ? void 0 : a2.fps) && void 0 !== e2 ? e2 : 4, h2 = null !== (s2 = null !== (n2 = null == o2 ? void 0 : o2.canvasQuality) && void 0 !== n2 ? n2 : null == a2 ? void 0 : a2.quality) && void 0 !== s2 ? s2 : 0.4;
    if ("string" == typeof h2) {
      var d2 = parseFloat(h2);
      h2 = isNaN(d2) ? 0.4 : d2;
    }
    return { enabled: l2, fps: ne(u2, 0, 12, "canvas recording fps", 4), quality: ne(h2, 0, 1, "canvas recording quality", 0.4) };
  }
  get Bt() {
    var t2, i2, e2 = this._instance.get_property(mt), r2 = { recordHeaders: null == (t2 = this._instance.config.session_recording) ? void 0 : t2.recordHeaders, recordBody: null == (i2 = this._instance.config.session_recording) ? void 0 : i2.recordBody }, s2 = (null == r2 ? void 0 : r2.recordHeaders) || (null == e2 ? void 0 : e2.recordHeaders), n2 = (null == r2 ? void 0 : r2.recordBody) || (null == e2 ? void 0 : e2.recordBody), o2 = I(this._instance.config.capture_performance) ? this._instance.config.capture_performance.network_timing : this._instance.config.capture_performance, a2 = !!(A(o2) ? o2 : null == e2 ? void 0 : e2.capturePerformance);
    return s2 || n2 || a2 ? { recordHeaders: s2, recordBody: n2, recordPerformance: a2 } : void 0;
  }
  get Ht() {
    var t2, i2, e2, r2, s2, n2, o2 = this._instance.get_property(bt), a2 = { maskAllInputs: null == (t2 = this._instance.config.session_recording) ? void 0 : t2.maskAllInputs, maskTextSelector: null == (i2 = this._instance.config.session_recording) ? void 0 : i2.maskTextSelector, blockSelector: null == (e2 = this._instance.config.session_recording) ? void 0 : e2.blockSelector }, l2 = null !== (r2 = null == a2 ? void 0 : a2.maskAllInputs) && void 0 !== r2 ? r2 : null == o2 ? void 0 : o2.maskAllInputs, u2 = null !== (s2 = null == a2 ? void 0 : a2.maskTextSelector) && void 0 !== s2 ? s2 : null == o2 ? void 0 : o2.maskTextSelector, h2 = null !== (n2 = null == a2 ? void 0 : a2.blockSelector) && void 0 !== n2 ? n2 : null == o2 ? void 0 : o2.blockSelector;
    return R(l2) && R(u2) && R(h2) ? void 0 : { maskAllInputs: null == l2 || l2, maskTextSelector: u2, blockSelector: h2 };
  }
  get Wt() {
    var t2 = this._instance.get_property(wt);
    return O(t2) ? t2 : null;
  }
  get Gt() {
    var t2 = this._instance.get_property(St);
    return O(t2) ? t2 : null;
  }
  get status() {
    return this.Jt ? this.Vt({ receivedFlags: this.Jt, isRecordingEnabled: this.zt, isSampled: this.Lt, urlTriggerMatching: this.Kt, eventTriggerMatching: this.Yt, linkedFlagMatching: this.Xt, sessionId: this.sessionId }) : Br;
  }
  constructor(t2) {
    if (this.Vt = es, this.Jt = false, this.Qt = [], this.Zt = "unknown", this.ti = Date.now(), this.jt = new Qr(), this.ii = void 0, this.ei = void 0, this.ri = void 0, this.si = void 0, this.ni = void 0, this._forceAllowLocalhostNetworkCapture = false, this.oi = () => {
      this.ai();
    }, this.li = () => {
      this.ui("browser offline", {});
    }, this.hi = () => {
      this.ui("browser online", {});
    }, this.di = () => {
      if (null != o && o.visibilityState) {
        var t3 = "window " + o.visibilityState;
        this.ui(t3, {});
      }
    }, this._instance = t2, this.Ot = false, this.vi = "/s/", this.ci = void 0, this.Jt = false, !this._instance.sessionManager) throw os.error("started without valid sessionManager"), new Error(ns + " started without valid sessionManager. This is a bug.");
    if ("always" === this._instance.config.cookieless_mode) throw new Error(ns + ' cannot be used with cookieless_mode="always"');
    this.Xt = new ts(this._instance), this.Kt = new Zr(this._instance), this.Yt = new is(this._instance);
    var { sessionId: i2, windowId: e2 } = this.At.checkAndGetSessionAndWindowId();
    this.Mt = i2, this.fi = e2, this.M = this.pi(), this.Ft >= this.At.sessionTimeoutMs && os.warn("session_idle_threshold_ms (" + this.Ft + ") is greater than the session timeout (" + this.At.sessionTimeoutMs + "). Session will never be detected as idle");
  }
  startIfEnabledOrStop(i2) {
    this.zt ? (this.gi(i2), st(t, "beforeunload", this.oi), st(t, "offline", this.li), st(t, "online", this.hi), st(t, "visibilitychange", this.di), this.mi(), this.bi(), F(this.ii) && (this.ii = this._instance.on("eventCaptured", ((t2) => {
      try {
        if ("$pageview" === t2.event) {
          var i3 = null != t2 && t2.properties.$current_url ? this.yi(null == t2 ? void 0 : t2.properties.$current_url) : "";
          if (!i3) return;
          this.ui("$pageview", { href: i3 });
        }
      } catch (t3) {
        os.error("Could not add $pageview to rrweb session", t3);
      }
    }))), this.ei || (this.ei = this.At.onSessionId(((t2, i3, e2) => {
      var r2, s2;
      e2 && (this.ui("$session_id_change", { sessionId: t2, windowId: i3, changeReason: e2 }), null == (r2 = this._instance) || null == (r2 = r2.persistence) || r2.unregister(It), null == (s2 = this._instance) || null == (s2 = s2.persistence) || s2.unregister(Et));
    })))) : this.stopRecording();
  }
  stopRecording() {
    var i2, e2, r2, s2;
    this.Ot && this.ci && (this.ci(), this.ci = void 0, this.Ot = false, null == t || t.removeEventListener("beforeunload", this.oi), null == t || t.removeEventListener("offline", this.li), null == t || t.removeEventListener("online", this.hi), null == t || t.removeEventListener("visibilitychange", this.di), this.pi(), clearInterval(this.wi), null == (i2 = this.ii) || i2.call(this), this.ii = void 0, null == (e2 = this.ni) || e2.call(this), this.ni = void 0, null == (r2 = this.ei) || r2.call(this), this.ei = void 0, null == (s2 = this.si) || s2.call(this), this.si = void 0, this.Yt.stop(), this.Kt.stop(), this.Xt.stop(), os.info("stopped"));
  }
  Si() {
    var t2;
    null == (t2 = this._instance.persistence) || t2.unregister(kt);
  }
  $i(t2) {
    var i2, e2 = this.Mt !== t2, r2 = this.Wt;
    if (O(r2)) {
      var s2 = this.Lt, n2 = e2 || !A(s2), o2 = n2 ? Nr(t2, r2) : s2;
      n2 && (o2 ? this.xi(Ur) : os.warn("Sample rate (" + r2 + ") has determined that this sessionId (" + t2 + ") will not be sent to the server."), this.ui("samplingDecisionMade", { sampleRate: r2, isSampled: o2 })), null == (i2 = this._instance.persistence) || i2.register({ [kt]: o2 });
    } else this.Si();
  }
  onRemoteConfig(t2) {
    var i2, e2, r2, s2;
    (this.ui("$remote_config_received", t2), this.ki(t2), null != (i2 = t2.sessionRecording) && i2.endpoint) && (this.vi = null == (s2 = t2.sessionRecording) ? void 0 : s2.endpoint);
    this.mi(), "any" === (null == (e2 = t2.sessionRecording) ? void 0 : e2.triggerMatchType) ? (this.Vt = rs, this.jt = new Yr([this.Yt, this.Kt])) : (this.Vt = ss, this.jt = new Xr([this.Yt, this.Kt])), this._instance.register_for_session({ $sdk_debug_replay_remote_trigger_matching_config: null == (r2 = t2.sessionRecording) ? void 0 : r2.triggerMatchType }), this.Kt.onRemoteConfig(t2), this.Yt.onRemoteConfig(t2), this.Xt.onRemoteConfig(t2, ((t3, i3) => {
      this.xi("linked_flag_matched", { flag: t3, variant: i3 });
    })), this.Jt = true, this.startIfEnabledOrStop();
  }
  mi() {
    O(this.Wt) && F(this.si) && (this.si = this.At.onSessionId(((t2) => {
      this.$i(t2);
    })));
  }
  ki(t2) {
    if (this._instance.persistence) {
      var i2, e2 = this._instance.persistence, r2 = () => {
        var i3, r3, s2, n2, o2, a2, l2, u2, h2, d2 = null == (i3 = t2.sessionRecording) ? void 0 : i3.sampleRate, v2 = F(d2) ? null : parseFloat(d2);
        F(v2) && this.Si();
        var c2 = null == (r3 = t2.sessionRecording) ? void 0 : r3.minimumDurationMilliseconds;
        e2.register({ [_t]: !!t2.sessionRecording, [gt]: null == (s2 = t2.sessionRecording) ? void 0 : s2.consoleLogRecordingEnabled, [mt]: B({ capturePerformance: t2.capturePerformance }, null == (n2 = t2.sessionRecording) ? void 0 : n2.networkPayloadCapture), [bt]: null == (o2 = t2.sessionRecording) ? void 0 : o2.masking, [yt]: { enabled: null == (a2 = t2.sessionRecording) ? void 0 : a2.recordCanvas, fps: null == (l2 = t2.sessionRecording) ? void 0 : l2.canvasFps, quality: null == (u2 = t2.sessionRecording) ? void 0 : u2.canvasQuality }, [wt]: v2, [St]: R(c2) ? null : c2, [$t]: null == (h2 = t2.sessionRecording) ? void 0 : h2.scriptConfig });
      };
      r2(), null == (i2 = this.ri) || i2.call(this), this.ri = this.At.onSessionId(r2);
    }
  }
  log(t2, i2) {
    var e2;
    void 0 === i2 && (i2 = "log"), null == (e2 = this._instance.sessionRecording) || e2.onRRwebEmit({ type: 6, data: { plugin: "rrweb/console@1", payload: { level: i2, trace: [], payload: [JSON.stringify(t2)] } }, timestamp: Date.now() });
  }
  gi(t2) {
    if (!R(Object.assign) && !R(Array.from) && !(this.Ot || this._instance.config.disable_session_recording || this._instance.consent.isOptedOut())) {
      var i2;
      if (this.Ot = true, this.At.checkAndGetSessionAndWindowId(), as()) this.Ei();
      else null == (i2 = v.__PosthogExtensions__) || null == i2.loadExternalDependency || i2.loadExternalDependency(this._instance, this.Ii, ((t3) => {
        if (t3) return os.error("could not load recorder", t3);
        this.Ei();
      }));
      os.info("starting"), this.status === qr && this.xi(t2 || "recording_initialized");
    }
  }
  get Ii() {
    var t2;
    return (null == (t2 = this._instance) || null == (t2 = t2.persistence) || null == (t2 = t2.get_property($t)) ? void 0 : t2.script) || "recorder";
  }
  Pi(t2) {
    var i2;
    return 3 === t2.type && -1 !== us.indexOf(null == (i2 = t2.data) ? void 0 : i2.source);
  }
  Ri(t2) {
    var i2 = this.Pi(t2);
    i2 || this.Zt || t2.timestamp - this.ti > this.Ft && (this.Zt = true, clearInterval(this.wi), this.ui("sessionIdle", { eventTimestamp: t2.timestamp, lastActivityTimestamp: this.ti, threshold: this.Ft, bufferLength: this.M.data.length, bufferSize: this.M.size }), this.ai());
    var e2 = false;
    if (i2 && (this.ti = t2.timestamp, this.Zt)) {
      var r2 = "unknown" === this.Zt;
      this.Zt = false, r2 || (this.ui("sessionNoLongerIdle", { reason: "user activity", type: t2.type }), e2 = true);
    }
    if (!this.Zt) {
      var { windowId: s2, sessionId: n2 } = this.At.checkAndGetSessionAndWindowId(!i2, t2.timestamp), o2 = this.Mt !== n2, a2 = this.fi !== s2;
      this.fi = s2, this.Mt = n2, o2 || a2 ? (this.stopRecording(), this.startIfEnabledOrStop("session_id_changed")) : e2 && this.Ti();
    }
  }
  Ci(t2) {
    try {
      return t2.rrwebMethod(), true;
    } catch (i2) {
      return this.Qt.length < 10 ? this.Qt.push({ enqueuedAt: t2.enqueuedAt || Date.now(), attempt: t2.attempt++, rrwebMethod: t2.rrwebMethod }) : os.warn("could not emit queued rrweb event.", i2, t2), false;
    }
  }
  ui(t2, i2) {
    return this.Ci(hs((() => as().addCustomEvent(t2, i2))));
  }
  Mi() {
    return this.Ci(hs((() => as().takeFullSnapshot())));
  }
  Ei() {
    var t2, i2, e2, r2, s2 = { blockClass: "ph-no-capture", blockSelector: void 0, ignoreClass: "ph-ignore-input", maskTextClass: "ph-mask", maskTextSelector: void 0, maskTextFn: void 0, maskAllInputs: true, maskInputOptions: { password: true }, maskInputFn: void 0, slimDOMOptions: {}, collectFonts: false, inlineStylesheet: true, recordCrossOriginIframes: false }, n2 = this._instance.config.session_recording;
    for (var [o2, a2] of Object.entries(n2 || {})) o2 in s2 && ("maskInputOptions" === o2 ? s2.maskInputOptions = B({ password: true }, a2) : s2[o2] = a2);
    (this.qt && this.qt.enabled && (s2.recordCanvas = true, s2.sampling = { canvas: this.qt.fps }, s2.dataURLOptions = { type: "image/webp", quality: this.qt.quality }), this.Ht) && (s2.maskAllInputs = null === (i2 = this.Ht.maskAllInputs) || void 0 === i2 || i2, s2.maskTextSelector = null !== (e2 = this.Ht.maskTextSelector) && void 0 !== e2 ? e2 : void 0, s2.blockSelector = null !== (r2 = this.Ht.blockSelector) && void 0 !== r2 ? r2 : void 0);
    var l2 = as();
    if (l2) {
      this.Fi = null !== (t2 = this.Fi) && void 0 !== t2 ? t2 : new tr(l2, { refillRate: this._instance.config.session_recording.__mutationThrottlerRefillRate, bucketSize: this._instance.config.session_recording.__mutationThrottlerBucketSize, onBlockedNode: (t3, i3) => {
        var e3 = "Too many mutations on node '" + t3 + "'. Rate limiting. This could be due to SVG animations or something similar";
        os.info(e3, { node: i3 }), this.log(ns + " " + e3, "warn");
      } });
      var u2 = this.Oi();
      this.ci = l2(B({ emit: (t3) => {
        this.onRRwebEmit(t3);
      }, plugins: u2 }, s2)), this.ti = Date.now(), this.Zt = A(this.Zt) ? this.Zt : "unknown", this.ui("$session_options", { sessionRecordingOptions: s2, activePlugins: u2.map(((t3) => null == t3 ? void 0 : t3.name)) }), this.ui("$posthog_config", { config: this._instance.config });
    } else os.error("onScriptLoaded was called but rrwebRecord is not available. This indicates something has gone wrong.");
  }
  Ti() {
    if (this.wi && clearInterval(this.wi), true !== this.Zt) {
      var t2 = this.Dt;
      t2 && (this.wi = setInterval((() => {
        this.Mi();
      }), t2));
    }
  }
  Oi() {
    var t2, i2, e2 = [], r2 = null == (t2 = v.__PosthogExtensions__) || null == (t2 = t2.rrwebPlugins) ? void 0 : t2.getRecordConsolePlugin;
    r2 && this.Ut && e2.push(r2());
    var s2 = null == (i2 = v.__PosthogExtensions__) || null == (i2 = i2.rrwebPlugins) ? void 0 : i2.getRecordNetworkPlugin;
    this.Bt && E(s2) && (!wi.includes(location.hostname) || this._forceAllowLocalhostNetworkCapture ? e2.push(s2(Ze(this._instance.config, this.Bt))) : os.info("NetworkCapture not started because we are on localhost."));
    return e2;
  }
  onRRwebEmit(t2) {
    var i2;
    if (this.Ai(), t2 && I(t2)) {
      if (t2.type === Be.Meta) {
        var e2 = this.yi(t2.data.href);
        if (this.Di = e2, !e2) return;
        t2.data.href = e2;
      } else this.ji();
      if (this.Kt.checkUrlTriggerConditions((() => this.Li()), (() => this.Ni()), ((t3) => this.zi(t3))), !this.Kt.urlBlocked || (r2 = t2).type === Be.Custom && "recording paused" === r2.data.tag) {
        var r2;
        t2.type === Be.FullSnapshot && this.Ti(), t2.type === Be.FullSnapshot && this.Jt && this.jt.triggerStatus(this.sessionId) === Jr && this.pi();
        var s2 = this.Fi ? this.Fi.throttleMutations(t2) : t2;
        if (s2) {
          var n2 = (function(t3) {
            var i3 = t3;
            if (i3 && I(i3) && 6 === i3.type && I(i3.data) && "rrweb/console@1" === i3.data.plugin) {
              i3.data.payload.payload.length > 10 && (i3.data.payload.payload = i3.data.payload.payload.slice(0, 10), i3.data.payload.payload.push("...[truncated]"));
              for (var e3 = [], r3 = 0; r3 < i3.data.payload.payload.length; r3++) i3.data.payload.payload[r3] && i3.data.payload.payload[r3].length > 2e3 ? e3.push(i3.data.payload.payload[r3].slice(0, 2e3) + "...[truncated]") : e3.push(i3.data.payload.payload[r3]);
              return i3.data.payload.payload = e3, t3;
            }
            return t3;
          })(s2);
          if (this.Ri(n2), true !== this.Zt || vs(n2)) {
            if (vs(n2)) {
              var o2 = n2.data.payload;
              if (o2) {
                var a2 = o2.lastActivityTimestamp, l2 = o2.threshold;
                n2.timestamp = a2 + l2;
              }
            }
            var u2 = null === (i2 = this._instance.config.session_recording.compress_events) || void 0 === i2 || i2 ? (function(t3) {
              if (Ue(t3) < 1024) return t3;
              try {
                if (t3.type === Be.FullSnapshot) return B({}, t3, { data: ds(t3.data), cv: "2024-10" });
                if (t3.type === Be.IncrementalSnapshot && t3.data.source === He.Mutation) return B({}, t3, { cv: "2024-10", data: B({}, t3.data, { texts: ds(t3.data.texts), attributes: ds(t3.data.attributes), removes: ds(t3.data.removes), adds: ds(t3.data.adds) }) });
                if (t3.type === Be.IncrementalSnapshot && t3.data.source === He.StyleSheetRule) return B({}, t3, { cv: "2024-10", data: B({}, t3.data, { adds: t3.data.adds ? ds(t3.data.adds) : void 0, removes: t3.data.removes ? ds(t3.data.removes) : void 0 }) });
              } catch (t4) {
                os.error("could not compress event - will use uncompressed event", t4);
              }
              return t3;
            })(n2) : n2, h2 = { $snapshot_bytes: Ue(u2), $snapshot_data: u2, $session_id: this.Mt, $window_id: this.fi };
            this.status !== zr ? this.Ui(h2) : this.pi();
          }
        }
      }
    }
  }
  ji() {
    if (!this._instance.config.capture_pageview && t) {
      var i2 = this.yi(t.location.href);
      this.Di !== i2 && (this.ui("$url_changed", { href: i2 }), this.Di = i2);
    }
  }
  Ai() {
    if (this.Qt.length) {
      var t2 = [...this.Qt];
      this.Qt = [], t2.forEach(((t3) => {
        Date.now() - t3.enqueuedAt <= 2e3 && this.Ci(t3);
      }));
    }
  }
  yi(t2) {
    var i2 = this._instance.config.session_recording;
    if (i2.maskNetworkRequestFn) {
      var e2, r2 = { url: t2 };
      return null == (e2 = r2 = i2.maskNetworkRequestFn(r2)) ? void 0 : e2.url;
    }
    return t2;
  }
  pi() {
    return this.M = { size: 0, data: [], sessionId: this.Mt, windowId: this.fi }, this.M;
  }
  ai() {
    this.qi && (clearTimeout(this.qi), this.qi = void 0);
    var t2 = this.Gt, i2 = this.Nt, e2 = O(i2) && i2 >= 0, r2 = O(t2) && e2 && i2 < t2;
    if (this.status === Br || this.status === Hr || this.status === zr || r2) return this.qi = setTimeout((() => {
      this.ai();
    }), 2e3), this.M;
    this.M.data.length > 0 && qe(this.M).forEach(((t3) => {
      this.Bi({ $snapshot_bytes: t3.size, $snapshot_data: t3.data, $session_id: t3.sessionId, $window_id: t3.windowId, $lib: "web", $lib_version: c.LIB_VERSION });
    }));
    return this.pi();
  }
  Ui(t2) {
    var i2, e2 = 2 + ((null == (i2 = this.M) ? void 0 : i2.data.length) || 0);
    !this.Zt && (this.M.size + t2.$snapshot_bytes + e2 > 943718.4 || this.M.sessionId !== this.Mt) && (this.M = this.ai()), this.M.size += t2.$snapshot_bytes, this.M.data.push(t2.$snapshot_data), this.qi || this.Zt || (this.qi = setTimeout((() => {
      this.ai();
    }), 2e3));
  }
  Bi(t2) {
    this._instance.capture("$snapshot", t2, { _url: this._instance.requestRouter.endpointFor("api", this.vi), _noTruncate: true, _batchKey: "recordings", skip_client_rate_limiting: true });
  }
  zi(t2) {
    var i2;
    this.jt.triggerStatus(this.sessionId) === Jr && (null == (i2 = this._instance) || null == (i2 = i2.persistence) || i2.register({ ["url" === t2 ? Et : It]: this.Mt }), this.ai(), this.xi(t2 + "_trigger_matched"));
  }
  Li() {
    this.Kt.urlBlocked || (this.Kt.urlBlocked = true, clearInterval(this.wi), os.info("recording paused due to URL blocker"), this.ui("recording paused", { reason: "url blocker" }));
  }
  Ni() {
    this.Kt.urlBlocked && (this.Kt.urlBlocked = false, this.Mi(), this.Ti(), this.ui("recording resumed", { reason: "left blocked url" }), os.info("recording resumed"));
  }
  bi() {
    0 !== this.Yt.Tt.length && F(this.ni) && (this.ni = this._instance.on("eventCaptured", ((t2) => {
      try {
        this.Yt.Tt.includes(t2.event) && this.zi("event");
      } catch (t3) {
        os.error("Could not activate event trigger", t3);
      }
    })));
  }
  overrideLinkedFlag() {
    this.Xt.linkedFlagSeen = true, this.Mi(), this.xi("linked_flag_overridden");
  }
  overrideSampling() {
    var t2;
    null == (t2 = this._instance.persistence) || t2.register({ [kt]: true }), this.Mi(), this.xi("sampling_overridden");
  }
  overrideTrigger(t2) {
    this.zi(t2);
  }
  xi(t2, i2) {
    this._instance.register_for_session({ $session_recording_start_reason: t2 }), os.info(t2.replace("_", " "), i2), m(["recording_initialized", "session_id_changed"], t2) || this.ui(t2, i2);
  }
  get sdkDebugProperties() {
    var { sessionStartTimestamp: t2 } = this.At.checkAndGetSessionAndWindowId(true);
    return { $recording_status: this.status, $sdk_debug_replay_internal_buffer_length: this.M.data.length, $sdk_debug_replay_internal_buffer_size: this.M.size, $sdk_debug_current_session_duration: this.Nt, $sdk_debug_session_start: t2 };
  }
};
var fs = z("[SegmentIntegration]");
function ps(t2, i2) {
  var e2 = t2.config.segment;
  if (!e2) return i2();
  !(function(t3, i3) {
    var e3 = t3.config.segment;
    if (!e3) return i3();
    var r2 = (e4) => {
      var r3 = () => e4.anonymousId() || Ni();
      t3.config.get_device_id = r3, e4.id() && (t3.register({ distinct_id: e4.id(), $device_id: r3() }), t3.persistence.set_property(Dt, "identified")), i3();
    }, s2 = e3.user();
    "then" in s2 && E(s2.then) ? s2.then(((t4) => r2(t4))) : r2(s2);
  })(t2, (() => {
    e2.register(((t3) => {
      Promise && Promise.resolve || fs.warn("This browser does not have Promise support, and can not use the segment integration");
      var i3 = (i4, e3) => {
        if (!e3) return i4;
        i4.event.userId || i4.event.anonymousId === t3.get_distinct_id() || (fs.info("No userId set, resetting PostHog"), t3.reset()), i4.event.userId && i4.event.userId !== t3.get_distinct_id() && (fs.info("UserId set, identifying with PostHog"), t3.identify(i4.event.userId));
        var r2 = t3.calculateEventProperties(e3, i4.event.properties);
        return i4.event.properties = Object.assign({}, r2, i4.event.properties), i4;
      };
      return { name: "PostHog JS", type: "enrichment", version: "1.0.0", isLoaded: () => true, load: () => Promise.resolve(), track: (t4) => i3(t4, t4.event.event), page: (t4) => i3(t4, "$pageview"), identify: (t4) => i3(t4, "$identify"), screen: (t4) => i3(t4, "$screen") };
    })(t2)).then((() => {
      i2();
    }));
  }));
}
var _s = "posthog-js";
function gs(t2, i2) {
  var { organization: e2, projectId: r2, prefix: s2, severityAllowList: n2 = ["error"] } = void 0 === i2 ? {} : i2;
  return (i3) => {
    var o2, a2, l2, u2, h2;
    if (!("*" === n2 || n2.includes(i3.level)) || !t2.__loaded) return i3;
    i3.tags || (i3.tags = {});
    var d2 = t2.requestRouter.endpointFor("ui", "/project/" + t2.config.token + "/person/" + t2.get_distinct_id());
    i3.tags["PostHog Person URL"] = d2, t2.sessionRecordingStarted() && (i3.tags["PostHog Recording URL"] = t2.get_session_replay_url({ withTimestamp: true }));
    var v2 = (null == (o2 = i3.exception) ? void 0 : o2.values) || [], c2 = v2.map(((t3) => B({}, t3, { stacktrace: t3.stacktrace ? B({}, t3.stacktrace, { type: "raw", frames: (t3.stacktrace.frames || []).map(((t4) => B({}, t4, { platform: "web:javascript" }))) }) : void 0 }))), f2 = { $exception_message: (null == (a2 = v2[0]) ? void 0 : a2.value) || i3.message, $exception_type: null == (l2 = v2[0]) ? void 0 : l2.type, $exception_personURL: d2, $exception_level: i3.level, $exception_list: c2, $sentry_event_id: i3.event_id, $sentry_exception: i3.exception, $sentry_exception_message: (null == (u2 = v2[0]) ? void 0 : u2.value) || i3.message, $sentry_exception_type: null == (h2 = v2[0]) ? void 0 : h2.type, $sentry_tags: i3.tags };
    return e2 && r2 && (f2.$sentry_url = (s2 || "https://sentry.io/organizations/") + e2 + "/issues/?project=" + r2 + "&query=" + i3.event_id), t2.exceptions.sendExceptionEvent(f2), i3;
  };
}
var ms = class {
  constructor(t2, i2, e2, r2, s2) {
    this.name = _s, this.setupOnce = function(n2) {
      n2(gs(t2, { organization: i2, projectId: e2, prefix: r2, severityAllowList: s2 }));
    };
  }
};
var bs = null != t && t.location ? Ei(t.location.hash, "__posthog") || Ei(location.hash, "state") : null;
var ys = "_postHogToolbarParams";
var ws = z("[Toolbar]");
var Ss = (function(t2) {
  return t2[t2.UNINITIALIZED = 0] = "UNINITIALIZED", t2[t2.LOADING = 1] = "LOADING", t2[t2.LOADED = 2] = "LOADED", t2;
})(Ss || {});
var $s = class {
  constructor(t2) {
    this.instance = t2;
  }
  Hi(t2) {
    v.ph_toolbar_state = t2;
  }
  Wi() {
    var t2;
    return null !== (t2 = v.ph_toolbar_state) && void 0 !== t2 ? t2 : Ss.UNINITIALIZED;
  }
  maybeLoadToolbar(i2, e2, r2) {
    if (void 0 === i2 && (i2 = void 0), void 0 === e2 && (e2 = void 0), void 0 === r2 && (r2 = void 0), !t || !o) return false;
    i2 = null != i2 ? i2 : t.location, r2 = null != r2 ? r2 : t.history;
    try {
      if (!e2) {
        try {
          t.localStorage.setItem("test", "test"), t.localStorage.removeItem("test");
        } catch (t2) {
          return false;
        }
        e2 = null == t ? void 0 : t.localStorage;
      }
      var s2, n2 = bs || Ei(i2.hash, "__posthog") || Ei(i2.hash, "state"), a2 = n2 ? X((() => JSON.parse(atob(decodeURIComponent(n2))))) || X((() => JSON.parse(decodeURIComponent(n2)))) : null;
      return a2 && "ph_authorize" === a2.action ? ((s2 = a2).source = "url", s2 && Object.keys(s2).length > 0 && (a2.desiredHash ? i2.hash = a2.desiredHash : r2 ? r2.replaceState(r2.state, "", i2.pathname + i2.search) : i2.hash = "")) : ((s2 = JSON.parse(e2.getItem(ys) || "{}")).source = "localstorage", delete s2.userIntent), !(!s2.token || this.instance.config.token !== s2.token) && (this.loadToolbar(s2), true);
    } catch (t2) {
      return false;
    }
  }
  Gi(t2) {
    var i2 = v.ph_load_toolbar || v.ph_load_editor;
    !F(i2) && E(i2) ? i2(t2, this.instance) : ws.warn("No toolbar load function found");
  }
  loadToolbar(i2) {
    var e2 = !(null == o || !o.getElementById(Bt));
    if (!t || e2) return false;
    var r2 = "custom" === this.instance.requestRouter.region && this.instance.config.advanced_disable_toolbar_metrics, s2 = B({ token: this.instance.config.token }, i2, { apiURL: this.instance.requestRouter.endpointFor("ui") }, r2 ? { instrument: false } : {});
    if (t.localStorage.setItem(ys, JSON.stringify(B({}, s2, { source: void 0 }))), this.Wi() === Ss.LOADED) this.Gi(s2);
    else if (this.Wi() === Ss.UNINITIALIZED) {
      var n2;
      this.Hi(Ss.LOADING), null == (n2 = v.__PosthogExtensions__) || null == n2.loadExternalDependency || n2.loadExternalDependency(this.instance, "toolbar", ((t2) => {
        if (t2) return ws.error("[Toolbar] Failed to load", t2), void this.Hi(Ss.UNINITIALIZED);
        this.Hi(Ss.LOADED), this.Gi(s2);
      })), st(t, "turbolinks:load", (() => {
        this.Hi(Ss.UNINITIALIZED), this.loadToolbar(s2);
      }));
    }
    return true;
  }
  Ji(t2) {
    return this.loadToolbar(t2);
  }
  maybeLoadEditor(t2, i2, e2) {
    return void 0 === t2 && (t2 = void 0), void 0 === i2 && (i2 = void 0), void 0 === e2 && (e2 = void 0), this.maybeLoadToolbar(t2, i2, e2);
  }
};
var xs = z("[TracingHeaders]");
var ks = class {
  constructor(t2) {
    this.Vi = void 0, this.Ki = void 0, this.nt = () => {
      var t3, i2;
      R(this.Vi) && (null == (t3 = v.__PosthogExtensions__) || null == (t3 = t3.tracingHeadersPatchFns) || t3._patchXHR(this._instance.config.__add_tracing_headers || [], this._instance.get_distinct_id(), this._instance.sessionManager));
      R(this.Ki) && (null == (i2 = v.__PosthogExtensions__) || null == (i2 = i2.tracingHeadersPatchFns) || i2._patchFetch(this._instance.config.__add_tracing_headers || [], this._instance.get_distinct_id(), this._instance.sessionManager));
    }, this._instance = t2;
  }
  J(t2) {
    var i2, e2;
    null != (i2 = v.__PosthogExtensions__) && i2.tracingHeadersPatchFns && t2(), null == (e2 = v.__PosthogExtensions__) || null == e2.loadExternalDependency || e2.loadExternalDependency(this._instance, "tracing-headers", ((i3) => {
      if (i3) return xs.error("failed to load script", i3);
      t2();
    }));
  }
  startIfEnabledOrStop() {
    var t2, i2;
    this._instance.config.__add_tracing_headers ? this.J(this.nt) : (null == (t2 = this.Vi) || t2.call(this), null == (i2 = this.Ki) || i2.call(this), this.Vi = void 0, this.Ki = void 0);
  }
};
var Es = z("[Web Vitals]");
var Is = 9e5;
var Ps = class {
  constructor(t2) {
    var i2;
    this.Yi = false, this.i = false, this.M = { url: void 0, metrics: [], firstMetricTimestamp: void 0 }, this.Xi = () => {
      clearTimeout(this.Qi), 0 !== this.M.metrics.length && (this._instance.capture("$web_vitals", this.M.metrics.reduce(((t3, i3) => B({}, t3, { ["$web_vitals_" + i3.name + "_event"]: B({}, i3), ["$web_vitals_" + i3.name + "_value"]: i3.value })), {})), this.M = { url: void 0, metrics: [], firstMetricTimestamp: void 0 });
    }, this.Zi = (t3) => {
      var i3, e2 = null == (i3 = this._instance.sessionManager) ? void 0 : i3.checkAndGetSessionAndWindowId(true);
      if (R(e2)) Es.error("Could not read session ID. Dropping metrics!");
      else {
        this.M = this.M || { url: void 0, metrics: [], firstMetricTimestamp: void 0 };
        var r2 = this.te();
        if (!R(r2)) if (F(null == t3 ? void 0 : t3.name) || F(null == t3 ? void 0 : t3.value)) Es.error("Invalid metric received", t3);
        else if (this.ie && t3.value >= this.ie) Es.error("Ignoring metric with value >= " + this.ie, t3);
        else this.M.url !== r2 && (this.Xi(), this.Qi = setTimeout(this.Xi, this.flushToCaptureTimeoutMs)), R(this.M.url) && (this.M.url = r2), this.M.firstMetricTimestamp = R(this.M.firstMetricTimestamp) ? Date.now() : this.M.firstMetricTimestamp, t3.attribution && t3.attribution.interactionTargetElement && (t3.attribution.interactionTargetElement = void 0), this.M.metrics.push(B({}, t3, { $current_url: r2, $session_id: e2.sessionId, $window_id: e2.windowId, timestamp: Date.now() })), this.M.metrics.length === this.allowedMetrics.length && this.Xi();
      }
    }, this.nt = () => {
      var t3, i3, e2, r2, s2 = v.__PosthogExtensions__;
      R(s2) || R(s2.postHogWebVitalsCallbacks) || ({ onLCP: t3, onCLS: i3, onFCP: e2, onINP: r2 } = s2.postHogWebVitalsCallbacks), t3 && i3 && e2 && r2 ? (this.allowedMetrics.indexOf("LCP") > -1 && t3(this.Zi.bind(this)), this.allowedMetrics.indexOf("CLS") > -1 && i3(this.Zi.bind(this)), this.allowedMetrics.indexOf("FCP") > -1 && e2(this.Zi.bind(this)), this.allowedMetrics.indexOf("INP") > -1 && r2(this.Zi.bind(this)), this.i = true) : Es.error("web vitals callbacks not loaded - not starting");
    }, this._instance = t2, this.Yi = !(null == (i2 = this._instance.persistence) || !i2.props[ct]), this.startIfEnabled();
  }
  get allowedMetrics() {
    var t2, i2, e2 = I(this._instance.config.capture_performance) ? null == (t2 = this._instance.config.capture_performance) ? void 0 : t2.web_vitals_allowed_metrics : void 0;
    return R(e2) ? (null == (i2 = this._instance.persistence) ? void 0 : i2.props[pt]) || ["CLS", "FCP", "INP", "LCP"] : e2;
  }
  get flushToCaptureTimeoutMs() {
    return (I(this._instance.config.capture_performance) ? this._instance.config.capture_performance.web_vitals_delayed_flush_ms : void 0) || 5e3;
  }
  get ie() {
    var t2 = I(this._instance.config.capture_performance) && O(this._instance.config.capture_performance.__web_vitals_max_value) ? this._instance.config.capture_performance.__web_vitals_max_value : Is;
    return 0 < t2 && t2 <= 6e4 ? Is : t2;
  }
  get isEnabled() {
    var t2 = null == a ? void 0 : a.protocol;
    if ("http:" !== t2 && "https:" !== t2) return Es.info("Web Vitals are disabled on non-http/https protocols"), false;
    var i2 = I(this._instance.config.capture_performance) ? this._instance.config.capture_performance.web_vitals : A(this._instance.config.capture_performance) ? this._instance.config.capture_performance : void 0;
    return A(i2) ? i2 : this.Yi;
  }
  startIfEnabled() {
    this.isEnabled && !this.i && (Es.info("enabled, starting..."), this.J(this.nt));
  }
  onRemoteConfig(t2) {
    var i2 = I(t2.capturePerformance) && !!t2.capturePerformance.web_vitals, e2 = I(t2.capturePerformance) ? t2.capturePerformance.web_vitals_allowed_metrics : void 0;
    this._instance.persistence && (this._instance.persistence.register({ [ct]: i2 }), this._instance.persistence.register({ [pt]: e2 })), this.Yi = i2, this.startIfEnabled();
  }
  J(t2) {
    var i2, e2;
    null != (i2 = v.__PosthogExtensions__) && i2.postHogWebVitalsCallbacks && t2(), null == (e2 = v.__PosthogExtensions__) || null == e2.loadExternalDependency || e2.loadExternalDependency(this._instance, "web-vitals", ((i3) => {
      i3 ? Es.error("failed to load script", i3) : t2();
    }));
  }
  te() {
    var i2 = t ? t.location.href : void 0;
    return i2 || Es.error("Could not determine current URL"), i2;
  }
};
var Rs = z("[Heatmaps]");
function Ts(t2) {
  return I(t2) && "clientX" in t2 && "clientY" in t2 && O(t2.clientX) && O(t2.clientY);
}
var Cs = class {
  constructor(t2) {
    var i2;
    this.rageclicks = new yi(), this.Yi = false, this.i = false, this.ee = null, this.instance = t2, this.Yi = !(null == (i2 = this.instance.persistence) || !i2.props[ut]);
  }
  get flushIntervalMilliseconds() {
    var t2 = 5e3;
    return I(this.instance.config.capture_heatmaps) && this.instance.config.capture_heatmaps.flush_interval_milliseconds && (t2 = this.instance.config.capture_heatmaps.flush_interval_milliseconds), t2;
  }
  get isEnabled() {
    return R(this.instance.config.capture_heatmaps) ? R(this.instance.config.enable_heatmaps) ? this.Yi : this.instance.config.enable_heatmaps : false !== this.instance.config.capture_heatmaps;
  }
  startIfEnabled() {
    if (this.isEnabled) {
      if (this.i) return;
      Rs.info("starting..."), this.re(), this.ee = setInterval(this.se.bind(this), this.flushIntervalMilliseconds);
    } else {
      var t2, i2;
      clearInterval(null !== (t2 = this.ee) && void 0 !== t2 ? t2 : void 0), null == (i2 = this.ne) || i2.stop(), this.getAndClearBuffer();
    }
  }
  onRemoteConfig(t2) {
    var i2 = !!t2.heatmaps;
    this.instance.persistence && this.instance.persistence.register({ [ut]: i2 }), this.Yi = i2, this.startIfEnabled();
  }
  getAndClearBuffer() {
    var t2 = this.M;
    return this.M = void 0, t2;
  }
  oe(t2) {
    this.ae(t2.originalEvent, "deadclick");
  }
  re() {
    t && o && (st(t, "beforeunload", this.se.bind(this)), st(o, "click", ((i2) => this.ae(i2 || (null == t ? void 0 : t.event))), { capture: true }), st(o, "mousemove", ((i2) => this.le(i2 || (null == t ? void 0 : t.event))), { capture: true }), this.ne = new se(this.instance, ee, this.oe.bind(this)), this.ne.startIfEnabled(), this.i = true);
  }
  ue(i2, e2) {
    var r2 = this.instance.scrollManager.scrollY(), s2 = this.instance.scrollManager.scrollX(), n2 = this.instance.scrollManager.scrollElement(), o2 = (function(i3, e3, r3) {
      for (var s3 = i3; s3 && Jt(s3) && !Vt(s3, "body"); ) {
        if (s3 === r3) return false;
        if (m(e3, null == t ? void 0 : t.getComputedStyle(s3).position)) return true;
        s3 = si(s3);
      }
      return false;
    })(ei(i2), ["fixed", "sticky"], n2);
    return { x: i2.clientX + (o2 ? 0 : s2), y: i2.clientY + (o2 ? 0 : r2), target_fixed: o2, type: e2 };
  }
  ae(t2, i2) {
    var e2;
    if (void 0 === i2 && (i2 = "click"), !Gt(t2.target) && Ts(t2)) {
      var r2 = this.ue(t2, i2);
      null != (e2 = this.rageclicks) && e2.isRageClick(t2.clientX, t2.clientY, (/* @__PURE__ */ new Date()).getTime()) && this.he(B({}, r2, { type: "rageclick" })), this.he(r2);
    }
  }
  le(t2) {
    !Gt(t2.target) && Ts(t2) && (clearTimeout(this.de), this.de = setTimeout((() => {
      this.he(this.ue(t2, "mousemove"));
    }), 500));
  }
  he(i2) {
    if (t) {
      var e2 = t.location.href;
      this.M = this.M || {}, this.M[e2] || (this.M[e2] = []), this.M[e2].push(i2);
    }
  }
  se() {
    this.M && !P(this.M) && this.instance.capture("$$heatmap", { $heatmap_data: this.getAndClearBuffer() });
  }
};
var Ms = class {
  constructor(t2) {
    this._instance = t2;
  }
  doPageView(i2, e2) {
    var r2, s2 = this.ve(i2, e2);
    return this.ce = { pathname: null !== (r2 = null == t ? void 0 : t.location.pathname) && void 0 !== r2 ? r2 : "", pageViewId: e2, timestamp: i2 }, this._instance.scrollManager.resetContext(), s2;
  }
  doPageLeave(t2) {
    var i2;
    return this.ve(t2, null == (i2 = this.ce) ? void 0 : i2.pageViewId);
  }
  doEvent() {
    var t2;
    return { $pageview_id: null == (t2 = this.ce) ? void 0 : t2.pageViewId };
  }
  ve(t2, i2) {
    var e2 = this.ce;
    if (!e2) return { $pageview_id: i2 };
    var r2 = { $pageview_id: i2, $prev_pageview_id: e2.pageViewId }, s2 = this._instance.scrollManager.getContext();
    if (s2 && !this._instance.config.disable_scroll_properties) {
      var { maxScrollHeight: n2, lastScrollY: o2, maxScrollY: a2, maxContentHeight: l2, lastContentY: u2, maxContentY: h2 } = s2;
      if (!(R(n2) || R(o2) || R(a2) || R(l2) || R(u2) || R(h2))) {
        n2 = Math.ceil(n2), o2 = Math.ceil(o2), a2 = Math.ceil(a2), l2 = Math.ceil(l2), u2 = Math.ceil(u2), h2 = Math.ceil(h2);
        var d2 = n2 <= 1 ? 1 : ne(o2 / n2, 0, 1), v2 = n2 <= 1 ? 1 : ne(a2 / n2, 0, 1), c2 = l2 <= 1 ? 1 : ne(u2 / l2, 0, 1), f2 = l2 <= 1 ? 1 : ne(h2 / l2, 0, 1);
        r2 = V(r2, { $prev_pageview_last_scroll: o2, $prev_pageview_last_scroll_percentage: d2, $prev_pageview_max_scroll: a2, $prev_pageview_max_scroll_percentage: v2, $prev_pageview_last_content: u2, $prev_pageview_last_content_percentage: c2, $prev_pageview_max_content: h2, $prev_pageview_max_content_percentage: f2 });
      }
    }
    return e2.pathname && (r2.$prev_pageview_pathname = e2.pathname), e2.timestamp && (r2.$prev_pageview_duration = (t2.getTime() - e2.timestamp.getTime()) / 1e3), r2;
  }
};
var Fs = function(t2) {
  var i2, e2, r2, s2, n2 = "";
  for (i2 = e2 = 0, r2 = (t2 = (t2 + "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")).length, s2 = 0; s2 < r2; s2++) {
    var o2 = t2.charCodeAt(s2), a2 = null;
    o2 < 128 ? e2++ : a2 = o2 > 127 && o2 < 2048 ? String.fromCharCode(o2 >> 6 | 192, 63 & o2 | 128) : String.fromCharCode(o2 >> 12 | 224, o2 >> 6 & 63 | 128, 63 & o2 | 128), M(a2) || (e2 > i2 && (n2 += t2.substring(i2, e2)), n2 += a2, i2 = e2 = s2 + 1);
  }
  return e2 > i2 && (n2 += t2.substring(i2, t2.length)), n2;
};
var Os = !!u || !!l;
var As = "text/plain";
var Ds = (t2, i2) => {
  var [e2, r2] = t2.split("?"), s2 = B({}, i2);
  null == r2 || r2.split("&").forEach(((t3) => {
    var [i3] = t3.split("=");
    delete s2[i3];
  }));
  var n2 = $i(s2);
  return e2 + "?" + (n2 = n2 ? (r2 ? r2 + "&" : "") + n2 : r2);
};
var js = (t2, i2) => JSON.stringify(t2, ((t3, i3) => "bigint" == typeof i3 ? i3.toString() : i3), i2);
var Ls = (t2) => {
  var { data: i2, compression: e2 } = t2;
  if (i2) {
    if (e2 === _.GZipJS) {
      var r2 = jr(Lr(js(i2)), { mtime: 0 }), s2 = new Blob([r2], { type: As });
      return { contentType: As, body: s2, estimatedSize: s2.size };
    }
    if (e2 === _.Base64) {
      var n2 = (function(t3) {
        var i3, e3, r3, s3, n3, o3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", a3 = 0, l2 = 0, u2 = "", h2 = [];
        if (!t3) return t3;
        t3 = Fs(t3);
        do {
          i3 = (n3 = t3.charCodeAt(a3++) << 16 | t3.charCodeAt(a3++) << 8 | t3.charCodeAt(a3++)) >> 18 & 63, e3 = n3 >> 12 & 63, r3 = n3 >> 6 & 63, s3 = 63 & n3, h2[l2++] = o3.charAt(i3) + o3.charAt(e3) + o3.charAt(r3) + o3.charAt(s3);
        } while (a3 < t3.length);
        switch (u2 = h2.join(""), t3.length % 3) {
          case 1:
            u2 = u2.slice(0, -2) + "==";
            break;
          case 2:
            u2 = u2.slice(0, -1) + "=";
        }
        return u2;
      })(js(i2)), o2 = ((t3) => "data=" + encodeURIComponent("string" == typeof t3 ? t3 : js(t3)))(n2);
      return { contentType: "application/x-www-form-urlencoded", body: o2, estimatedSize: new Blob([o2]).size };
    }
    var a2 = js(i2);
    return { contentType: "application/json", body: a2, estimatedSize: new Blob([a2]).size };
  }
};
var Ns = [];
l && Ns.push({ transport: "fetch", method: (t2) => {
  var i2, e2, { contentType: r2, body: s2, estimatedSize: n2 } = null !== (i2 = Ls(t2)) && void 0 !== i2 ? i2 : {}, o2 = new Headers();
  J(t2.headers, (function(t3, i3) {
    o2.append(i3, t3);
  })), r2 && o2.append("Content-Type", r2);
  var a2 = t2.url, u2 = null;
  if (h) {
    var d2 = new h();
    u2 = { signal: d2.signal, timeout: setTimeout((() => d2.abort()), t2.timeout) };
  }
  l(a2, B({ method: (null == t2 ? void 0 : t2.method) || "GET", headers: o2, keepalive: "POST" === t2.method && (n2 || 0) < 52428.8, body: s2, signal: null == (e2 = u2) ? void 0 : e2.signal }, t2.fetchOptions)).then(((i3) => i3.text().then(((e3) => {
    var r3 = { statusCode: i3.status, text: e3 };
    if (200 === i3.status) try {
      r3.json = JSON.parse(e3);
    } catch (t3) {
      N.error(t3);
    }
    null == t2.callback || t2.callback(r3);
  })))).catch(((i3) => {
    N.error(i3), null == t2.callback || t2.callback({ statusCode: 0, text: i3 });
  })).finally((() => u2 ? clearTimeout(u2.timeout) : null));
} }), u && Ns.push({ transport: "XHR", method: (t2) => {
  var i2, e2 = new u();
  e2.open(t2.method || "GET", t2.url, true);
  var { contentType: r2, body: s2 } = null !== (i2 = Ls(t2)) && void 0 !== i2 ? i2 : {};
  J(t2.headers, (function(t3, i3) {
    e2.setRequestHeader(i3, t3);
  })), r2 && e2.setRequestHeader("Content-Type", r2), t2.timeout && (e2.timeout = t2.timeout), e2.withCredentials = true, e2.onreadystatechange = () => {
    if (4 === e2.readyState) {
      var i3 = { statusCode: e2.status, text: e2.responseText };
      if (200 === e2.status) try {
        i3.json = JSON.parse(e2.responseText);
      } catch (t3) {
      }
      null == t2.callback || t2.callback(i3);
    }
  }, e2.send(s2);
} }), null != n && n.sendBeacon && Ns.push({ transport: "sendBeacon", method: (t2) => {
  var i2 = Ds(t2.url, { beacon: "1" });
  try {
    var e2, { contentType: r2, body: s2 } = null !== (e2 = Ls(t2)) && void 0 !== e2 ? e2 : {}, o2 = "string" == typeof s2 ? new Blob([s2], { type: r2 }) : s2;
    n.sendBeacon(i2, o2);
  } catch (t3) {
  }
} });
var zs = function(t2, i2) {
  if (!(function(t3) {
    try {
      new RegExp(t3);
    } catch (t4) {
      return false;
    }
    return true;
  })(i2)) return false;
  try {
    return new RegExp(i2).test(t2);
  } catch (t3) {
    return false;
  }
};
function Us(t2, i2, e2) {
  return js({ distinct_id: t2, userPropertiesToSet: i2, userPropertiesToSetOnce: e2 });
}
var qs = { exact: (t2, i2) => i2.some(((i3) => t2.some(((t3) => i3 === t3)))), is_not: (t2, i2) => i2.every(((i3) => t2.every(((t3) => i3 !== t3)))), regex: (t2, i2) => i2.some(((i3) => t2.some(((t3) => zs(i3, t3))))), not_regex: (t2, i2) => i2.every(((i3) => t2.every(((t3) => !zs(i3, t3))))), icontains: (t2, i2) => i2.map(Bs).some(((i3) => t2.map(Bs).some(((t3) => i3.includes(t3))))), not_icontains: (t2, i2) => i2.map(Bs).every(((i3) => t2.map(Bs).every(((t3) => !i3.includes(t3))))) };
var Bs = (t2) => t2.toLowerCase();
var Hs = z("[Error tracking]");
var Ws = class {
  constructor(t2) {
    var i2, e2;
    this.fe = [], this._instance = t2, this.fe = null !== (i2 = null == (e2 = this._instance.persistence) ? void 0 : e2.get_property(dt)) && void 0 !== i2 ? i2 : [];
  }
  onRemoteConfig(t2) {
    var i2, e2, r2, s2 = null !== (i2 = null == (e2 = t2.errorTracking) ? void 0 : e2.suppressionRules) && void 0 !== i2 ? i2 : [], n2 = null == (r2 = t2.errorTracking) ? void 0 : r2.captureExtensionExceptions;
    this.fe = s2, this._instance.persistence && this._instance.persistence.register({ [dt]: this.fe, [vt]: n2 });
  }
  get pe() {
    var t2, i2 = !!this._instance.get_property(vt), e2 = this._instance.config.error_tracking.captureExtensionExceptions;
    return null !== (t2 = null != e2 ? e2 : i2) && void 0 !== t2 && t2;
  }
  sendExceptionEvent(t2) {
    if (this._e(t2)) Hs.info("Skipping exception capture because a suppression rule matched");
    else {
      if (this.pe || !this.ge(t2)) return this._instance.capture("$exception", t2, { _noTruncate: true, _batchKey: "exceptionEvent" });
      Hs.info("Skipping exception capture because it was thrown by an extension");
    }
  }
  _e(t2) {
    var i2 = t2.$exception_list;
    if (!i2 || !k(i2) || 0 === i2.length) return false;
    var e2 = i2.reduce(((t3, i3) => {
      var { type: e3, value: r2 } = i3;
      return T(e3) && e3.length > 0 && t3.$exception_types.push(e3), T(r2) && r2.length > 0 && t3.$exception_values.push(r2), t3;
    }), { $exception_types: [], $exception_values: [] });
    return this.fe.some(((t3) => {
      var i3 = t3.values.map(((t4) => {
        var i4, r2 = qs[t4.operator], s2 = k(t4.value) ? t4.value : [t4.value], n2 = null !== (i4 = e2[t4.key]) && void 0 !== i4 ? i4 : [];
        return s2.length > 0 && r2(s2, n2);
      }));
      return "OR" === t3.type ? i3.some(Boolean) : i3.every(Boolean);
    }));
  }
  ge(t2) {
    var i2 = t2.$exception_list;
    return !(!i2 || !k(i2)) && i2.flatMap(((t3) => {
      var i3, e2;
      return null !== (i3 = null == (e2 = t3.stacktrace) ? void 0 : e2.frames) && void 0 !== i3 ? i3 : [];
    })).some(((t3) => t3.filename && t3.filename.startsWith("chrome-extension://")));
  }
};
var Gs = "Mobile";
var Js = "iOS";
var Vs = "Android";
var Ks = "Tablet";
var Ys = Vs + " " + Ks;
var Xs = "iPad";
var Qs = "Apple";
var Zs = Qs + " Watch";
var tn = "Safari";
var en = "BlackBerry";
var rn = "Samsung";
var sn = rn + "Browser";
var nn = rn + " Internet";
var on = "Chrome";
var an = on + " OS";
var ln = on + " " + Js;
var un = "Internet Explorer";
var hn = un + " " + Gs;
var dn = "Opera";
var vn = dn + " Mini";
var cn = "Edge";
var fn = "Microsoft " + cn;
var pn = "Firefox";
var _n = pn + " " + Js;
var gn = "Nintendo";
var mn = "PlayStation";
var bn = "Xbox";
var yn = Vs + " " + Gs;
var wn = Gs + " " + tn;
var Sn = "Windows";
var $n = Sn + " Phone";
var xn = "Nokia";
var kn = "Ouya";
var En = "Generic";
var In = En + " " + Gs.toLowerCase();
var Pn = En + " " + Ks.toLowerCase();
var Rn = "Konqueror";
var Tn = "(\\d+(\\.\\d+)?)";
var Cn = new RegExp("Version/" + Tn);
var Mn = new RegExp(bn, "i");
var Fn = new RegExp(mn + " \\w+", "i");
var On = new RegExp(gn + " \\w+", "i");
var An = new RegExp(en + "|PlayBook|BB10", "i");
var Dn = { "NT3.51": "NT 3.11", "NT4.0": "NT 4.0", "5.0": "2000", 5.1: "XP", 5.2: "XP", "6.0": "Vista", 6.1: "7", 6.2: "8", 6.3: "8.1", 6.4: "10", "10.0": "10" };
var jn = (t2, i2) => i2 && m(i2, Qs) || (function(t3) {
  return m(t3, tn) && !m(t3, on) && !m(t3, Vs);
})(t2);
var Ln = function(t2, i2) {
  return i2 = i2 || "", m(t2, " OPR/") && m(t2, "Mini") ? vn : m(t2, " OPR/") ? dn : An.test(t2) ? en : m(t2, "IE" + Gs) || m(t2, "WPDesktop") ? hn : m(t2, sn) ? nn : m(t2, cn) || m(t2, "Edg/") ? fn : m(t2, "FBIOS") ? "Facebook " + Gs : m(t2, "UCWEB") || m(t2, "UCBrowser") ? "UC Browser" : m(t2, "CriOS") ? ln : m(t2, "CrMo") || m(t2, on) ? on : m(t2, Vs) && m(t2, tn) ? yn : m(t2, "FxiOS") ? _n : m(t2.toLowerCase(), Rn.toLowerCase()) ? Rn : jn(t2, i2) ? m(t2, Gs) ? wn : tn : m(t2, pn) ? pn : m(t2, "MSIE") || m(t2, "Trident/") ? un : m(t2, "Gecko") ? pn : "";
};
var Nn = { [hn]: [new RegExp("rv:" + Tn)], [fn]: [new RegExp(cn + "?\\/" + Tn)], [on]: [new RegExp("(" + on + "|CrMo)\\/" + Tn)], [ln]: [new RegExp("CriOS\\/" + Tn)], "UC Browser": [new RegExp("(UCBrowser|UCWEB)\\/" + Tn)], [tn]: [Cn], [wn]: [Cn], [dn]: [new RegExp("(Opera|OPR)\\/" + Tn)], [pn]: [new RegExp(pn + "\\/" + Tn)], [_n]: [new RegExp("FxiOS\\/" + Tn)], [Rn]: [new RegExp("Konqueror[:/]?" + Tn, "i")], [en]: [new RegExp(en + " " + Tn), Cn], [yn]: [new RegExp("android\\s" + Tn, "i")], [nn]: [new RegExp(sn + "\\/" + Tn)], [un]: [new RegExp("(rv:|MSIE )" + Tn)], Mozilla: [new RegExp("rv:" + Tn)] };
var zn = function(t2, i2) {
  var e2 = Ln(t2, i2), r2 = Nn[e2];
  if (R(r2)) return null;
  for (var s2 = 0; s2 < r2.length; s2++) {
    var n2 = r2[s2], o2 = t2.match(n2);
    if (o2) return parseFloat(o2[o2.length - 2]);
  }
  return null;
};
var Un = [[new RegExp(bn + "; " + bn + " (.*?)[);]", "i"), (t2) => [bn, t2 && t2[1] || ""]], [new RegExp(gn, "i"), [gn, ""]], [new RegExp(mn, "i"), [mn, ""]], [An, [en, ""]], [new RegExp(Sn, "i"), (t2, i2) => {
  if (/Phone/.test(i2) || /WPDesktop/.test(i2)) return [$n, ""];
  if (new RegExp(Gs).test(i2) && !/IEMobile\b/.test(i2)) return [Sn + " " + Gs, ""];
  var e2 = /Windows NT ([0-9.]+)/i.exec(i2);
  if (e2 && e2[1]) {
    var r2 = e2[1], s2 = Dn[r2] || "";
    return /arm/i.test(i2) && (s2 = "RT"), [Sn, s2];
  }
  return [Sn, ""];
}], [/((iPhone|iPad|iPod).*?OS (\d+)_(\d+)_?(\d+)?|iPhone)/, (t2) => {
  if (t2 && t2[3]) {
    var i2 = [t2[3], t2[4], t2[5] || "0"];
    return [Js, i2.join(".")];
  }
  return [Js, ""];
}], [/(watch.*\/(\d+\.\d+\.\d+)|watch os,(\d+\.\d+),)/i, (t2) => {
  var i2 = "";
  return t2 && t2.length >= 3 && (i2 = R(t2[2]) ? t2[3] : t2[2]), ["watchOS", i2];
}], [new RegExp("(" + Vs + " (\\d+)\\.(\\d+)\\.?(\\d+)?|" + Vs + ")", "i"), (t2) => {
  if (t2 && t2[2]) {
    var i2 = [t2[2], t2[3], t2[4] || "0"];
    return [Vs, i2.join(".")];
  }
  return [Vs, ""];
}], [/Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i, (t2) => {
  var i2 = ["Mac OS X", ""];
  if (t2 && t2[1]) {
    var e2 = [t2[1], t2[2], t2[3] || "0"];
    i2[1] = e2.join(".");
  }
  return i2;
}], [/Mac/i, ["Mac OS X", ""]], [/CrOS/, [an, ""]], [/Linux|debian/i, ["Linux", ""]]];
var qn = function(t2) {
  return On.test(t2) ? gn : Fn.test(t2) ? mn : Mn.test(t2) ? bn : new RegExp(kn, "i").test(t2) ? kn : new RegExp("(" + $n + "|WPDesktop)", "i").test(t2) ? $n : /iPad/.test(t2) ? Xs : /iPod/.test(t2) ? "iPod Touch" : /iPhone/.test(t2) ? "iPhone" : /(watch)(?: ?os[,/]|\d,\d\/)[\d.]+/i.test(t2) ? Zs : An.test(t2) ? en : /(kobo)\s(ereader|touch)/i.test(t2) ? "Kobo" : new RegExp(xn, "i").test(t2) ? xn : /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i.test(t2) || /(kf[a-z]+)( bui|\)).+silk\//i.test(t2) ? "Kindle Fire" : /(Android|ZTE)/i.test(t2) ? !new RegExp(Gs).test(t2) || /(9138B|TB782B|Nexus [97]|pixel c|HUAWEISHT|BTV|noble nook|smart ultra 6)/i.test(t2) ? /pixel[\daxl ]{1,6}/i.test(t2) && !/pixel c/i.test(t2) || /(huaweimed-al00|tah-|APA|SM-G92|i980|zte|U304AA)/i.test(t2) || /lmy47v/i.test(t2) && !/QTAQZ3/i.test(t2) ? Vs : Ys : Vs : new RegExp("(pda|" + Gs + ")", "i").test(t2) ? In : new RegExp(Ks, "i").test(t2) && !new RegExp(Ks + " pc", "i").test(t2) ? Pn : "";
};
var Bn = "https?://(.*)";
var Hn = ["gclid", "gclsrc", "dclid", "gbraid", "wbraid", "fbclid", "msclkid", "twclid", "li_fat_id", "igshid", "ttclid", "rdt_cid", "epik", "qclid", "sccid", "irclid", "_kx"];
var Wn = K(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gad_source", "mc_cid"], Hn);
var Gn = "<masked>";
var Jn = ["li_fat_id"];
function Vn(t2, i2, e2) {
  if (!o) return {};
  var r2, s2 = i2 ? K([], Hn, e2 || []) : [], n2 = Kn(ki(o.URL, s2, Gn), t2), a2 = (r2 = {}, J(Jn, (function(t3) {
    var i3 = Hi.D(t3);
    r2[t3] = i3 || null;
  })), r2);
  return V(a2, n2);
}
function Kn(t2, i2) {
  var e2 = Wn.concat(i2 || []), r2 = {};
  return J(e2, (function(i3) {
    var e3 = xi(t2, i3);
    r2[i3] = e3 || null;
  })), r2;
}
function Yn(t2) {
  var i2 = (function(t3) {
    return t3 ? 0 === t3.search(Bn + "google.([^/?]*)") ? "google" : 0 === t3.search(Bn + "bing.com") ? "bing" : 0 === t3.search(Bn + "yahoo.com") ? "yahoo" : 0 === t3.search(Bn + "duckduckgo.com") ? "duckduckgo" : null : null;
  })(t2), e2 = "yahoo" != i2 ? "q" : "p", r2 = {};
  if (!M(i2)) {
    r2.$search_engine = i2;
    var s2 = o ? xi(o.referrer, e2) : "";
    s2.length && (r2.ph_keyword = s2);
  }
  return r2;
}
function Xn() {
  return navigator.language || navigator.userLanguage;
}
function Qn() {
  return (null == o ? void 0 : o.referrer) || "$direct";
}
function Zn(t2, i2) {
  var e2 = t2 ? K([], Hn, i2 || []) : [], r2 = null == a ? void 0 : a.href.substring(0, 1e3);
  return { r: Qn().substring(0, 1e3), u: r2 ? ki(r2, e2, Gn) : void 0 };
}
function to(t2) {
  var i2, { r: e2, u: r2 } = t2, s2 = { $referrer: e2, $referring_domain: null == e2 ? void 0 : "$direct" == e2 ? "$direct" : null == (i2 = Si(e2)) ? void 0 : i2.host };
  if (r2) {
    s2.$current_url = r2;
    var n2 = Si(r2);
    s2.$host = null == n2 ? void 0 : n2.host, s2.$pathname = null == n2 ? void 0 : n2.pathname;
    var o2 = Kn(r2);
    V(s2, o2);
  }
  if (e2) {
    var a2 = Yn(e2);
    V(s2, a2);
  }
  return s2;
}
function io() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (t2) {
    return;
  }
}
function eo() {
  try {
    return (/* @__PURE__ */ new Date()).getTimezoneOffset();
  } catch (t2) {
    return;
  }
}
function ro(i2, e2) {
  if (!d) return {};
  var r2, s2, n2, o2 = i2 ? K([], Hn, e2 || []) : [], [l2, u2] = (function(t2) {
    for (var i3 = 0; i3 < Un.length; i3++) {
      var [e3, r3] = Un[i3], s3 = e3.exec(t2), n3 = s3 && (E(r3) ? r3(s3, t2) : r3);
      if (n3) return n3;
    }
    return ["", ""];
  })(d);
  return V(Z({ $os: l2, $os_version: u2, $browser: Ln(d, navigator.vendor), $device: qn(d), $device_type: (s2 = d, n2 = qn(s2), n2 === Xs || n2 === Ys || "Kobo" === n2 || "Kindle Fire" === n2 || n2 === Pn ? Ks : n2 === gn || n2 === bn || n2 === mn || n2 === kn ? "Console" : n2 === Zs ? "Wearable" : n2 ? Gs : "Desktop"), $timezone: io(), $timezone_offset: eo() }), { $current_url: ki(null == a ? void 0 : a.href, o2, Gn), $host: null == a ? void 0 : a.host, $pathname: null == a ? void 0 : a.pathname, $raw_user_agent: d.length > 1e3 ? d.substring(0, 997) + "..." : d, $browser_version: zn(d, navigator.vendor), $browser_language: Xn(), $browser_language_prefix: (r2 = Xn(), "string" == typeof r2 ? r2.split("-")[0] : void 0), $screen_height: null == t ? void 0 : t.screen.height, $screen_width: null == t ? void 0 : t.screen.width, $viewport_height: null == t ? void 0 : t.innerHeight, $viewport_width: null == t ? void 0 : t.innerWidth, $lib: "web", $lib_version: c.LIB_VERSION, $insert_id: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10), $time: Date.now() / 1e3 });
}
var so = z("[FeatureFlags]");
var no = "$active_feature_flags";
var oo = "$override_feature_flags";
var ao = "$feature_flag_payloads";
var lo = "$override_feature_flag_payloads";
var uo = "$feature_flag_request_id";
var ho = (t2) => {
  var i2 = {};
  for (var [e2, r2] of Y(t2 || {})) r2 && (i2[e2] = r2);
  return i2;
};
var vo = (t2) => {
  var i2 = t2.flags;
  return i2 ? (t2.featureFlags = Object.fromEntries(Object.keys(i2).map(((t3) => {
    var e2;
    return [t3, null !== (e2 = i2[t3].variant) && void 0 !== e2 ? e2 : i2[t3].enabled];
  }))), t2.featureFlagPayloads = Object.fromEntries(Object.keys(i2).filter(((t3) => i2[t3].enabled)).filter(((t3) => {
    var e2;
    return null == (e2 = i2[t3].metadata) ? void 0 : e2.payload;
  })).map(((t3) => {
    var e2;
    return [t3, null == (e2 = i2[t3].metadata) ? void 0 : e2.payload];
  })))) : so.warn("Using an older version of the feature flags endpoint. Please upgrade your PostHog server to the latest version"), t2;
};
var co = (function(t2) {
  return t2.FeatureFlags = "feature_flags", t2.Recordings = "recordings", t2;
})({});
var fo = class {
  constructor(t2) {
    this.me = false, this.be = false, this.ye = false, this.we = false, this.Se = false, this.$e = false, this.xe = false, this._instance = t2, this.featureFlagEventHandlers = [];
  }
  flags() {
    if (this._instance.config.__preview_remote_config) this.$e = true;
    else {
      var t2 = !this.ke && (this._instance.config.advanced_disable_feature_flags || this._instance.config.advanced_disable_feature_flags_on_first_load);
      this.Ee({ disableFlags: t2 });
    }
  }
  get hasLoadedFlags() {
    return this.be;
  }
  getFlags() {
    return Object.keys(this.getFlagVariants());
  }
  getFlagsWithDetails() {
    var t2 = this._instance.get_property(Tt), i2 = this._instance.get_property(oo), e2 = this._instance.get_property(lo);
    if (!e2 && !i2) return t2 || {};
    var r2 = V({}, t2 || {}), s2 = [.../* @__PURE__ */ new Set([...Object.keys(e2 || {}), ...Object.keys(i2 || {})])];
    for (var n2 of s2) {
      var o2, a2, l2 = r2[n2], u2 = null == i2 ? void 0 : i2[n2], h2 = R(u2) ? null !== (o2 = null == l2 ? void 0 : l2.enabled) && void 0 !== o2 && o2 : !!u2, d2 = R(u2) ? l2.variant : "string" == typeof u2 ? u2 : void 0, v2 = null == e2 ? void 0 : e2[n2], c2 = B({}, l2, { enabled: h2, variant: h2 ? null != d2 ? d2 : null == l2 ? void 0 : l2.variant : void 0 });
      if (h2 !== (null == l2 ? void 0 : l2.enabled) && (c2.original_enabled = null == l2 ? void 0 : l2.enabled), d2 !== (null == l2 ? void 0 : l2.variant) && (c2.original_variant = null == l2 ? void 0 : l2.variant), v2) c2.metadata = B({}, null == l2 ? void 0 : l2.metadata, { payload: v2, original_payload: null == l2 || null == (a2 = l2.metadata) ? void 0 : a2.payload });
      r2[n2] = c2;
    }
    return this.me || (so.warn(" Overriding feature flag details!", { flagDetails: t2, overriddenPayloads: e2, finalDetails: r2 }), this.me = true), r2;
  }
  getFlagVariants() {
    var t2 = this._instance.get_property(Pt), i2 = this._instance.get_property(oo);
    if (!i2) return t2 || {};
    for (var e2 = V({}, t2), r2 = Object.keys(i2), s2 = 0; s2 < r2.length; s2++) e2[r2[s2]] = i2[r2[s2]];
    return this.me || (so.warn(" Overriding feature flags!", { enabledFlags: t2, overriddenFlags: i2, finalFlags: e2 }), this.me = true), e2;
  }
  getFlagPayloads() {
    var t2 = this._instance.get_property(ao), i2 = this._instance.get_property(lo);
    if (!i2) return t2 || {};
    for (var e2 = V({}, t2 || {}), r2 = Object.keys(i2), s2 = 0; s2 < r2.length; s2++) e2[r2[s2]] = i2[r2[s2]];
    return this.me || (so.warn(" Overriding feature flag payloads!", { flagPayloads: t2, overriddenPayloads: i2, finalPayloads: e2 }), this.me = true), e2;
  }
  reloadFeatureFlags() {
    this.we || this._instance.config.advanced_disable_feature_flags || this.ke || (this.ke = setTimeout((() => {
      this.Ee();
    }), 5));
  }
  Ie() {
    clearTimeout(this.ke), this.ke = void 0;
  }
  ensureFlagsLoaded() {
    this.be || this.ye || this.ke || this.reloadFeatureFlags();
  }
  setAnonymousDistinctId(t2) {
    this.$anon_distinct_id = t2;
  }
  setReloadingPaused(t2) {
    this.we = t2;
  }
  Ee(t2) {
    var i2;
    if (this.Ie(), !this._instance.I()) if (this.ye) this.Se = true;
    else {
      var e2 = { token: this._instance.config.token, distinct_id: this._instance.get_distinct_id(), groups: this._instance.getGroups(), $anon_distinct_id: this.$anon_distinct_id, person_properties: B({}, (null == (i2 = this._instance.persistence) ? void 0 : i2.get_initial_props()) || {}, this._instance.get_property(Ct) || {}), group_properties: this._instance.get_property(Mt) };
      (null != t2 && t2.disableFlags || this._instance.config.advanced_disable_feature_flags) && (e2.disable_flags = true);
      var r2 = this._instance.config.__preview_remote_config, s2 = r2 ? "/flags/?v=2" : "/flags/?v=2&config=true", n2 = this._instance.config.advanced_only_evaluate_survey_feature_flags ? "&only_evaluate_survey_feature_flags=true" : "", o2 = this._instance.requestRouter.endpointFor("api", s2 + n2);
      r2 && (e2.timezone = io()), this.ye = true, this._instance.Pe({ method: "POST", url: o2, data: e2, compression: this._instance.config.disable_compression ? void 0 : _.Base64, timeout: this._instance.config.feature_flag_request_timeout_ms, callback: (t3) => {
        var i3, r3, s3 = true;
        (200 === t3.statusCode && (this.Se || (this.$anon_distinct_id = void 0), s3 = false), this.ye = false, this.$e) || (this.$e = true, this._instance.Re(null !== (r3 = t3.json) && void 0 !== r3 ? r3 : {}));
        if (!e2.disable_flags || this.Se) if (this.xe = !s3, t3.json && null != (i3 = t3.json.quotaLimited) && i3.includes(co.FeatureFlags)) so.warn("You have hit your feature flags quota limit, and will not be able to load feature flags until the quota is reset.  Please visit https://posthog.com/docs/billing/limits-alerts to learn more.");
        else {
          var n3;
          if (!e2.disable_flags) this.receivedFeatureFlags(null !== (n3 = t3.json) && void 0 !== n3 ? n3 : {}, s3);
          this.Se && (this.Se = false, this.Ee());
        }
      } });
    }
  }
  getFeatureFlag(t2, i2) {
    if (void 0 === i2 && (i2 = {}), this.be || this.getFlags() && this.getFlags().length > 0) {
      var e2 = this.getFlagVariants()[t2], r2 = "" + e2, s2 = this._instance.get_property(uo) || void 0, n2 = this._instance.get_property(At) || {};
      if ((i2.send_event || !("send_event" in i2)) && (!(t2 in n2) || !n2[t2].includes(r2))) {
        var o2, a2, l2, u2, h2, d2, v2, c2, f2;
        k(n2[t2]) ? n2[t2].push(r2) : n2[t2] = [r2], null == (o2 = this._instance.persistence) || o2.register({ [At]: n2 });
        var p2 = this.getFeatureFlagDetails(t2), _2 = { $feature_flag: t2, $feature_flag_response: e2, $feature_flag_payload: this.getFeatureFlagPayload(t2) || null, $feature_flag_request_id: s2, $feature_flag_bootstrapped_response: (null == (a2 = this._instance.config.bootstrap) || null == (a2 = a2.featureFlags) ? void 0 : a2[t2]) || null, $feature_flag_bootstrapped_payload: (null == (l2 = this._instance.config.bootstrap) || null == (l2 = l2.featureFlagPayloads) ? void 0 : l2[t2]) || null, $used_bootstrap_value: !this.xe };
        R(null == p2 || null == (u2 = p2.metadata) ? void 0 : u2.version) || (_2.$feature_flag_version = p2.metadata.version);
        var g2, m2 = null !== (h2 = null == p2 || null == (d2 = p2.reason) ? void 0 : d2.description) && void 0 !== h2 ? h2 : null == p2 || null == (v2 = p2.reason) ? void 0 : v2.code;
        if (m2 && (_2.$feature_flag_reason = m2), null != p2 && null != (c2 = p2.metadata) && c2.id && (_2.$feature_flag_id = p2.metadata.id), R(null == p2 ? void 0 : p2.original_variant) && R(null == p2 ? void 0 : p2.original_enabled) || (_2.$feature_flag_original_response = R(p2.original_variant) ? p2.original_enabled : p2.original_variant), null != p2 && null != (f2 = p2.metadata) && f2.original_payload) _2.$feature_flag_original_payload = null == p2 || null == (g2 = p2.metadata) ? void 0 : g2.original_payload;
        this._instance.capture("$feature_flag_called", _2);
      }
      return e2;
    }
    so.warn('getFeatureFlag for key "' + t2 + `" failed. Feature flags didn't load in time.`);
  }
  getFeatureFlagDetails(t2) {
    return this.getFlagsWithDetails()[t2];
  }
  getFeatureFlagPayload(t2) {
    return this.getFlagPayloads()[t2];
  }
  getRemoteConfigPayload(t2, i2) {
    var e2 = this._instance.config.token;
    this._instance.Pe({ method: "POST", url: this._instance.requestRouter.endpointFor("api", "/flags/?v=2&config=true"), data: { distinct_id: this._instance.get_distinct_id(), token: e2 }, compression: this._instance.config.disable_compression ? void 0 : _.Base64, timeout: this._instance.config.feature_flag_request_timeout_ms, callback: (e3) => {
      var r2, s2 = null == (r2 = e3.json) ? void 0 : r2.featureFlagPayloads;
      i2((null == s2 ? void 0 : s2[t2]) || void 0);
    } });
  }
  isFeatureEnabled(t2, i2) {
    if (void 0 === i2 && (i2 = {}), this.be || this.getFlags() && this.getFlags().length > 0) return !!this.getFeatureFlag(t2, i2);
    so.warn('isFeatureEnabled for key "' + t2 + `" failed. Feature flags didn't load in time.`);
  }
  addFeatureFlagsHandler(t2) {
    this.featureFlagEventHandlers.push(t2);
  }
  removeFeatureFlagsHandler(t2) {
    this.featureFlagEventHandlers = this.featureFlagEventHandlers.filter(((i2) => i2 !== t2));
  }
  receivedFeatureFlags(t2, i2) {
    if (this._instance.persistence) {
      this.be = true;
      var e2 = this.getFlagVariants(), r2 = this.getFlagPayloads(), s2 = this.getFlagsWithDetails();
      !(function(t3, i3, e3, r3, s3) {
        void 0 === e3 && (e3 = {}), void 0 === r3 && (r3 = {}), void 0 === s3 && (s3 = {});
        var n2 = vo(t3), o2 = n2.flags, a2 = n2.featureFlags, l2 = n2.featureFlagPayloads;
        if (a2) {
          var u2 = t3.requestId;
          if (k(a2)) {
            so.warn("v1 of the feature flags endpoint is deprecated. Please use the latest version.");
            var h2 = {};
            if (a2) for (var d2 = 0; d2 < a2.length; d2++) h2[a2[d2]] = true;
            i3 && i3.register({ [no]: a2, [Pt]: h2 });
          } else {
            var v2 = a2, c2 = l2, f2 = o2;
            t3.errorsWhileComputingFlags && (v2 = B({}, e3, v2), c2 = B({}, r3, c2), f2 = B({}, s3, f2)), i3 && i3.register(B({ [no]: Object.keys(ho(v2)), [Pt]: v2 || {}, [ao]: c2 || {}, [Tt]: f2 || {} }, u2 ? { [uo]: u2 } : {}));
          }
        }
      })(t2, this._instance.persistence, e2, r2, s2), this.Te(i2);
    }
  }
  override(t2, i2) {
    void 0 === i2 && (i2 = false), so.warn("override is deprecated. Please use overrideFeatureFlags instead."), this.overrideFeatureFlags({ flags: t2, suppressWarning: i2 });
  }
  overrideFeatureFlags(t2) {
    if (!this._instance.__loaded || !this._instance.persistence) return so.uninitializedWarning("posthog.featureFlags.overrideFeatureFlags");
    if (false === t2) return this._instance.persistence.unregister(oo), this._instance.persistence.unregister(lo), void this.Te();
    if (t2 && "object" == typeof t2 && ("flags" in t2 || "payloads" in t2)) {
      var i2, e2 = t2;
      if (this.me = Boolean(null !== (i2 = e2.suppressWarning) && void 0 !== i2 && i2), "flags" in e2) {
        if (false === e2.flags) this._instance.persistence.unregister(oo);
        else if (e2.flags) if (k(e2.flags)) {
          for (var r2 = {}, s2 = 0; s2 < e2.flags.length; s2++) r2[e2.flags[s2]] = true;
          this._instance.persistence.register({ [oo]: r2 });
        } else this._instance.persistence.register({ [oo]: e2.flags });
      }
      return "payloads" in e2 && (false === e2.payloads ? this._instance.persistence.unregister(lo) : e2.payloads && this._instance.persistence.register({ [lo]: e2.payloads })), void this.Te();
    }
    this.Te();
  }
  onFeatureFlags(t2) {
    if (this.addFeatureFlagsHandler(t2), this.be) {
      var { flags: i2, flagVariants: e2 } = this.Ce();
      t2(i2, e2);
    }
    return () => this.removeFeatureFlagsHandler(t2);
  }
  updateEarlyAccessFeatureEnrollment(t2, i2, e2) {
    var r2, s2 = (this._instance.get_property(Rt) || []).find(((i3) => i3.flagKey === t2)), n2 = { ["$feature_enrollment/" + t2]: i2 }, o2 = { $feature_flag: t2, $feature_enrollment: i2, $set: n2 };
    s2 && (o2.$early_access_feature_name = s2.name), e2 && (o2.$feature_enrollment_stage = e2), this._instance.capture("$feature_enrollment_update", o2), this.setPersonPropertiesForFlags(n2, false);
    var a2 = B({}, this.getFlagVariants(), { [t2]: i2 });
    null == (r2 = this._instance.persistence) || r2.register({ [no]: Object.keys(ho(a2)), [Pt]: a2 }), this.Te();
  }
  getEarlyAccessFeatures(t2, i2, e2) {
    void 0 === i2 && (i2 = false);
    var r2 = this._instance.get_property(Rt), s2 = e2 ? "&" + e2.map(((t3) => "stage=" + t3)).join("&") : "";
    if (r2 && !i2) return t2(r2);
    this._instance.Pe({ url: this._instance.requestRouter.endpointFor("api", "/api/early_access_features/?token=" + this._instance.config.token + s2), method: "GET", callback: (i3) => {
      var e3, r3;
      if (i3.json) {
        var s3 = i3.json.earlyAccessFeatures;
        return null == (e3 = this._instance.persistence) || e3.unregister(Rt), null == (r3 = this._instance.persistence) || r3.register({ [Rt]: s3 }), t2(s3);
      }
    } });
  }
  Ce() {
    var t2 = this.getFlags(), i2 = this.getFlagVariants();
    return { flags: t2.filter(((t3) => i2[t3])), flagVariants: Object.keys(i2).filter(((t3) => i2[t3])).reduce(((t3, e2) => (t3[e2] = i2[e2], t3)), {}) };
  }
  Te(t2) {
    var { flags: i2, flagVariants: e2 } = this.Ce();
    this.featureFlagEventHandlers.forEach(((r2) => r2(i2, e2, { errorsLoading: t2 })));
  }
  setPersonPropertiesForFlags(t2, i2) {
    void 0 === i2 && (i2 = true);
    var e2 = this._instance.get_property(Ct) || {};
    this._instance.register({ [Ct]: B({}, e2, t2) }), i2 && this._instance.reloadFeatureFlags();
  }
  resetPersonPropertiesForFlags() {
    this._instance.unregister(Ct);
  }
  setGroupPropertiesForFlags(t2, i2) {
    void 0 === i2 && (i2 = true);
    var e2 = this._instance.get_property(Mt) || {};
    0 !== Object.keys(e2).length && Object.keys(e2).forEach(((i3) => {
      e2[i3] = B({}, e2[i3], t2[i3]), delete t2[i3];
    })), this._instance.register({ [Mt]: B({}, e2, t2) }), i2 && this._instance.reloadFeatureFlags();
  }
  resetGroupPropertiesForFlags(t2) {
    if (t2) {
      var i2 = this._instance.get_property(Mt) || {};
      this._instance.register({ [Mt]: B({}, i2, { [t2]: {} }) });
    } else this._instance.unregister(Mt);
  }
  reset() {
    this.be = false, this.ye = false, this.we = false, this.Se = false, this.$e = false, this.xe = false, this.$anon_distinct_id = void 0, this.Ie(), this.me = false;
  }
};
var po = ["cookie", "localstorage", "localstorage+cookie", "sessionstorage", "memory"];
var _o = class {
  constructor(t2, i2) {
    this.S = t2, this.props = {}, this.Me = false, this.Fe = ((t3) => {
      var i3 = "";
      return t3.token && (i3 = t3.token.replace(/\+/g, "PL").replace(/\//g, "SL").replace(/=/g, "EQ")), t3.persistence_name ? "ph_" + t3.persistence_name : "ph_" + i3 + "_posthog";
    })(t2), this.B = this.Oe(t2), this.load(), t2.debug && N.info("Persistence loaded", t2.persistence, B({}, this.props)), this.update_config(t2, t2, i2), this.save();
  }
  isDisabled() {
    return !!this.Ae;
  }
  Oe(t2) {
    -1 === po.indexOf(t2.persistence.toLowerCase()) && (N.critical("Unknown persistence type " + t2.persistence + "; falling back to localStorage+cookie"), t2.persistence = "localStorage+cookie");
    var i2 = t2.persistence.toLowerCase();
    return "localstorage" === i2 && Gi.O() ? Gi : "localstorage+cookie" === i2 && Vi.O() ? Vi : "sessionstorage" === i2 && Qi.O() ? Qi : "memory" === i2 ? Yi : "cookie" === i2 ? Hi : Vi.O() ? Vi : Hi;
  }
  properties() {
    var t2 = {};
    return J(this.props, (function(i2, e2) {
      if (e2 === Pt && I(i2)) for (var r2 = Object.keys(i2), n2 = 0; n2 < r2.length; n2++) t2["$feature/" + r2[n2]] = i2[r2[n2]];
      else a2 = e2, l2 = false, (M(o2 = Wt) ? l2 : s && o2.indexOf === s ? -1 != o2.indexOf(a2) : (J(o2, (function(t3) {
        if (l2 || (l2 = t3 === a2)) return W;
      })), l2)) || (t2[e2] = i2);
      var o2, a2, l2;
    })), t2;
  }
  load() {
    if (!this.Ae) {
      var t2 = this.B.j(this.Fe);
      t2 && (this.props = V({}, t2));
    }
  }
  save() {
    this.Ae || this.B.L(this.Fe, this.props, this.De, this.je, this.Le, this.S.debug);
  }
  remove() {
    this.B.N(this.Fe, false), this.B.N(this.Fe, true);
  }
  clear() {
    this.remove(), this.props = {};
  }
  register_once(t2, i2, e2) {
    if (I(t2)) {
      R(i2) && (i2 = "None"), this.De = R(e2) ? this.Ne : e2;
      var r2 = false;
      if (J(t2, ((t3, e3) => {
        this.props.hasOwnProperty(e3) && this.props[e3] !== i2 || (this.props[e3] = t3, r2 = true);
      })), r2) return this.save(), true;
    }
    return false;
  }
  register(t2, i2) {
    if (I(t2)) {
      this.De = R(i2) ? this.Ne : i2;
      var e2 = false;
      if (J(t2, ((i3, r2) => {
        t2.hasOwnProperty(r2) && this.props[r2] !== i3 && (this.props[r2] = i3, e2 = true);
      })), e2) return this.save(), true;
    }
    return false;
  }
  unregister(t2) {
    t2 in this.props && (delete this.props[t2], this.save());
  }
  update_campaign_params() {
    if (!this.Me) {
      var t2 = Vn(this.S.custom_campaign_params, this.S.mask_personal_data_properties, this.S.custom_personal_data_properties);
      P(Z(t2)) || this.register(t2), this.Me = true;
    }
  }
  update_search_keyword() {
    var t2;
    this.register((t2 = null == o ? void 0 : o.referrer) ? Yn(t2) : {});
  }
  update_referrer_info() {
    var t2;
    this.register_once({ $referrer: Qn(), $referring_domain: null != o && o.referrer && (null == (t2 = Si(o.referrer)) ? void 0 : t2.host) || "$direct" }, void 0);
  }
  set_initial_person_info() {
    this.props[Nt] || this.props[zt] || this.register_once({ [Ut]: Zn(this.S.mask_personal_data_properties, this.S.custom_personal_data_properties) }, void 0);
  }
  get_initial_props() {
    var t2 = {};
    J([zt, Nt], ((i3) => {
      var e3 = this.props[i3];
      e3 && J(e3, (function(i4, e4) {
        t2["$initial_" + y(e4)] = i4;
      }));
    }));
    var i2, e2, r2 = this.props[Ut];
    if (r2) {
      var s2 = (i2 = to(r2), e2 = {}, J(i2, (function(t3, i3) {
        e2["$initial_" + y(i3)] = t3;
      })), e2);
      V(t2, s2);
    }
    return t2;
  }
  safe_merge(t2) {
    return J(this.props, (function(i2, e2) {
      e2 in t2 || (t2[e2] = i2);
    })), t2;
  }
  update_config(t2, i2, e2) {
    if (this.Ne = this.De = t2.cookie_expiration, this.set_disabled(t2.disable_persistence || !!e2), this.set_cross_subdomain(t2.cross_subdomain_cookie), this.set_secure(t2.secure_cookie), t2.persistence !== i2.persistence) {
      var r2 = this.Oe(t2), s2 = this.props;
      this.clear(), this.B = r2, this.props = s2, this.save();
    }
  }
  set_disabled(t2) {
    this.Ae = t2, this.Ae ? this.remove() : this.save();
  }
  set_cross_subdomain(t2) {
    t2 !== this.je && (this.je = t2, this.remove(), this.save());
  }
  set_secure(t2) {
    t2 !== this.Le && (this.Le = t2, this.remove(), this.save());
  }
  set_event_timer(t2, i2) {
    var e2 = this.props[at] || {};
    e2[t2] = i2, this.props[at] = e2, this.save();
  }
  remove_event_timer(t2) {
    var i2 = (this.props[at] || {})[t2];
    return R(i2) || (delete this.props[at][t2], this.save()), i2;
  }
  get_property(t2) {
    return this.props[t2];
  }
  set_property(t2, i2) {
    this.props[t2] = i2, this.save();
  }
};
var go = class {
  constructor() {
    this.ze = {}, this.ze = {};
  }
  on(t2, i2) {
    return this.ze[t2] || (this.ze[t2] = []), this.ze[t2].push(i2), () => {
      this.ze[t2] = this.ze[t2].filter(((t3) => t3 !== i2));
    };
  }
  emit(t2, i2) {
    for (var e2 of this.ze[t2] || []) e2(i2);
    for (var r2 of this.ze["*"] || []) r2(t2, i2);
  }
};
var mo = class _mo {
  constructor(t2) {
    this.Ue = new go(), this.qe = (t3, i2) => this.Be(t3, i2) && this.He(t3, i2) && this.We(t3, i2), this.Be = (t3, i2) => null == i2 || !i2.event || (null == t3 ? void 0 : t3.event) === (null == i2 ? void 0 : i2.event), this._instance = t2, this.Ge = /* @__PURE__ */ new Set(), this.Je = /* @__PURE__ */ new Set();
  }
  init() {
    var t2;
    if (!R(null == (t2 = this._instance) ? void 0 : t2.Ve)) {
      var i2;
      null == (i2 = this._instance) || i2.Ve(((t3, i3) => {
        this.on(t3, i3);
      }));
    }
  }
  register(t2) {
    var i2, e2;
    if (!R(null == (i2 = this._instance) ? void 0 : i2.Ve) && (t2.forEach(((t3) => {
      var i3, e3;
      null == (i3 = this.Je) || i3.add(t3), null == (e3 = t3.steps) || e3.forEach(((t4) => {
        var i4;
        null == (i4 = this.Ge) || i4.add((null == t4 ? void 0 : t4.event) || "");
      }));
    })), null != (e2 = this._instance) && e2.autocapture)) {
      var r2, s2 = /* @__PURE__ */ new Set();
      t2.forEach(((t3) => {
        var i3;
        null == (i3 = t3.steps) || i3.forEach(((t4) => {
          null != t4 && t4.selector && s2.add(null == t4 ? void 0 : t4.selector);
        }));
      })), null == (r2 = this._instance) || r2.autocapture.setElementSelectors(s2);
    }
  }
  on(t2, i2) {
    var e2;
    null != i2 && 0 != t2.length && (this.Ge.has(t2) || this.Ge.has(null == i2 ? void 0 : i2.event)) && this.Je && (null == (e2 = this.Je) ? void 0 : e2.size) > 0 && this.Je.forEach(((t3) => {
      this.Ke(i2, t3) && this.Ue.emit("actionCaptured", t3.name);
    }));
  }
  Ye(t2) {
    this.onAction("actionCaptured", ((i2) => t2(i2)));
  }
  Ke(t2, i2) {
    if (null == (null == i2 ? void 0 : i2.steps)) return false;
    for (var e2 of i2.steps) if (this.qe(t2, e2)) return true;
    return false;
  }
  onAction(t2, i2) {
    return this.Ue.on(t2, i2);
  }
  He(t2, i2) {
    if (null != i2 && i2.url) {
      var e2, r2 = null == t2 || null == (e2 = t2.properties) ? void 0 : e2.$current_url;
      if (!r2 || "string" != typeof r2) return false;
      if (!_mo.Xe(r2, null == i2 ? void 0 : i2.url, (null == i2 ? void 0 : i2.url_matching) || "contains")) return false;
    }
    return true;
  }
  static Xe(i2, e2, r2) {
    switch (r2) {
      case "regex":
        return !!t && zs(i2, e2);
      case "exact":
        return e2 === i2;
      case "contains":
        var s2 = _mo.Qe(e2).replace(/_/g, ".").replace(/%/g, ".*");
        return zs(i2, s2);
      default:
        return false;
    }
  }
  static Qe(t2) {
    return t2.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
  }
  We(t2, i2) {
    if ((null != i2 && i2.href || null != i2 && i2.tag_name || null != i2 && i2.text) && !this.Ze(t2).some(((t3) => !(null != i2 && i2.href && !_mo.Xe(t3.href || "", null == i2 ? void 0 : i2.href, (null == i2 ? void 0 : i2.href_matching) || "exact")) && ((null == i2 || !i2.tag_name || t3.tag_name === (null == i2 ? void 0 : i2.tag_name)) && !(null != i2 && i2.text && !_mo.Xe(t3.text || "", null == i2 ? void 0 : i2.text, (null == i2 ? void 0 : i2.text_matching) || "exact") && !_mo.Xe(t3.$el_text || "", null == i2 ? void 0 : i2.text, (null == i2 ? void 0 : i2.text_matching) || "exact")))))) return false;
    if (null != i2 && i2.selector) {
      var e2, r2 = null == t2 || null == (e2 = t2.properties) ? void 0 : e2.$element_selectors;
      if (!r2) return false;
      if (!r2.includes(null == i2 ? void 0 : i2.selector)) return false;
    }
    return true;
  }
  Ze(t2) {
    return null == (null == t2 ? void 0 : t2.properties.$elements) ? [] : null == t2 ? void 0 : t2.properties.$elements;
  }
};
var bo = (function(t2) {
  return t2.Button = "button", t2.Tab = "tab", t2.Selector = "selector", t2;
})({});
var yo = (function(t2) {
  return t2.TopLeft = "top_left", t2.TopRight = "top_right", t2.TopCenter = "top_center", t2.MiddleLeft = "middle_left", t2.MiddleRight = "middle_right", t2.MiddleCenter = "middle_center", t2.Left = "left", t2.Center = "center", t2.Right = "right", t2.NextToTrigger = "next_to_trigger", t2;
})({});
var wo = (function(t2) {
  return t2.Popover = "popover", t2.API = "api", t2.Widget = "widget", t2.ExternalSurvey = "external_survey", t2;
})({});
var So = (function(t2) {
  return t2.Open = "open", t2.MultipleChoice = "multiple_choice", t2.SingleChoice = "single_choice", t2.Rating = "rating", t2.Link = "link", t2;
})({});
var $o = (function(t2) {
  return t2.NextQuestion = "next_question", t2.End = "end", t2.ResponseBased = "response_based", t2.SpecificQuestion = "specific_question", t2;
})({});
var xo = (function(t2) {
  return t2.Once = "once", t2.Recurring = "recurring", t2.Always = "always", t2;
})({});
var ko = (function(t2) {
  return t2.SHOWN = "survey shown", t2.DISMISSED = "survey dismissed", t2.SENT = "survey sent", t2;
})({});
var Eo = (function(t2) {
  return t2.SURVEY_ID = "$survey_id", t2.SURVEY_NAME = "$survey_name", t2.SURVEY_RESPONSE = "$survey_response", t2.SURVEY_ITERATION = "$survey_iteration", t2.SURVEY_ITERATION_START_DATE = "$survey_iteration_start_date", t2.SURVEY_PARTIALLY_COMPLETED = "$survey_partially_completed", t2.SURVEY_SUBMISSION_ID = "$survey_submission_id", t2.SURVEY_QUESTIONS = "$survey_questions", t2.SURVEY_COMPLETED = "$survey_completed", t2;
})({});
var Io = z("[Surveys]");
var Po = "seenSurvey_";
var Ro = (t2, i2) => {
  var e2 = "$survey_" + i2 + "/" + t2.id;
  return t2.current_iteration && t2.current_iteration > 0 && (e2 = "$survey_" + i2 + "/" + t2.id + "/" + t2.current_iteration), e2;
};
var To = (t2) => {
  var i2 = "" + Po + t2.id;
  return t2.current_iteration && t2.current_iteration > 0 && (i2 = "" + Po + t2.id + "_" + t2.current_iteration), i2;
};
var Co = [wo.Popover, wo.Widget, wo.API];
var Mo = class {
  constructor(t2) {
    this._instance = t2, this.tr = /* @__PURE__ */ new Map(), this.ir = /* @__PURE__ */ new Map();
  }
  register(t2) {
    var i2;
    R(null == (i2 = this._instance) ? void 0 : i2.Ve) || (this.er(t2), this.rr(t2));
  }
  rr(t2) {
    var i2 = t2.filter(((t3) => {
      var i3, e2;
      return (null == (i3 = t3.conditions) ? void 0 : i3.actions) && (null == (e2 = t3.conditions) || null == (e2 = e2.actions) || null == (e2 = e2.values) ? void 0 : e2.length) > 0;
    }));
    if (0 !== i2.length) {
      if (null == this.sr) {
        this.sr = new mo(this._instance), this.sr.init();
        this.sr.Ye(((t3) => {
          this.onAction(t3);
        }));
      }
      i2.forEach(((t3) => {
        var i3, e2, r2, s2, n2;
        t3.conditions && null != (i3 = t3.conditions) && i3.actions && null != (e2 = t3.conditions) && null != (e2 = e2.actions) && e2.values && (null == (r2 = t3.conditions) || null == (r2 = r2.actions) || null == (r2 = r2.values) ? void 0 : r2.length) > 0 && (null == (s2 = this.sr) || s2.register(t3.conditions.actions.values), null == (n2 = t3.conditions) || null == (n2 = n2.actions) || null == (n2 = n2.values) || n2.forEach(((i4) => {
          if (i4 && i4.name) {
            var e3 = this.ir.get(i4.name);
            e3 && e3.push(t3.id), this.ir.set(i4.name, e3 || [t3.id]);
          }
        })));
      }));
    }
  }
  er(t2) {
    var i2;
    if (0 !== t2.filter(((t3) => {
      var i3, e2;
      return (null == (i3 = t3.conditions) ? void 0 : i3.events) && (null == (e2 = t3.conditions) || null == (e2 = e2.events) || null == (e2 = e2.values) ? void 0 : e2.length) > 0;
    })).length) {
      null == (i2 = this._instance) || i2.Ve(((t3, i3) => {
        this.onEvent(t3, i3);
      })), t2.forEach(((t3) => {
        var i3;
        null == (i3 = t3.conditions) || null == (i3 = i3.events) || null == (i3 = i3.values) || i3.forEach(((i4) => {
          if (i4 && i4.name) {
            var e2 = this.tr.get(i4.name);
            e2 && e2.push(t3.id), this.tr.set(i4.name, e2 || [t3.id]);
          }
        }));
      }));
    }
  }
  onEvent(t2, i2) {
    var e2, r2 = (null == (e2 = this._instance) || null == (e2 = e2.persistence) ? void 0 : e2.props[Ot]) || [];
    if ("survey shown" === t2 && i2 && r2.length > 0) {
      var s2;
      Io.info("survey event matched, removing survey from activated surveys", { event: t2, eventPayload: i2, existingActivatedSurveys: r2 });
      var n2 = null == i2 || null == (s2 = i2.properties) ? void 0 : s2.$survey_id;
      if (n2) {
        var o2 = r2.indexOf(n2);
        o2 >= 0 && (r2.splice(o2, 1), this.nr(r2));
      }
    } else this.tr.has(t2) && (Io.info("survey event matched, updating activated surveys", { event: t2, surveys: this.tr.get(t2) }), this.nr(r2.concat(this.tr.get(t2) || [])));
  }
  onAction(t2) {
    var i2, e2 = (null == (i2 = this._instance) || null == (i2 = i2.persistence) ? void 0 : i2.props[Ot]) || [];
    this.ir.has(t2) && this.nr(e2.concat(this.ir.get(t2) || []));
  }
  nr(t2) {
    var i2;
    null == (i2 = this._instance) || null == (i2 = i2.persistence) || i2.register({ [Ot]: [...new Set(t2)] });
  }
  getSurveys() {
    var t2, i2 = null == (t2 = this._instance) || null == (t2 = t2.persistence) ? void 0 : t2.props[Ot];
    return i2 || [];
  }
  getEventToSurveys() {
    return this.tr;
  }
  ar() {
    return this.sr;
  }
};
var Fo = class {
  constructor(t2) {
    this.lr = void 0, this._surveyManager = null, this.ur = false, this.hr = false, this.dr = [], this._instance = t2, this._surveyEventReceiver = null;
  }
  onRemoteConfig(t2) {
    var i2 = t2.surveys;
    if (F(i2)) return Io.warn("Flags not loaded yet. Not loading surveys.");
    var e2 = k(i2);
    this.lr = e2 ? i2.length > 0 : i2, Io.info("flags response received, isSurveysEnabled: " + this.lr), this.loadIfEnabled();
  }
  reset() {
    localStorage.removeItem("lastSeenSurveyDate");
    for (var t2 = [], i2 = 0; i2 < localStorage.length; i2++) {
      var e2 = localStorage.key(i2);
      (null != e2 && e2.startsWith(Po) || null != e2 && e2.startsWith("inProgressSurvey_")) && t2.push(e2);
    }
    t2.forEach(((t3) => localStorage.removeItem(t3)));
  }
  loadIfEnabled() {
    if (!this._surveyManager) if (this.hr) Io.info("Already initializing surveys, skipping...");
    else if (this._instance.config.disable_surveys) Io.info("Disabled. Not loading surveys.");
    else if (this._instance.config.cookieless_mode) Io.info("Not loading surveys in cookieless mode.");
    else {
      var t2 = null == v ? void 0 : v.__PosthogExtensions__;
      if (t2) {
        if (!R(this.lr) || this._instance.config.advanced_enable_surveys) {
          var i2 = this.lr || this._instance.config.advanced_enable_surveys;
          this.hr = true;
          try {
            var e2 = t2.generateSurveys;
            if (e2) return void this.vr(e2, i2);
            var r2 = t2.loadExternalDependency;
            if (!r2) return void this.cr("PostHog loadExternalDependency extension not found.");
            r2(this._instance, "surveys", ((e3) => {
              e3 || !t2.generateSurveys ? this.cr("Could not load surveys script", e3) : this.vr(t2.generateSurveys, i2);
            }));
          } catch (t3) {
            throw this.cr("Error initializing surveys", t3), t3;
          } finally {
            this.hr = false;
          }
        }
      } else Io.error("PostHog Extensions not found.");
    }
  }
  vr(t2, i2) {
    this._surveyManager = t2(this._instance, i2), this._surveyEventReceiver = new Mo(this._instance), Io.info("Surveys loaded successfully"), this.pr({ isLoaded: true });
  }
  cr(t2, i2) {
    Io.error(t2, i2), this.pr({ isLoaded: false, error: t2 });
  }
  onSurveysLoaded(t2) {
    return this.dr.push(t2), this._surveyManager && this.pr({ isLoaded: true }), () => {
      this.dr = this.dr.filter(((i2) => i2 !== t2));
    };
  }
  getSurveys(t2, i2) {
    if (void 0 === i2 && (i2 = false), this._instance.config.disable_surveys) return Io.info("Disabled. Not loading surveys."), t2([]);
    var e2 = this._instance.get_property(Ft);
    if (e2 && !i2) return t2(e2, { isLoaded: true });
    if (this.ur) return t2([], { isLoaded: false, error: "Surveys are already being loaded" });
    try {
      this.ur = true, this._instance.Pe({ url: this._instance.requestRouter.endpointFor("api", "/api/surveys/?token=" + this._instance.config.token), method: "GET", timeout: this._instance.config.surveys_request_timeout_ms, callback: (i3) => {
        var e3;
        this.ur = false;
        var r2 = i3.statusCode;
        if (200 !== r2 || !i3.json) {
          var s2 = "Surveys API could not be loaded, status: " + r2;
          return Io.error(s2), t2([], { isLoaded: false, error: s2 });
        }
        var n2, o2 = i3.json.surveys || [], a2 = o2.filter(((t3) => (function(t4) {
          return !(!t4.start_date || t4.end_date);
        })(t3) && ((function(t4) {
          var i4;
          return !(null == (i4 = t4.conditions) || null == (i4 = i4.events) || null == (i4 = i4.values) || !i4.length);
        })(t3) || (function(t4) {
          var i4;
          return !(null == (i4 = t4.conditions) || null == (i4 = i4.actions) || null == (i4 = i4.values) || !i4.length);
        })(t3))));
        a2.length > 0 && (null == (n2 = this._surveyEventReceiver) || n2.register(a2));
        return null == (e3 = this._instance.persistence) || e3.register({ [Ft]: o2 }), t2(o2, { isLoaded: true });
      } });
    } catch (t3) {
      throw this.ur = false, t3;
    }
  }
  pr(t2) {
    for (var i2 of this.dr) try {
      if (!t2.isLoaded) return i2([], t2);
      this.getSurveys(i2);
    } catch (t3) {
      Io.error("Error in survey callback", t3);
    }
  }
  getActiveMatchingSurveys(t2, i2) {
    if (void 0 === i2 && (i2 = false), !F(this._surveyManager)) return this._surveyManager.getActiveMatchingSurveys(t2, i2);
    Io.warn("init was not called");
  }
  _r(t2) {
    var i2 = null;
    return this.getSurveys(((e2) => {
      var r2;
      i2 = null !== (r2 = e2.find(((i3) => i3.id === t2))) && void 0 !== r2 ? r2 : null;
    })), i2;
  }
  gr(t2) {
    if (F(this._surveyManager)) return { eligible: false, reason: "SDK is not enabled or survey functionality is not yet loaded" };
    var i2 = "string" == typeof t2 ? this._r(t2) : t2;
    return i2 ? this._surveyManager.checkSurveyEligibility(i2) : { eligible: false, reason: "Survey not found" };
  }
  canRenderSurvey(t2) {
    if (F(this._surveyManager)) return Io.warn("init was not called"), { visible: false, disabledReason: "SDK is not enabled or survey functionality is not yet loaded" };
    var i2 = this.gr(t2);
    return { visible: i2.eligible, disabledReason: i2.reason };
  }
  canRenderSurveyAsync(t2, i2) {
    return F(this._surveyManager) ? (Io.warn("init was not called"), Promise.resolve({ visible: false, disabledReason: "SDK is not enabled or survey functionality is not yet loaded" })) : new Promise(((e2) => {
      this.getSurveys(((i3) => {
        var r2, s2 = null !== (r2 = i3.find(((i4) => i4.id === t2))) && void 0 !== r2 ? r2 : null;
        if (s2) {
          var n2 = this.gr(s2);
          e2({ visible: n2.eligible, disabledReason: n2.reason });
        } else e2({ visible: false, disabledReason: "Survey not found" });
      }), i2);
    }));
  }
  renderSurvey(t2, i2) {
    if (F(this._surveyManager)) Io.warn("init was not called");
    else {
      var e2 = this._r(t2);
      if (e2) if (Co.includes(e2.type)) {
        var r2 = null == o ? void 0 : o.querySelector(i2);
        r2 ? this._surveyManager.renderSurvey(e2, r2) : Io.warn("Survey element not found");
      } else Io.warn("Surveys of type " + e2.type + " cannot be rendered in the app");
      else Io.warn("Survey not found");
    }
  }
};
var Oo = z("[RateLimiter]");
var Ao = class {
  constructor(t2) {
    var i2, e2;
    this.serverLimits = {}, this.lastEventRateLimited = false, this.checkForLimiting = (t3) => {
      var i3 = t3.text;
      if (i3 && i3.length) try {
        (JSON.parse(i3).quota_limited || []).forEach(((t4) => {
          Oo.info((t4 || "events") + " is quota limited."), this.serverLimits[t4] = (/* @__PURE__ */ new Date()).getTime() + 6e4;
        }));
      } catch (t4) {
        return void Oo.warn('could not rate limit - continuing. Error: "' + (null == t4 ? void 0 : t4.message) + '"', { text: i3 });
      }
    }, this.instance = t2, this.captureEventsPerSecond = (null == (i2 = t2.config.rate_limiting) ? void 0 : i2.events_per_second) || 10, this.captureEventsBurstLimit = Math.max((null == (e2 = t2.config.rate_limiting) ? void 0 : e2.events_burst_limit) || 10 * this.captureEventsPerSecond, this.captureEventsPerSecond), this.lastEventRateLimited = this.clientRateLimitContext(true).isRateLimited;
  }
  clientRateLimitContext(t2) {
    var i2, e2, r2;
    void 0 === t2 && (t2 = false);
    var s2 = (/* @__PURE__ */ new Date()).getTime(), n2 = null !== (i2 = null == (e2 = this.instance.persistence) ? void 0 : e2.get_property(Lt)) && void 0 !== i2 ? i2 : { tokens: this.captureEventsBurstLimit, last: s2 };
    n2.tokens += (s2 - n2.last) / 1e3 * this.captureEventsPerSecond, n2.last = s2, n2.tokens > this.captureEventsBurstLimit && (n2.tokens = this.captureEventsBurstLimit);
    var o2 = n2.tokens < 1;
    return o2 || t2 || (n2.tokens = Math.max(0, n2.tokens - 1)), !o2 || this.lastEventRateLimited || t2 || this.instance.capture("$$client_ingestion_warning", { $$client_ingestion_warning_message: "posthog-js client rate limited. Config is set to " + this.captureEventsPerSecond + " events per second and " + this.captureEventsBurstLimit + " events burst limit." }, { skip_client_rate_limiting: true }), this.lastEventRateLimited = o2, null == (r2 = this.instance.persistence) || r2.set_property(Lt, n2), { isRateLimited: o2, remainingTokens: n2.tokens };
  }
  isServerRateLimited(t2) {
    var i2 = this.serverLimits[t2 || "events"] || false;
    return false !== i2 && (/* @__PURE__ */ new Date()).getTime() < i2;
  }
};
var Do = z("[RemoteConfig]");
var jo = class {
  constructor(t2) {
    this._instance = t2;
  }
  get remoteConfig() {
    var t2;
    return null == (t2 = v._POSTHOG_REMOTE_CONFIG) || null == (t2 = t2[this._instance.config.token]) ? void 0 : t2.config;
  }
  mr(t2) {
    var i2, e2;
    null != (i2 = v.__PosthogExtensions__) && i2.loadExternalDependency ? null == (e2 = v.__PosthogExtensions__) || null == e2.loadExternalDependency || e2.loadExternalDependency(this._instance, "remote-config", (() => t2(this.remoteConfig))) : (Do.error("PostHog Extensions not found. Cannot load remote config."), t2());
  }
  br(t2) {
    this._instance.Pe({ method: "GET", url: this._instance.requestRouter.endpointFor("assets", "/array/" + this._instance.config.token + "/config"), callback: (i2) => {
      t2(i2.json);
    } });
  }
  load() {
    try {
      if (this.remoteConfig) return Do.info("Using preloaded remote config", this.remoteConfig), void this.Re(this.remoteConfig);
      if (this._instance.I()) return void Do.warn("Remote config is disabled. Falling back to local config.");
      this.mr(((t2) => {
        if (!t2) return Do.info("No config found after loading remote JS config. Falling back to JSON."), void this.br(((t3) => {
          this.Re(t3);
        }));
        this.Re(t2);
      }));
    } catch (t2) {
      Do.error("Error loading remote config", t2);
    }
  }
  Re(t2) {
    t2 ? this._instance.config.__preview_remote_config ? (this._instance.Re(t2), false !== t2.hasFeatureFlags && this._instance.featureFlags.ensureFlagsLoaded()) : Do.info("__preview_remote_config is disabled. Logging config instead", t2) : Do.error("Failed to fetch remote config from PostHog.");
  }
};
var Lo = 3e3;
var No = class {
  constructor(t2, i2) {
    this.yr = true, this.wr = [], this.Sr = ne((null == i2 ? void 0 : i2.flush_interval_ms) || Lo, 250, 5e3, "flush interval", Lo), this.$r = t2;
  }
  enqueue(t2) {
    this.wr.push(t2), this.kr || this.Er();
  }
  unload() {
    this.Ir();
    var t2 = this.wr.length > 0 ? this.Pr() : {}, i2 = Object.values(t2);
    [...i2.filter(((t3) => 0 === t3.url.indexOf("/e"))), ...i2.filter(((t3) => 0 !== t3.url.indexOf("/e")))].map(((t3) => {
      this.$r(B({}, t3, { transport: "sendBeacon" }));
    }));
  }
  enable() {
    this.yr = false, this.Er();
  }
  Er() {
    var t2 = this;
    this.yr || (this.kr = setTimeout((() => {
      if (this.Ir(), this.wr.length > 0) {
        var i2 = this.Pr(), e2 = function() {
          var e3 = i2[r2], s2 = (/* @__PURE__ */ new Date()).getTime();
          e3.data && k(e3.data) && J(e3.data, ((t3) => {
            t3.offset = Math.abs(t3.timestamp - s2), delete t3.timestamp;
          })), t2.$r(e3);
        };
        for (var r2 in i2) e2();
      }
    }), this.Sr));
  }
  Ir() {
    clearTimeout(this.kr), this.kr = void 0;
  }
  Pr() {
    var t2 = {};
    return J(this.wr, ((i2) => {
      var e2, r2 = i2, s2 = (r2 ? r2.batchKey : null) || r2.url;
      R(t2[s2]) && (t2[s2] = B({}, r2, { data: [] })), null == (e2 = t2[s2].data) || e2.push(r2.data);
    })), this.wr = [], t2;
  }
};
var zo = ["retriesPerformedSoFar"];
var Uo = class {
  constructor(i2) {
    this.Rr = false, this.Tr = 3e3, this.wr = [], this._instance = i2, this.wr = [], this.Cr = true, !R(t) && "onLine" in t.navigator && (this.Cr = t.navigator.onLine, st(t, "online", (() => {
      this.Cr = true, this.se();
    })), st(t, "offline", (() => {
      this.Cr = false;
    })));
  }
  get length() {
    return this.wr.length;
  }
  retriableRequest(t2) {
    var { retriesPerformedSoFar: i2 } = t2, e2 = H(t2, zo);
    O(i2) && i2 > 0 && (e2.url = Ds(e2.url, { retry_count: i2 })), this._instance.Pe(B({}, e2, { callback: (t3) => {
      200 !== t3.statusCode && (t3.statusCode < 400 || t3.statusCode >= 500) && (null != i2 ? i2 : 0) < 10 ? this.Mr(B({ retriesPerformedSoFar: i2 }, e2)) : null == e2.callback || e2.callback(t3);
    } }));
  }
  Mr(t2) {
    var i2 = t2.retriesPerformedSoFar || 0;
    t2.retriesPerformedSoFar = i2 + 1;
    var e2 = (function(t3) {
      var i3 = 3e3 * Math.pow(2, t3), e3 = i3 / 2, r3 = Math.min(18e5, i3), s3 = (Math.random() - 0.5) * (r3 - e3);
      return Math.ceil(r3 + s3);
    })(i2), r2 = Date.now() + e2;
    this.wr.push({ retryAt: r2, requestOptions: t2 });
    var s2 = "Enqueued failed request for retry in " + e2;
    navigator.onLine || (s2 += " (Browser is offline)"), N.warn(s2), this.Rr || (this.Rr = true, this.Fr());
  }
  Fr() {
    this.Or && clearTimeout(this.Or), this.Or = setTimeout((() => {
      this.Cr && this.wr.length > 0 && this.se(), this.Fr();
    }), this.Tr);
  }
  se() {
    var t2 = Date.now(), i2 = [], e2 = this.wr.filter(((e3) => e3.retryAt < t2 || (i2.push(e3), false)));
    if (this.wr = i2, e2.length > 0) for (var { requestOptions: r2 } of e2) this.retriableRequest(r2);
  }
  unload() {
    for (var { requestOptions: t2 } of (this.Or && (clearTimeout(this.Or), this.Or = void 0), this.wr)) try {
      this._instance.Pe(B({}, t2, { transport: "sendBeacon" }));
    } catch (t3) {
      N.error(t3);
    }
    this.wr = [];
  }
};
var qo = class {
  constructor(t2) {
    this.Ar = () => {
      var t3, i2, e2, r2;
      this.Dr || (this.Dr = {});
      var s2 = this.scrollElement(), n2 = this.scrollY(), o2 = s2 ? Math.max(0, s2.scrollHeight - s2.clientHeight) : 0, a2 = n2 + ((null == s2 ? void 0 : s2.clientHeight) || 0), l2 = (null == s2 ? void 0 : s2.scrollHeight) || 0;
      this.Dr.lastScrollY = Math.ceil(n2), this.Dr.maxScrollY = Math.max(n2, null !== (t3 = this.Dr.maxScrollY) && void 0 !== t3 ? t3 : 0), this.Dr.maxScrollHeight = Math.max(o2, null !== (i2 = this.Dr.maxScrollHeight) && void 0 !== i2 ? i2 : 0), this.Dr.lastContentY = a2, this.Dr.maxContentY = Math.max(a2, null !== (e2 = this.Dr.maxContentY) && void 0 !== e2 ? e2 : 0), this.Dr.maxContentHeight = Math.max(l2, null !== (r2 = this.Dr.maxContentHeight) && void 0 !== r2 ? r2 : 0);
    }, this._instance = t2;
  }
  getContext() {
    return this.Dr;
  }
  resetContext() {
    var t2 = this.Dr;
    return setTimeout(this.Ar, 0), t2;
  }
  startMeasuringScrollPosition() {
    st(t, "scroll", this.Ar, { capture: true }), st(t, "scrollend", this.Ar, { capture: true }), st(t, "resize", this.Ar);
  }
  scrollElement() {
    if (!this._instance.config.scroll_root_selector) return null == t ? void 0 : t.document.documentElement;
    var i2 = k(this._instance.config.scroll_root_selector) ? this._instance.config.scroll_root_selector : [this._instance.config.scroll_root_selector];
    for (var e2 of i2) {
      var r2 = null == t ? void 0 : t.document.querySelector(e2);
      if (r2) return r2;
    }
  }
  scrollY() {
    if (this._instance.config.scroll_root_selector) {
      var i2 = this.scrollElement();
      return i2 && i2.scrollTop || 0;
    }
    return t && (t.scrollY || t.pageYOffset || t.document.documentElement.scrollTop) || 0;
  }
  scrollX() {
    if (this._instance.config.scroll_root_selector) {
      var i2 = this.scrollElement();
      return i2 && i2.scrollLeft || 0;
    }
    return t && (t.scrollX || t.pageXOffset || t.document.documentElement.scrollLeft) || 0;
  }
};
var Bo = (t2) => Zn(null == t2 ? void 0 : t2.config.mask_personal_data_properties, null == t2 ? void 0 : t2.config.custom_personal_data_properties);
var Ho = class {
  constructor(t2, i2, e2, r2) {
    this.jr = (t3) => {
      var i3 = this.Lr();
      if (!i3 || i3.sessionId !== t3) {
        var e3 = { sessionId: t3, props: this.Nr(this._instance) };
        this.zr.register({ [jt]: e3 });
      }
    }, this._instance = t2, this.Ur = i2, this.zr = e2, this.Nr = r2 || Bo, this.Ur.onSessionId(this.jr);
  }
  Lr() {
    return this.zr.props[jt];
  }
  getSetOnceProps() {
    var t2, i2 = null == (t2 = this.Lr()) ? void 0 : t2.props;
    return i2 ? "r" in i2 ? to(i2) : { $referring_domain: i2.referringDomain, $pathname: i2.initialPathName, utm_source: i2.utm_source, utm_campaign: i2.utm_campaign, utm_medium: i2.utm_medium, utm_content: i2.utm_content, utm_term: i2.utm_term } : {};
  }
  getSessionProps() {
    var t2 = {};
    return J(Z(this.getSetOnceProps()), ((i2, e2) => {
      "$current_url" === e2 && (e2 = "url"), t2["$session_entry_" + y(e2)] = i2;
    })), t2;
  }
};
var Wo = z("[SessionId]");
var Go = class {
  constructor(t2, i2, e2) {
    var r2;
    if (this.qr = [], this.Br = (t3, i3) => Math.abs(t3 - i3) > this.sessionTimeoutMs, !t2.persistence) throw new Error("SessionIdManager requires a PostHogPersistence instance");
    if ("always" === t2.config.cookieless_mode) throw new Error('SessionIdManager cannot be used with cookieless_mode="always"');
    this.S = t2.config, this.zr = t2.persistence, this.fi = void 0, this.Mt = void 0, this._sessionStartTimestamp = null, this._sessionActivityTimestamp = null, this.Hr = i2 || Ni, this.Wr = e2 || Ni;
    var s2 = this.S.persistence_name || this.S.token, n2 = this.S.session_idle_timeout_seconds || 1800;
    if (this._sessionTimeoutMs = 1e3 * ne(n2, 60, 36e3, "session_idle_timeout_seconds", 1800), t2.register({ $configured_session_timeout_ms: this._sessionTimeoutMs }), this.Gr(), this.Jr = "ph_" + s2 + "_window_id", this.Vr = "ph_" + s2 + "_primary_window_exists", this.Kr()) {
      var o2 = Qi.j(this.Jr), a2 = Qi.j(this.Vr);
      o2 && !a2 ? this.fi = o2 : Qi.N(this.Jr), Qi.L(this.Vr, true);
    }
    if (null != (r2 = this.S.bootstrap) && r2.sessionID) try {
      var l2 = ((t3) => {
        var i3 = t3.replace(/-/g, "");
        if (32 !== i3.length) throw new Error("Not a valid UUID");
        if ("7" !== i3[12]) throw new Error("Not a UUIDv7");
        return parseInt(i3.substring(0, 12), 16);
      })(this.S.bootstrap.sessionID);
      this.Yr(this.S.bootstrap.sessionID, (/* @__PURE__ */ new Date()).getTime(), l2);
    } catch (t3) {
      Wo.error("Invalid sessionID in bootstrap", t3);
    }
    this.Xr();
  }
  get sessionTimeoutMs() {
    return this._sessionTimeoutMs;
  }
  onSessionId(t2) {
    return R(this.qr) && (this.qr = []), this.qr.push(t2), this.Mt && t2(this.Mt, this.fi), () => {
      this.qr = this.qr.filter(((i2) => i2 !== t2));
    };
  }
  Kr() {
    return "memory" !== this.S.persistence && !this.zr.Ae && Qi.O();
  }
  Qr(t2) {
    t2 !== this.fi && (this.fi = t2, this.Kr() && Qi.L(this.Jr, t2));
  }
  Zr() {
    return this.fi ? this.fi : this.Kr() ? Qi.j(this.Jr) : null;
  }
  Yr(t2, i2, e2) {
    t2 === this.Mt && i2 === this._sessionActivityTimestamp && e2 === this._sessionStartTimestamp || (this._sessionStartTimestamp = e2, this._sessionActivityTimestamp = i2, this.Mt = t2, this.zr.register({ [xt]: [i2, t2, e2] }));
  }
  ts() {
    if (this.Mt && this._sessionActivityTimestamp && this._sessionStartTimestamp) return [this._sessionActivityTimestamp, this.Mt, this._sessionStartTimestamp];
    var t2 = this.zr.props[xt];
    return k(t2) && 2 === t2.length && t2.push(t2[0]), t2 || [0, null, 0];
  }
  resetSessionId() {
    this.Yr(null, null, null);
  }
  Xr() {
    st(t, "beforeunload", (() => {
      this.Kr() && Qi.N(this.Vr);
    }), { capture: false });
  }
  checkAndGetSessionAndWindowId(t2, i2) {
    if (void 0 === t2 && (t2 = false), void 0 === i2 && (i2 = null), "always" === this.S.cookieless_mode) throw new Error('checkAndGetSessionAndWindowId should not be called with cookieless_mode="always"');
    var e2 = i2 || (/* @__PURE__ */ new Date()).getTime(), [r2, s2, n2] = this.ts(), o2 = this.Zr(), a2 = O(n2) && n2 > 0 && Math.abs(e2 - n2) > 864e5, l2 = false, u2 = !s2, h2 = !t2 && this.Br(e2, r2);
    u2 || h2 || a2 ? (s2 = this.Hr(), o2 = this.Wr(), Wo.info("new session ID generated", { sessionId: s2, windowId: o2, changeReason: { noSessionId: u2, activityTimeout: h2, sessionPastMaximumLength: a2 } }), n2 = e2, l2 = true) : o2 || (o2 = this.Wr(), l2 = true);
    var d2 = 0 === r2 || !t2 || a2 ? e2 : r2, v2 = 0 === n2 ? (/* @__PURE__ */ new Date()).getTime() : n2;
    return this.Qr(o2), this.Yr(s2, d2, v2), t2 || this.Gr(), l2 && this.qr.forEach(((t3) => t3(s2, o2, l2 ? { noSessionId: u2, activityTimeout: h2, sessionPastMaximumLength: a2 } : void 0))), { sessionId: s2, windowId: o2, sessionStartTimestamp: v2, changeReason: l2 ? { noSessionId: u2, activityTimeout: h2, sessionPastMaximumLength: a2 } : void 0, lastActivityTimestamp: r2 };
  }
  Gr() {
    clearTimeout(this.es), this.es = setTimeout((() => {
      var [t2] = this.ts();
      this.Br((/* @__PURE__ */ new Date()).getTime(), t2) && this.resetSessionId();
    }), 1.1 * this.sessionTimeoutMs);
  }
};
var Jo = ["$set_once", "$set"];
var Vo = z("[SiteApps]");
var Ko = class {
  constructor(t2) {
    this._instance = t2, this.rs = [], this.apps = {};
  }
  get isEnabled() {
    return !!this._instance.config.opt_in_site_apps;
  }
  ss(t2, i2) {
    if (i2) {
      var e2 = this.globalsForEvent(i2);
      this.rs.push(e2), this.rs.length > 1e3 && (this.rs = this.rs.slice(10));
    }
  }
  get siteAppLoaders() {
    var t2;
    return null == (t2 = v._POSTHOG_REMOTE_CONFIG) || null == (t2 = t2[this._instance.config.token]) ? void 0 : t2.siteApps;
  }
  init() {
    if (this.isEnabled) {
      var t2 = this._instance.Ve(this.ss.bind(this));
      this.ns = () => {
        t2(), this.rs = [], this.ns = void 0;
      };
    }
  }
  globalsForEvent(t2) {
    var i2, e2, r2, s2, n2, o2, a2;
    if (!t2) throw new Error("Event payload is required");
    var l2 = {}, u2 = this._instance.get_property("$groups") || [], h2 = this._instance.get_property("$stored_group_properties") || {};
    for (var [d2, v2] of Object.entries(h2)) l2[d2] = { id: u2[d2], type: d2, properties: v2 };
    var { $set_once: c2, $set: f2 } = t2;
    return { event: B({}, H(t2, Jo), { properties: B({}, t2.properties, f2 ? { $set: B({}, null !== (i2 = null == (e2 = t2.properties) ? void 0 : e2.$set) && void 0 !== i2 ? i2 : {}, f2) } : {}, c2 ? { $set_once: B({}, null !== (r2 = null == (s2 = t2.properties) ? void 0 : s2.$set_once) && void 0 !== r2 ? r2 : {}, c2) } : {}), elements_chain: null !== (n2 = null == (o2 = t2.properties) ? void 0 : o2.$elements_chain) && void 0 !== n2 ? n2 : "", distinct_id: null == (a2 = t2.properties) ? void 0 : a2.distinct_id }), person: { properties: this._instance.get_property("$stored_person_properties") }, groups: l2 };
  }
  setupSiteApp(t2) {
    var i2 = this.apps[t2.id], e2 = () => {
      var e3;
      (!i2.errored && this.rs.length && (Vo.info("Processing " + this.rs.length + " events for site app with id " + t2.id), this.rs.forEach(((t3) => null == i2.processEvent ? void 0 : i2.processEvent(t3))), i2.processedBuffer = true), Object.values(this.apps).every(((t3) => t3.processedBuffer || t3.errored))) && (null == (e3 = this.ns) || e3.call(this));
    }, r2 = false, s2 = (s3) => {
      i2.errored = !s3, i2.loaded = true, Vo.info("Site app with id " + t2.id + " " + (s3 ? "loaded" : "errored")), r2 && e2();
    };
    try {
      var { processEvent: n2 } = t2.init({ posthog: this._instance, callback: (t3) => {
        s2(t3);
      } });
      n2 && (i2.processEvent = n2), r2 = true;
    } catch (i3) {
      Vo.error("Error while initializing PostHog app with config id " + t2.id, i3), s2(false);
    }
    if (r2 && i2.loaded) try {
      e2();
    } catch (e3) {
      Vo.error("Error while processing buffered events PostHog app with config id " + t2.id, e3), i2.errored = true;
    }
  }
  os() {
    var t2 = this.siteAppLoaders || [];
    for (var i2 of t2) this.apps[i2.id] = { id: i2.id, loaded: false, errored: false, processedBuffer: false };
    for (var e2 of t2) this.setupSiteApp(e2);
  }
  ls(t2) {
    if (0 !== Object.keys(this.apps).length) {
      var i2 = this.globalsForEvent(t2);
      for (var e2 of Object.values(this.apps)) try {
        null == e2.processEvent || e2.processEvent(i2);
      } catch (i3) {
        Vo.error("Error while processing event " + t2.event + " for site app " + e2.id, i3);
      }
    }
  }
  onRemoteConfig(t2) {
    var i2, e2, r2, s2 = this;
    if (null != (i2 = this.siteAppLoaders) && i2.length) return this.isEnabled ? (this.os(), void this._instance.on("eventCaptured", ((t3) => this.ls(t3)))) : void Vo.error('PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.');
    if (null == (e2 = this.ns) || e2.call(this), null != (r2 = t2.siteApps) && r2.length) if (this.isEnabled) {
      var n2 = function(t3) {
        var i3;
        v["__$$ph_site_app_" + t3] = s2._instance, null == (i3 = v.__PosthogExtensions__) || null == i3.loadSiteApp || i3.loadSiteApp(s2._instance, a2, ((i4) => {
          if (i4) return Vo.error("Error while initializing PostHog app with config id " + t3, i4);
        }));
      };
      for (var { id: o2, url: a2 } of t2.siteApps) n2(o2);
    } else Vo.error('PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.');
  }
};
var Yo = ["amazonbot", "amazonproductbot", "app.hypefactors.com", "applebot", "archive.org_bot", "awariobot", "backlinksextendedbot", "baiduspider", "bingbot", "bingpreview", "chrome-lighthouse", "dataforseobot", "deepscan", "duckduckbot", "facebookexternal", "facebookcatalog", "http://yandex.com/bots", "hubspot", "ia_archiver", "leikibot", "linkedinbot", "meta-externalagent", "mj12bot", "msnbot", "nessus", "petalbot", "pinterest", "prerender", "rogerbot", "screaming frog", "sebot-wa", "sitebulb", "slackbot", "slurp", "trendictionbot", "turnitin", "twitterbot", "vercel-screenshot", "vercelbot", "yahoo! slurp", "yandexbot", "zoombot", "bot.htm", "bot.php", "(bot;", "bot/", "crawler", "ahrefsbot", "ahrefssiteaudit", "semrushbot", "siteauditbot", "splitsignalbot", "gptbot", "oai-searchbot", "chatgpt-user", "perplexitybot", "better uptime bot", "sentryuptimebot", "uptimerobot", "headlesschrome", "cypress", "google-hoteladsverifier", "adsbot-google", "apis-google", "duplexweb-google", "feedfetcher-google", "google favicon", "google web preview", "google-read-aloud", "googlebot", "googleother", "google-cloudvertexbot", "googleweblight", "mediapartners-google", "storebot-google", "google-inspectiontool", "bytespider"];
var Xo = function(t2, i2) {
  if (!t2) return false;
  var e2 = t2.toLowerCase();
  return Yo.concat(i2 || []).some(((t3) => {
    var i3 = t3.toLowerCase();
    return -1 !== e2.indexOf(i3);
  }));
};
var Qo = function(t2, i2) {
  if (!t2) return false;
  var e2 = t2.userAgent;
  if (e2 && Xo(e2, i2)) return true;
  try {
    var r2 = null == t2 ? void 0 : t2.userAgentData;
    if (null != r2 && r2.brands && r2.brands.some(((t3) => Xo(null == t3 ? void 0 : t3.brand, i2)))) return true;
  } catch (t3) {
  }
  return !!t2.webdriver;
};
var Zo = (function(t2) {
  return t2.US = "us", t2.EU = "eu", t2.CUSTOM = "custom", t2;
})({});
var ta = "i.posthog.com";
var ia = class {
  constructor(t2) {
    this.us = {}, this.instance = t2;
  }
  get apiHost() {
    var t2 = this.instance.config.api_host.trim().replace(/\/$/, "");
    return "https://app.posthog.com" === t2 ? "https://us.i.posthog.com" : t2;
  }
  get uiHost() {
    var t2, i2 = null == (t2 = this.instance.config.ui_host) ? void 0 : t2.replace(/\/$/, "");
    return i2 || (i2 = this.apiHost.replace("." + ta, ".posthog.com")), "https://app.posthog.com" === i2 ? "https://us.posthog.com" : i2;
  }
  get region() {
    return this.us[this.apiHost] || (/https:\/\/(app|us|us-assets)(\.i)?\.posthog\.com/i.test(this.apiHost) ? this.us[this.apiHost] = Zo.US : /https:\/\/(eu|eu-assets)(\.i)?\.posthog\.com/i.test(this.apiHost) ? this.us[this.apiHost] = Zo.EU : this.us[this.apiHost] = Zo.CUSTOM), this.us[this.apiHost];
  }
  endpointFor(t2, i2) {
    if (void 0 === i2 && (i2 = ""), i2 && (i2 = "/" === i2[0] ? i2 : "/" + i2), "ui" === t2) return this.uiHost + i2;
    if (this.region === Zo.CUSTOM) return this.apiHost + i2;
    var e2 = ta + i2;
    switch (t2) {
      case "assets":
        return "https://" + this.region + "-assets." + e2;
      case "api":
        return "https://" + this.region + "." + e2;
    }
  }
};
var ea = { icontains: (i2, e2) => !!t && e2.href.toLowerCase().indexOf(i2.toLowerCase()) > -1, not_icontains: (i2, e2) => !!t && -1 === e2.href.toLowerCase().indexOf(i2.toLowerCase()), regex: (i2, e2) => !!t && zs(e2.href, i2), not_regex: (i2, e2) => !!t && !zs(e2.href, i2), exact: (t2, i2) => i2.href === t2, is_not: (t2, i2) => i2.href !== t2 };
var ra = class _ra {
  constructor(t2) {
    var i2 = this;
    this.getWebExperimentsAndEvaluateDisplayLogic = function(t3) {
      void 0 === t3 && (t3 = false), i2.getWebExperiments(((t4) => {
        _ra.hs("retrieved web experiments from the server"), i2.ds = /* @__PURE__ */ new Map(), t4.forEach(((t5) => {
          if (t5.feature_flag_key) {
            var e2;
            if (i2.ds) _ra.hs("setting flag key ", t5.feature_flag_key, " to web experiment ", t5), null == (e2 = i2.ds) || e2.set(t5.feature_flag_key, t5);
            var r2 = i2._instance.getFeatureFlag(t5.feature_flag_key);
            T(r2) && t5.variants[r2] && i2.vs(t5.name, r2, t5.variants[r2].transforms);
          } else if (t5.variants) for (var s2 in t5.variants) {
            var n2 = t5.variants[s2];
            _ra.cs(n2) && i2.vs(t5.name, s2, n2.transforms);
          }
        }));
      }), t3);
    }, this._instance = t2, this._instance.onFeatureFlags(((t3) => {
      this.onFeatureFlags(t3);
    }));
  }
  onFeatureFlags(t2) {
    if (this._is_bot()) _ra.hs("Refusing to render web experiment since the viewer is a likely bot");
    else if (!this._instance.config.disable_web_experiments) {
      if (F(this.ds)) return this.ds = /* @__PURE__ */ new Map(), this.loadIfEnabled(), void this.previewWebExperiment();
      _ra.hs("applying feature flags", t2), t2.forEach(((t3) => {
        var i2;
        if (this.ds && null != (i2 = this.ds) && i2.has(t3)) {
          var e2, r2 = this._instance.getFeatureFlag(t3), s2 = null == (e2 = this.ds) ? void 0 : e2.get(t3);
          r2 && null != s2 && s2.variants[r2] && this.vs(s2.name, r2, s2.variants[r2].transforms);
        }
      }));
    }
  }
  previewWebExperiment() {
    var t2 = _ra.getWindowLocation();
    if (null != t2 && t2.search) {
      var i2 = xi(null == t2 ? void 0 : t2.search, "__experiment_id"), e2 = xi(null == t2 ? void 0 : t2.search, "__experiment_variant");
      i2 && e2 && (_ra.hs("previewing web experiments " + i2 + " && " + e2), this.getWebExperiments(((t3) => {
        this.fs(parseInt(i2), e2, t3);
      }), false, true));
    }
  }
  loadIfEnabled() {
    this._instance.config.disable_web_experiments || this.getWebExperimentsAndEvaluateDisplayLogic();
  }
  getWebExperiments(t2, i2, e2) {
    if (this._instance.config.disable_web_experiments && !e2) return t2([]);
    var r2 = this._instance.get_property("$web_experiments");
    if (r2 && !i2) return t2(r2);
    this._instance.Pe({ url: this._instance.requestRouter.endpointFor("api", "/api/web_experiments/?token=" + this._instance.config.token), method: "GET", callback: (i3) => {
      if (200 !== i3.statusCode || !i3.json) return t2([]);
      var e3 = i3.json.experiments || [];
      return t2(e3);
    } });
  }
  fs(t2, i2, e2) {
    var r2 = e2.filter(((i3) => i3.id === t2));
    r2 && r2.length > 0 && (_ra.hs("Previewing web experiment [" + r2[0].name + "] with variant [" + i2 + "]"), this.vs(r2[0].name, i2, r2[0].variants[i2].transforms));
  }
  static cs(t2) {
    return !F(t2.conditions) && (_ra.ps(t2) && _ra._s(t2));
  }
  static ps(t2) {
    var i2;
    if (F(t2.conditions) || F(null == (i2 = t2.conditions) ? void 0 : i2.url)) return true;
    var e2, r2, s2, n2 = _ra.getWindowLocation();
    return !!n2 && (null == (e2 = t2.conditions) || !e2.url || ea[null !== (r2 = null == (s2 = t2.conditions) ? void 0 : s2.urlMatchType) && void 0 !== r2 ? r2 : "icontains"](t2.conditions.url, n2));
  }
  static getWindowLocation() {
    return null == t ? void 0 : t.location;
  }
  static _s(t2) {
    var i2;
    if (F(t2.conditions) || F(null == (i2 = t2.conditions) ? void 0 : i2.utm)) return true;
    var e2 = Vn();
    if (e2.utm_source) {
      var r2, s2, n2, o2, a2, l2, u2, h2, d2 = null == (r2 = t2.conditions) || null == (r2 = r2.utm) || !r2.utm_campaign || (null == (s2 = t2.conditions) || null == (s2 = s2.utm) ? void 0 : s2.utm_campaign) == e2.utm_campaign, v2 = null == (n2 = t2.conditions) || null == (n2 = n2.utm) || !n2.utm_source || (null == (o2 = t2.conditions) || null == (o2 = o2.utm) ? void 0 : o2.utm_source) == e2.utm_source, c2 = null == (a2 = t2.conditions) || null == (a2 = a2.utm) || !a2.utm_medium || (null == (l2 = t2.conditions) || null == (l2 = l2.utm) ? void 0 : l2.utm_medium) == e2.utm_medium, f2 = null == (u2 = t2.conditions) || null == (u2 = u2.utm) || !u2.utm_term || (null == (h2 = t2.conditions) || null == (h2 = h2.utm) ? void 0 : h2.utm_term) == e2.utm_term;
      return d2 && c2 && f2 && v2;
    }
    return false;
  }
  static hs(t2) {
    for (var i2 = arguments.length, e2 = new Array(i2 > 1 ? i2 - 1 : 0), r2 = 1; r2 < i2; r2++) e2[r2 - 1] = arguments[r2];
    N.info("[WebExperiments] " + t2, e2);
  }
  vs(t2, i2, e2) {
    this._is_bot() ? _ra.hs("Refusing to render web experiment since the viewer is a likely bot") : "control" !== i2 ? e2.forEach(((e3) => {
      if (e3.selector) {
        var r2;
        _ra.hs("applying transform of variant " + i2 + " for experiment " + t2 + " ", e3);
        var s2 = null == (r2 = document) ? void 0 : r2.querySelectorAll(e3.selector);
        null == s2 || s2.forEach(((t3) => {
          var i3 = t3;
          e3.html && (i3.innerHTML = e3.html), e3.css && i3.setAttribute("style", e3.css);
        }));
      }
    })) : _ra.hs("Control variants leave the page unmodified.");
  }
  _is_bot() {
    return n && this._instance ? Qo(n, this._instance.config.custom_blocked_useragents) : void 0;
  }
};
var sa = z("[PostHog ExternalIntegrations]");
var na = { intercom: "intercom-integration", crispChat: "crisp-chat-integration" };
var oa = class {
  constructor(t2) {
    this._instance = t2;
  }
  J(t2, i2) {
    var e2;
    null == (e2 = v.__PosthogExtensions__) || null == e2.loadExternalDependency || e2.loadExternalDependency(this._instance, t2, ((t3) => {
      if (t3) return sa.error("failed to load script", t3);
      i2();
    }));
  }
  startIfEnabledOrStop() {
    var t2 = this, i2 = function(i3) {
      var e3, s3, n2;
      (!r2 || null != (e3 = v.__PosthogExtensions__) && null != (e3 = e3.integrations) && e3[i3] || t2.J(na[i3], (() => {
        var e4;
        null == (e4 = v.__PosthogExtensions__) || null == (e4 = e4.integrations) || null == (e4 = e4[i3]) || e4.start(t2._instance);
      })), !r2 && null != (s3 = v.__PosthogExtensions__) && null != (s3 = s3.integrations) && s3[i3]) && (null == (n2 = v.__PosthogExtensions__) || null == (n2 = n2.integrations) || null == (n2 = n2[i3]) || n2.stop());
    };
    for (var [e2, r2] of Object.entries(null !== (s2 = this._instance.config.integrations) && void 0 !== s2 ? s2 : {})) {
      var s2;
      i2(e2);
    }
  }
};
var aa = {};
var la = () => {
};
var ua = "posthog";
var ha = !Os && -1 === (null == d ? void 0 : d.indexOf("MSIE")) && -1 === (null == d ? void 0 : d.indexOf("Mozilla"));
var da = (i2) => {
  var e2;
  return { api_host: "https://us.i.posthog.com", ui_host: null, token: "", autocapture: true, rageclick: true, cross_subdomain_cookie: et(null == o ? void 0 : o.location), persistence: "localStorage+cookie", persistence_name: "", loaded: la, save_campaign_params: true, custom_campaign_params: [], custom_blocked_useragents: [], save_referrer: true, capture_pageview: "2025-05-24" !== i2 || "history_change", capture_pageleave: "if_capture_pageview", defaults: null != i2 ? i2 : "unset", debug: a && T(null == a ? void 0 : a.search) && -1 !== a.search.indexOf("__posthog_debug=true") || false, cookie_expiration: 365, upgrade: false, disable_session_recording: false, disable_persistence: false, disable_web_experiments: true, disable_surveys: false, disable_surveys_automatic_display: false, disable_external_dependency_loading: false, enable_recording_console_log: void 0, secure_cookie: "https:" === (null == t || null == (e2 = t.location) ? void 0 : e2.protocol), ip: false, opt_out_capturing_by_default: false, opt_out_persistence_by_default: false, opt_out_useragent_filter: false, opt_out_capturing_persistence_type: "localStorage", consent_persistence_name: null, opt_out_capturing_cookie_prefix: null, opt_in_site_apps: false, property_denylist: [], respect_dnt: false, sanitize_properties: null, request_headers: {}, request_batching: true, properties_string_max_length: 65535, session_recording: {}, mask_all_element_attributes: false, mask_all_text: false, mask_personal_data_properties: false, custom_personal_data_properties: [], advanced_disable_flags: false, advanced_disable_decide: false, advanced_disable_feature_flags: false, advanced_disable_feature_flags_on_first_load: false, advanced_only_evaluate_survey_feature_flags: false, advanced_enable_surveys: false, advanced_disable_toolbar_metrics: false, feature_flag_request_timeout_ms: 3e3, surveys_request_timeout_ms: 1e4, on_request_error: (t2) => {
    var i3 = "Bad HTTP status: " + t2.statusCode + " " + t2.text;
    N.error(i3);
  }, get_device_id: (t2) => t2, capture_performance: void 0, name: "posthog", bootstrap: {}, disable_compression: false, session_idle_timeout_seconds: 1800, person_profiles: "identified_only", before_send: void 0, request_queue_config: { flush_interval_ms: Lo }, error_tracking: {}, _onCapture: la };
};
var va = (t2) => {
  var i2 = {};
  R(t2.process_person) || (i2.person_profiles = t2.process_person), R(t2.xhr_headers) || (i2.request_headers = t2.xhr_headers), R(t2.cookie_name) || (i2.persistence_name = t2.cookie_name), R(t2.disable_cookie) || (i2.disable_persistence = t2.disable_cookie), R(t2.store_google) || (i2.save_campaign_params = t2.store_google), R(t2.verbose) || (i2.debug = t2.verbose);
  var e2 = V({}, i2, t2);
  return k(t2.property_blacklist) && (R(t2.property_denylist) ? e2.property_denylist = t2.property_blacklist : k(t2.property_denylist) ? e2.property_denylist = [...t2.property_blacklist, ...t2.property_denylist] : N.error("Invalid value for property_denylist config: " + t2.property_denylist)), e2;
};
var ca = class {
  constructor() {
    this.__forceAllowLocalhost = false;
  }
  get gs() {
    return this.__forceAllowLocalhost;
  }
  set gs(t2) {
    N.error("WebPerformanceObserver is deprecated and has no impact on network capture. Use `_forceAllowLocalhostNetworkCapture` on `posthog.sessionRecording`"), this.__forceAllowLocalhost = t2;
  }
};
var fa = class _fa {
  get decideEndpointWasHit() {
    var t2, i2;
    return null !== (t2 = null == (i2 = this.featureFlags) ? void 0 : i2.hasLoadedFlags) && void 0 !== t2 && t2;
  }
  get flagsEndpointWasHit() {
    var t2, i2;
    return null !== (t2 = null == (i2 = this.featureFlags) ? void 0 : i2.hasLoadedFlags) && void 0 !== t2 && t2;
  }
  constructor() {
    this.webPerformance = new ca(), this.bs = false, this.version = c.LIB_VERSION, this.ys = new go(), this._calculate_event_properties = this.calculateEventProperties.bind(this), this.config = da(), this.SentryIntegration = ms, this.sentryIntegration = (t2) => (function(t3, i2) {
      var e2 = gs(t3, i2);
      return { name: _s, processEvent: (t4) => e2(t4) };
    })(this, t2), this.__request_queue = [], this.__loaded = false, this.analyticsDefaultEndpoint = "/e/", this.ws = false, this.Ss = null, this.$s = null, this.xs = null, this.featureFlags = new fo(this), this.toolbar = new $s(this), this.scrollManager = new qo(this), this.pageViewManager = new Ms(this), this.surveys = new Fo(this), this.experiments = new ra(this), this.exceptions = new Ws(this), this.rateLimiter = new Ao(this), this.requestRouter = new ia(this), this.consent = new te(this), this.externalIntegrations = new oa(this), this.people = { set: (t2, i2, e2) => {
      var r2 = T(t2) ? { [t2]: i2 } : t2;
      this.setPersonProperties(r2), null == e2 || e2({});
    }, set_once: (t2, i2, e2) => {
      var r2 = T(t2) ? { [t2]: i2 } : t2;
      this.setPersonProperties(void 0, r2), null == e2 || e2({});
    } }, this.on("eventCaptured", ((t2) => N.info('send "' + (null == t2 ? void 0 : t2.event) + '"', t2)));
  }
  init(t2, i2, e2) {
    if (e2 && e2 !== ua) {
      var r2, s2 = null !== (r2 = aa[e2]) && void 0 !== r2 ? r2 : new _fa();
      return s2._init(t2, i2, e2), aa[e2] = s2, aa[ua][e2] = s2, s2;
    }
    return this._init(t2, i2, e2);
  }
  _init(i2, e2, r2) {
    var s2, n2;
    if (void 0 === e2 && (e2 = {}), R(i2) || C(i2)) return N.critical("PostHog was initialized without a token. This likely indicates a misconfiguration. Please check the first argument passed to posthog.init()"), this;
    if (this.__loaded) return N.warn("You have already initialized PostHog! Re-initializing is a no-op"), this;
    this.__loaded = true, this.config = {}, this.ks = e2, this.Es = [], e2.person_profiles && (this.$s = e2.person_profiles), this.set_config(V({}, da(e2.defaults), va(e2), { name: r2, token: i2 })), this.config.on_xhr_error && N.error("on_xhr_error is deprecated. Use on_request_error instead"), this.compression = e2.disable_compression ? void 0 : _.GZipJS;
    var o2 = this.Is();
    this.persistence = new _o(this.config, o2), this.sessionPersistence = "sessionStorage" === this.config.persistence || "memory" === this.config.persistence ? this.persistence : new _o(B({}, this.config, { persistence: "sessionStorage" }), o2);
    var a2 = B({}, this.persistence.props), l2 = B({}, this.sessionPersistence.props);
    this.register({ $initialization_time: (/* @__PURE__ */ new Date()).toISOString() }), this.Ps = new No(((t2) => this.Rs(t2)), this.config.request_queue_config), this.Ts = new Uo(this), this.__request_queue = [];
    var u2 = "always" === this.config.cookieless_mode || "on_reject" === this.config.cookieless_mode && this.consent.isExplicitlyOptedOut();
    if (u2 || (this.sessionManager = new Go(this), this.sessionPropsManager = new Ho(this, this.sessionManager, this.persistence)), new ks(this).startIfEnabledOrStop(), this.siteApps = new Ko(this), null == (s2 = this.siteApps) || s2.init(), u2 || (this.sessionRecording = new cs(this), this.sessionRecording.startIfEnabledOrStop()), this.config.disable_scroll_properties || this.scrollManager.startMeasuringScrollPosition(), this.autocapture = new Mi(this), this.autocapture.startIfEnabled(), this.surveys.loadIfEnabled(), this.heatmaps = new Cs(this), this.heatmaps.startIfEnabled(), this.webVitalsAutocapture = new Ps(this), this.exceptionObserver = new le(this), this.exceptionObserver.startIfEnabled(), this.deadClicksAutocapture = new se(this, re), this.deadClicksAutocapture.startIfEnabled(), this.historyAutocapture = new ze(this), this.historyAutocapture.startIfEnabled(), c.DEBUG = c.DEBUG || this.config.debug, c.DEBUG && N.info("Starting in debug mode", { this: this, config: e2, thisC: B({}, this.config), p: a2, s: l2 }), void 0 !== (null == (n2 = e2.bootstrap) ? void 0 : n2.distinctID)) {
      var h2, d2, v2 = this.config.get_device_id(Ni()), f2 = null != (h2 = e2.bootstrap) && h2.isIdentifiedID ? v2 : e2.bootstrap.distinctID;
      this.persistence.set_property(Dt, null != (d2 = e2.bootstrap) && d2.isIdentifiedID ? "identified" : "anonymous"), this.register({ distinct_id: e2.bootstrap.distinctID, $device_id: f2 });
    }
    if (this.Cs()) {
      var p2, g2, m2 = Object.keys((null == (p2 = e2.bootstrap) ? void 0 : p2.featureFlags) || {}).filter(((t2) => {
        var i3;
        return !(null == (i3 = e2.bootstrap) || null == (i3 = i3.featureFlags) || !i3[t2]);
      })).reduce(((t2, i3) => {
        var r3;
        return t2[i3] = (null == (r3 = e2.bootstrap) || null == (r3 = r3.featureFlags) ? void 0 : r3[i3]) || false, t2;
      }), {}), b2 = Object.keys((null == (g2 = e2.bootstrap) ? void 0 : g2.featureFlagPayloads) || {}).filter(((t2) => m2[t2])).reduce(((t2, i3) => {
        var r3, s3;
        null != (r3 = e2.bootstrap) && null != (r3 = r3.featureFlagPayloads) && r3[i3] && (t2[i3] = null == (s3 = e2.bootstrap) || null == (s3 = s3.featureFlagPayloads) ? void 0 : s3[i3]);
        return t2;
      }), {});
      this.featureFlags.receivedFeatureFlags({ featureFlags: m2, featureFlagPayloads: b2 });
    }
    if (u2) this.register_once({ distinct_id: Ht, $device_id: null }, "");
    else if (!this.get_distinct_id()) {
      var y2 = this.config.get_device_id(Ni());
      this.register_once({ distinct_id: y2, $device_id: y2 }, ""), this.persistence.set_property(Dt, "anonymous");
    }
    return st(t, "onpagehide" in self ? "pagehide" : "unload", this._handle_unload.bind(this), { passive: false }), this.toolbar.maybeLoadToolbar(), e2.segment ? ps(this, (() => this.Ms())) : this.Ms(), E(this.config._onCapture) && this.config._onCapture !== la && (N.warn("onCapture is deprecated. Please use `before_send` instead"), this.on("eventCaptured", ((t2) => this.config._onCapture(t2.event, t2)))), this.config.ip && N.warn('The `ip` config option has NO EFFECT AT ALL and has been deprecated. Use a custom transformation or "Discard IP data" project setting instead. See https://posthog.com/tutorials/web-redact-properties#hiding-customer-ip-address for more information.'), this;
  }
  Re(t2) {
    var i2, e2, r2, s2, n2, a2, l2, u2;
    if (!o || !o.body) return N.info("document not ready yet, trying again in 500 milliseconds..."), void setTimeout((() => {
      this.Re(t2);
    }), 500);
    this.compression = void 0, t2.supportedCompression && !this.config.disable_compression && (this.compression = m(t2.supportedCompression, _.GZipJS) ? _.GZipJS : m(t2.supportedCompression, _.Base64) ? _.Base64 : void 0), null != (i2 = t2.analytics) && i2.endpoint && (this.analyticsDefaultEndpoint = t2.analytics.endpoint), this.set_config({ person_profiles: this.$s ? this.$s : "identified_only" }), null == (e2 = this.siteApps) || e2.onRemoteConfig(t2), null == (r2 = this.sessionRecording) || r2.onRemoteConfig(t2), null == (s2 = this.autocapture) || s2.onRemoteConfig(t2), null == (n2 = this.heatmaps) || n2.onRemoteConfig(t2), this.surveys.onRemoteConfig(t2), null == (a2 = this.webVitalsAutocapture) || a2.onRemoteConfig(t2), null == (l2 = this.exceptionObserver) || l2.onRemoteConfig(t2), this.exceptions.onRemoteConfig(t2), null == (u2 = this.deadClicksAutocapture) || u2.onRemoteConfig(t2);
  }
  Ms() {
    try {
      this.config.loaded(this);
    } catch (t2) {
      N.critical("`loaded` function failed", t2);
    }
    this.Fs(), this.config.capture_pageview && setTimeout((() => {
      this.consent.isOptedIn() && this.Os();
    }), 1), new jo(this).load(), this.featureFlags.flags();
  }
  Fs() {
    var t2;
    this.is_capturing() && (this.config.request_batching && (null == (t2 = this.Ps) || t2.enable()));
  }
  _dom_loaded() {
    this.is_capturing() && G(this.__request_queue, ((t2) => this.Rs(t2))), this.__request_queue = [], this.Fs();
  }
  _handle_unload() {
    var t2, i2;
    this.config.request_batching ? (this.As() && this.capture("$pageleave"), null == (t2 = this.Ps) || t2.unload(), null == (i2 = this.Ts) || i2.unload()) : this.As() && this.capture("$pageleave", null, { transport: "sendBeacon" });
  }
  Pe(t2) {
    this.__loaded && (ha ? this.__request_queue.push(t2) : this.rateLimiter.isServerRateLimited(t2.batchKey) || (t2.transport = t2.transport || this.config.api_transport, t2.url = Ds(t2.url, { ip: this.config.ip ? 1 : 0 }), t2.headers = B({}, this.config.request_headers), t2.compression = "best-available" === t2.compression ? this.compression : t2.compression, t2.fetchOptions = t2.fetchOptions || this.config.fetch_options, ((t3) => {
      var i2, e2, r2, s2 = B({}, t3);
      s2.timeout = s2.timeout || 6e4, s2.url = Ds(s2.url, { _: (/* @__PURE__ */ new Date()).getTime().toString(), ver: c.LIB_VERSION, compression: s2.compression });
      var n2 = null !== (i2 = s2.transport) && void 0 !== i2 ? i2 : "fetch", o2 = null !== (e2 = null == (r2 = rt(Ns, ((t4) => t4.transport === n2))) ? void 0 : r2.method) && void 0 !== e2 ? e2 : Ns[0].method;
      if (!o2) throw new Error("No available transport method");
      o2(s2);
    })(B({}, t2, { callback: (i2) => {
      var e2, r2;
      (this.rateLimiter.checkForLimiting(i2), i2.statusCode >= 400) && (null == (e2 = (r2 = this.config).on_request_error) || e2.call(r2, i2));
      null == t2.callback || t2.callback(i2);
    } }))));
  }
  Rs(t2) {
    this.Ts ? this.Ts.retriableRequest(t2) : this.Pe(t2);
  }
  _execute_array(t2) {
    var i2, e2 = [], r2 = [], s2 = [];
    G(t2, ((t3) => {
      t3 && (i2 = t3[0], k(i2) ? s2.push(t3) : E(t3) ? t3.call(this) : k(t3) && "alias" === i2 ? e2.push(t3) : k(t3) && -1 !== i2.indexOf("capture") && E(this[i2]) ? s2.push(t3) : r2.push(t3));
    }));
    var n2 = function(t3, i3) {
      G(t3, (function(t4) {
        if (k(t4[0])) {
          var e3 = i3;
          J(t4, (function(t5) {
            e3 = e3[t5[0]].apply(e3, t5.slice(1));
          }));
        } else this[t4[0]].apply(this, t4.slice(1));
      }), i3);
    };
    n2(e2, this), n2(r2, this), n2(s2, this);
  }
  Cs() {
    var t2, i2;
    return (null == (t2 = this.config.bootstrap) ? void 0 : t2.featureFlags) && Object.keys(null == (i2 = this.config.bootstrap) ? void 0 : i2.featureFlags).length > 0 || false;
  }
  push(t2) {
    this._execute_array([t2]);
  }
  capture(t2, i2, e2) {
    var r2;
    if (this.__loaded && this.persistence && this.sessionPersistence && this.Ps) {
      if (this.is_capturing()) if (!R(t2) && T(t2)) {
        if (this.config.opt_out_useragent_filter || !this._is_bot()) {
          var s2 = null != e2 && e2.skip_client_rate_limiting ? void 0 : this.rateLimiter.clientRateLimitContext();
          if (null == s2 || !s2.isRateLimited) {
            null != i2 && i2.$current_url && !T(null == i2 ? void 0 : i2.$current_url) && (N.error("Invalid `$current_url` property provided to `posthog.capture`. Input must be a string. Ignoring provided value."), null == i2 || delete i2.$current_url), this.sessionPersistence.update_search_keyword(), this.config.save_campaign_params && this.sessionPersistence.update_campaign_params(), this.config.save_referrer && this.sessionPersistence.update_referrer_info(), (this.config.save_campaign_params || this.config.save_referrer) && this.persistence.set_initial_person_info();
            var n2 = /* @__PURE__ */ new Date(), o2 = (null == e2 ? void 0 : e2.timestamp) || n2, a2 = Ni(), l2 = { uuid: a2, event: t2, properties: this.calculateEventProperties(t2, i2 || {}, o2, a2) };
            s2 && (l2.properties.$lib_rate_limit_remaining_tokens = s2.remainingTokens), (null == e2 ? void 0 : e2.$set) && (l2.$set = null == e2 ? void 0 : e2.$set);
            var u2, h2 = this.Ds(null == e2 ? void 0 : e2.$set_once);
            if (h2 && (l2.$set_once = h2), (l2 = tt(l2, null != e2 && e2._noTruncate ? null : this.config.properties_string_max_length)).timestamp = o2, R(null == e2 ? void 0 : e2.timestamp) || (l2.properties.$event_time_override_provided = true, l2.properties.$event_time_override_system_time = n2), t2 === ko.DISMISSED || t2 === ko.SENT) {
              var d2 = null == i2 ? void 0 : i2[Eo.SURVEY_ID], v2 = null == i2 ? void 0 : i2[Eo.SURVEY_ITERATION];
              u2 = { id: d2, current_iteration: v2 }, localStorage.getItem(To(u2)) || localStorage.setItem(To(u2), "true"), l2.$set = B({}, l2.$set, { [Ro({ id: d2, current_iteration: v2 }, t2 === ko.SENT ? "responded" : "dismissed")]: true });
            }
            var c2 = B({}, l2.properties.$set, l2.$set);
            if (P(c2) || this.setPersonPropertiesForFlags(c2), !F(this.config.before_send)) {
              var f2 = this.js(l2);
              if (!f2) return;
              l2 = f2;
            }
            this.ys.emit("eventCaptured", l2);
            var p2 = { method: "POST", url: null !== (r2 = null == e2 ? void 0 : e2._url) && void 0 !== r2 ? r2 : this.requestRouter.endpointFor("api", this.analyticsDefaultEndpoint), data: l2, compression: "best-available", batchKey: null == e2 ? void 0 : e2._batchKey };
            return !this.config.request_batching || e2 && (null == e2 || !e2._batchKey) || null != e2 && e2.send_instantly ? this.Rs(p2) : this.Ps.enqueue(p2), l2;
          }
          N.critical("This capture call is ignored due to client rate limiting.");
        }
      } else N.error("No event name provided to posthog.capture");
    } else N.uninitializedWarning("posthog.capture");
  }
  Ve(t2) {
    return this.on("eventCaptured", ((i2) => t2(i2.event, i2)));
  }
  calculateEventProperties(t2, i2, e2, r2, s2) {
    if (e2 = e2 || /* @__PURE__ */ new Date(), !this.persistence || !this.sessionPersistence) return i2;
    var n2 = s2 ? void 0 : this.persistence.remove_event_timer(t2), a2 = B({}, i2);
    if (a2.token = this.config.token, a2.$config_defaults = this.config.defaults, ("always" == this.config.cookieless_mode || "on_reject" == this.config.cookieless_mode && this.consent.isExplicitlyOptedOut()) && (a2.$cookieless_mode = true), "$snapshot" === t2) {
      var l2 = B({}, this.persistence.properties(), this.sessionPersistence.properties());
      return a2.distinct_id = l2.distinct_id, (!T(a2.distinct_id) && !O(a2.distinct_id) || C(a2.distinct_id)) && N.error("Invalid distinct_id for replay event. This indicates a bug in your implementation"), a2;
    }
    var u2, h2 = ro(this.config.mask_personal_data_properties, this.config.custom_personal_data_properties);
    if (this.sessionManager) {
      var { sessionId: v2, windowId: c2 } = this.sessionManager.checkAndGetSessionAndWindowId(s2, e2.getTime());
      a2.$session_id = v2, a2.$window_id = c2;
    }
    this.sessionPropsManager && V(a2, this.sessionPropsManager.getSessionProps());
    try {
      var f2;
      this.sessionRecording && V(a2, this.sessionRecording.sdkDebugProperties), a2.$sdk_debug_retry_queue_size = null == (f2 = this.Ts) ? void 0 : f2.length;
    } catch (t3) {
      a2.$sdk_debug_error_capturing_properties = String(t3);
    }
    if (this.requestRouter.region === Zo.CUSTOM && (a2.$lib_custom_api_host = this.config.api_host), u2 = "$pageview" !== t2 || s2 ? "$pageleave" !== t2 || s2 ? this.pageViewManager.doEvent() : this.pageViewManager.doPageLeave(e2) : this.pageViewManager.doPageView(e2, r2), a2 = V(a2, u2), "$pageview" === t2 && o && (a2.title = o.title), !R(n2)) {
      var p2 = e2.getTime() - n2;
      a2.$duration = parseFloat((p2 / 1e3).toFixed(3));
    }
    d && this.config.opt_out_useragent_filter && (a2.$browser_type = this._is_bot() ? "bot" : "browser"), (a2 = V({}, h2, this.persistence.properties(), this.sessionPersistence.properties(), a2)).$is_identified = this._isIdentified(), k(this.config.property_denylist) ? J(this.config.property_denylist, (function(t3) {
      delete a2[t3];
    })) : N.error("Invalid value for property_denylist config: " + this.config.property_denylist + " or property_blacklist config: " + this.config.property_blacklist);
    var _2 = this.config.sanitize_properties;
    _2 && (N.error("sanitize_properties is deprecated. Use before_send instead"), a2 = _2(a2, t2));
    var g2 = this.Ls();
    return a2.$process_person_profile = g2, g2 && !s2 && this.Ns("_calculate_event_properties"), a2;
  }
  Ds(t2) {
    var i2;
    if (!this.persistence || !this.Ls()) return t2;
    if (this.bs) return t2;
    var e2 = this.persistence.get_initial_props(), r2 = null == (i2 = this.sessionPropsManager) ? void 0 : i2.getSetOnceProps(), s2 = V({}, e2, r2 || {}, t2 || {}), n2 = this.config.sanitize_properties;
    return n2 && (N.error("sanitize_properties is deprecated. Use before_send instead"), s2 = n2(s2, "$set_once")), this.bs = true, P(s2) ? void 0 : s2;
  }
  register(t2, i2) {
    var e2;
    null == (e2 = this.persistence) || e2.register(t2, i2);
  }
  register_once(t2, i2, e2) {
    var r2;
    null == (r2 = this.persistence) || r2.register_once(t2, i2, e2);
  }
  register_for_session(t2) {
    var i2;
    null == (i2 = this.sessionPersistence) || i2.register(t2);
  }
  unregister(t2) {
    var i2;
    null == (i2 = this.persistence) || i2.unregister(t2);
  }
  unregister_for_session(t2) {
    var i2;
    null == (i2 = this.sessionPersistence) || i2.unregister(t2);
  }
  zs(t2, i2) {
    this.register({ [t2]: i2 });
  }
  getFeatureFlag(t2, i2) {
    return this.featureFlags.getFeatureFlag(t2, i2);
  }
  getFeatureFlagPayload(t2) {
    var i2 = this.featureFlags.getFeatureFlagPayload(t2);
    try {
      return JSON.parse(i2);
    } catch (t3) {
      return i2;
    }
  }
  isFeatureEnabled(t2, i2) {
    return this.featureFlags.isFeatureEnabled(t2, i2);
  }
  reloadFeatureFlags() {
    this.featureFlags.reloadFeatureFlags();
  }
  updateEarlyAccessFeatureEnrollment(t2, i2, e2) {
    this.featureFlags.updateEarlyAccessFeatureEnrollment(t2, i2, e2);
  }
  getEarlyAccessFeatures(t2, i2, e2) {
    return void 0 === i2 && (i2 = false), this.featureFlags.getEarlyAccessFeatures(t2, i2, e2);
  }
  on(t2, i2) {
    return this.ys.on(t2, i2);
  }
  onFeatureFlags(t2) {
    return this.featureFlags.onFeatureFlags(t2);
  }
  onSurveysLoaded(t2) {
    return this.surveys.onSurveysLoaded(t2);
  }
  onSessionId(t2) {
    var i2, e2;
    return null !== (i2 = null == (e2 = this.sessionManager) ? void 0 : e2.onSessionId(t2)) && void 0 !== i2 ? i2 : () => {
    };
  }
  getSurveys(t2, i2) {
    void 0 === i2 && (i2 = false), this.surveys.getSurveys(t2, i2);
  }
  getActiveMatchingSurveys(t2, i2) {
    void 0 === i2 && (i2 = false), this.surveys.getActiveMatchingSurveys(t2, i2);
  }
  renderSurvey(t2, i2) {
    this.surveys.renderSurvey(t2, i2);
  }
  canRenderSurvey(t2) {
    return this.surveys.canRenderSurvey(t2);
  }
  canRenderSurveyAsync(t2, i2) {
    return void 0 === i2 && (i2 = false), this.surveys.canRenderSurveyAsync(t2, i2);
  }
  identify(t2, i2, e2) {
    if (!this.__loaded || !this.persistence) return N.uninitializedWarning("posthog.identify");
    if (O(t2) && (t2 = t2.toString(), N.warn("The first argument to posthog.identify was a number, but it should be a string. It has been converted to a string.")), t2) if (["distinct_id", "distinctid"].includes(t2.toLowerCase())) N.critical('The string "' + t2 + '" was set in posthog.identify which indicates an error. This ID should be unique to the user and not a hardcoded string.');
    else if (t2 !== Ht) {
      if (this.Ns("posthog.identify")) {
        var r2 = this.get_distinct_id();
        if (this.register({ $user_id: t2 }), !this.get_property("$device_id")) {
          var s2 = r2;
          this.register_once({ $had_persisted_distinct_id: true, $device_id: s2 }, "");
        }
        t2 !== r2 && t2 !== this.get_property(ot) && (this.unregister(ot), this.register({ distinct_id: t2 }));
        var n2 = "anonymous" === (this.persistence.get_property(Dt) || "anonymous");
        t2 !== r2 && n2 ? (this.persistence.set_property(Dt, "identified"), this.setPersonPropertiesForFlags(B({}, e2 || {}, i2 || {}), false), this.capture("$identify", { distinct_id: t2, $anon_distinct_id: r2 }, { $set: i2 || {}, $set_once: e2 || {} }), this.xs = Us(t2, i2, e2), this.featureFlags.setAnonymousDistinctId(r2)) : (i2 || e2) && this.setPersonProperties(i2, e2), t2 !== r2 && (this.reloadFeatureFlags(), this.unregister(At));
      }
    } else N.critical('The string "' + Ht + '" was set in posthog.identify which indicates an error. This ID is only used as a sentinel value.');
    else N.error("Unique user id has not been set in posthog.identify");
  }
  setPersonProperties(t2, i2) {
    if ((t2 || i2) && this.Ns("posthog.setPersonProperties")) {
      var e2 = Us(this.get_distinct_id(), t2, i2);
      this.xs !== e2 ? (this.setPersonPropertiesForFlags(B({}, i2 || {}, t2 || {})), this.capture("$set", { $set: t2 || {}, $set_once: i2 || {} }), this.xs = e2) : N.info("A duplicate setPersonProperties call was made with the same properties. It has been ignored.");
    }
  }
  group(t2, i2, e2) {
    if (t2 && i2) {
      if (this.Ns("posthog.group")) {
        var r2 = this.getGroups();
        r2[t2] !== i2 && this.resetGroupPropertiesForFlags(t2), this.register({ $groups: B({}, r2, { [t2]: i2 }) }), e2 && (this.capture("$groupidentify", { $group_type: t2, $group_key: i2, $group_set: e2 }), this.setGroupPropertiesForFlags({ [t2]: e2 })), r2[t2] === i2 || e2 || this.reloadFeatureFlags();
      }
    } else N.error("posthog.group requires a group type and group key");
  }
  resetGroups() {
    this.register({ $groups: {} }), this.resetGroupPropertiesForFlags(), this.reloadFeatureFlags();
  }
  setPersonPropertiesForFlags(t2, i2) {
    void 0 === i2 && (i2 = true), this.featureFlags.setPersonPropertiesForFlags(t2, i2);
  }
  resetPersonPropertiesForFlags() {
    this.featureFlags.resetPersonPropertiesForFlags();
  }
  setGroupPropertiesForFlags(t2, i2) {
    void 0 === i2 && (i2 = true), this.Ns("posthog.setGroupPropertiesForFlags") && this.featureFlags.setGroupPropertiesForFlags(t2, i2);
  }
  resetGroupPropertiesForFlags(t2) {
    this.featureFlags.resetGroupPropertiesForFlags(t2);
  }
  reset(t2) {
    var i2, e2, r2, s2;
    if (N.info("reset"), !this.__loaded) return N.uninitializedWarning("posthog.reset");
    var n2 = this.get_property("$device_id");
    if (this.consent.reset(), null == (i2 = this.persistence) || i2.clear(), null == (e2 = this.sessionPersistence) || e2.clear(), this.surveys.reset(), this.featureFlags.reset(), null == (r2 = this.persistence) || r2.set_property(Dt, "anonymous"), null == (s2 = this.sessionManager) || s2.resetSessionId(), this.xs = null, "always" === this.config.cookieless_mode) this.register_once({ distinct_id: Ht, $device_id: null }, "");
    else {
      var o2 = this.config.get_device_id(Ni());
      this.register_once({ distinct_id: o2, $device_id: t2 ? o2 : n2 }, "");
    }
    this.register({ $last_posthog_reset: (/* @__PURE__ */ new Date()).toISOString() }, 1);
  }
  get_distinct_id() {
    return this.get_property("distinct_id");
  }
  getGroups() {
    return this.get_property("$groups") || {};
  }
  get_session_id() {
    var t2, i2;
    return null !== (t2 = null == (i2 = this.sessionManager) ? void 0 : i2.checkAndGetSessionAndWindowId(true).sessionId) && void 0 !== t2 ? t2 : "";
  }
  get_session_replay_url(t2) {
    if (!this.sessionManager) return "";
    var { sessionId: i2, sessionStartTimestamp: e2 } = this.sessionManager.checkAndGetSessionAndWindowId(true), r2 = this.requestRouter.endpointFor("ui", "/project/" + this.config.token + "/replay/" + i2);
    if (null != t2 && t2.withTimestamp && e2) {
      var s2, n2 = null !== (s2 = t2.timestampLookBack) && void 0 !== s2 ? s2 : 10;
      if (!e2) return r2;
      r2 += "?t=" + Math.max(Math.floor(((/* @__PURE__ */ new Date()).getTime() - e2) / 1e3) - n2, 0);
    }
    return r2;
  }
  alias(t2, i2) {
    return t2 === this.get_property(nt) ? (N.critical("Attempting to create alias for existing People user - aborting."), -2) : this.Ns("posthog.alias") ? (R(i2) && (i2 = this.get_distinct_id()), t2 !== i2 ? (this.zs(ot, t2), this.capture("$create_alias", { alias: t2, distinct_id: i2 })) : (N.warn("alias matches current distinct_id - skipping api call."), this.identify(t2), -1)) : void 0;
  }
  set_config(t2) {
    var i2 = B({}, this.config);
    if (I(t2)) {
      var e2, r2, s2, n2, o2;
      V(this.config, va(t2));
      var a2 = this.Is();
      null == (e2 = this.persistence) || e2.update_config(this.config, i2, a2), this.sessionPersistence = "sessionStorage" === this.config.persistence || "memory" === this.config.persistence ? this.persistence : new _o(B({}, this.config, { persistence: "sessionStorage" }), a2), Gi.O() && "true" === Gi.D("ph_debug") && (this.config.debug = true), this.config.debug && (c.DEBUG = true, N.info("set_config", { config: t2, oldConfig: i2, newConfig: B({}, this.config) })), null == (r2 = this.sessionRecording) || r2.startIfEnabledOrStop(), null == (s2 = this.autocapture) || s2.startIfEnabled(), null == (n2 = this.heatmaps) || n2.startIfEnabled(), this.surveys.loadIfEnabled(), this.Us(), null == (o2 = this.externalIntegrations) || o2.startIfEnabledOrStop();
    }
  }
  startSessionRecording(t2) {
    var i2 = true === t2, e2 = { sampling: i2 || !(null == t2 || !t2.sampling), linked_flag: i2 || !(null == t2 || !t2.linked_flag), url_trigger: i2 || !(null == t2 || !t2.url_trigger), event_trigger: i2 || !(null == t2 || !t2.event_trigger) };
    if (Object.values(e2).some(Boolean)) {
      var r2, s2, n2, o2, a2;
      if (null == (r2 = this.sessionManager) || r2.checkAndGetSessionAndWindowId(), e2.sampling) null == (s2 = this.sessionRecording) || s2.overrideSampling();
      if (e2.linked_flag) null == (n2 = this.sessionRecording) || n2.overrideLinkedFlag();
      if (e2.url_trigger) null == (o2 = this.sessionRecording) || o2.overrideTrigger("url");
      if (e2.event_trigger) null == (a2 = this.sessionRecording) || a2.overrideTrigger("event");
    }
    this.set_config({ disable_session_recording: false });
  }
  stopSessionRecording() {
    this.set_config({ disable_session_recording: true });
  }
  sessionRecordingStarted() {
    var t2;
    return !(null == (t2 = this.sessionRecording) || !t2.started);
  }
  captureException(t2, i2) {
    var e2 = new Error("PostHog syntheticException");
    return this.exceptions.sendExceptionEvent(B({}, Le(((t3) => t3 instanceof Error)(t2) ? { error: t2, event: t2.message } : { event: t2 }, { syntheticException: e2 }), i2));
  }
  loadToolbar(t2) {
    return this.toolbar.loadToolbar(t2);
  }
  get_property(t2) {
    var i2;
    return null == (i2 = this.persistence) ? void 0 : i2.props[t2];
  }
  getSessionProperty(t2) {
    var i2;
    return null == (i2 = this.sessionPersistence) ? void 0 : i2.props[t2];
  }
  toString() {
    var t2, i2 = null !== (t2 = this.config.name) && void 0 !== t2 ? t2 : ua;
    return i2 !== ua && (i2 = ua + "." + i2), i2;
  }
  _isIdentified() {
    var t2, i2;
    return "identified" === (null == (t2 = this.persistence) ? void 0 : t2.get_property(Dt)) || "identified" === (null == (i2 = this.sessionPersistence) ? void 0 : i2.get_property(Dt));
  }
  Ls() {
    var t2, i2;
    return !("never" === this.config.person_profiles || "identified_only" === this.config.person_profiles && !this._isIdentified() && P(this.getGroups()) && (null == (t2 = this.persistence) || null == (t2 = t2.props) || !t2[ot]) && (null == (i2 = this.persistence) || null == (i2 = i2.props) || !i2[qt]));
  }
  As() {
    return true === this.config.capture_pageleave || "if_capture_pageview" === this.config.capture_pageleave && (true === this.config.capture_pageview || "history_change" === this.config.capture_pageview);
  }
  createPersonProfile() {
    this.Ls() || this.Ns("posthog.createPersonProfile") && this.setPersonProperties({}, {});
  }
  Ns(t2) {
    return "never" === this.config.person_profiles ? (N.error(t2 + ' was called, but process_person is set to "never". This call will be ignored.'), false) : (this.zs(qt, true), true);
  }
  Is() {
    if ("always" === this.config.cookieless_mode) return true;
    var t2 = this.consent.isOptedOut(), i2 = this.config.opt_out_persistence_by_default || "on_reject" === this.config.cookieless_mode;
    return this.config.disable_persistence || t2 && !!i2;
  }
  Us() {
    var t2, i2, e2, r2, s2 = this.Is();
    (null == (t2 = this.persistence) ? void 0 : t2.Ae) !== s2 && (null == (e2 = this.persistence) || e2.set_disabled(s2));
    (null == (i2 = this.sessionPersistence) ? void 0 : i2.Ae) !== s2 && (null == (r2 = this.sessionPersistence) || r2.set_disabled(s2));
    return s2;
  }
  opt_in_capturing(t2) {
    if ("always" !== this.config.cookieless_mode) {
      var i2;
      if ("on_reject" === this.config.cookieless_mode && this.consent.isExplicitlyOptedOut() && (this.reset(true), this.sessionManager = new Go(this), this.persistence && (this.sessionPropsManager = new Ho(this, this.sessionManager, this.persistence)), this.sessionRecording = new cs(this), this.sessionRecording.startIfEnabledOrStop()), this.consent.optInOut(true), this.Us(), R(null == t2 ? void 0 : t2.captureEventName) || null != t2 && t2.captureEventName) this.capture(null !== (i2 = null == t2 ? void 0 : t2.captureEventName) && void 0 !== i2 ? i2 : "$opt_in", null == t2 ? void 0 : t2.captureProperties, { send_instantly: true });
      this.config.capture_pageview && this.Os();
    } else N.warn('Consent opt in/out is not valid with cookieless_mode="always" and will be ignored');
  }
  opt_out_capturing() {
    var t2;
    "always" !== this.config.cookieless_mode ? ("on_reject" === this.config.cookieless_mode && this.consent.isOptedIn() && this.reset(true), this.consent.optInOut(false), this.Us(), "on_reject" === this.config.cookieless_mode && (this.register({ distinct_id: Ht, $device_id: null }), this.sessionManager = void 0, this.sessionPropsManager = void 0, null == (t2 = this.sessionRecording) || t2.stopRecording(), this.sessionRecording = void 0, this.Os())) : N.warn('Consent opt in/out is not valid with cookieless_mode="always" and will be ignored');
  }
  has_opted_in_capturing() {
    return this.consent.isOptedIn();
  }
  has_opted_out_capturing() {
    return this.consent.isOptedOut();
  }
  is_capturing() {
    return "always" === this.config.cookieless_mode || ("on_reject" === this.config.cookieless_mode ? this.consent.isExplicitlyOptedOut() || this.consent.isOptedIn() : !this.has_opted_out_capturing());
  }
  clear_opt_in_out_capturing() {
    this.consent.reset(), this.Us();
  }
  _is_bot() {
    return n ? Qo(n, this.config.custom_blocked_useragents) : void 0;
  }
  Os() {
    o && ("visible" === o.visibilityState ? this.ws || (this.ws = true, this.capture("$pageview", { title: o.title }, { send_instantly: true }), this.Ss && (o.removeEventListener("visibilitychange", this.Ss), this.Ss = null)) : this.Ss || (this.Ss = this.Os.bind(this), st(o, "visibilitychange", this.Ss)));
  }
  debug(i2) {
    false === i2 ? (null == t || t.console.log("You've disabled debug mode."), localStorage && localStorage.removeItem("ph_debug"), this.set_config({ debug: false })) : (null == t || t.console.log("You're now in debug mode. All calls to PostHog will be logged in your console.\nYou can disable this with `posthog.debug(false)`."), localStorage && localStorage.setItem("ph_debug", "true"), this.set_config({ debug: true }));
  }
  I() {
    var t2, i2, e2, r2, s2, n2, o2, a2 = this.ks || {};
    return "advanced_disable_flags" in a2 ? !!a2.advanced_disable_flags : false !== this.config.advanced_disable_flags ? !!this.config.advanced_disable_flags : true === this.config.advanced_disable_decide ? (N.warn("Config field 'advanced_disable_decide' is deprecated. Please use 'advanced_disable_flags' instead. The old field will be removed in a future major version."), true) : (e2 = "advanced_disable_decide", r2 = false, s2 = N, n2 = (i2 = "advanced_disable_flags") in (t2 = a2) && !R(t2[i2]), o2 = e2 in t2 && !R(t2[e2]), n2 ? t2[i2] : o2 ? (s2 && s2.warn("Config field '" + e2 + "' is deprecated. Please use '" + i2 + "' instead. The old field will be removed in a future major version."), t2[e2]) : r2);
  }
  js(t2) {
    if (F(this.config.before_send)) return t2;
    var i2 = k(this.config.before_send) ? this.config.before_send : [this.config.before_send], e2 = t2;
    for (var r2 of i2) {
      if (e2 = r2(e2), F(e2)) {
        var s2 = "Event '" + t2.event + "' was rejected in beforeSend function";
        return j(t2.event) ? N.warn(s2 + ". This can cause unexpected behavior.") : N.info(s2), null;
      }
      e2.properties && !P(e2.properties) || N.warn("Event '" + t2.event + "' has no properties after beforeSend function, this is likely an error.");
    }
    return e2;
  }
  getPageViewId() {
    var t2;
    return null == (t2 = this.pageViewManager.ce) ? void 0 : t2.pageViewId;
  }
  captureTraceFeedback(t2, i2) {
    this.capture("$ai_feedback", { $ai_trace_id: String(t2), $ai_feedback_text: i2 });
  }
  captureTraceMetric(t2, i2, e2) {
    this.capture("$ai_metric", { $ai_trace_id: String(t2), $ai_metric_name: i2, $ai_metric_value: String(e2) });
  }
};
!(function(t2, i2) {
  for (var e2 = 0; e2 < i2.length; e2++) t2.prototype[i2[e2]] = Q(t2.prototype[i2[e2]]);
})(fa, ["identify"]);
var pa;
var _a = (pa = aa[ua] = new fa(), (function() {
  function i2() {
    i2.done || (i2.done = true, ha = false, J(aa, (function(t2) {
      t2._dom_loaded();
    })));
  }
  null != o && o.addEventListener ? "complete" === o.readyState ? i2() : st(o, "DOMContentLoaded", i2, { capture: false }) : t && N.error("Browser doesn't support `document.addEventListener` so PostHog couldn't be initialized");
})(), pa);
export {
  f as COPY_AUTOCAPTURE_EVENT,
  _ as Compression,
  fa as PostHog,
  ko as SurveyEventName,
  Eo as SurveyEventProperties,
  yo as SurveyPosition,
  $o as SurveyQuestionBranchingType,
  So as SurveyQuestionType,
  xo as SurveySchedule,
  wo as SurveyType,
  bo as SurveyWidgetType,
  _a as default,
  p as knownUnsafeEditableEvent,
  _a as posthog,
  g as severityLevels
};
//# sourceMappingURL=posthog-js.js.map
