'use strict';

var Buffers = require('buffers');
var EventEmitter = require('events').EventEmitter;
var Net = require('net');
var Socks5Client = require('socks5-client');
var util = require('util');

var bitcore = require('bitcore');
var $ = bitcore.util.preconditions;
var Networks = bitcore.Networks;
var Random = bitcore.crypto.Random;

var Messages = require('./messages');

var MAX_RECEIVE_BUFFER = 10000000;

/**
 * A Peer instance represents a remote bitcoin node and allows to communicate
 * with it using the standard messages of the bitcoin p2p protocol.
 *
 * @example
 * ```javascript
 *
 * var peer = new Peer('127.0.0.1').setProxy('127.0.0.1', 9050);
 * peer.on('tx', function(tx) {
 *  console.log('New transaction: ', tx.id);
 * });
 * peer.connect();
 * ```
 *
 * @param {String} host - IP address of the remote host
 * @param {Number} [port] - Port number of the remote host
 * @param {Network} [network] - The context for this communication
 * @returns {Peer} A new instance of Peer.
 * @constructor
 */
function Peer(host, port, network, relay) {
  if (!(this instanceof Peer)) {
    return new Peer(host, port, network);
  }

  // overloading stuff
  if (port instanceof Object && !network) {
    network = port;
    port = undefined;
  }

  this.host = host || 'localhost';
  this.status = Peer.STATUS.DISCONNECTED;
  this.network = network || Networks.defaultNetwork;
  this.port = port || this.network.port;
  this.relay = relay === false ? false : true;

  this.dataBuffer = new Buffers();

  this.version = 0;
  this.bestHeight = 0;
  this.subversion = null;

  // set message handlers
  var self = this;
  this.on('verack', function() {
    self.status = Peer.STATUS.READY;
    self.emit('ready');
  });

  this.on('version', function(message) {
    self.version = message.version;
    self.subversion = message.subversion;
    self.bestHeight = message.start_height;
  });

  this.on('ping', this._sendPong);

  // https://github.com/bitcoin/bitcoin/blob/dd4ffcec0ea561e16c4621b31712166717db3e0b/src/net.h#L313
  // Ping time measurement:
  // The pong nonce we're expecting, or zero if no pong expected (pre-BIP0031)
  this._pingNonceSent = 0;
  // Time the last ping was sent, or zero if no ping was ever sent.
  this._pingStart = 0;
  // Last measured round-trip time.
  this._pingTime = 0;
  // Whether a ping is requested.
  this._pingQueued = false;
  //this.on('ping', this._sendPong);
  this.on('pong', this._receivePong);
  this.ping();
}
util.inherits(Peer, EventEmitter);

Peer.STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  READY: 'ready'
};
Peer.PING_INTERVAL = 2 * 60 * 1000;
Peer.BIP0031_VERSION = 60000;

/**
 * Set a socks5 proxy for the connection. Enables the use of the TOR network.
 *
 * @param {String} host - IP address of the proxy
 * @param {Number} port - Port number of the proxy
 * @returns {Peer} The same Peer instance.
 */
Peer.prototype.setProxy = function(host, port) {
  $.checkState(this.status === Peer.STATUS.DISCONNECTED);

  this.proxy = {
    host: host,
    port: port
  };
  return this;
};

/**
 * Init the connection with the remote peer.
 *
 * @returns {Socket} The same peer instance.
 */
Peer.prototype.connect = function() {
  this.socket = this._getSocket();
  this.status = Peer.STATUS.CONNECTING;

  var self = this;
  this.socket.on('connect', function(ev) {
    self.status = Peer.STATUS.CONNECTED;
    self.emit('connect');
    self._sendVersion();
  });

  this.socket.on('error', self._onError.bind(this));
  this.socket.on('end', self.disconnect.bind(this));

  this.socket.on('data', function(data) {
    self.dataBuffer.push(data);

    if (self.dataBuffer.length > MAX_RECEIVE_BUFFER) {
      // TODO: handle this case better
      return self.disconnect();
    }
    self._readMessage();
  });

  this.socket.connect(this.port, this.host);
  return this;
};

Peer.prototype._onError = function(e) {
  this.emit('error', e);
};

/**
 * Disconnects the remote connection.
 *
 * @returns {Socket} The same peer instance.
 */
Peer.prototype.disconnect = function() {
  this.status = Peer.STATUS.DISCONNECTED;
  this.socket.destroy();
  this.emit('disconnect');
  return this;
};

