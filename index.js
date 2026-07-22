const dns = require("node:dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);

const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).send({ msg: "Unauthorized" });
  }
  // "Bearer zjxashsahjdhj".split(" ") // ["Bearer", "xsghagshsf"]
  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).send({ msg: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload
    next();
  } catch (error) {
    console.log(error);
    res.status(401).send({ msg: "Unauthorized" });
  }

};

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

    app.post("/product", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await productCollection.insertOne({
        ...data,
        price: Number(data.price),
        quantity: Number(data.quantity),
      });
      res.send(result);
    });

    /**
     *     query = {title: {$regex: searchText, $options: "i"}}
     *
     */

    app.get("/products", async (req, res) => {
      const searchText = req.query.search || "";
      let query = {};
      query.$or = [
        { title: { $regex: searchText, $options: "i" } },
        { description: { $regex: searchText, $options: "i" } },
      ];

      const result = await productCollection.find(query).toArray();

      res.send(result);
    });

    /**
     * 1. total_page = Math.ceil(total_data/limit)
     * 2. skip = (page-1) * limit
     */

    app.get("/seller/products", verifyToken,  async (req, res) => {
      const limit = Number(req.query.limit) || 10;
      const page = Number(req.query.page) || 1;
      const user = req.user

      const total_data = await productCollection.countDocuments();
      const total_page = Math.ceil(total_data / limit);

      const skip = (page - 1) * limit;

      const data = await productCollection
        .find({userId: user.id})
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({ total_page, skip, page, data });
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
