## Fully agnostic node queue

Usually when working with queues you are using callbacks. This can be a bit of a pain to work with. This module allows
you to use promises in async/await - style instead. It allows fast prototyping and easy separation of concerns. 
You can scale easily without changing the logic as your project grows.

### Install

```bash
npm install node-function-queue
```

### Import

```javascript
import {NodeFunctionQueue} from "node-function-queue";

const transactionQ = new NodeFunctionQueue(id="transaction queue", concurrency=10);
```

### Usage

```javascript
// your function
const myFunction = async (data) => {
	const result = await doSomething(data);
	return result;
};

// without queue
const result = await myFunction(data);
const processed = processResult(result);

// with queue
const result = await transactionQ.asyncQ(() => myFunction(data));
const processed = processResult(result);
```

### Functions

#### asyncQ: Transform an async function into an awaitable queue-function

```javascript
const myFunction = async (data) => {
	const result = await doSomething(data);
	return result;
};
const result = await transactionQ.asyncQ(() => myFunction(data));
```
#### wrapQ: Wrap a function into  an awaitable queue-function

```javascript
const myFunctionQ = transactionQ.wrapQ(async (data) => {
	const result = await doSomething(data);
	return result;
});
const result = await myFunctionQ(data);
```
#### callbackQ: Callback style queue 
```javascript
const myFunction = async (data) => {
	// something
};
const resolve = (result) => {
    // something
};
const reject = (err) => {
	// something
};

transactionQ.callbackQ(()=>myFunction(data), resolve, reject);
```

#### Queue Config
All exposed queue functions take an optional config object as last parameter. The config object can contain the following properties:
```javascript
const defaultConfig = {
	retries: 100, // number of retries before the job is canceled, if 0 the job is tried once and if negative the job is not attempted at all, be careful when using Infinity
	waitBeforeRetry: 15, // seconds after the which the job is retried, if 0 immediately and if negative an error is thrown immediately, careful when using 0
	retryAfterTimeout: 30, // seconds after which the job is canceled, if 0 or negative the job is never canceled, careful when using 0
}
```

### Generic callback queue

More often than not multiple queues are used and depend on each other

thus we separate them like W -> X -> Y -> Z

e.g. Payment Process -> PDF -> Invoicing Software -> Transaction Mail

### Error Notification Queue

```javascript
const Queue = require('queue');
const errorQ = new Queue("error notification queue");
errorQ.process(async function processError(job) {
	await processError(job.data);
});
errorQ.on('error', (job, err) => {
	logErrorAndSendEmail(err);
});
```

### Email Queue

```javascript
const emailQ = new Queue("emails");
pdfQ.process(async function processInvoice(job) {
	const result = await sendTransactionMail(job.data);
});
emailQ.on('error', (job, err) => {
	errorQ.add(job);
});
```

### Invoicing Queue

```javascript
const invoicingQ = new Queue("rate limited invoicing");
pdfQ.process(async function processInvoice(job) {
	const result = await createInvoiceRecord(job.data);
	if (result.success) {
		return result;
	} else {
		errorQ.add(result.error);
	}
});
invoicingQ.on('error', (job, err) => {
	errorQ.add(job);
});
```

### PDF Queue

```javascript
const pdfQ = new Queue("pdf creation");
pdfQ.process(async function createPdf(job) {
	const result = await createPdf(job.data);
	if (result.success) {
		return result;
	} else {
		errorQ.add(result.error);
	}
});
pdfQ.on('completed', (job) => {
	emailQ.add(job.result);
	invoicingQ.add(job.result);
});
pdfQ.on('error', (job, err) => {
	// this is fun to debug when our intermediate starts throwing an error!
	errorQ.add(job);
});
```

### Payment Queue

```javascript
const paymentQ = new Queue("payment processing");
emailQ.process(async function processPayment(job) {
	const result = await paymentProcessor(job.data);
	if (result.success) {
		return result;
	} else {
		throw new Error(result.error);
	}
});
paymentQ.on('completed', (job) => {
	callPdfQ(job.result);
});
paymentQ.on('error', (job, err) => {
	deny(job);
});
webhook.on('payment', (req, res) => {
	const {payment} = req.body;
	paymentQ.add(payment);
	res.status(200).send("OK");
});
```

While this is a very simple example, it can get very complex very fast. Especially when you have to deal with errors and
retries. This is where this module comes in.
Although the provided example is easy to scale and concerns are separated, it is still a lot of code to write and
maintain. This module allows you to write the same code in a much more readable way.

## Promise Queue async wrapping

