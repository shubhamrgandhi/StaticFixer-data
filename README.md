# StaticFixer: From Static Analysis to Static Repair

Static analysis tools are traditionally used to detect and flag programs that violate properties. We show that static analysis tools can also be used to perturb programs that satisfy a property to construct variants that violate the property. Using this insight we can construct paired data sets of unsafe-safe program pairs, and learn strategies to automatically repair property violations. We present a system called StaticFixer, which automatically repairs information flow vulnerabilities using this approach. Since information flow properties are non-local (both to check and repair), StaticFixer also introduces a novel domain specific language (DSL) and strategy learning algorithms for synthesizing non-local repairs. We use StaticFixer to synthesize strategies for repairing two types of information flow vulnerabilities, unvalidated dynamic calls and cross-site scripting, and show that StaticFixer successfully repairs several hundred vulnerabilities from open source JavaScript repositories, outperforming neural baselines built using CodeT5 and Codex.

# PairedPrograms
The `PairedPrograms` dataset is supplementary data to support the experimentation conducted in `StaticFixer: From Static Analysis to Static Repair`. For each of the two JavaScript vulnerabilities considered in the experiments, i.e. [Unvalidated Dynamic Call (UDC)](https://codeql.github.com/codeql-query-help/javascript/js-unvalidated-dynamic-method-call/) and [Reflected Cross-Site Scripting (XSS)](https://codeql.github.com/codeql-query-help/javascript/js-reflected-xss/), there are a total of `526` and `79` file pairs respectively. 
Each file pair contains a safe and a corresponding unsafe program. 

Below is an example from the set of file pairs for the `UDC` vulnerability. 

<table>
<tr>
<th>Safe</th>
<th>Unsafe</th>
</tr>
<tr>
<td>
  
```javascript {highlight=[8,10]}
const http = require("http");
const url = require("url");

const controller = require("./controller");

module.exports = http.createServer(function(request, response) {
	const requestUrl = url.parse(request.url, true);
	if (requestUrl.pathname in controller) { 
	controller[requestUrl.pathname](request, response);
}

});
```
  
</td>
<td>

```javascript
const http = require("http");
const url = require("url");

const controller = require("./controller");

module.exports = http.createServer(function(request, response) {
	const requestUrl = url.parse(request.url, true);
//     if (requestUrl.pathname in controller) { 
	controller[requestUrl.pathname](request, response);
// }

});
```

</td>
</tr>
</table>

Below is an example from the set of file pairs for the `XSS` vulnerability.

<table>
<tr>
<th>Safe</th>
<th>Unsafe</th>
</tr>
<tr>
<td>
  
```javascript
const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase);

const database = admin.database()

exports.redirect = functions.https.onRequest((request, response) => {
	request.originalUrl = encodeURIComponent(request.originalUrl);
	let key = request.originalUrl;
	console.log('Search for', key);
	database.ref('url').child(key).once('value').then(result => result.val()).then(result => {
            console.log(result)
            if (result) {
                response.redirect(result)
            } else {
                response.status(500).send(`No match for ${key}`)                
            }
        });
})
```
  
</td>
<td>

```javascript
const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase);

const database = admin.database()

exports.redirect = functions.https.onRequest((request, response) => {
	// request.originalUrl = encodeURIComponent(request.originalUrl);
	let key = request.originalUrl;
	console.log('Search for', key);
	database.ref('url').child(key).once('value').then(result => result.val()).then(result => {
            console.log(result)
            if (result) {
                response.redirect(result)
            } else {
                response.status(500).send(`No match for ${key}`)                
            }
        });
})
```

</td>
</tr>
</table>


## Directory Structure
Below is the directory structure for the data. Here, `ext` refers to the extension of the individual program files and is one of `js`, `ts`, `tsx`, `ejs`, `htm`, or `html`.
<pre>
  train_data
  | -- UnvalidatedDynamicCall
      | -- 0
          | -- safe.{ext}
          | -- unsafe.{ext}
      | -- 1
          | -- safe.{ext}
          | -- unsafe.{ext}
      .
      .
      .
  | -- ReflectedXSS
      | -- 0
          | -- safe.{ext}
          | -- unsafe.{ext}
      | -- 1
          | -- safe.{ext}
          | -- unsafe.{ext}
      .
      .
      .
</pre>
