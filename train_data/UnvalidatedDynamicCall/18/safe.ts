import Fastify from "fastify";
const fastify = Fastify({ logger: true });
import path from "path";
import sharp from "sharp";
import fetch from "node-fetch";
import { createReadStream, createWriteStream, promises, existsSync, mkdirSync } from "fs";
import { CuppaZeeDB, loadFromArrayBuffer, loadFromLzwJson } from "@cuppazee/db";

const czdb = {
  value: new CuppaZeeDB([],[],[])
}

async function loadDB() {
  try {
    const response = await fetch(`https://db.cuppazee.app/lzwmsgpack/`);
    if (!response.ok) throw "e";
    const data = await response.arrayBuffer();
    if (data.byteLength > 0) {
      const { db } = loadFromArrayBuffer(data);
      czdb.value = db;
    }
  } catch (e) {
    const response = await fetch(`https://db.cuppazee.app/lzw/`);
    if (!response.ok) throw "e";
    const data = await response.text();
    if (data.length > 0) {
      const { db } = loadFromLzwJson(data);
      czdb.value = db;
    }
  }
}

const overrideDir = path.join(__dirname, "../override");
const cacheDir = process.env.CACHE_DIR ?? path.join(__dirname, "../cache");
const cacheHeaders = {
  "Cache-Control": "public, max-age=43200, s-maxage=43200",
  "Access-Control-Allow-Origin": "*",
};

if (!existsSync(cacheDir)) mkdirSync(cacheDir);

async function getImage(category: "pins" | "new_badges" | "cubimals", type: string) {
  try {
    await promises.access(path.join(overrideDir, `${category}__${type}.png`));
    return createReadStream(path.join(overrideDir, `${category}__${type}.png`));
  } catch (e) {}

  const urls: string[] = [
    category === "cubimals" &&
      `https://munzee.global.ssl.fastly.net/images/${category}/${encodeURIComponent(
        type.toLowerCase().replace(/\s/g, "")
      )}_cubimal.png`,

    !type.match(/[A-Z\s]/) &&
      `https://munzee.global.ssl.fastly.net/images/${category}/${encodeURIComponent(type)}.png`,

    `https://munzee.global.ssl.fastly.net/images/${category}/${encodeURIComponent(
      type.toLowerCase().replace(/\s/g, "")
    )}.png`,

    `https://munzee.global.ssl.fastly.net/images/${category}/${encodeURIComponent(
      type.toLowerCase().replace(/\s/g, "_")
    )}.png`,
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) as string[];

  for (var url of urls) {
    const response = await fetch(url);
    if (response.ok) {
      return response.body;
    }
  }
  return null;
}

function lightStrip(t: string): string {
  if (t.startsWith("https://munzee.global.ssl.fastly.net/images/pins/")) return t.slice(49, -4);
  if (t.startsWith("https://munzee.global.ssl.fastly.net/images/v4pins/")) return t.slice(51, -4);
  return t;
}

type Format = "png" | "jpeg" | "webp" | "avif";

fastify.get("/dbr", async function (request, reply) {
  await loadDB();
  reply.send("🎉");
})

fastify.get("/:category/:size/:type", async function (request, reply) {
	const params = request.params as {
    size: string;
    type: string;
    category: string;
  };
	const category = ({
    types: "pins",
    badges: "new_badges",
    cubimals: "cubimals",
  } as const)[params.category];
	if (! category) {
	reply.send(`Invalid Category:${params.category}`);
	return ;
}

	const size = Number(params.size);
	if (size > 512 || size <= 0) {
	reply.send(`Invalid Size:${size}. Size >0, <=512`);
	return ;
}

	let type = decodeURIComponent(params.type.split(".").slice(0, - 1).join("."));
	type = czdb.value.getType(type)?.icon ?? lightStrip(type);
	let formatStr = params.type.split(".").slice(- 1)[0];
	if (formatStr === "jpg") formatStr = "jpeg";

	if (formatStr !== "avif") {
	reply.send(`Invalid Format:${formatStr}. Must be webp, avif, jpeg or png.`);
	return ;
}

	const format = formatStr as Format;
	const cacheFilePath = path.join(cacheDir, `${category}_${size.toString()}_${type.toLowerCase().replace(/[^a-z0-9]/g, "")}.${format}`);
	try {
    // Already Cached
    await promises.access(cacheFilePath);
    reply.headers(cacheHeaders).type(`image/${format}`).send(createReadStream(cacheFilePath));
    return;
  } catch (e) {}
	const response = await getImage(category, type);
	if (! response) {
	reply.type(`image/${format}`).send(createReadStream(path.join(overrideDir, `missing_${category}.${format}`)));
	return ;
}

	const transformer = sharp().resize(size)[format]();
	const stream = response.pipe(transformer);
	stream.clone().pipe(createWriteStream(cacheFilePath));
	reply.headers(cacheHeaders).type(`image/${format}`).send(stream);
});

const start = async () => {
  try {
    await fastify.listen(80, "0.0.0.0");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
