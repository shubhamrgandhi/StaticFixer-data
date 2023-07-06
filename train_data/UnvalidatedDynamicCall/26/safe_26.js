import { LOAD_PARSER, clearErrors } from '../actions/parser';
import { PARSE_SNIPPET } from '../actions/app';
import onError from '../util/parser-error-logger.js';
import { getRuleCount, rules } from '../util/rules.js';
import { makeParserEndpointUrl } from '../util/requests.js';

const API_URL = process.env.REACT_APP_API_URL;

let parser = null;
const parserCache = {};

self.onmessage = ({ data: action }) => {
  switch (action.type) {
  case PARSE_SNIPPET: {
    if (!parser) break;
    const { snippet } = action.payload;
    self.postMessage(clearErrors());
    const AST = parser(snippet, (err) => onError(err, self.postMessage), {});
    const ruleCounts = {}; getRuleCount(AST, ruleCounts);
    self.postMessage({
      type: action.type,
      payload: {
        AST,
        ruleCounts,
      },
    });
    break;
  }
  case LOAD_PARSER: {
	const language = action.payload;
	if (language in parserCache) {
	parser = parserCache[language];
}

	self.postMessage({
type : action.type ,
payload : action.payload 
});
	break
}
  default: {
    console.log(action.type);
  }
  }
};
