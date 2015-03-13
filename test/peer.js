'use strict';

var Buffers = require('buffers');
var chai = require('chai');
var Net = require('net');
var Socks5Client = require('socks5-client');
var EventEmitter = require('events').EventEmitter;

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');
var fs = require('fs');

var bitcore = require('bitcore');
var _ = bitcore.deps._;
var Networks = bitcore.Networks;
var p2p = require('../');
var Peer = p2p.Peer;
var Messages = p2p.Messages;

describe('Peer', function() {

  var mockPeer, mockSocket, dataBuffer;
  beforeEach( function() {
    mockPeer = new Peer();
    mockSocket = new EventEmitter();
    mockPeer._getSocket = function() {return mockSocket};
    dataBuffer = new Buffers();
    mockSocket.write = function(data) {
      dataBuffer.push(data)
    };
    mockSocket.destroy = function() {};
    mockSocket.connect = function() {
      mockSocket.emit('connect')
    };
    mockPeer.connect();
  });

  it('parses and emits properly when fed Satoshi-v0.9.1.dat', function(callback) {
    var expected = {
      version: 1,
      verack: 1,
      inv: 18,
      addr: 4
    };
    var received = {
      version: 0,
      verack: 0,
      inv: 0,
      addr: 0
    };
    var check = function(message) {
      received[message.command]++;
      if (_.isEqual(received, expected)) {
        callback();
      }
    };
    mockPeer.on('version', check);
    mockPeer.on('verack', check);
    mockPeer.on('addr', check);
    mockPeer.on('inv', check);
    mockSocket.emit('data', fs.readFileSync(__dirname + '/data/Satoshi-v0.9.1.dat'));
  });
  it('should be able to create instance', function() {
    var peer = new Peer('localhost');
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(Networks.livenet.port);
  });

  it('should be able to create instance setting a port', function() {
    var peer = new Peer('localhost', 8111);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(8111);
  });

  it('should be able to create instance setting a network', function() {
    var peer = new Peer('localhost', Networks.testnet);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(Networks.testnet.port);
  });

  it('should be able to create instance setting port and network', function() {
    var peer = new Peer('localhost', 8111, Networks.testnet);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('should support creating instance without new', function() {
    var peer = Peer('localhost', 8111, Networks.testnet);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('should be able to set a proxy', function() {
    var peer, peer2, socket;

    peer = new Peer('localhost');
    expect(peer.proxy).to.be.undefined();
    socket = peer._getSocket();
    socket.should.be.instanceof(Net.Socket);

    peer2 = peer.setProxy('127.0.0.1', 9050);
    peer2.proxy.host.should.equal('127.0.0.1');
    peer2.proxy.port.should.equal(9050);
    socket = peer2._getSocket();
    socket.should.be.instanceof(Socks5Client);

    peer.should.equal(peer2);
  });

  it('Peer.relay setting set properly', function() {
    var peer = new Peer('localhost');
    peer.relay.should.equal(true);
    var peer2 = new Peer('localhost', null, null, false);
    peer2.relay.should.equal(false);
    var peer3 = new Peer('localhost', null, null, true);
    peer3.relay.should.equal(true);
  });

  it('Peer.relay setting respected', function() {
    [true,false].forEach(function(relay) {
      var peer = new Peer('localhost', null, null, relay);
      var peerSendMessageStub = sinon.stub(Peer.prototype, 'sendMessage', function(message) {
        message.relay.should.equal(relay);
      });
      peer._sendVersion();
      peerSendMessageStub.restore();
    });
  });

  it('should send pong on ping', function() {
    var pingMessage = new Messages.Ping();
    mockSocket.emit('data', pingMessage.serialize(Networks.livenet));
    var responseMessages = Messages.parseMessages(Networks.livenet, dataBuffer);
    var pongMessage = responseMessages[responseMessages.length - 1];
    'pong'.should.equal(pongMessage.command);
  });

  it('pong should have same nonce as ping', function() {
    var pingMessage = new Messages.Ping();
    mockSocket.emit('data', pingMessage.serialize(Networks.livenet));
    var responseMessages = Messages.parseMessages(Networks.livenet, dataBuffer);
    var pongMessage = responseMessages[responseMessages.length - 1];
    pingMessage.nonce.toString().should.equal(pongMessage.nonce.toString());
  });

  it('should emit ready on verack', function(callback) {
    var message = new Messages.VerAck();
    mockPeer.on('ready', callback)
    mockSocket.emit('data', message.serialize(Networks.livenet));
  });
});
