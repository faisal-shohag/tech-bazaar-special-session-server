const dns = require("node:dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);

const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dontenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    credentials: true,
    origin: [process.env.CLIENT_URL],
  }),
);
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("tech-bazaar");
    const subscriptionCollection = db.collection("subscription");
    const paymentCollection = db.collection("payment");
    const userCollection = db.collection("user");
    const productCollection = db.collection("products");

    app.post("/subscription", async (req, res) => {
      const { user, session_id } = req.body;

      const isExistSession = await subscriptionCollection.findOne({
        session_id,
      });
      if (isExistSession) {
        return res.status(400).send({ message: "Session already exist" });
      }

      const subs_result = await subscriptionCollection.insertOne({
        userId: new ObjectId(user.id),
        session_id,
      });

      const user_result = await userCollection.updateOne(
        { _id: new ObjectId(user.id) },
        { $set: { plan: "pro" } },
      );

      res.send({ subs_result, user_result });
    });

    app.post("/payment", async (req, res) => {
      const { price, userId, title, productId, session_id } = req.body;

      const isExistSession = await paymentCollection.findOne({ session_id });
      if (isExistSession) {
        return res.status(400).send({ message: "Session already exist" });
      }

      const pay_result = await paymentCollection.insertOne({
        userId,
        session_id,
        price: Number(price),
        title,
        productId,
      });

      res.send({ pay_result });
    });

    app.post("/product", async (req, res) => {
      const data = req.body;
      const result = await productCollection.insertOne({
        ...data,
        price: Number(data.price),
        quantity: Number(data.quantity),
      });
      res.send(result);
    });

    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();

      res.send(result);
    });

    app.get("/product/:id", async (req, res) => {
      const { id } = req.params;
      const result = await productCollection.findOne({ _id: id });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
