'use strict';

var _ = require('bitcore').deps._;
var chai = require('chai');

/* jshint unused: false */
var should = chai.should();
var sinon = require('sinon');

var bitcore = require('bitcore');
var Random = bitcore.crypto.Random;
var BN = bitcore.crypto.BN;
var BufferUtil = bitcore.util.buffer;
var p2p = require('../');
var Peer = p2p.Peer;
var Pool = p2p.Pool;
var Networks = bitcore.Networks;
var Messages = p2p.Messages;
var Block = bitcore.Block;
var Transaction = bitcore.Transaction;

// config 
var network = Networks.livenet;
var blockHash = {
  'livenet': '000000000000000013413cf2536b491bf0988f52e90c476ffeb701c8bfdb1db9',
  'testnet': '0000000058cc069d964711cd25083c0a709f4df2b34c8ff9302ce71fe5b45786'
};
var stopBlock = {
  'livenet': '00000000000000000b539ef570128acb953af3dbcfc19dd8e6066949672311a1',
  'testnet': '00000000d0bc4271bcefaa7eb25000e345910ba16b91eb375cd944b68624de9f'
};
var txHash = {
  'livenet': '22231e8219a0617a0ded618b5dc713fdf9b0db8ebd5bb3322d3011a703119d3b',
  'testnet': '22231e8219a0617a0ded618b5dc713fdf9b0db8ebd5bb3322d3011a703119d3b'
};

// These tests require a running bitcoind instance
describe('Integration with ' + network.name + ' bitcoind', function() {

  this.timeout(15000);
  it('handshakes', function(cb) {
    var peer = new Peer('localhost', network);
    peer.once('version', function(m) {
      m.version.should.be.above(70000);
      m.services.toString().should.equal('1');
      Math.abs(new Date() - m.timestamp).should.be.below(10000); // less than 10 seconds of time difference
      m.nonce.length.should.equal(8);
      m.start_height.should.be.above(300000);
      cb();
    });
    peer.once('verack', function(m) {
      should.exist(m);
      m.command.should.equal('verack');
    });
    peer.connect();
  });
  var connect = function(cb) {
    var peer = new Peer('localhost', network);
    peer.once('ready', function() {
      cb(peer);
    });
    peer.once('error', function(err) {
      should.not.exist(err);
    });
    peer.connect();
  };
  it('connects', function(cb) {
    connect(function(peer) {
      peer.version.should.be.above(70000);
      _.isString(peer.subversion).should.equal(true);
      _.isNumber(peer.bestHeight).should.equal(true);
      cb();
    });
  });
  it('handles inv', function(cb) {
    // assumes there will be at least one transaction/block
    // in the next few seconds
    connect(function(peer) {
      peer.once('inv', function(message) {
        message.inventory[0].hash.length.should.equal(32);
        cb();
      });
    });
  });
  it('handles addr', function(cb) {
    connect(function(peer) {
      peer.once('addr', function(message) {
        message.addresses.forEach(function(address) {
          (address.time instanceof Date).should.equal(true);
          should.exist(address.ip);
          (address.services instanceof BN).should.equal(true);
        });
        cb();
      });
      var message = new Messages.GetAddresses();
      peer.sendMessage(message);
    });
  });
  it('requests inv detailed info', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        should.exist(message.block);
        cb();
      });
      peer.once('tx', function(message) {
        should.exist(message.transaction);
        cb();
      });
      peer.once('inv', function(m) {
        var message = new Messages.GetData(m.inventory);
        peer.sendMessage(message);
      });
    });
  });
  it('sends tx inv and receives getdata for that tx', function(cb) {
    connect(function(peer) {
      var type = Messages.Inventory.TYPE.TX;
      var inv = [{
        type: type,
        typeName: Messages.Inventory.TYPE_NAME[type],
        hash: Random.getRandomBuffer(32) // needs to be random for repeatability
      }];
      peer.once('getdata', function(message) {
        message.inventory.should.deep.equal(inv);
        cb();
      });
      var message = new Messages.Inventory(inv);
      message.inventory[0].hash.length.should.equal(32);
      peer.sendMessage(message);
    });
  });
  it('requests block data', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        (message.block instanceof Block).should.equal(true);
        cb();
      });
      var message = Messages.GetData.forBlock(blockHash[network.name]);
      peer.sendMessage(message);
    });
  });
  var fakeHash = 'e2dfb8afe1575bfacae1a0b4afc49af7ddda69285857267bae0e22be15f74a3a';
  it('handles request tx data not found', function(cb) {
    connect(function(peer) {
      var expected = Messages.NotFound.forTransaction(fakeHash);
      peer.once('notfound', function(message) {
        (message instanceof Messages.NotFound).should.equal(true);
        message.should.deep.equal(expected);
        cb();
      });
      var message = Messages.GetData.forTransaction(fakeHash);
      peer.sendMessage(message);
    });
  });
  var from = [blockHash[network.name]];
  var stop = stopBlock[network.name];
  it('gets headers', function(cb) {
    connect(function(peer) {
      peer.once('headers', function(message) {
        (message instanceof Messages.Headers).should.equal(true);
        message.headers.length.should.equal(3);
        cb();
      });
      var message = new Messages.GetHeaders(from, stop);
      peer.sendMessage(message);
    });
  });
  it('gets blocks', function(cb) {
    connect(function(peer) {
      peer.once('inv', function(message) {
        (message instanceof Messages.Inventory).should.equal(true);
        if (message.inventory.length === 2) {
          message.inventory[0].type.should.equal(Messages.Inventory.TYPE.BLOCK);
          cb();
        }
      });
      var message = new Messages.GetBlocks(from, stop);
      peer.sendMessage(message);
    });
  });
  var testInvGetData = function(expected, message, cb) {
    connect(function(peer) {
      peer.once('getdata', function(message) {
        (message instanceof Messages.GetData).should.equal(true);
        message.should.deep.equal(expected);
        cb();
      });
      peer.sendMessage(message);
    });
  };
  it('sends block inv and receives getdata', function(cb) {
    var randomHash = Random.getRandomBuffer(32); // needs to be random for repeatability
    var expected = Messages.GetData.forBlock(randomHash);
    var message = Messages.Inventory.forBlock(randomHash);
    testInvGetData(expected, message, cb);
  });
  it('sends tx inv and receives getdata', function(cb) {
    var randomHash = Random.getRandomBuffer(32); // needs to be random for repeatability
    var expected = Messages.GetData.forTransaction(randomHash);
    var message = Messages.Inventory.forTransaction(randomHash);
    testInvGetData(expected, message, cb);
  });
});