```javascript
const transactionQ = new NodeFunctionQueue("my-id", 10);
const asyncQ = transactionQ.asyncQ;

webhook.on('payment', async (req, res) => {
	const {payment} = req.body;
	
	// an error is thrown if the promise is rejected or maximum retries are reached
	const processedPayment = await asyncQ(() => paymentProcessor(payment));
	if (!processedPayment.success) {
		await processError(processedPdf);
		return;
	}
	
	const pdf = await asyncQ(() => createPdf(processedPayment));
	if (!pdf.success) {
		await processError(pdf);
		return;
	}
	
	const promises = [
		asyncQ(() => sendTransactionMail(pdf, processedPayment)),
		asyncQ(() => createInvoiceRecord(pdf, processedPayment)),
	];
	// run them in parallel with Promise allSettled
	const settled = await Promise.allSettled(promises);
	
	const email = settled[0];
	const invoice = settled[1];
	
	if (settled[0].status === "rejected" || !email.value.success) {
		await processError(email.value);
	}
	if (settled[1].status === "rejected" || !invoice.value.success) {
		await processError(invoice.value);
	}

});
```
Almost half the lines of code and in one place. This is much easier to read and maintain.

## Promise Queue function wrapping

```javascript
const transactionQ = new NodeFunctionQueue("my-id", 10);
// wrapQ returns a function that can be called with the same parameters as the original function
const paymentProcessorQ = transactionQ.wrapQ(paymentProcessor);
const createPdfQ = transactionQ.wrapQ(createPdf);
const sendTransactionMailQ = transactionQ.wrapQ(sendTransactionMail);
const createInvoiceRecordQ = transactionQ.wrapQ(createInvoiceRecord);

webhook.on('payment', async (req, res) => {
	const {payment} = req.body;
	
	const processedPayment = await paymentProcessorQ(payment);
	if (!processedPayment.success) {
		await processError(processedPayment);
		return;
	}
	
	const pdf = await createPdfQ(processedPayment);
	if (!pdf.success) {
		await processError(processedPdf);
		return;
	}
	
	const promises = [sendTransactionMailQ, createInvoiceRecordQ].map(_f => _f(pdf, processedPayment));
	const settled = await Promise.allSettled(promises);
	
	for (const {status, value} of settled) {
			if (status === "rejected" || !value.success) await processError(value);
	}
});
```
WrapQ is a total no-brainer. By wrapping the original functions you can use them as they are and don't have to change anything. This is especially useful when you are using third party libraries.

Due to the agnostic nature of this module, you can use it for anything what is a promise.

## Separation of concerns

Separating the queues into different files is still possible. 

```javascript
const transactionPaymentQ = new NodeFunctionQueue("transactionPaymentQ", 10);
const paymentProcessorQ = transactionPaymentQ.wrapQ(paymentProcessor);
export default paymentProcessorQ;
```

```javascript
const transactionCreatePdfQ = new NodeFunctionQueue("transactionCreatePdfQ", 10);
const createPdfQ = transactionCreatePdfQ.wrapQ(paymentProcessor);
export default createPdfQ;
```

```javascript
const transactionMailQ = new NodeFunctionQueue("transactionMailQ", 10);
const sendTransactionMailQ = transactionMailQ.wrapQ(paymentProcessor);
export default sendTransactionMailQ;
```

```javascript
const transactionCreateInvoiceRecordQ = new NodeFunctionQueue("transactionCreateInvoiceRecordQ", 10);
const createInvoiceRecordQ = transactionCreateInvoiceRecordQ.wrapQ(paymentProcessor);
export default createInvoiceRecordQ;
```

```javascript
import paymentProcessorQ from "./paymentProcessorQ";
import createPdfQ from "./createPdfQ";
import sendTransactionMailQ from "./sendTransactionMailQ";
import createInvoiceRecordQ from "./createInvoiceRecordQ";

export {paymentProcessorQ, createPdfQ, sendTransactionMailQ, createInvoiceRecordQ}
```


```javascript
import {createInvoiceRecordQ, createPdfQ, sendTransactionMailQ, createInvoiceRecordQ} from "./queues";

webhook.on('payment', async (req, res) => {
	const {payment} = req.body;
	
	const processedPayment = await paymentProcessorQ(payment);
	if (!processedPayment.success) {
		await processError(processedPayment);
		return;
	}
	
	const pdf = await createPdfQ(processedPayment);
	if (!pdf.success) {
		await processError(processedPdf);
		return;
	}
	
	const promises = [sendTransactionMailQ, createInvoiceRecordQ].map(_f => _f(pdf, processedPayment));
	const settled = await Promise.allSettled(promises);
	for (const {status, value} of settled) if (status === "rejected" || !value.success) await processError(value);
});
```

From this point on you can go into distributing the queues across multiple machines or further separate the queues from the main process.

// ToDo Benchmarks
Expect wrap to be fastest and asyncQ to be slowest. As this runs on node only it doesn't need redis and serialization, it should kill on benchmarks. 

// ToDo Tests
