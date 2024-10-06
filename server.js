require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");

// SSLCommerz credentials
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWD;
const is_live = false;

// Database connection
const MONGODB_CONNECTION = process.env.MONGODB_CONNECTION;
const client = new MongoClient(MONGODB_CONNECTION, {
  serverApi: ServerApiVersion.v1,
});

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

async function run() {
  try {
    await client.connect();

    const orderCollection = client.db("sslcommerz").collection("order");

    app.post("/payment", async (req, res) => {
      const {
        _cartItem,
        email,
        firstName,
        lastName,
        total_price,
        postCode,
        road,
        city,
        country,
        customersId,
        qnt,
      } = req.body;

      const trans_id = new ObjectId().toString();

      const data = {
        total_amount: total_price,
        currency: "BDT",
        tran_id: trans_id,
        success_url: `http://localhost:8000/payment/success/${trans_id}`,
        fail_url: `http://localhost:8000/payment/fail/${trans_id}`,
        cancel_url: `http://localhost:8000/payment/cancel/${trans_id}`,
        ipn_url: `http://localhost:8000/payment/ipn`,
        shipping_method: "Courier",
        product_name: "something" || "Computer",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: `${firstName} ${lastName}`,
        cus_email: email,
        cus_add1: road,
        cus_city: city,
        cus_postcode: postCode,
        cus_country: country,
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: city,
        ship_city: city,
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

      try {
        const apiResponse = await sslcz.init(data);
        console.log("api response--------------> ", apiResponse.GatewayPageURL);

        const finalOrder = {
          _product: _cartItem,
          paidStatus: false,
          transaction_id: trans_id,
          extraInformation: req.body,
        };
        const result = await orderCollection.insertOne(finalOrder);

        return res.send({
          status: "success",
          url: apiResponse.GatewayPageURL,
          result: result,
        });
      } catch (error) {
        console.log(error);

        return res
          .status(500)
          .send({ status: "error", message: "Internal server error" });
      }
    });

    app.post("/payment/success/:trans_id", async (req, res) => {
      const tran_id = req.params.trans_id;
      const updateResult = await orderCollection.updateOne(
        { transaction_id: tran_id },
        { $set: { paidStatus: true } }
      );

      if (updateResult.modifiedCount > 0) {
        res.redirect(
          `http://localhost:8000/payment/success`
          // `http://localhost:8000/payment/success?tran_id=${tran_id}`
        );
      } else {
        res.redirect(`http://localhost:8000/payment/fail`);
      }
    });

    app.post("/payment/fail/:trans_id", async (req, res) => {
      const tran_id = req.params.trans_id;
      await orderCollection.deleteOne({ transaction_id: tran_id });
      res.redirect(`http://localhost:8000/payment/fail`);
    });
  } catch (error) {
    console.error("Error connecting to database:", error);
  }
}
run();

app.get("/", (req, res) => {
  res.status(200).send("Hello World");
});

app.get("/payment/success", (req, res) => {
  res.send("Payment success");
});

app.get("/payment/fail", (req, res) => {
  res.send("Payment fail");
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
