'use strict';

/**
 * Module dependencies.
 */

var CP_get = require('../lib/CP_get');
var CP_player = require('../modules/CP_player');

/**
 * Configuration dependencies.
 */

var config = require('../config/production/config');
Object.keys(config).length === 0 &&
  (config = require('../config/production/config.backup'));
var config_md5 = require('md5')(JSON.stringify(config));

var modules = require('../config/production/modules');
Object.keys(modules).length === 0 &&
  (modules = require('../config/production/modules.backup'));
var modules_md5 = require('md5')(JSON.stringify(modules));

setInterval(function() {
  if (
    config_md5 &&
    process.env['CP_CONFIG_MD5'] &&
    config_md5 !== process.env['CP_CONFIG_MD5']
  ) {
    config = require('../config/production/config');
    Object.keys(config).length === 0 &&
      (config = require('../config/production/config.backup'));
    config_md5 = process.env['CP_CONFIG_MD5'];
  }
  if (
    modules_md5 &&
    process.env['CP_MODULES_MD5'] &&
    modules_md5 !== process.env['CP_MODULES_MD5']
  ) {
    modules = require('../config/production/modules');
    Object.keys(modules).length === 0 &&
      (modules = require('../config/production/modules.backup'));
    modules_md5 = process.env['CP_MODULES_MD5'];
  }
}, 3333);

/**
 * Node dependencies.
 */

var express = require('express');
var md5 = require('md5');
var router = express.Router();

/**
 * Iframe code.
 */

