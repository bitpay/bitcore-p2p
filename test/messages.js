'use strict';

var chai = require('chai');
var should = chai.should();
var fs = require('fs');
var Buffers = require('buffers');

var bitcore = require('bitcore');
var _ = bitcore.deps._;
var Networks = bitcore.Networks;
var network = Networks.livenet;
var BufferUtils = bitcore.util.buffer;

var Data = require('./data/messages');
var P2P = require('../');
var BloomFilter = P2P.BloomFilter;
var Messages = P2P.Messages;


describe('Messages', function() {

  var commands = {
    Version: 'version',
    VerAck: 'verack',
    Inventory: 'inv',
    Addresses: 'addr',
    Ping: 'ping',
    Pong: 'pong',
    Alert: 'alert',
    Reject: 'reject',
    Block: 'block',
    MerkleBlock: 'merkleblock',
    FilterLoad: 'filterload',
    FilterAdd: 'filteradd',
    FilterClear: 'filterclear',
    GetBlocks: 'getblocks',
    GetHeaders: 'getheaders',
    GetData: 'getdata',
    GetAddresses: 'getaddr',
    Headers: 'headers',
    Transaction: 'tx',
    NotFound: 'notfound'
  };
  // TODO: add data for these
  var noPayload = ['Reject', 'GetBlocks', 'GetHeaders'];
  var names = Object.keys(commands);
  describe('named', function() {
    names.forEach(function(name) {
      var command = commands[name];
      var data = Data[command.toUpperCase()];

      it('should have data for ' + name, function() {
        should.exist(data);
      });

      it('command for name ' + name, function() {
        Messages.Message.COMMANDS[command].should.equal(Messages[name]);
      });

      describe(name, function() {
        var message = new Messages[name]();
        it('should be able to create instance', function() {
          message.command.should.equal(command);
        });

        it('should be able to serialize the payload', function() {
          var payload = message.getPayload();
          should.exist(payload);
        });

        it('should be able to serialize the message', function() {
          var buffer = message.serialize(Networks.livenet);
          should.exist(buffer);
        });

        if (noPayload.indexOf(name) === -1) {
          it('should be able to parse payload', function() {
            var payload = new Buffer(data.payload, 'hex');
            var m = new Messages[name]().fromBuffer(payload);
            should.exist(m);
          });
        }
      });
    });
  });

  var buildMessage = function(hex) {
    var m = Buffers();
    m.push(new Buffer(hex, 'hex'));
    return m;
  };
  it('fails with invalid command', function() {
    var invalidCommand = 'f9beb4d96d616c6963696f757300000025000000bd5e830c' +
      '0102000000ec3995c1bf7269ff728818a65e53af00cbbee6b6eca8ac9ce7bc79d87' +
      '7041ed8';
    var fails = function() {
      Messages.parseMessage(network, buildMessage(invalidCommand));
    };
    fails.should.throw('Unsupported message command: malicious');
  });

  it('ignores malformed messages', function() {
    var malformed1 = 'd8c4c3d976657273696f6e000000000065000000fc970f1772110' +
      '1000100000000000000ba6288540000000001000000000000000000000000000000' +
      '0000ffffba8886dceab0010000000000000000000000000000000000ffff0509552' +
      '2208de7e1c1ef80a1cea70f2f5361746f7368693a302e392e312fa317050001';
    var malformed2 = 'f9beb4d967657464617461000000000089000000d88134740102' +
      '0000006308e4a380c949dbad182747b0f7b6a89e874328ca41f37287f74a81b8f84' +
      '86d';
    var malformed3 = 'f9beb4d967657464617461000000000025000000616263640102' +
      '00000069ebcbc34a4f9890da9aea0f773beba883a9afb1ab9ad7647dd4a1cd346c3' +
      '728';
    [malformed1, malformed2, malformed3].forEach(function(malformed) {
      var ret = Messages.parseMessage(network, buildMessage(malformed));
      should.not.exist(ret);
    });
  });

  it('Inventory#from family methods work', function() {
    var hash = 'eb951630aba498b9a0d10f72b5ea9e39d5ff04b03dc2231e662f52057f948aa1';
    [Messages.Inventory, Messages.GetData, Messages.NotFound].forEach(function(clazz) {
      var b = clazz.forBlock(hash);
      var mb = clazz.forMerkleBlock(hash);
      (b instanceof clazz).should.equal(true);
      var t = clazz.forTransaction(hash);
      (t instanceof clazz).should.equal(true);
      clazz.forBlock(BufferUtils.reverse(new Buffer(hash, 'hex'))).should.deep.equal(b);
      clazz.forMerkleBlock(BufferUtils.reverse(new Buffer(hash, 'hex'))).should.deep.equal(mb);
      clazz.forFilteredBlock(BufferUtils.reverse(new Buffer(hash, 'hex'))).should.deep.equal(mb);
      clazz.forTransaction(BufferUtils.reverse(new Buffer(hash, 'hex'))).should.deep.equal(t);
    });
  });

  it('Version#fromBuffer works w/o fRelay arg', function() {
    var messageHex = Data.VERSION_NO_FRELAY.payload;
    var message = new Messages.Version()
          .fromBuffer(new Buffer(messageHex, 'hex'));
  });

  it('Version#relay setting works', function() {
    [true,false].forEach(function(relay) {
      var message = new Messages.Version(null,null,relay);
      message.relay.should.equal(relay);
      var messageBuf = message.getPayload();
      var newMessage = new Messages.Version().fromBuffer(messageBuf)
      newMessage.relay.should.equal(relay);
    });
  });

  it('FilterLoad#fromBuffer method works', function() {
    var testPayload = Data.FILTERLOAD.payload;
    var msg = new Messages.FilterLoad().fromBuffer(new Buffer(testPayload, 'hex'));
    msg.getPayload().toString('hex').should.equal(testPayload);
  });

  it('MerkleBlock#fromBuffer method works', function() {
    var testPayload = Data.MERKLEBLOCK.payload;
    var msg = new Messages.MerkleBlock().fromBuffer(new Buffer(testPayload, 'hex'));
    msg.getPayload().toString('hex').should.equal(testPayload);
  });

  it('ParseMessages works on Satoshi-v0.9.1.dat', function(callback) {
    var fileBuffer = fs.readFileSync(__dirname + '/data/Satoshi-v0.9.1.dat');
    var dataBuffer = new Buffers();
    dataBuffer.push(fileBuffer);

    var expected = {
      version: 1,
      verack: 1,
      inv: 18,
      addr: 4
    };
    var actual = {
      version: 0,
      verack: 0,
      inv: 0,
      addr: 0
    };
    var countMessage = function(message) {
      actual[message.command]++;
      if (_.isEqual(actual, expected)) {
        callback();
      }
    };
    var messages = Messages.parseMessages(network, dataBuffer);
    messages.forEach(countMessage);
  });

  it('default new Ping has zero-length nonce', function() {
    var message = new Messages.Ping();
    message.nonce.length.should.equal(0);
  });
});
