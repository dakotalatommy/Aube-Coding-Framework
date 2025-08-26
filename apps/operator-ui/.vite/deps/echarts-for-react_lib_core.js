import {
  init_tslib_es6,
  tslib_es6_exports
} from "./chunk-NXD5ICG4.js";
import {
  require_react
} from "./chunk-K4NLKXWU.js";
import {
  __commonJS,
  __toCommonJS
} from "./chunk-V4OQ3NZ2.js";

// node_modules/size-sensor/lib/id.js
var require_id = __commonJS({
  "node_modules/size-sensor/lib/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports["default"] = void 0;
    var id = 1;
    var _default = function _default2() {
      return "".concat(id++);
    };
    exports["default"] = _default;
  }
});

// node_modules/size-sensor/lib/debounce.js
var require_debounce = __commonJS({
  "node_modules/size-sensor/lib/debounce.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports["default"] = void 0;
    var _default = function _default2(fn) {
      var delay = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 60;
      var timer = null;
      return function() {
        var _this = this;
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        clearTimeout(timer);
        timer = setTimeout(function() {
          fn.apply(_this, args);
        }, delay);
      };
    };
    exports["default"] = _default;
  }
});

// node_modules/size-sensor/lib/constant.js
var require_constant = __commonJS({
  "node_modules/size-sensor/lib/constant.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.SizeSensorId = exports.SensorTabIndex = exports.SensorClassName = void 0;
    var SizeSensorId = "size-sensor-id";
    exports.SizeSensorId = SizeSensorId;
    var SensorClassName = "size-sensor-object";
    exports.SensorClassName = SensorClassName;
    var SensorTabIndex = "-1";
    exports.SensorTabIndex = SensorTabIndex;
  }
});

// node_modules/size-sensor/lib/sensors/object.js
var require_object = __commonJS({
  "node_modules/size-sensor/lib/sensors/object.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.createSensor = void 0;
    var _debounce = _interopRequireDefault(require_debounce());
    var _constant = require_constant();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    var createSensor = function createSensor2(element, whenDestroy) {
      var sensor = void 0;
      var listeners = [];
      var newSensor = function newSensor2() {
        if (getComputedStyle(element).position === "static") {
          element.style.position = "relative";
        }
        var obj = document.createElement("object");
        obj.onload = function() {
          obj.contentDocument.defaultView.addEventListener("resize", resizeListener);
          resizeListener();
        };
        obj.style.display = "block";
        obj.style.position = "absolute";
        obj.style.top = "0";
        obj.style.left = "0";
        obj.style.height = "100%";
        obj.style.width = "100%";
        obj.style.overflow = "hidden";
        obj.style.pointerEvents = "none";
        obj.style.zIndex = "-1";
        obj.style.opacity = "0";
        obj.setAttribute("class", _constant.SensorClassName);
        obj.setAttribute("tabindex", _constant.SensorTabIndex);
        obj.type = "text/html";
        element.appendChild(obj);
        obj.data = "about:blank";
        return obj;
      };
      var resizeListener = (0, _debounce["default"])(function() {
        listeners.forEach(function(listener) {
          listener(element);
        });
      });
      var bind = function bind2(cb) {
        if (!sensor) {
          sensor = newSensor();
        }
        if (listeners.indexOf(cb) === -1) {
          listeners.push(cb);
        }
      };
      var destroy = function destroy2() {
        if (sensor && sensor.parentNode) {
          if (sensor.contentDocument) {
            sensor.contentDocument.defaultView.removeEventListener("resize", resizeListener);
          }
          sensor.parentNode.removeChild(sensor);
          element.removeAttribute(_constant.SizeSensorId);
          sensor = void 0;
          listeners = [];
          whenDestroy && whenDestroy();
        }
      };
      var unbind = function unbind2(cb) {
        var idx = listeners.indexOf(cb);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
        if (listeners.length === 0 && sensor) {
          destroy();
        }
      };
      return {
        element,
        bind,
        destroy,
        unbind
      };
    };
    exports.createSensor = createSensor;
  }
});

// node_modules/size-sensor/lib/sensors/resizeObserver.js
var require_resizeObserver = __commonJS({
  "node_modules/size-sensor/lib/sensors/resizeObserver.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.createSensor = void 0;
    var _constant = require_constant();
    var _debounce = _interopRequireDefault(require_debounce());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    var createSensor = function createSensor2(element, whenDestroy) {
      var sensor = void 0;
      var listeners = [];
      var resizeListener = (0, _debounce["default"])(function() {
        listeners.forEach(function(listener) {
          listener(element);
        });
      });
      var newSensor = function newSensor2() {
        var s = new ResizeObserver(resizeListener);
        s.observe(element);
        resizeListener();
        return s;
      };
      var bind = function bind2(cb) {
        if (!sensor) {
          sensor = newSensor();
        }
        if (listeners.indexOf(cb) === -1) {
          listeners.push(cb);
        }
      };
      var destroy = function destroy2() {
        sensor.disconnect();
        listeners = [];
        sensor = void 0;
        element.removeAttribute(_constant.SizeSensorId);
        whenDestroy && whenDestroy();
      };
      var unbind = function unbind2(cb) {
        var idx = listeners.indexOf(cb);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
        if (listeners.length === 0 && sensor) {
          destroy();
        }
      };
      return {
        element,
        bind,
        destroy,
        unbind
      };
    };
    exports.createSensor = createSensor;
  }
});

