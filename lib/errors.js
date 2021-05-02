'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on widecore-p2p Module {0}'
};

module.exports = require('widecore-lib').errors.extend(spec);
