/*

This code was greatly expanded from a nodejs example for a receiver that authenticates Twitch's signature:
https://github.com/BarryCarlyon/twitch_misc/blob/master/webhooks/handlers/nodejs/receive.js

*/

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fetch, { Response } from 'node-fetch';
import moment from 'moment';
import { TwitchSearchChannelsReturns, XClient } from 'src/gm';
import express, { Router } from 'express';
import { IncomingMessage } from 'http';
import { Bot } from '../../bot.js';
import { Channel, TextChannel } from 'discord.js';
import { fileURLToPath } from 'url';
// import { eq } from 'lodash';
// url and querystring for parsing url queries
// import url from 'url';
// import querystring from 'querystring';

// Load configuation
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join( __dirname, '../../../auth.json')).toString()).TWITCH;

// "subscription": {
// "id": "f1c2a387-161a-49f9-a165-0f21d7a4e1c4",
// "type": "stream.online",
// "version": "1",
// "status": "enabled",
// "cost": 0,
// "condition": {
// "broadcaster_user_id": "1337"
// },
// "transport": {
// "method": "webhook",
// "callback": "https://example.com/webhooks/callback"
// },
// "created_at": "2019-11-16T10:11:12.123Z"
// },
// "event": {
// "id": "9001",
// "broadcaster_user_id": "1337",
// "broadcaster_user_login": "cool_user",
// "broadcaster_user_name": "Cool_User",
// "type": "live",
// "started_at": "2020-10-11T10:11:12.123Z"
// }

interface ExternalTwitchRequestStructure {
    challenge?: string;
    subscription?: {
        id: string;
        status: string;
        type: string;
        version: string;
        cost: number;
        condition: {
            broadcaster_user_id?: string;
        };
        transport?: {// it doesn't seem like the transport property is gauranteed (it isn't in the object in the reference)
            method: string;
            callback?: string;
            secret?: string;
        };
        created_at: string;
    };
    event?: {
        // stream online event
        id?: string;
        broadcaster_user_id?: string;
        broadcaster_user_login?: string;
        broadcaster_user_name?: string;
        type?: 'live' | 'playlist' | 'watch_party' | 'premiere' | 'rerun';
        started_at?: string;
        // auth revoke event
        client_id?: string;
        user_id?: string;
        user_login?: string;
        user_name?: string;
    }
}

let currToken: string;
let tokenExpiresIn = 0;
setInterval(() => {
    tokenExpiresIn--;
}, 1000);

interface CustomIncoming extends IncomingMessage {
    /**
     * Whether this request contains the headers of an eventsub request
     */
    twitch_eventsub: boolean;
    twitch_hex: string;
    twitch_signature: string;
}