router.get('/:id', function(req, res) {
	let id = req.params.id ? ('' + req.params.id).trim() : '';
	let type = (req.query.type || '').replace(/[^0-9]/g, '');
	let season = (req.query.season || '').replace(/[^0-9]/g, '');
	let episode = (req.query.episode || '').replace(/[^0-9]/g, '');
	let origin = config.protocol + '' + (config.bomain ? config.botdomain : config.subdomain) + '' + (config.bomain || config.domain);
	let id_key = id.replace(/[0-9]/g, '');
	id = id.replace(/[^0-9]/g, '');
	let id_value = id;
	if (modules.player.data.display === 'cinemaplayer') {
	let ip = getIp(req);
	let d = modules.player.data.cinemaplayer['information'].dataset;
	if (d && d.length) {
	let dataset = d.join(' ');
	dataset = dataset.replace(/\[id]/gi, id_value).replace(/\[kp_id]/gi, id_value).replace(/\[ip]/gi, ip || '').replace(/\[hash]/gi, md5(ip + '.' + config.urls.admin)).replace(/\[title]/gi, ((typeof req.query.title !== 'undefined' && '' + req.query.title) || '').replace(/"/gi, '&quot;')).replace(/\[year]/gi, (typeof req.query.year !== 'undefined' && ('' + req.query.year).replace(/[^0-9]/g, '')) || '').replace(/\[type]/gi, (req.query.type && ['tv', 'movie'].indexOf('' + req.query.type) + 1 ? '' + req.query.type : '') || '').replace(/\[imdb_id]/gi, (typeof req.query.imdb_id !== 'undefined' && ('' + req.query.imdb_id).replace(/[^0-9]/g, '')) || '').replace(/\[tmdb_id]/gi, (typeof req.query.tmdb_id !== 'undefined' && ('' + req.query.tmdb_id).replace(/[^0-9]/g, '')) || '').replace(/\[douban_id]/gi, (typeof req.query.douban_id !== 'undefined' && ('' + req.query.douban_id).replace(/[^0-9]/g, '')) || '').replace(/\[tvmaze_id]/gi, (typeof req.query.tvmaze_id !== 'undefined' && ('' + req.query.tvmaze_id).replace(/[^0-9]/g, '')) || '').replace(/\[movie_id]/gi, (typeof req.query.movie_id !== 'undefined' && ('' + req.query.movie_id).replace(/[^0-9]/g, '')) || '').replace(/\[[^\]]+]/gi, '');
}

	return res.send('<!DOCTYPE html><html lang="' + config.language + '">' + '<head>' + '<title>' + id_value + '</title>' + '<link rel="canonical" href="' + origin + '/' + config.urls.movie + config.urls.slash + config.urls.prefix_id + id_value + '"/>' + '</head>' + '<body>' + '<style>body,html{border:0;padding:0;margin:0;width:100%;height:100%;overflow:hidden}</style>' + '<div id="cinemaplayer" ' + dataset + '></div>' + '<script src="' + modules.player.data.embed.js + '?v=' + process.env['CP_VER'] + '"></script>' + '</body></html>') ;
}

	let query = {};
	let data = {};
	if (id_value === id) {
	query['id'] = id;
}
else if (['tmdb_id', 'imdb_id', 'douban_id', 'tvmaze_id', 'wa_id', 'movie_id'].indexOf(id_key) + 1) {
	if (type) {
	query['type'] = type;
}

	query['custom.' + id_key] = id_value;
}
else {
	id = '';
}
	try {
    if (modules.player.data.script) {
      data = JSON.parse(modules.player.data.script);
    }
  } catch (e) {
    console.error(e);
  }
	let parameters = '';
	if (season) {
	data['data-season'] = season;
}

	if (episode) {
	data['data-episode'] = episode;
}

	data['data-kinopoisk'] = id ? id : '';
	data['data-title'] = req.query.title ? req.query.title.replace(/"/g, "'") : '';
	data['data-autoplay'] = req.query.autoplay ? req.query.autoplay : '';
	if (id && req.query.title) {
	for (var dkey in data) {
      if (data.hasOwnProperty(dkey) && data[dkey]) {
        data[dkey] = ('' + data[dkey]).trim();
        parameters += ' ' + dkey + '="' + encodeURIComponent(data[dkey]) + '"';
      }
    }
	res.send('<!DOCTYPE html><html lang="' + config.language + '"><body>' + '<style>body,html{border:0;padding:0;margin:0;width:100%;height:100%;overflow:hidden}</style>' + '<div id="yohoho" ' + parameters + '></div>' + '<script data-cfasync="false" src="' + modules.player.data.js + '"></script>' + '</body></html>');
}
else if (id) {
	let req1 = {};
	req1['from'] = process.env.CP_RT;
	req1['certainly'] = true;
	CP_get.movies(Object.assign({}, req1, query), 1, '', 1, false, function (err, movies){
	if (err) return res.status(404).send(err) ;

	if (movies && movies.length) {
	let noindex = config.urls.noindex ? movies[0].custom && /"unique":true|"unique":"true"/i.test(movies[0].custom) ? config.urls.movie : config.urls.noindex : config.urls.movie;
	let movie = (movies && movies[0]) || {};
	if (movie &&
 (movie.player ||
 (movie.custom &&
 (movie.custom.indexOf('"player1"') + 1 || movie.custom.indexOf('"player2"') + 1 || movie.custom.indexOf('"player3"') + 1 || movie.custom.indexOf('"player4"') + 1 || movie.custom.indexOf('"player5"') + 1)) ||
 (modules.player.data.custom && modules.player.data.custom.length && modules.player.data.custom.filter(function (l){
	return ! /^#/i.test(l) && /~\s*iframe$/i.test(l) ;
}).length))) {
	try {
            movie.custom = JSON.parse(movie.custom || '{}');
            [
              'imdb_id',
              'tmdb_id',
              'douban_id',
              'tvmaze_id',
              'wa_id',
              'movie_id'
            ].forEach(function(i) {
              if (movie.custom[i]) {
                movie[i] = movie.custom[i];
              }
            });
            [1, 2, 3, 4, 5].forEach(function(p) {
              if (movie.custom['player' + p]) {
                movie.player +=
                  (movie.player ? ',' : '') + movie.custom['player' + p];
              }
            });
          } catch (e) {
            movie.custom = {};
          }
	let player = CP_player.code('movie', movie);
	player.player = player.player.replace(/data-url="[^"]*"/, '').replace('data-player=', 'data-url="' + origin + '/api?' + (id_key || 'kp_id') + '=' + id_value + '&type=' + movie.type + '&player" data-player=');
	return res.send('<!DOCTYPE html><html lang="' + config.language + '">' + '<head>' + '<title>' + id + '</title>' + '<link rel="canonical" href="' + origin + '/' + noindex + config.urls.slash + config.urls.prefix_id + (parseInt(movies[0].kp_id) + parseInt('' + config.urls.unique_id)) + '"/>' + (player.head || '') + '</head>' + '<body>' + '<style>body,html{border:0;padding:0;margin:0;width:100%;height:100%;overflow:hidden}</style>' + (player.player || '') + (player.footer || '') + '</body></html>') ;
}

	try {
          var custom = movies[0].custom ? JSON.parse(movies[0].custom) : {};
          data['data-imdb'] = custom.imdb_id ? custom.imdb_id : '';
          data['data-tmdb'] = custom.tmdb_id ? custom.tmdb_id : '';
          data['data-douban'] = custom.douban_id ? custom.douban_id : '';
          data['data-tvmaze'] = custom.tvmaze_id ? custom.tvmaze_id : '';
          data['data-wa'] = custom.wa_id ? custom.wa_id : '';
        } catch (e) {
          console.error(e);
        }
	data['data-title'] = ((movies[0].title_ru || movies[0].title_en) + ' (' + movies[0].year + ')').replace(/"/g, "'");
	for (var dkey in data) {
          if (data.hasOwnProperty(dkey) && data[dkey]) {
            data[dkey] = ('' + data[dkey]).trim();
            parameters +=
              ' ' + dkey + '="' + encodeURIComponent(data[dkey]) + '"';
          }
        }
	res.send('<!DOCTYPE html><html lang="' + config.language + '">' + '<link rel="canonical" href="' + origin + '/' + noindex + config.urls.slash + config.urls.prefix_id + (parseInt(movies[0].kp_id) + parseInt('' + config.urls.unique_id)) + '"/>' + '<body>' + '<style>body,html{border:0;padding:0;margin:0;width:100%;height:100%;overflow:hidden}</style>' + '<div id="yohoho" ' + parameters + '></div>' + '<script data-cfasync="false" src="' + modules.player.data.js + '"></script>' + '</body></html>');
}
else {
	res.status(404).send('');
}
});
}
else {
	res.status(404).send('');
}
});

/**
 * Get user IP.
 *
 * @param {Object} req
 */

function getIp(req) {
  var ips = req.ips || [];
  var ip = '';
  if (req.header('x-forwarded-for')) {
    req
      .header('x-forwarded-for')
      .split(',')
      .forEach(function(one_ip) {
        if (ips.indexOf(one_ip.trim()) === -1) {
          ips.push(one_ip.trim());
        }
      });
  }
  if (req.header('x-real-ip')) {
    req
      .header('x-real-ip')
      .split(',')
      .forEach(function(one_ip) {
        if (ips.indexOf(one_ip.trim()) === -1) {
          ips.push(one_ip.trim());
        }
      });
  }
  if (req.connection.remoteAddress) {
    req.connection.remoteAddress.split(',').forEach(function(one_ip) {
      if (ips.indexOf(one_ip.trim()) === -1) {
        ips.push(one_ip.trim());
      }
    });
  }
  ips.forEach(function(one_ip) {
    if (ip) return;
    one_ip = one_ip.replace('::ffff:', '');
    if (
      one_ip !== '127.0.0.1' &&
      /^([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/.test(
        one_ip
      )
    ) {
      ip = one_ip;
    }
  });
  return ip;
}

module.exports = router;
