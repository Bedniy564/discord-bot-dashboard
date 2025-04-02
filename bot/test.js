const https = require('https');
const options = {
  hostname: 'discord.com',
  port: 443,
  path: '/api/v9/gateway',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

const req = https.request(options, res => {
  console.log('Status:', res.statusCode);
  res.on('data', d => console.log(d.toString()));
});

req.on('error', e => console.error('Error:', e));
req.end();