export function twitchRouter(client: XClient): Router {
    const router = express.Router();

    // Middleware!
    // Express allows whats called middle ware
    // it runs before (or after) other parts of the route runs
    router.use(express.json({
        verify(req: CustomIncoming, res, buf/*, encoding*/) {
            // is there a hub to verify against
            req.twitch_eventsub = false;
            if (req.headers && typeof req.headers['twitch-eventsub-message-signature'] === "string" && typeof req.headers['twitch-eventsub-message-id'] === "string" && typeof req.headers['twitch-eventsub-message-timestamp'] === "string") {
                req.twitch_eventsub = true;

                const id = req.headers['twitch-eventsub-message-id'];
                const stamp = req.headers['twitch-eventsub-message-timestamp'];
                const [algo, sig] = req.headers['twitch-eventsub-message-signature'].split("=");

                if (req.headers["content-length"] !== `${buf.length}`) {
                    xlg.log(`Possibly corrupted paylod data may have been received (intended content length does not match raw bytes length)`);
                }

                // xlg.log("old hmac ", crypto.createHmac(algo, config.hub_secret)
                //     .update(buf)
                //     // .update(req.headers['twitch-eventsub-message-id'] + req.headers['twitch-eventsub-message-timestamp'])
                //     .digest('hex'))
                req.twitch_hex = crypto.createHmac(algo, config.hub_secret)
                    .update(id + stamp + buf) // from the pseudo code in the docs
                    .digest('hex');
                req.twitch_signature = sig;
            } else {
                xlg.log("Invalid Twitch request body")
            }
        }
    }));

    router.get("/hooks", async (req, res) => {
        if (req.query.pass !== "cantbreakin") return res.sendStatus(401);
        const status = req.query.s && typeof req.query.s === "string" && ['enabled', 'webhook_callback_verification_pending', 'webhook_callback_verification_failed', 'notification_failures_exceeded', 'authorization_revoked', 'user_removed'].includes(req.query.s) ? <'enabled' | 'webhook_callback_verification_pending' | 'webhook_callback_verification_failed' | 'notification_failures_exceeded' | 'authorization_revoked' | 'user_removed'>req.query.s : undefined;
        res.json(await getAllSubscriptions(status));
    });

    router.get("/search", async (req, res) => {
        try {
            if (typeof req.query.q !== "string" || !req.query.q) {
                return res.sendStatus(400);
            }
            const first = typeof req.query.l === "string" && parseInt(req.query.l, 10) < 101 ? parseInt(req.query.l, 10) : 10;
            // if (!req.user) {
            //     return res.sendStatus(401);
            // }
            const q = decodeURIComponent(req.query.q);
            await getOAuth();
            if (!currToken || !currToken.length) return res.send("bad token");
            const r = await fetch(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(q)}&first=${first}`, {
                method: "GET",
                headers: {
                    "Client-ID": `${config.client_id}`,
                    "Authorization": `Bearer ${currToken}`
                }
            });
            const j = await r.json() as { data: TwitchSearchChannelsReturns[], pagination: { cursor: string } };
            if (j.data) {
                return res.json(j.data);
            }
            res.json(j);
        } catch (error) {
            xlg.error(error)
            return res.sendStatus(500);
        }
    });
    
    /*router.get("/unsubscribe", async (req, res) => {
        if (req.query.pass !== "cantbreakin") return;
        const who = req.query.u;
        if (!who) {
            res.send("Username not specified")
            console.log("unsub u not specified");
            return
        }
        await getOAuth();
        await unregisterTwitchWebhook(who);
        res.send(`Unsubscribed from: ${who}`)
    })*/

    // Routes
    router.get('/', (req, res) => {
        // console.log("GET request", JSON.stringify(req.body, null, 2))
        xlg.log('Incoming Get request on /api/twitch\nApparent unauthorized request at API endpoint for Twitch');
        res.sendStatus(401);// it is unauthorized, so treating it as such
    });

    // stuff for handling the api endpoint for twitch (post)
    router.post("/", async (req, res) => {
        try {
            // xlg.log('Incoming Post request on /api/twitch', req.headers, req.body);
            xlg.log('Incoming Post request on /api/twitch');
            // this will be true if the security 
            // middleware already validated the request
            // headers for eventsub and prepared the signature tests
            if (req.twitch_eventsub) {
                const msg_type = typeof req.headers['twitch-eventsub-message-type'] === "string" ? req.headers['twitch-eventsub-message-type'] : null;
                if (req.twitch_hex !== req.twitch_signature) {
                    // xlg.log('Tested signature did not pass');
                    // the signature was invalid
                    return res.sendStatus(401);
                    //res.send('Ok');// we'll ok for now but there are other options
                }
                xlg.log('Twitch signature matched');
                // the signature passed the test so it should be a valid payload from Twitch
                // we ok as quickly as possible
                // you can do whatever you want with the data
                // it's in req.body
                // if (req.query.streamer && req.query.streamer.length) {
                if (req.body) {
                    // xlg.log("twitch has data, message type", msg_type)
                    const dat: ExternalTwitchRequestStructure = req.body;
                    if (msg_type === "webhook_callback_verification") {
                        // xlg.log("Got Twitch callback verification")
                        if (typeof dat.challenge === "string") {
                            // xlg.log('and got a challenge:', dat.challenge);
                            // awknowledging the twitch challenge to pass the callback test
                            return res.send(encodeURIComponent(dat.challenge));
                        }
                        return res.sendStatus(403);
                    } else if (msg_type === "revocation") {
                        xlg.log("Twitch subscription revoked");
                        if (dat.subscription?.condition.broadcaster_user_id) {
                            await Bot.client.database.removeAllTwitchStreamerSubscriptions(dat.subscription.condition.broadcaster_user_id);
                        } else {
                            return res.sendStatus(403);
                        }
                        return res.sendStatus(200);
                    } else if (msg_type === "notification" && dat.event && dat.subscription && !('challenge' in dat)) {
                        try {
                            // xlg.log("got a possible event, sending 200 immediately")
                            res.sendStatus(202);// not returning on this one so script will continue, return at end of block
                            // twitch sender
                            if (dat.event.broadcaster_user_id && dat.event.broadcaster_user_login && dat.event.broadcaster_user_name && dat.event.id && dat.event.type && dat.event.started_at && dat.subscription.type === "stream.online") {
                                // xlg.log("Definitely an online event")
                                const subs = await Bot.client.database.getTwitchSubsForID(dat.event.broadcaster_user_id);
                                if (subs && subs.length) {
                                    for (let i = 0; i < subs.length; i++) {
                                        const sub = subs[i];
                                        const diff = Math.abs(moment(dat.event.started_at).diff(sub.laststream, "seconds"));
                                        if (diff < 100) continue;
                                        const channels = await client.specials.shards.getAllChannels();
                                        if (channels) {
                                            const channel = channels.find(c => c.id === sub.channelid);
                                            if (channel) {
                                                /*
                                                    "id": "3d141868-46ed-4ef8-cd09-1fbb4f845355",
                                                    "user_id": "56145452",
                                                    "user_login": "testBroadcaster",
                                                    "user_name": "testBroadcaster",
                                                    "game_id": "509658",
                                                    "game_name": "Just Chatting",
                                                    "type": "live",
                                                    "title": "Example title from the CLI!",
                                                    "viewer_count": 9848,
                                                    "started_at": "2021-03-20T03:18:50Z",
                                                    "language": "en",
                                                    "thumbnail_url": "https://static-cdn.jtvnw.net/previews-ttv/live_twitch_user-{width}x{height}.jpg",
                                                    "tag_ids": []
                                                */
                                                const name = dat.event.broadcaster_user_name;
                                                const link = `https://twitch.tv/${dat.event.broadcaster_user_name}`;
                                                const msg = sub.message || "";
                                                const game = "";// *
                                                const title = "";// *
                                                const message = `${msg.replace(/\{name\}/g, name).replace(/\{link\}/g, link).replace(/\{game\}/g, game).replace(/\{title\}/g, title) || `${name} just went live!`}${!/\{link\}/g.exec(msg)?.length ? `\n${link}` : ""}`;
                                                if (client.shard) {
                                                    await client.shard.broadcastEval((client, { sub, message }) => {
                                                        const c = client.channels.cache.get(sub.channelid);
                                                        if (c && c.isText()) {
                                                            c.send(`${message}`);
                                                        }
                                                    }, { context: { sub, message } });
                                                }
                                                // channel.send(\`${ sub.message || `${req.body.data[0].user_name} just went live!` }\nhttps://twitch.tv/${req.body.data[0].user_name}\`)
                                                //channel.send(`${sub.message || `${req.body.data[0].user_name} just went live!`}\nhttps://twitch.tv/${req.body.data[0].user_name}`)
                                                if (sub.delafter > -1 && sub.delafter <= sub.notified) {
                                                    Bot.client.database.removeTwitchSubscription(sub.streamerid, sub.guildid);
                                                }
                                            }
                                        }
                                    }
                                    await Bot.client.database.incrementTwitchNotified(dat.event.broadcaster_user_id, dat.event.started_at);
                                }
                            }
                        } catch (error) {
                            xlg.error("Twitch stream online event receive error", error)
                        }
                        return;
                    } else {
                        xlg.log("Unknown request type:", msg_type)
                        return res.sendStatus(401);
                    }
                }
                // xlg.log("ended at end")
                // } else {
                //     console.log('Received a Twitch payload with no id query param');
                // }
                return res.sendStatus(102);
            } else {
                xlg.log(`Twitch reception didn't seem to be a hook or request`);
                // again, not normally called
                return res.sendStatus(403);
                //res.send('Ok');// but dump out a OK
            }
        } catch (error) {
            xlg.error(error);
            return res.sendStatus(500);
        }
    });

    return router;
}

