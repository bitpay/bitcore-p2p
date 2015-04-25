'use strict';

var bitcore = require('bitcore');
var Inventory = require('../inventory');

function builder(options) {
  /* jshint maxstatements: 20 */
  /* jshint maxcomplexity: 10 */

  if (!options) {
    options = {};
  }

  if (!options.network) {
    options.network = bitcore.Networks.defaultNetwork;
  }

  options.Block = options.Block || bitcore.Block;
  options.BlockHeader = options.BlockHeader || bitcore.BlockHeader;
  options.Transaction = options.Transaction || bitcore.Transaction;
  options.MerkleBlock = options.MerkleBlock || bitcore.MerkleBlock;
  options.protocolVersion = options.protocolVersion || 70000;

  var exported = {
    constructors: {
      Block: options.Block,
      BlockHeader: options.BlockHeader,
      Transaction: options.Transaction,
      MerkleBlock: options.MerkleBlock
    },
    defaults: {
      protocolVersion: options.protocolVersion,
      network: options.network
    },
    inventoryCommands: [
      'getdata',
      'inv',
      'notfound'
    ],
    commandsMap: {
      version: require('./commands/version'),
      verack: require('./commands/verack'),
      ping: require('./commands/ping'),
      pong: require('./commands/pong'),
      block: require('./commands/block'),
      tx: require('./commands/tx'),
      getdata: require('./commands/getdata'),
      headers: require('./commands/headers'),
      notfound: require('./commands/notfound'),
      inv: require('./commands/inv'),
      addr: require('./commands/addr'),
      alert: require('./commands/alert'),
      reject: require('./commands/reject'),
      merkleblock: require('./commands/merkleblock'),
      filterload: require('./commands/filterload'),
      filteradd: require('./commands/filteradd'),
      filterclear: require('./commands/filterclear'),
      getblocks: require('./commands/getblocks'),
      getheaders: require('./commands/getheaders'),
      mempool: require('./commands/mempool'),
      getaddr: require('./commands/getaddr')
    },
    commands: {}
  };

  Object.keys(exported.commandsMap).forEach(function(key) {
    var Command = exported.commandsMap[key];
    exported.commands[key] = function(obj) {
      return new Command(obj, options);
    };

    exported.commands[key]._constructor = Command;

    exported.commands[key].fromBuffer = function(buffer) {
      var message = exported.commands[key]();
      message.setPayload(buffer);
      return message;
    };

  });

  exported.inventoryCommands.forEach(function(command) {

    // add forTransaction methods
    exported.commands[command].forTransaction = function forTransaction(hash) {
      return new exported.commands[command]([Inventory.forTransaction(hash)]);
    };

    // add forBlock methods
    exported.commands[command].forBlock = function forBlock(hash) {
      return new exported.commands[command]([Inventory.forBlock(hash)]);
    };

    // add forFilteredBlock methods
    exported.commands[command].forFilteredBlock = function forFilteredBlock(hash) {
      return new exported.commands[command]([Inventory.forFilteredBlock(hash)]);
    };

  });

  return exported;

}

module.exports = builder;