/**
 * Send a Message to the remote peer.
 *
 * @param {Message} message - A message instance
 */
Peer.prototype.sendMessage = function(message) {
  this.socket.write(message.serialize(this.network));
};

/**
 * Internal function that sends VERSION message to the remote peer.
 */
Peer.prototype._sendVersion = function() {
  var message = new Messages.Version(null, null, this.relay);
  this.sendMessage(message);
};

/**
 * Send a PONG message to the remote peer.
 * https://github.com/bitcoin/bitcoin/blob/84a7789b291ee7c72cf02f777f3011243f384d95/src/main.cpp#L4085
 */
Peer.prototype._sendPong = function(pingMessage) {
  if (this.version > Peer.BIP0031_VERSION) {
    var pongMessage = new Messages.Pong(pingMessage.nonce);
    this.sendMessage(pongMessage);
  }
};

/**
 * Handling of pong message from remote peer
 * https://github.com/bitcoin/bitcoin/blob/84a7789b291ee7c72cf02f777f3011243f384d95/src/main.cpp#L4107
 */
Peer.prototype._receivePong = function(message) {
  var pongTimeReceived = Date.now();
  var pongNonce = message.nonce.slice(8);
  var pingFinished = false;
  var problem = '';

  if (message.nonce.length === 8) {

    // Only process pong message if there is an outstanding ping (old ping without nonce should never pong)
    if (this._pingNonceSent != 0) {
      if (pongNonce === this._pingNonceSent) {
        // Matching pong received, this ping is no longer outstanding
        pingFinished = true;
        var pingTime = pongTimeReceived - this._pingStart;
        if (pingTime > 0) {
          // Successful ping time measurement, replace previous
          this._pingTime = pingTime;
        } else {
          problem = 'Timing mishap'; // This should never happen
        }
      } else {
        // Nonce mismatches are normal when pings are overlapping
        problem = 'Nonce mismatch';
        if (pongNonce === 0) {
          // This is most likely a bug in another implementation somewhere, cancel this ping
          pingFinished = true;
          problem = 'Nonce zero';
        }
      }
    } else {
      problem = 'Unsolicited pong without ping';
    }
  } else {
    // This is most likely a bug in another implementation somewhere, cancel this ping
    pingFinished = true;
    problem = 'Short payload';
  }

  if (problem.length) {
    this._onError(new Error(problem));
  }

  if (pingFinished) {
    this._pingNonceSent = 0;
  }
};

/**
 * Request a ping be sent to the peer
 */
Peer.prototype.ping = function() {
  this._pingQueued = true;
};

/**
 * Send multiple messages to the remote peer.
 *
 * @param {Message[]} messages - An array of message instances
 */
Peer.prototype.sendMessages = function(messages) {
  messages = messages || [];
  var pingSend = false;
  // ping invoked by user
  if (this._pingQueued) {
    pingSend = true;
  }
  if (this._pingNonceSent == 0 && this._pingStart + Peer.PING_INTERVAL < Date.now()) {
    // Ping automatically sent as a latency probe & keepalive.
    pingSend = true;
  }
  if (pingSend) {
    var pingNonce = Random.getPseudoRandomBuffer(8);
    this._pingQueued = false;
    this._pingStart = Date.now();
    var pingMessage;
    if (this.version > Peer.BIP0031_VERSION) {
      this._pingNonceSent = pingNonce;
      pingMessage = new Messages.Ping(pingNonce);
    } else {
      // Peer is too old to support ping command with nonce, pong will never arrive.
      this._pingNonceSent = 0;
      pingMessage = new Messages.Ping();
    }
    messages.push(pingMessage);
  }

  messages.forEach(this.sendMessage.bind(this))
};

/**
 * Internal function that tries to read a message from the data buffer
 */
Peer.prototype._readMessage = function() {
  var message = Messages.parseMessage(this.network, this.dataBuffer);

  if (message) {
    this.emit(message.command, message);
    this._readMessage();
  }
};

/**
 * Internal function that creates a socket using a proxy if neccesary.
 *
 * @returns {Socket} A Socket instance not yet connected.
 */
Peer.prototype._getSocket = function() {
  if (this.proxy) {
    return new Socks5Client(this.proxy.host, this.proxy.port);
  }

  return new Net.Socket();
};

module.exports = Peer;
