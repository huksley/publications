import mongoose from "mongoose";
import express from "express";
import { Client } from "@elastic/elasticsearch";
import path from "path";
import esbuild from "esbuild";
import { Publication } from "./Publication";
import { nanoid } from "nanoid";
const livereload = require("livereload");


const indexName = "publications2";

function startExpressServer(onStart) {
  const app = express();
  app.use(express.static("public"));

  // handle /index.html route with index.html content
  app.get("/index.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  // handle styles.css
  app.get("/styles.css", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "styles.css"));
  });

  // add JSON body parser
  app.use(express.json());

  // save publications
  app.post("/api/publications", async (req, res) => {
    // get publication from request body
    console.info("Received publication", req.body);
    const publication = req.body
    // generate _id
    publication._id = nanoid();

    // add publication to Mongo
    const added = await addPublicationToMongo(publication);
    // add publication to elastic search
    await client.index({
      index: indexName,
      id: added._id,
      body: {
        ...added,
        _id: undefined,
      },
    });
    res.send(added);
  })

  // return a list of publications from elastic search
  app.get("/api/publications", async (req, res) => {
    const body = await client.search({
      index: indexName,
      body: {
        size: 1000,
        query: {
          multi_match: {
            query: req.query.search || "",
            fields: ["title", "text"],
          },
        },
      },
    });

    // convert elastic search hits to publications
    const publications = body.hits.hits.map((hit) => ({
      _id: hit._id,
      ...((hit._source as object) || {}),
    }));
    console.info("Return publications", publications.length);
    res.send(publications);
  });

  // build and service app.tss with esbuild
  app.get("/app.js", async (req, res) => {
    res.setHeader("content-type", "text/javascript");
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, "public/app.tsx")],
      sourcemap: true,
      bundle: true,
      minify: false,
      write: false,
      plugins: [],
      define: {
        "process.env.NODE_ENV": '"development"',
        global: "window",
      },
    });
    res.send(result.outputFiles[0].text);
  });

  // handle all html files from folder public
  app.get("*.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", req.path));
  });

  app.listen(3000, () => {
    console.log("Listening on port 3000");

    const liveReloadServer = livereload.createServer({
      exts: ["html", "css", "js", "ts", "tsx"],
    });
    liveReloadServer.watch(path.join(__dirname, "public"));
    liveReloadServer.server.once("connection", () => {
      setTimeout(() => {
        liveReloadServer.refresh("/");
      }, 100);
    });

    onStart();
  });
}

function getAveragePublicationRank(publications: Publication[]) {
  const sum = publications.reduce((acc, pub) => acc + pub.rank, 0);
  return sum / publications.length;
}

function getPublicationsByAuthor(publications: Publication[], author: string) {
  return publications.filter((pub) => pub.authors.includes(author));
}

function getPublicationsByDate(publications: Publication[], date: Date) {
  return publications.filter((pub) => pub.date >= date);
}

function addPublication(publications: Publication[], publication: Publication) {
  publications.push(publication);
}

// PublicationModel
const PublicationSchema = new mongoose.Schema({
  _id: String,
  title: String,
  rank: Number,
  authors: [String],
  date: Date,
  text: String,
});

// create sample publication
const samplePublication: Publication = {
  _id: nanoid(),
  title: "Sample Publication",
  rank: 1,
  authors: ["John Doe"],
  date: new Date(),
  text: "Sample Publication Text",
};

// connect to Mongo via mongoose
mongoose.set("strictQuery", true);
mongoose.connect("mongodb://localhost:27017/publications");

// create publication model
const PublicationModel = mongoose.model("Publication", PublicationSchema);

// create publication in Mongo
async function addPublicationToMongo(samplePublication) {
  const publication = new PublicationModel(samplePublication);
  publication.save();
  return publication.toObject()
}

addPublicationToMongo(samplePublication);

// get all publications from Mongo
PublicationModel.find({}, (err, publications) => {
  if (err) {
    console.log(err);
  } else {
    console.log("All mongo publications", publications?.length);
  }
});

// Create full text on publications in elastic search
const client = new Client({
  node: "http://localhost:9200",
});

async function createFullTextIndex() {

  // delete index if it exists
  if (!(await client.indices.exists({ index: indexName }))) {
    // await client.indices.delete({ index: indexName });
    // create index
    await client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            title: { type: "text" },
            authors: { type: "text" },
            text: { type: "text" },
          },
        },
      },
    });
  }

  // get all publications from Mongo
  PublicationModel.find({}, async (err, publications: mongoose.Document<string, Publication>[]) => {
    if (err) {
      console.log(err);
    } else {
      // add all publications to elastic search, in batches of 100
      const batch = 100;
      for (let i = 0; i < publications.length; i += batch) {
        const publicationsBatch = publications.slice(i, i + batch);
        // create buik request to add publications to elastic search
        const body = publicationsBatch.flatMap((doc) => {
          const doco = doc.toObject();
          console.info("Adding", doco._id);
          return [
            { index: { _index: indexName, _id: doc._id } },
            {
              ...doco,
              _id: undefined,
            },
          ];
        });

        await client.bulk({ refresh: true, body }).then((res) => {
          console.warn(
            "Bulk error",
            res.items.filter((item) => item.index?.error).map((item) => item.index?.error)
          );
          console.warn("Bulk added", res.items.filter((item) => item.index?.result === "created").length);
        });

        await client.indices.refresh({ index: indexName });

        client.count({ index: indexName }).then((res) => {
          console.log("Number of publications in elastic search:", res.count);
        });
      }
    }
  });
}

startExpressServer(() => {
  createFullTextIndex();
});