export async function addTwitchWebhook(username: string, isID = false, guildid?: string, targetChannel?: Channel, message?: string, editing = false, delafter = -1): Promise<boolean | 'ID_NOT_FOUND' | 'ALREADY_EXISTS'> {
    //if (!token) token = (await getOAuth()).access_token;
    //if (!token) return false;
    await getOAuth();
    let uid;
    if (isID) {
        uid = await idLookup(username, true);
    } else {
        uid = await idLookup(username);
    }
    const id: string = !uid || !uid.data || !uid.data[0] || !uid.data[0].id ? null : uid.data[0].id
    if (!id) return "ID_NOT_FOUND";
    let preexists = false;
    if (guildid) {
        const existingSubs = await Bot.client.database.getTwitchSubsForID(uid.data[0].id);
        if (existingSubs && existingSubs.length) {
            for (let i = 0; i < existingSubs.length; i++) {
                const sub = existingSubs[i];
                if (sub.streamerid === id && guildid === sub.guildid) {
                    if (sub.laststream && Math.abs(moment().diff(sub.laststream, "ms")) < 1000 * 60 * 60 * 24 * 10) {//FIXME: this "retry for inactivity" practice can draw a lot of 409 errors
                        preexists = true;
                        if (!editing) {
                            await addTwitchWebhook(id, true);
                            return "ALREADY_EXISTS";
                        }
                    } else {
                        break;
                    }
                }
            }
        }
    }
    let subid = "";
    if (!preexists) {
        const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
            method: 'POST',
            body: JSON.stringify({
                "type": "stream.online",
                "version": "1",
                "transport": {
                    "method": "webhook",
                    "callback": `${config.callback_domain}/api/twitch`,// ${config.callback_domain}/api/twitch?streamer=${uid.data[0].id}
                    "secret": config.hub_secret,
                },
                "condition": {
                    "broadcaster_user_id": `${id}`
                }
                // "hub.topic": `https://api.twitch.tv/helix/streams?user_id=${uid.data[0].id}`,
                // "hub.lease_seconds": 864000,// 864000
            }),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currToken}`,
                "Client-ID": `${config.client_id}`
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;//TODO: assert type is correct
        const j = await res.json();
        if (`${res.status}`.startsWith("2") && j.data[0].id) {
            subid = j.data[0].id
        }
        // if (!res) return false;// commenting this out to remark that this what null-checked to return failure if the sub wasn't created, but that would actually be checked if a response code of 4xx was received
    }

    if (guildid && targetChannel && targetChannel instanceof TextChannel) {
        const subRes = await Bot.client.database.addTwitchSubscription(uid.data[0].id, guildid, targetChannel.id, 864000 * 1000, message, uid.data[0].display_name || uid.data[0].login, delafter, 0, subid);
        if (!subRes) return false;
        if (uid.data[0].display_name || uid.data[0].login) {
            targetChannel.send(`This is a test message for the set Twitch notification.\nhttps://twitch.tv/${uid.data[0].display_name || uid.data[0].login}`);
        } else {
            targetChannel.send("This is a test message for the set Twitch notification.");
        }
    }

    return true;
}

