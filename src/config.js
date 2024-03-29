module.exports = {
  env: process.env.NODE_ENV,
  webhook: {
    line: {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    },
  },
  redis: {
    host: process.env.REDIS_HOST,
    expireTime: process.env.REDIS_EXPIRE_TIME,
  },
  proxy: {
    ip: process.env.PROXY_IP,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  },
};
