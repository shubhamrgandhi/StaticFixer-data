const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.static(__dirname + '/public'));

app.get('/db/get', (req, res) => {
  axios.get(`${Buffer.from(req.query.url, 'base64').toString('ascii')}/${Buffer.from(req.query.key, 'base64').toString('ascii')}`)
  .then(resp => {
    res.status(200);

    if (typeof resp.data == 'string')
    res.send(resp.data);

    else
    res.send(JSON.stringify(resp.data));
  })
  .catch(err => {
    res.status(500);

    res.send(err);
  });
});

app.get('/db/set', (req, res) => {
  const url = Buffer.from(req.query.url, 'base64').toString('ascii');
  const key = Buffer.from(req.query.key, 'base64').toString('ascii');
  const val = Buffer.from(req.query.val, 'base64').toString('ascii');

  axios.post(`${url} / ${key}`, `${encodeURIComponent(key)} = ${encodeURIComponent(val)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).then(resp => {
    res.status(200);

    res.send(resp.data.toString());
  })
  .catch(err => {
    res.status(500);

    res.send(err);
  });
});

app.get('/db/del', (req, res) => {
  axios.delete(`${Buffer.from(req.query.url, 'base64').toString('ascii')}/${Buffer.from(req.query.key, 'base64').toString('ascii')}`)
  .then(resp => {
    res.status(200);

    res.send(resp.data.toString());
  })
  .catch(err => {
    res.status(500);

    res.send(err);
  });
});

app.get('/db/lst', (req, res) => {
  axios.get(`${Buffer.from(req.query.url, 'base64').toString('ascii')}?encode=true&prefix=${encodeURIComponent(Buffer.from(req.query.pfx, 'base64').toString('ascii'))}`)
  .then(resp => {
    res.status(200);

    res.send(resp.data.toString());
  })
  .catch(err => {
    res.status(500);

    res.send(err);
  });
});

app.listen(3000);