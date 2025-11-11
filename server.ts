import "dotenv/config";

import fs from "fs";
import express from "express";
import { join, basename } from "path";
import * as zip from "@zip.js/zip.js";

type Level = {
    songName: string,
    songAuthor: string,
    levelAuthor: string,
    url: string
};
const levels: Record<string, Level> = {};

const { ORIGIN, HOSTNAME } = process.env;

const handleFile = async path => {
    if(!fs.existsSync(path)) {
        if(path in levels) delete levels[path];
        console.log(`Deleted ${path}!`);
        return;
    }
    const level = fs.readFileSync(path);
    let reader, entries;
    try {
        reader = new zip.ZipReader(new zip.Uint8ArrayReader(level));
        entries = await reader.getEntries();
    } catch(_) { return; }
    for(const entry of entries) {
        if(entry.filename !== "meta.json") continue;
        if(entry.directory) continue;
        const text = await entry.getData?.(new zip.TextWriter());
        if(text === undefined) continue;

        const meta = JSON.parse(text);
        const { songName, songProducer, levelAuthor } = meta;
        if(!songName || !songProducer || !levelAuthor) return;

        levels[path] = {
            url: "/" + basename(path),
            songName,
            songAuthor: songProducer,
            levelAuthor
        };
        console.log(`Updated ${path}!`);
    }
};

console.log("Reading levels...");
await Promise.all(fs.readdirSync("levels").map(async path => await handleFile(join("levels", path))));

fs.watch("levels", {}, async (etype, name) => await handleFile(join("levels", name || "nonexistent")));

const app = express();
app.get("/", (req, res) => {
    res.header("Access-Control-Allow-Origin", ORIGIN || "*");
    res.send(Object.values(levels).map(x => {
        x = { ...x };
        x.url = new URL(x.url, HOSTNAME || "http://localhost").href;
        return x;
    }));
});
app.use(express.static("levels"));

app.listen(50960, () => console.log(`listening at :50960!`));