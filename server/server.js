const express = require("express");
const app = express();
const { resolve } = require("path");
// Replace if using a different env file or config
const env = require("dotenv").config({ path: "./.env" });
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
});

const cors = require("cors");
// Define the CORS options
const corsOptions = {
  credentials: true,
  // origin: ['http://localhost:3000', 'http://localhost:4200'] // Whitelist the domains you want to allow
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(process.env.STATIC_DIR));

app.get("/", (req, res) => {
  const path = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(path);
});

app.get("/config", (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.post("/create-customer-stripe", async (req, res) => {
  const { name, email } = req.body;
  try {
    const customer = await stripe.customers.create({
      name: name,
      email: email,
    });
    res.send({
      customerId: customer?.id,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/:customerId/payment_methods", async (req, res) => {
  try {
    var customerId = req.params.customerId;
    console.log("customerId", customerId);

    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      {
        limit: 10,
      }
    );
    res.send({ paymentMethods: paymentMethods });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, customer } = req.body;
  console.log("req.body====1", req.body);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer,
      setup_future_usage: "off_session",
      automatic_payment_methods: {
        enabled: true,
      },
    });
    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Retrieve a PaymentMethod
app.get("/retrieve-paymentmethod/:pmID", async (req, res) => {
  var paymentID = req.params.pmID;
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentID);
    res.status(200).send({
      paymentMethod,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

//Detach a PaymentMethod from a Customer
app.post("/detach-payment/:pmID", async (req, res) => {
  var paymentID = req.params.pmID;

  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentID);
    res.status(200).send({
      paymentMethod,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// attach payment method
app.post("/attach-payment-method", async (req, res) => {
  const { paymentMethodId, customerId } = req.body;

  try {
    // link Payment Method with Customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    // update Customer with default paymentmethod
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    res.json({ message: "Payment method set as default successfully." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// attach payment method
app.post("/link-payment-customer", async (req, res) => {
  const { paymentMethodId, customerId } = req.body;

  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    console.log("paymentMethod", paymentMethod);

    res.json({ message: "Payment method set as default successfully." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/update-payment-intent", async (req, res) => {
  const { paymentIntentId, paymentMethodId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(
      paymentIntentId
    );

    res.json({ paymentIntent: confirmedPaymentIntent });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// API tạo và xác nhận thanh toán
app.post("/create-payment", async (req, res) => {
  const { paymentMethodId, amount, customer, currency } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
    });

    res.status(200).json({ success: true, paymentIntent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET  /v1/payment_intents/:id

app.get("/retrieve-paymentmethod/:pmID", async (req, res) => {
  var paymentID = req.params.pmID;
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      "pi_3MtwBwLkdIwHu7ix28a3tqPa"
    );
    res.status(200).send({
      paymentMethod,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// API tạo và xác nhận thanh toán
app.post("/update-payment-methods", async (req, res) => {
  const { paymentMethodId, exp_month, exp_year } = req.body;
  try {
    const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, {
      metadata: {
        order_id: "6735",
      },
      card: {
        exp_month,
        exp_year,
      },
    });
    console.log("paymentMethod", paymentMethod);

    res.status(200).json({ success: true, paymentIntent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Express.js example - Liên kết Payment Method với Customer
app.post("/attach-payment-method-default", async (req, res) => {
  const { paymentMethodId, customerId, exp_month, exp_year, setDefault } =
    req.body;
  try {
    // Update Customer with default payment method
    if (setDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    // or update exp_month , exp_year
    const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, {
      card: {
        exp_month,
        exp_year,
      },
    });

    res.json({ message: "Payment method set as default successfully." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.get("/get-list-payment-method-customer/:id", async (req, res) => {
  var customerId = req.params.id;
  try {
    // Get Customer to test the default method
    const customer = await stripe.customers.retrieve(customerId);

    // Get the customer's Payment Methods list
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    // Specify the default Payment Method
    const defaultPaymentMethodId =
      customer.invoice_settings.default_payment_method;

    // Mark any default payment methods
    const paymentMethodsWithDefaultFlag = paymentMethods.data.map((method) => ({
      ...method,
      isDefault: method.id === defaultPaymentMethodId,
    }));

    res.send({
      result: paymentMethodsWithDefaultFlag,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(5252, () =>
  console.log(`Node server listening at http://localhost:5252`)
);
