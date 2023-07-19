/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
const express = require("express");
const ObjectID = require("mongodb").ObjectID;
const router = express.Router({
  strict: true,
});

router.get("/cursor/:cursor", async (req, res) => {
  try {
    console.log(`URL: ${req.url} | PARAMS:`, req.params);
    const cursor = req.params.cursor || 0;
    const limit = 20;
    console.log(`ARTISTS | GET CURSOR: ${cursor} | LIMIT: ${limit}`);

    const query = cursor !== "0" ? { id: { $gt: cursor } } : {};

    const artists = await global.art47db.Artist.find({ id: { $gt: cursor } })
      .sort()
      .limit(limit)
      .populate("image")
      .lean();

    const nextKey = {};

    if (artists.length < limit) {
      console.log(
        // eslint-disable-next-line no-underscore-dangle
        `XXX END XXXX | FOUND ${artists.length} ARTISTS`
      );
      res.json({ artists: artists });
    } else {
      const lastArtist = artists[artists.length - 1];
      nextKey.id = lastArtist.id;
      nextKey.rate = lastArtist.ratingUser ? lastArtist.ratingUser.rate : null;
      nextKey.score = lastArtist.recommendationUser
        ? lastArtist.recommendationUser.score
        : null;
      nextKey.ratingAverage = lastArtist.ratingAverage;

      console.log(
        `FOUND Artists` +
          ` | NEXT ID: ${nextKey.id}` +
          ` | NEXT RATE: ${nextKey.rate} ` +
          ` | NEXT SCORE: ${nextKey.score}` +
          ` | ${artists.length} ARTISTS`
      );
      res.json({ artists: artists, nextKey: nextKey });
    }
  } catch (err) {
    const message = `GET | ARTISTS | ID: ${req.body.id} | USER ID: ${escape(
      req.params.userid
    )} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});

router.get("/user/:userid/id/:artistId/(:artworks)?", async (req, res) => {
  try {
    const userDoc =
      req.params.userid !== "0"
        ? await global.art47db.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

    const user_id = userDoc ? userDoc._id.toString() : false;
    const artistId = req.params.artistId || false;
    const artworksFlag = req.params.artworks || false;

    console.log(
      `GET Artist | URL: ${req.url}` +
        ` | USER _ID: ${user_id}` +
        ` | ARTIST ID: ${artistId}` +
        ` | ARTWORKS FLAG: ${artworksFlag}`
    );

    let artist;

    if (artworksFlag) {
      console.log("POPULATE artworks");
      artist = await global.art47db.Artist.findOne({ id: artistId })
        .populate("image")
        .populate("artworks")
        .lean();
    } else {
      artist = await global.art47db.Artist.findOne({ id: artistId })
        .populate("image")
        .lean();
    }

    console.log(
      `FOUND ARTIST | ARTWORKS FLAG: ${artworksFlag} | ID: ${artist.id} | _ID: ${artist._id}`
    );

    res.json({ artist: artist });
  } catch (err) {
    console.error(
      `GET | Artist | OAUTHID: ${escape(req.params.userid)} ERROR: ${err}`
    );
    res
      .status(400)
      .send(
        `GET | Artist | OAUTHID: ${req.params.userid} | ERROR: ${err}`
      );
  }
});

router.get("/", async (req, res) => {
  try {
    console.log(`ARTISTS | GET`);

    const docs = await global.art47db.Artist.find({})
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    console.log(`FOUND ${docs.length} Artists`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | Artist | ID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artist | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

module.exports = router;
