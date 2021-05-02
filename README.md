<img src="http://widecore.io/css/images/widecore-p2p.svg" alt="widecore payment protocol" height="35" width="102">

Widecore P2P
=======

[![NPM Package](https://img.shields.io/npm/v/widecore-p2p.svg?style=flat-square)](https://www.npmjs.org/package/widecore-p2p)
[![Build Status](https://img.shields.io/travis/widecoin-project/widecore-p2p.svg?branch=master&style=flat-square)](https://travis-ci.org/widecoin-project/widecore-p2p)
[![Coverage Status](https://img.shields.io/coveralls/widecoin-project/widecore-p2p.svg?style=flat-square)](https://coveralls.io/r/widecoin-project/widecore-p2p?branch=master)

`widecore-p2p` adds [Widecoin protocol](https://en.bitcoin.it/wiki/Protocol_documentation) support for Widecore.

See [the main widecore repo](https://github.com/widecoin-project/widecore) for more information.

## Getting Started

```sh
npm install widecore-p2p
```
In order to connect to the Widecoin network, you'll need to know the IP address of at least one node of the network, or use [Pool](/docs/pool.md) to discover peers using a DNS seed.

```javascript
var Peer = require('widecore-p2p').Peer;

var peer = new Peer({host: '127.0.0.1'});

peer.on('ready', function() {
  // peer info
  console.log(peer.version, peer.subversion, peer.bestHeight);
});
peer.on('disconnect', function() {
  console.log('connection closed');
});
peer.connect();
```

Then, you can get information from other peers by using:

```javascript
// handle events
peer.on('inv', function(message) {
  // message.inventory[]
});
peer.on('tx', function(message) {
  // message.transaction
});
```

Take a look at the [widecore guide](http://widecore.io/guide/peer.html) on the usage of the `Peer` class.

## Contributing

See [CONTRIBUTING.md](https://github.com/widecoin-project/widecore/blob/master/CONTRIBUTING.md) on the main widecore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/widecoin-project/widecore/blob/master/LICENS).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

Copyright 2020 The Widecore Core Developers
