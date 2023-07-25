'use strict';

const functionVersion = '0.0.7'
const functions = require('firebase-functions'); // Cloud Functions for Firebase library
const DialogflowApp = require('actions-on-google').DialogflowApp;
// Google Assistant helper library
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    // console.log(`Dialogflow Request headers: ${JSON.stringify(request.headers)}`);
    console.log(`Dialogflow Request body: ${JSON.stringify(request.body)}`);
    if (request.body.queryResult) {
        return processV2Request(request, response);
    } else {
        console.log('Invalid Request');
        return response.status(400).end('Invalid Webhook Request (expecting v2 webhook request)');
    }
});
// Imports the Google Cloud client library
const Datastore = require('@google-cloud/datastore');

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/*
Ok je vais ajouter {{type}} à la liste
C'est noté ! J'ai ajouté {{type}} à la liste
J'ai ajouté {{type}} à la liste
{{type}} a bien été ajouté à la liste
Ok je vais ajouter "{{thing}}" à la liste
"{{thing}}" a bien été ajouté à la liste
J'ajoute "{{thing}}" à la liste
*/

function translateType(type) {
    return type.replace('movie', 'film').replace('serie', 'série').replace('music', 'musique');
}

/*
* Function to handle v2 webhook requests from Dialogflow
*/
function processV2Request(request, response) {
    // An action is a string used to identify what needs to be done in fulfillment
    let action = (request.body.queryResult.action) ? request.body.queryResult.action : 'default';
    console.log("\n", 'got action "' + action + '"', "\n")
    // the fulfillment text from DialogFlow
    // let fulfillmentText = request.body.queryResult.fulfillmentText;
    // Parameters are any entities that Dialogflow has extracted from the request.
    let parameters = request.body.queryResult.parameters || {}; // https://dialogflow.com/docs/actions-and-parameters
    // if all params has been given
    // let allRequiredParamsPresent = request.body.queryResult.allRequiredParamsPresent;
    // Contexts are objects used to track and store conversation state
    let inputContexts = request.body.queryResult.contexts; // https://dialogflow.com/docs/contexts
    let outputContexts = request.body.queryResult.outputContexts; // https://dialogflow.com/docs/contexts
    // Get the request source (Google Assistant, Slack, API, etc)
    let requestSource = (request.body.originalDetectIntentRequest) ? request.body.originalDetectIntentRequest.source : undefined;
    // Get the session ID to differentiate calls from different users
    let session = (request.body.session) ? request.body.session : undefined;
    let thing = parameters['thing-to-watch'];
    if (!thing && outputContexts && outputContexts.length) {
        outputContexts.forEach(outputContext => {
            if (!thing && outputContext.parameters && outputContext.parameters['thing-to-watch']) {
                thing = outputContext.parameters['thing-to-watch'];
            }
        })
        console.log('thing was not given in parameters')
        console.log((thing && thing.length ? 'but thing was found' : 'and also not found') + ' in output context')
    }
    let type = parameters['type-of-thing'];
    let thisType = type.replace('movie', 'ce film').replace('serie', 'cette série').replace('music', 'cette musique');
    let fulfillmentText = '';
    let res = {};
    let addRichResponse = false;
    // Create handlers for Dialogflow actions as well as a 'default' handler
    const actionHandlers = {
        // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
        'input.welcome': () => {
            sendResponse('Réponse à input.welcome'); // Send simple response to user
        },
        // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
        'input.unknown': () => {
            // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
            sendResponse('Réponse à input.unknown'); // Send simple response to user
        },
        'see-watchlist': () => {
            getWatchlist(type).then(items => {
                fulfillmentText = 'Voici les derniers ajouts :' + "\n";
                items.forEach((item, index) => {
                    fulfillmentText += item.title
                    if (!type) {
                        fulfillmentText += ` (${translateType(item.type)})`
                    }
                    if (index === (items.length - 2)) {
                        // before last
                        fulfillmentText += ' & '
                    } else if (index === (items.length - 1)) {
                        // last
                        fulfillmentText += '.'
                    } else {
                        // others
                        fulfillmentText += ', '
                    }
                });
                return sendResponse({ fulfillmentText });
            }).catch(err => console.error('Error while handling see-watchlist action', err))
        },
        'add-to-watchlist': () => {
            if (thing.length && type.length) {
                // Case 1 : we have thing & type
                fulfillmentText = 'Ok je vais ajouter {type} "{thing}" à la liste';
                addToWatchlist(thing, type)
            } else if (thing.length) {
                // Case 2 : we have only thing
                fulfillmentText = '"{thing}" ? C\'est un film, une série, une musique ?';
                // ask for type
                addRichResponse = true;
            } else {
                // Case 3 : we miss thing
                fulfillmentText = 'Je n\'ai pas saisi votre demande, quelle oeuvre essayez-vous d\'ajouter ?';
            }
            fulfillmentText = fulfillmentText.replace('{type}', thisType);
            fulfillmentText = fulfillmentText.replace('{thing}', thing)
            fulfillmentText = capitalizeFirstLetter(fulfillmentText);
            if (addRichResponse) {
                res.fulfillmentMessages = buildRichResponseV2(fulfillmentText, fulfillmentText);
            }
            res.fulfillmentText = fulfillmentText;
            sendResponse(res);
        },
        // Default handler for unknown or undefined actions
        'default': () => {
            fulfillmentText = 'Je n\'ai pas saisi votre demande, quelle oeuvre essayez-vous d\'ajouter ?';
            sendResponse({ fulfillmentText });
        }
    };

    // If undefined or unknown action use the default handler
    if (!actionHandlers[action]) {
        action = 'default';
    }

    // Run the proper handler function to handle the request from Dialogflow
    actionHandlers[action]();

    // Function to send correctly formatted responses to Dialogflow which are then sent to the user
    function sendResponse(responseToUser) {
        // if the response is a string send it as a response to the user
        if (typeof responseToUser === 'string') {
            let responseJson = { fulfillmentText: responseToUser }; // displayed response
            response.json(responseJson); // Send response to Dialogflow
        } else {
            // If the response to the user includes rich responses or contexts send them to Dialogflow
            let responseJson = {};

            // Define the text response
            responseJson.fulfillmentText = responseToUser.fulfillmentText;
            // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
            if (responseToUser.fulfillmentMessages) {
                responseJson.fulfillmentMessages = responseToUser.fulfillmentMessages;
            }
            // Optional: add contexts (https://dialogflow.com/docs/contexts)
            if (responseToUser.outputContexts) {
                responseJson.outputContexts = responseToUser.outputContexts;
            }

            // Send the response to Dialogflow
            console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
            response.json(responseJson);
        }
    }
}

