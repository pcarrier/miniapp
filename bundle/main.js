var leak = [];
setInterval(function () {
  var s = "", n = Math.random();
  for (i = 0; i < 100; i++) s = s + n;
  leak.push(s);
}, 10);

require('http').createServer(function (req, rep) {
  rep.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
  rep.end('What a wonderful day this has been! My heart is full of joy.');
}).listen(3000);
