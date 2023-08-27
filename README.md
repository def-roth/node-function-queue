# Fully agnostic node queue

Usually when working with queues you are using callbacks. This can be a bit of a pain to work with. This module allows
you to use promises in async/await - style instead.

### Import

```javascript
import {NodeFunctionQueue} from "node-function-queue";

const transactionQ = new NodeFunctionQueue();
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

## Usual callback queue

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

## Promise Queue

```javascript
const transactionQ = new NodeFunctionQueue();
const asyncQ = transactionQ.asyncQ;

webhook.on('payment', async (req, res) => {
	const {payment} = req.body;
	
	// an error is thrown if the promise is rejected or maximum retries are reached
	const processedPayment = await asyncQ(() => paymentProcessor(payment));
	if (!processedPayment.success) {
		await processError(processedPdf);
		return;
	}
	
	const processedPdf = await asyncQ(() => createPdf(processedPayment));
	if (!processedPdf.success) {
		await processError(processedPdf);
		return;
	}
	
	const promises = [
		asyncQ(() => sendTransactionMail(pdf, processedPayment)),
		asyncQ(() => createInvoiceRecord(pdf, processedPayment)),
	];
	
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

Due to the agnostic nature of this module, you can use it for anything what is a promise. This includes calling your mom on sunday.