// node_modules/size-sensor/lib/sensors/index.js
var require_sensors = __commonJS({
  "node_modules/size-sensor/lib/sensors/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.createSensor = void 0;
    var _object = require_object();
    var _resizeObserver = require_resizeObserver();
    var createSensor = typeof ResizeObserver !== "undefined" ? _resizeObserver.createSensor : _object.createSensor;
    exports.createSensor = createSensor;
  }
});

// node_modules/size-sensor/lib/sensorPool.js
var require_sensorPool = __commonJS({
  "node_modules/size-sensor/lib/sensorPool.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.removeSensor = exports.getSensor = exports.Sensors = void 0;
    var _id = _interopRequireDefault(require_id());
    var _sensors = require_sensors();
    var _constant = require_constant();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { "default": obj };
    }
    var Sensors = {};
    exports.Sensors = Sensors;
    function clean(sensorId) {
      if (sensorId && Sensors[sensorId]) {
        delete Sensors[sensorId];
      }
    }
    var getSensor = function getSensor2(element) {
      var sensorId = element.getAttribute(_constant.SizeSensorId);
      if (sensorId && Sensors[sensorId]) {
        return Sensors[sensorId];
      }
      var newId = (0, _id["default"])();
      element.setAttribute(_constant.SizeSensorId, newId);
      var sensor = (0, _sensors.createSensor)(element, function() {
        return clean(newId);
      });
      Sensors[newId] = sensor;
      return sensor;
    };
    exports.getSensor = getSensor;
    var removeSensor = function removeSensor2(sensor) {
      var sensorId = sensor.element.getAttribute(_constant.SizeSensorId);
      sensor.destroy();
      clean(sensorId);
    };
    exports.removeSensor = removeSensor;
  }
});

// node_modules/size-sensor/lib/index.js
var require_lib = __commonJS({
  "node_modules/size-sensor/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.ver = exports.clear = exports.bind = void 0;
    var _sensorPool = require_sensorPool();
    var bind = function bind2(element, cb) {
      var sensor = (0, _sensorPool.getSensor)(element);
      sensor.bind(cb);
      return function() {
        sensor.unbind(cb);
      };
    };
    exports.bind = bind;
    var clear = function clear2(element) {
      var sensor = (0, _sensorPool.getSensor)(element);
      (0, _sensorPool.removeSensor)(sensor);
    };
    exports.clear = clear;
    var ver = "1.0.2";
    exports.ver = ver;
  }
});

// node_modules/echarts-for-react/lib/helper/pick.js
var require_pick = __commonJS({
  "node_modules/echarts-for-react/lib/helper/pick.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pick = void 0;
    function pick(obj, keys) {
      var r = {};
      keys.forEach(function(key) {
        r[key] = obj[key];
      });
      return r;
    }
    exports.pick = pick;
  }
});

// node_modules/echarts-for-react/lib/helper/is-function.js
var require_is_function = __commonJS({
  "node_modules/echarts-for-react/lib/helper/is-function.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isFunction = void 0;
    function isFunction(v) {
      return typeof v === "function";
    }
    exports.isFunction = isFunction;
  }
});

