const awsServerlessExpress = require('aws-serverless-express');
const app = require('./dist/backend/src/app.js').default;

const server = awsServerlessExpress.createServer(app);

exports.handler = (event, context) => {
  return awsServerlessExpress.proxy(server, event, context);
};