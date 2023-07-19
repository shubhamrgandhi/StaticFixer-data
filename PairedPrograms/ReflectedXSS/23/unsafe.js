'use strict';

const { Joi } = require('celebrate');

module.exports.schema = Joi.object().keys({
    package: Joi.string().required()
}).unknown(true);

module.exports.route = (req, res) => {
    // Start activity with action com.swedbankpay.mobilesdk.VIEW_PAYMENTORDER
    // in the given package, with the same url as was used for this
    // request. This makes it so that we only ever need to compare
    // against paymentUrl in the SDK, and not do any further
    // interpretations of the url there.
    const intentUrl = `intent:// ${req.headers.host} ${req.originalUrl} #Intent;scheme= ${req.protocol} ;action=com.swedbankpay.mobilesdk.VIEW_PAYMENTORDER;package= ${req.query.package} ;end;`;
    const html = `<html>
<head>
<title>Swedbank Pay Payment</title>
<link rel="stylesheet" href="https://design.swedbankpay.com/v/4.3.0/styles/dg-style.css">
<meta name="viewport" content="width=device-width">
<meta http-equiv="refresh" content="0;url=${intentUrl}">
</head>
<body>
<div class="text-center">
<img src="https://design.swedbankpay.com/v/4.3.0/img/swedbankpay-logo.svg" alt="Swedbank Pay" height="120">
<p><a class="btn btn-executive" href="${intentUrl}">Back to app</a></p>
</div>
</body>
</html>
`;
    res.status(200).send(html).end();
};
