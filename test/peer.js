'use strict';

var chai = require('chai');
var Net = require('net');
var Socks5Client = require('socks5-client');

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');
var fs = require('fs');

var bitcore = require('bitcore');
var _ = bitcore.deps._;
var p2p = require('../');
var Peer = p2p.Peer;
var Networks = bitcore.Networks;

describe('Peer', function() {

  describe('Integration test', function() {
    it('parses ./test/connection.log', function(callback) {
      var peer = new Peer('');
      var mockSocket = sinon.stub();
      var dataCallback;
      var connectCallback;
      var endCallback;
      var expected = {
        version: 1,
        verack: 1,
        inv: 18,
        ready: 1,
        disconnect: 1,
        addr: 4
      };
      var received = {
        version: 0,
        verack: 0,
        inv: 0,
        ready: 0,
        disconnect: 0,
        addr: 0
      };
      mockSocket.on = function() {
        if (arguments[0] === 'data') {
          dataCallback = arguments[1];
        }
        if (arguments[0] === 'connect') {
          connectCallback = arguments[1];
        }
        if (arguments[0] === 'end') {
          endCallback = arguments[1];
        }
      };
      mockSocket.write = function() {};
      mockSocket.destroy = function() {};
      mockSocket.connect = function() {
        connectCallback();
      };
      mockSocket.end = function() {
        endCallback();
      };
      peer._getSocket = function() {
        return mockSocket;
      };
      peer.on('connect', function() {
        dataCallback(fs.readFileSync('./test/connection.log'));
      });
      var check = function(message) {
        received[message.command]++;
        if (_.isEqual(received, expected)) {
          callback();
        }
      };
      peer.on('version', check);
      peer.on('verack', check);
      peer.on('addr', check);
      peer.on('inv', check);
      peer.on('ready', function() {check({command: 'ready'})});
      peer.on('disconnect', function() {check({command: 'disconnect'})});
      peer.connect();
      mockSocket.end();
    });
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

});
