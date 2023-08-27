/// <reference types="node" />
import { EventEmitter } from 'node:events';
export interface TaskConfig {
    retry: number;
    retries: number;
    waitBeforeRetry: number;
    retryAfterTimeout: number;
    killAfterElapsed?: number;
}
export interface Task {
    resolve: Function;
    reject: Function;
    task: Function;
    config: TaskConfig;
}
export declare class NodeFunctionQueue extends EventEmitter {
    private readonly _id;
    private readonly _concurrency;
    private readonly _workers;
    private readonly _tasks;
    private readonly _defaultConfig;
    constructor(id?: string, concurrency?: number);
    /**
     * Creates a worker and adds it to the worker pool.
     * @returns {void}
     */
    private _putWorker;
    /**
     * Initializes a worker and adds the release event to the worker.
     *
     * @returns {Worker} The worker
     * */
    private _createWorker;
    private _getConfig;
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
    private _queue;
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
    callbackQ(task: Function, resolve: Function, reject: Function, config?: TaskConfig): void;
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
    asyncQ(task: Function, config?: TaskConfig): Promise<unknown>;
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
    wrapQ(_function: Function, config?: TaskConfig): (...args: any[]) => Promise<unknown>;
}