// node_modules/echarts-for-react/lib/helper/is-string.js
var require_is_string = __commonJS({
  "node_modules/echarts-for-react/lib/helper/is-string.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isString = void 0;
    function isString(v) {
      return typeof v === "string";
    }
    exports.isString = isString;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/echarts-for-react/lib/helper/is-equal.js
var require_is_equal = __commonJS({
  "node_modules/echarts-for-react/lib/helper/is-equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isEqual = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var fast_deep_equal_1 = (0, tslib_1.__importDefault)(require_fast_deep_equal());
    exports.isEqual = fast_deep_equal_1.default;
  }
});

// node_modules/echarts-for-react/lib/core.js
var require_core = __commonJS({
  "node_modules/echarts-for-react/lib/core.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var react_1 = (0, tslib_1.__importStar)(require_react());
    var size_sensor_1 = require_lib();
    var pick_1 = require_pick();
    var is_function_1 = require_is_function();
    var is_string_1 = require_is_string();
    var is_equal_1 = require_is_equal();
    var EChartsReactCore = (
      /** @class */
      (function(_super) {
        (0, tslib_1.__extends)(EChartsReactCore2, _super);
        function EChartsReactCore2(props) {
          var _this = _super.call(this, props) || this;
          _this.echarts = props.echarts;
          _this.ele = null;
          _this.isInitialResize = true;
          return _this;
        }
        EChartsReactCore2.prototype.componentDidMount = function() {
          this.renderNewEcharts();
        };
        EChartsReactCore2.prototype.componentDidUpdate = function(prevProps) {
          var shouldSetOption = this.props.shouldSetOption;
          if ((0, is_function_1.isFunction)(shouldSetOption) && !shouldSetOption(prevProps, this.props)) {
            return;
          }
          if (!(0, is_equal_1.isEqual)(prevProps.theme, this.props.theme) || !(0, is_equal_1.isEqual)(prevProps.opts, this.props.opts) || !(0, is_equal_1.isEqual)(prevProps.onEvents, this.props.onEvents)) {
            this.dispose();
            this.renderNewEcharts();
            return;
          }
          var pickKeys = ["option", "notMerge", "lazyUpdate", "showLoading", "loadingOption"];
          if (!(0, is_equal_1.isEqual)((0, pick_1.pick)(this.props, pickKeys), (0, pick_1.pick)(prevProps, pickKeys))) {
            this.updateEChartsOption();
          }
          if (!(0, is_equal_1.isEqual)(prevProps.style, this.props.style) || !(0, is_equal_1.isEqual)(prevProps.className, this.props.className)) {
            this.resize();
          }
        };
        EChartsReactCore2.prototype.componentWillUnmount = function() {
          this.dispose();
        };
        EChartsReactCore2.prototype.getEchartsInstance = function() {
          return this.echarts.getInstanceByDom(this.ele) || this.echarts.init(this.ele, this.props.theme, this.props.opts);
        };
        EChartsReactCore2.prototype.dispose = function() {
          if (this.ele) {
            try {
              (0, size_sensor_1.clear)(this.ele);
            } catch (e) {
              console.warn(e);
            }
            this.echarts.dispose(this.ele);
          }
        };
        EChartsReactCore2.prototype.renderNewEcharts = function() {
          var _this = this;
          var _a = this.props, onEvents = _a.onEvents, onChartReady = _a.onChartReady;
          var echartsInstance = this.updateEChartsOption();
          this.bindEvents(echartsInstance, onEvents || {});
          if ((0, is_function_1.isFunction)(onChartReady))
            onChartReady(echartsInstance);
          if (this.ele) {
            (0, size_sensor_1.bind)(this.ele, function() {
              _this.resize();
            });
          }
        };
        EChartsReactCore2.prototype.bindEvents = function(instance, events) {
          function _bindEvent(eventName2, func) {
            if ((0, is_string_1.isString)(eventName2) && (0, is_function_1.isFunction)(func)) {
              instance.on(eventName2, function(param) {
                func(param, instance);
              });
            }
          }
          for (var eventName in events) {
            if (Object.prototype.hasOwnProperty.call(events, eventName)) {
              _bindEvent(eventName, events[eventName]);
            }
          }
        };
        EChartsReactCore2.prototype.updateEChartsOption = function() {
          var _a = this.props, option = _a.option, _b = _a.notMerge, notMerge = _b === void 0 ? false : _b, _c = _a.lazyUpdate, lazyUpdate = _c === void 0 ? false : _c, showLoading = _a.showLoading, _d = _a.loadingOption, loadingOption = _d === void 0 ? null : _d;
          var echartInstance = this.getEchartsInstance();
          echartInstance.setOption(option, notMerge, lazyUpdate);
          if (showLoading)
            echartInstance.showLoading(loadingOption);
          else
            echartInstance.hideLoading();
          return echartInstance;
        };
        EChartsReactCore2.prototype.resize = function() {
          var echartsInstance = this.getEchartsInstance();
          if (!this.isInitialResize) {
            try {
              echartsInstance.resize();
            } catch (e) {
              console.warn(e);
            }
          }
          this.isInitialResize = false;
        };
        EChartsReactCore2.prototype.render = function() {
          var _this = this;
          var _a = this.props, style = _a.style, _b = _a.className, className = _b === void 0 ? "" : _b;
          var newStyle = (0, tslib_1.__assign)({ height: 300 }, style);
          return react_1.default.createElement("div", { ref: function(e) {
            _this.ele = e;
          }, style: newStyle, className: "echarts-for-react " + className });
        };
        return EChartsReactCore2;
      })(react_1.PureComponent)
    );
    exports.default = EChartsReactCore;
  }
});
export default require_core();
//# sourceMappingURL=echarts-for-react_lib_core.js.map