/**
 * Remove the webhook registration from the twitch registry itself
 * This is not removing subscriptions from the database, this is removing the actual webhook subscription for a particular user
 * @param id the id of the user (you may have to look it up first {@link idLookup})
 */
export async function unregisterTwitchWebhook(id: string): Promise<Response> {
    await getOAuth();
	// const uid = await idLookup(username);
    const res = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`, {
        method: 'DELETE',
        headers: {
            // "Content-Type": "application/json",
            "Authorization": `Bearer ${currToken}`,
            "Client-ID": `${config.client_id}`
        }
    });
    return res;
}

/**
 * Remove the subscription for a particular user (selected by its username, not id) from the database
 * This is not deleting the subscription in the twitch registry, though it will do so if no more subscriptions are registered in the database
 */
export async function unsubscribeTwitchSubscription(username: string, guildid: string): Promise<boolean | string> {
    await getOAuth();
    const uid = await idLookup(username);
    if (!uid) {
        return "NO_DATA";
    }
    if (uid.status === 400 || !uid.data) {
        return "INVALID";
    }
    if (!uid.data[0] || !uid.data[0].id) {
        return "NO_USER";
    }
    /*if () {
        return false;
    }*/
    const id = uid.data[0].id;
    const subid = await Bot.client.database.getTwitchSubIDForStreamerID(id);
    const remres = await Bot.client.database.removeTwitchSubscription(id, guildid)
    if ((remres || remres === 0) && remres < 1) {
        return "NO_SUBSCRIPTION";
    }
    const allSubscriptions = await Bot.client.database.getTwitchSubsForID(id);
    if (allSubscriptions && !allSubscriptions.length && subid) {
        await unregisterTwitchWebhook(subid);
    }
    return true;
}

/**
 * Perform oauth token lookup and refresh on the twitch api
 */
async function getOAuth() {
    try {
        if (tokenExpiresIn > 60) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${config.client_id}&client_secret=${config.client_secret}&grant_type=client_credentials&scope=user:read:email`, { method: "POST" }) as any;//TODO: assert type is correct
        const j = await result.json();
        if (!j || !j.access_token) {
            xlg.error("Couldn't retrieve access token", j);
            return false;
        }
        currToken = j.access_token;
    } catch (error) {
        xlg.error(error);
    }
}