function handleSpeechTexts(speech) {
    return speech.replace('&', 'et')
}

function buildRichResponseV2(speech, text) {
    speech = handleSpeechTexts(speech)
    return [
        { // this first object is mandatory
            'platform': 'ACTIONS_ON_GOOGLE',
            'simple_responses': {
                'simple_responses': [
                    {
                        'text_to_speech': speech,
                        'display_text': text
                    }
                ]
            }
        },
        {
            'platform': 'ACTIONS_ON_GOOGLE',
            'suggestions': { // dont forget to put suggestions into a suggestions object -_-'''''''
                suggestions: [
                    { "title": "Film" },
                    { "title": "Série" },
                    { "title": "Musique" }
                ]
            }
        }
        /* THIS DOES NOT WORKS
        // it return an intent.action.OPTION instead of actions.intent.TEXT like suggestions does above
        // and break the response from user and is not catched by addathingtowatchlist-followup
        // -_-''''
        {
            'platform': 'ACTIONS_ON_GOOGLE',
            'listSelect': {
                'items': [
                    {
                        "info": { "key": 'movie' },
                        "title": "Film",
                    },
                    {
                        "info": { "key": 'serie' },
                        "title": "Série",
                    },
                    {
                        "info": { "key": 'music' },
                        "title": "Musique",
                    },
                ]
            }
        },
        */
    ]
}

// Your Google Cloud Platform project ID
const projectId = 'popop-83a3e';
// Creates a client
const datastore = new Datastore({ projectId });
const kind = 'listo-watchlist';

function addToWatchlist(thing, type) {
    const key = datastore.key(kind);
    const entity = {
        key,
        data: [
            {
                name: 'added',
                value: new Date().toJSON(),
            },
            {
                name: 'title',
                value: thing,
            },
            {
                name: 'type',
                value: type,
            },
        ],
    };
    return datastore.save(entity)
        .then(() => console.log(`Watchlist entry ${key.id} created successfully :)`))
        .catch(err => console.error('Error while adding watchlist entry :', err));
}

function getWatchlist(type) {
    const query = datastore.createQuery(kind).order('added', { descending: true })
    if (type) {
        console.log('will get only "' + type + '" from watchlist')
        query.filter('type', type);
    }
    query.limit(3)
    return datastore.runQuery(query)
        .then(results => {
            const items = results[0];
            console.log('items :');
            items.forEach(item => {
                console.log(`[${item.type}] ${item.title}`);
            });
            return items;
        })
        .catch(err => console.error('Error while getting watchlist entries:', err));
}
