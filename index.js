const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, user) => {
    if (err) {
      return res.status(403).send({ error: true, message: "no access" });
    }
    req.user = user;

    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jgk3xtt.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp";`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const userCollection = client.db("bistroDB").collection("users");
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewsCollection = client.db("bistroDB").collection("reviews");
    const cartCollection = client.db("bistroDB").collection("carts");

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      const query = { email: email };
      const adminCheck = await userCollection.findOne(query);
      if (adminCheck?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Forbidden" });
      }
      next();
    };

    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //user related api
    app.get("/users", authenticateToken, async (req, res) => {
      const allUsers = await userCollection.find().toArray();
      res.send(allUsers);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        console.log("user exist");
        return res.send({ message: "user exist already" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //admin check
    app.get(
      "/users/admin-check/:email",
      authenticateToken,
      async (req, res) => {
        const email = req.params.email;
        if (req.user.email !== email) {
          console.log(req.user.email);
          console.log(email);
          return res
            .status(403)
            .send({ error: true, message: "access denied" });
        }
        const query = { email: email };
        const adminCheck = await userCollection.findOne(query);
        res.send({ admin: adminCheck?.role === "admin" });
      }
    );

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.query.role;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //menu related api
    app.get("/menu", async (req, res) => {
      const menu = await menuCollection.find().toArray();
      res.send(menu);
    });

    app.post("/menu", authenticateToken, verifyAdmin, async (req, res) => {
      const response = await menuCollection.insertOne(req.body);
      res.send(response);
    });

    app.delete(
      "/menu/:id",
      authenticateToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
        res.send(result);
      }
    );

    //reviews related api
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews);
    });

    //carts related api
    app.post("/carts", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get("/carts", authenticateToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      if (req.user.email !== email) {
        return res.status(403).json({ error: true, message: "no access" });
      }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("boss is running");
});

app.listen(port, () => {
  console.log("Listening");
});

/* jwt secret key 
node 
require('crypto').randomBytes(64).toString('hex') */
