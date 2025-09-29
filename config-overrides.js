module.exports = function override(config, env) {
  return config;
};

module.exports.devServer = function (configFunction) {
  return function (proxy, allowedHost) {
    const config = configFunction(proxy, allowedHost);
    config.allowedHosts = 'all';
    return config;
  };
};