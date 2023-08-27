"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFunctionQueue = void 0;
var node_events_1 = require("node:events");
var releaseEvent = Symbol('releaseEvent');
var Worker = /** @class */ (function () {
    function Worker(releaseEvent) {
        this.release = releaseEvent;
    }
    Worker.prototype.run = function (task, resolve, onError) {
        var _this = this;
        if (onError === void 0) { onError = function (e) { return console.log(e); }; }
        task()
            .then(function (res) { return resolve(res); })
            .catch(function (e) { return onError(e); })
            .then(function () { return _this.release(); });
    };
    Worker.prototype.runTimeout = function (task, resolve, onError, timeout) {
        var _this = this;
        if (onError === void 0) { onError = function (e) { return console.log(e); }; }
        if (timeout === void 0) { timeout = 30; }
        var rejectionPromise = this.rejectAfter(timeout);
        var taskPromise = task();
        Promise.race([
            taskPromise,
            rejectionPromise,
        ])
            .then(function (res) { return resolve(res); })
            .catch(function (e) { return onError(e); })
            .then(function () { return _this.release(); });
    };
    Worker.prototype.rejectAfter = function (timeout) {
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                reject(new Error("Timeout"));
            }, timeout * 1000);
        });
    };
    return Worker;
}());
var NodeFunctionQueue = /** @class */ (function (_super) {
    __extends(NodeFunctionQueue, _super);
    function NodeFunctionQueue(id, concurrency) {
        if (id === void 0) { id = (Math.random() + performance.now()).toString(); }
        if (concurrency === void 0) { concurrency = 3; }
        var _this = _super.call(this) || this;
        _this._id = id;
        _this._concurrency = concurrency;
        _this._workers = [];
        _this._tasks = [];
        _this._defaultConfig = {
            retries: 100,
            waitBeforeRetry: 15,
            retryAfterTimeout: 30,
            retry: 0,
        };
        _this.on(releaseEvent, function () {
            if (_this._tasks[0]) {
                var _a = _this._tasks.shift(), task = _a.task, resolve = _a.resolve, reject = _a.reject, config = _a.config;
                _this._queue(task, resolve, reject, config);
            }
        });
        for (var i = 0; i < _this._concurrency; i += 1) {
            _this._putWorker();
        }
        return _this;
    }
    /**
     * Creates a worker and adds it to the worker pool.
     * @returns {void}
     */
    NodeFunctionQueue.prototype._putWorker = function () {
        var worker = this._createWorker();
        worker.release();
    };
    /**
     * Initializes a worker and adds the release event to the worker.
     *
     * @returns {Worker} The worker
     * */
    NodeFunctionQueue.prototype._createWorker = function () {
        var _this = this;
        var worker = new Worker(function () {
            _this._workers.push(worker);
            _this.emit(releaseEvent);
        });
        return worker;
    };
    NodeFunctionQueue.prototype._getConfig = function (config) {
        var used = config ? __assign(__assign({}, this._defaultConfig), config) : this._defaultConfig;
        used.retry = 0;
        return used;
    };
    /**
     * This function queues a task and resolves when the task is done.
     * e.g. either the event is fire and forget or uses a simple callback.
     *
     *
     * A task is done when it resolves or rejects after the given retries default 1000.
     * If the task rejects, the task is retried after the given timeout in seconds default 15.
     * If waitBeforeRetry is 0, the task is retried immediately.
     * If waitBeforeRetry is -1, the task is not retried and rejects immediately with an error.
     *
     * @param {function} task The function to be queued
     * @param {function} resolve The callback to be called when the task resolves with its result
     * @param {function} reject The callback to be called when the task rejects with its error or when the task is not resolved after the given retries
     * @param config The config for the task
     * @param {number} config.retries The number of retries before the task rejects default 1000
     * @param {number} config.waitBeforeRetry The timeout in seconds between retries default 15
     * @param {number} config.retry The current retry count default -1
     * @param {number} config.killAfterTimeout The timeout in seconds after the task is killed and repeated default 30
     *
     * @returns {void}
     * */
    NodeFunctionQueue.prototype._queue = function (task, resolve, reject, config) {
        var _this = this;
        var retries = config.retries, waitBeforeRetry = config.waitBeforeRetry, retry = config.retry, retryAfterTimeout = config.retryAfterTimeout;
        if (retry >= retries) {
            reject(new Error("Max retries reached"));
            return;
        }
        if (this._workers[0]) {
            config.retry++;
            var worker = this._workers.pop();
            var schedule = retryAfterTimeout > 0 ? worker.runTimeout : worker.run;
            schedule(task, resolve, function (e) {
                if (waitBeforeRetry > 0) {
                    setTimeout(function () {
                        _this._queue(task, resolve, reject, config);
                    }, waitBeforeRetry * 1000);
                }
                else if (waitBeforeRetry === 0) {
                    _this._queue(task, resolve, reject, config);
                }
                else {
                    reject(e);
                }
            });
        }
        else {
            this._tasks.push({ task: task, resolve: resolve, reject: reject, config: config });
        }
    };
    /**
     * Queues a task and resolves when the task is done.
     * e.g. either the event is fire and forget or uses a simple callback.
     *
     *
     *
     * @param {function} task The function to be queued
     * @param {function} resolve Resolve the tasks result
     * @param {function} reject Reject the task with an error
     * @param config The config for the task
     * @param {number} config.retries The number of retries before the task rejects default 1000
     * @param {number} config.waitBeforeRetry The timeout in seconds between retries default 15
     * @param {number} config.killAfterTimeout The timeout in seconds after the task is killed and repeated default 30
     *
     * @returns {Promise<unknown>} The result of the task
     * */
    NodeFunctionQueue.prototype.callbackQ = function (task, resolve, reject, config) {
        this._queue(task, resolve, reject, this._getConfig(config));
    };
    /**
     * Transforms your async function to a queued function.
     * instead of using
     * const result = await request(data);
     * you can use
     * const result = await queue.async(() => request(data));
     * or just
     * const result = await async(() => request(data));
     *
     * An async style wrapper for queue. So you can chain them in async style instead of using callbacks.
     * for an async function you can use await queue.async(task)
     * e.g. multiple events are queued and processed in order:
     * const result = await request(data);
     * const verified = await verify(result);
     * const processed = await process(verified);
     * const file = await createFileFrom(processed);
     * const stored = await store(processed, file);
     * await send(file);
     *
     * becomes
     * const result = await queue.async(() => request(data));
     * const verified = await queue.async(() => verify(result));
     * const process = await queue.async(() => process(result));
     * const file = await queue.async(() => createFileFrom(processed));
     * const stored = await queue.async(() => store(processed, file));
     * await queue.async(() => send(file));
     *
     *
     * The task is the function to be queued.
     * The retries is the number of retries before the task rejects default 1000.
     * waitBeforeRetry is the timeout in seconds between retries default 15.
     *
     * @param {function} task The function to be queued
     * @param config The config for the task
     * @param {number} config.retries The number of retries before the task rejects default 1000
     * @param {number} config.waitBeforeRetry The timeout in seconds between retries default 15
     * @param {number} config.killAfterTimeout The timeout in seconds after the task is killed and repeated default 30
     *
     * @returns {Promise<unknown>} The result of the task
     * */
    NodeFunctionQueue.prototype.asyncQ = function (task, config) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) { return _this.callbackQ(task, resolve, reject, config); })];
            });
        });
    };
    /**
     * Wraps your function to a queued function.
     * For reusability you can wrap your function to a queued function.
     *
     * usage:
     * const queuedFunction = queue.wrap(function);
     * const result = await queuedFunction();
     *
     * @param {function} _function The function to be queued
     * @param config The config for the task
     * @param {number} config.retries The number of retries before the task rejects default 1000
     * @param {number} config.waitBeforeRetry The timeout in seconds between retries default 15
     * @param {number} config.killAfterTimeout The timeout in seconds after the task is killed and repeated default 30
     *
     * @returns {Promise<unknown>} The result of the function
     * */
    NodeFunctionQueue.prototype.wrapQ = function (_function, config) {
        var _this = this;
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return __awaiter(_this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    return [2 /*return*/, new Promise(function (resolve, reject) { return _this.callbackQ(_function.apply(void 0, args), resolve, reject, config); })];
                });
            });
        };
    };
    return NodeFunctionQueue;
}(node_events_1.EventEmitter));
exports.NodeFunctionQueue = NodeFunctionQueue;
