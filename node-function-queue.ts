import {EventEmitter} from 'node:events';

const releaseEvent = Symbol('releaseEvent');

class Worker {
  public release: Function;
  constructor(releaseEvent: Function) {
    this.release = releaseEvent;
  }

  public run = (task: Function, resolve: Function, onError=(e: Error)=>console.log(e)) => {
    task()
      .then((res)=>resolve(res))
      .catch((e)=>onError(e))
      .then(() => this.release());
  }

  public runTimeout = (task: Function, resolve: Function, onError=(e: Error)=>console.log(e), timeout=30) =>  {
    const rejectionPromise = this.rejectAfter(timeout);
    const taskPromise = task();
    Promise.race([
      taskPromise,
      rejectionPromise,
    ])
      .then((res)=>resolve(res))
      .catch((e)=>onError(e))
      .then(() => this.release());
  }

  private rejectAfter = (timeout: number)  =>  {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout"));
      }, timeout * 1000);
    });
  }
}


export interface TaskConfig {
  retry: number,
  retries: number,
  waitBeforeRetry: number,
  retryAfterTimeout: number,
  killAfterElapsed?: number,
}


export interface Task {
  resolve: Function,
  reject: Function,
  task: Function,
  config: TaskConfig,
}


export class NodeFunctionQueue extends EventEmitter {

  private readonly _id: string;
  private readonly _concurrency: number;
  private readonly _workers: Worker[];
  private readonly _tasks: Task[];
  private readonly _defaultConfig: TaskConfig;

  constructor(id = (Math.random() + performance.now()).toString(), concurrency = 3) {
    super();
    this._id = id;
    this._concurrency = concurrency;
    this._workers = [];
    this._tasks = [];
    this._defaultConfig = {
      retries: 100,
      waitBeforeRetry: 15,
      retryAfterTimeout: 30,
      retry: 0,
    }

    this.on(releaseEvent, () => {
      if (this._tasks[0]) {
        const {task, resolve, reject, config} = this._tasks.shift();
        this._queue(task, resolve, reject, config);
      }
    });

    for (let i = 0; i < this._concurrency; i += 1) {
      this._putWorker();
    }
  }

  /**
   * Creates a worker and adds it to the worker pool.
   * @returns {void}
   */
  private _putWorker = () => {
    const worker = this._createWorker();
    worker.release();
  }

  /**
   * Initializes a worker and adds the release event to the worker.
   *
   * @returns {Worker} The worker
   * */
  private _createWorker = () => {
    const worker = new Worker(() => {
      this._workers.push(worker);
      this.emit(releaseEvent);
    })
    return worker;
  }

  private _getConfig = (config) => {
    const used = config ? {...this._defaultConfig, ...config} : {...this._defaultConfig};
    used.retry = 0;
    return used;
  }

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
  private _queue = (task: Function, resolve: Function, reject: Function, config: TaskConfig) => {

    const {retries, waitBeforeRetry, retry, retryAfterTimeout} = config;

    if (retry >= retries) {
      reject(new Error("Max retries reached"));
      return;
    }


    if (this._workers[0]) {

      config.retry++;

      const worker = this._workers.pop();

      const schedule = retryAfterTimeout > 0 ? worker.runTimeout : worker.run;

      const onError = (e) => {
        if (waitBeforeRetry > 0) {
          setTimeout(() => {
            this._queue(task, resolve, reject, config);
          }, waitBeforeRetry * 1000);
        } else if (waitBeforeRetry === 0) {
          this._queue(task, resolve, reject, config);
        } else {
          reject(e)
        }
      };

      schedule( task, resolve, onError, retryAfterTimeout );

    } else {
      this._tasks.push({task, resolve, reject, config});
    }
  }


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
  public callbackQ = (task: Function, resolve: Function, reject: Function, config?: TaskConfig) => {
    this._queue(task, resolve, reject, this._getConfig(config))
  }

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
  public asyncQ = async (task: Function, config?: TaskConfig) => {
    return new Promise((resolve, reject) => this.callbackQ(task, resolve, reject, config))
  }

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
  public wrapQ = (_function: Function, config?: TaskConfig) => {
    return async (...args) => new Promise((resolve, reject) => this.callbackQ(()=>_function(...args), resolve, reject, config))
  }

}



