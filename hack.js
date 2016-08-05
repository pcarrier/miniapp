#!/usr/bin/env node
const
  FS = require('fs')
, HTTPS = require('https')
, Path = require('path')
, Stream = require('stream')
, URL = require('url')
, netErr = 2, authErr = 4
, deployHost = process.env.DEPLOY_HOSTNAME || 'galaxy.pcarrier.meet-eeyore.com'
, appName    = process.env.APP             || 'deployed.pcarrier.meet-eeyore.com'
, bundlePath = process.env.BUNDLE          || 'bundle.tgz'
, bundle     = FS.createReadStream(bundlePath)
, credsPath  = Path.join(process.env.HOME, '.hackdeploycreds')
, httpsTrip  = (reqSpec, reqBody) => new Promise((resolve, reject) => {
    const body = []
    , fail = (err) => reject([err, body.join('')])
    , req = HTTPS.request(reqSpec, (rep) => {
      rep.on('data', (chunk) => body.push(chunk));
      rep.on('end', () => {
        if (rep.statusCode < 200 || rep.statusCode > 299)
          fail(new Error(`status code ${rep.statusCode}`));
        else
          resolve(body.join(''))
      });
    });
    reqBody.pipe(req).on('error', fail);
    req.on('error', fail);
  })
, getCreds = () => new Promise((resolve, reject) => {
    try {
      resolve(JSON.parse(FS.readFileSync(credsPath, 'utf8')));
    } catch (e) {
      console.log(`could not read creds file ${credsPath} (${e.message}), trying to log in...`);
      const user = process.env.DEPLOY_USER
      ,     pass = process.env.DEPLOY_PASS;
      if (!user || !pass)
        reject(new Error('please set DEPLOY_USER and DEPLOY_PASS and try again'));
      const reqBody = new Stream.Readable();
      reqBody._read = ()=>null;
      reqBody.push(JSON.stringify({ meteorAccountsLoginInfo: { username: user, password: pass } }));
      reqBody.push(null);
      const req = Object.assign(URL.parse('https://accounts.meteor.com/api/v1/private/login'),
        { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      httpsTrip(req, reqBody)
        .then((raw) => {
          try {
          const r = JSON.parse(raw)
          ,  auth = {session: r.session, token: r.token};
          FS.writeFileSync(credsPath, JSON.stringify(auth), {mode: 0o600});
          resolve(auth);
          } catch (e) {
            reject(e);
          }
        })
        .catch((e) => reject(new Error(`auth failed: ${e[0].message} (response: ${e[1]})`)));
    }
  })
, main = () => getCreds().then((creds) => {
    const req = Object.assign(URL.parse('https://' + deployHost + '/deploy/' + appName),
      { method: 'POST', headers: { 'X-Meteor-Session': creds.session,
                                   'X-Meteor-Auth': creds.token } });
    httpsTrip(req, bundle)
      .then((msg) => console.log(msg))
      .catch((e) => {
        console.log(`upload failed: ${e[0].message} (response: ${e[1]})`);
        process.exit(netErr);
    });
  }).catch((e) => {
    console.log(`could not authenticate: ${e.message}`)
    process.exit(authErr)
  });

main();
