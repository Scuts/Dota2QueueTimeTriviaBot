import fs from "fs";
import { MongoClient } from "mongodb";
import config from "./config.json";
let heroesText = fs.readFileSync(`dotaconstants\\build\\heroes.json`, 'utf8');
let heroes = Object.values(JSON.parse(heroesText));
console.log(heroes);
const uri = config.uri;
const mongoClient = new MongoClient(uri);
mongoClient.connect(err => {
    const collection = mongoClient.db("qttDB").collection("heroes");
    collection.deleteMany({}).then(results => {
        collection.insertMany(heroes);
    });
});