async function idLookup(username: string, isid = false) {
    await getOAuth();
    let lquery = "login";
    if (isid) {
        lquery = "id";
    }
	const response = await fetch(`https://api.twitch.tv/helix/users?${lquery}=${username}`, {
		method: 'GET',
		headers: {
			"Client-ID": `${config.client_id}`,
            "Authorization": `Bearer ${currToken}`
		}
	})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await response.json() as any;//TODO: explicity assert type is correct
	return json;
}

async function getAllSubscriptions(status?: 'enabled' | 'webhook_callback_verification_pending' | 'webhook_callback_verification_failed' | 'notification_failures_exceeded' | 'authorization_revoked' | 'user_removed') {// this was not a function originally
    await getOAuth();
    // if (!currToken || !currToken.length) return res.send("bad token");
    const r = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?first=100${status ? `&status=${status}` : ""}`, {
        method: "GET",
        headers: {
            "Client-ID": `${config.client_id}`,
            "Authorization": `Bearer ${currToken}`
        }
    });
    const j = await r.json();
    return j;
}

/*async function startHookExpirationManagement() {
    return null;
}*/
// setInterval(async () => {
//     try {
//         await getOAuth();
//         const response = await fetch("https://api.twitch.tv/helix/webhooks/subscriptions?first=100", {
//             method: "GET",
//             headers: {
//                 "Client-ID": `${config.client_id}`,
//                 "Authorization": `Bearer ${currToken}`
//             }
//         });
//         const json = await response.json();
//         // checking to see if any webhooks are registered
//         if (json.total > 0) {
//             const hooks = json.data;
//             // iterating through to renew ones that need it
//             for (let i = 0; i < hooks.length; i++) {
//                 const hook = hooks[i];
//                 //console.log(`time: ${moment(hook.expires_at).diff(moment()) <= 86400000} ${moment(hook.expires_at).diff(moment()) - 86400000}`)
//                 const dff = moment(hook.expires_at).diff(moment());
//                 //console.log(`${dff} < 86400000`)
//                 if (dff <= 86400000) {
//                     // parsing query strings from the callback url
//                     const parsedUrl = url.parse(hook.callback);
//                     const parsedQs = querystring.parse(parsedUrl.query || "");
//                     if (parsedQs.streamer && typeof parsedQs.streamer === "string") {
//                         await addTwitchWebhook(parsedQs.streamer, true);
//                     }
//                 }
//             }
//         }
//     } catch (error) {
//         xlg.error(error);
//     }
// }, 60000)

/*exports.addTwitchWebhook = addTwitchWebhook;
exports.unregisterTwitchWebhook = unregisterTwitchWebhook;
exports.twitchIDLookup = idLookup;*/
//startHookExpirationManagement();
//exports.twitchRouter = router;
//exports.addTwitchWebhook = addTwitchWebhook;
//exports.unregisterTwitchWebhook = unregisterTwitchWebhook;
//exports.unsubscribeTwitchWebhook = unsubscribeTwitchWebhook;
//exports.configTwitchClient = configTwitchClient;

/*(async () => {
	try {
		startTwitchListening();
		const oares = await getOAuth();
		console.log((await addTwitchWebhook("EnigmaDigm", oares.access_token)))
	} catch(err) {
		console.error(err)
	}
})();*/

