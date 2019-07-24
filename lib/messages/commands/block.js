'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('flocore-lib');
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;

/**
 * @param {Block=} arg - An instance of a Block
 * @param {Object} options
 * @param {Function} options.Block - A block constructor
 * @extends Message
 * @constructor
 */
function BlockMessage(arg, options) {
  Message.call(this, options);
  this.Block = options.Block;
  this.command = 'block';
  $.checkArgument(
    _.isUndefined(arg) || arg instanceof this.Block,
    'An instance of Block or undefined is expected'
  );
  this.block = arg;
}
inherits(BlockMessage, Message);

BlockMessage.prototype.setPayload = function(payload) {
  if (typeof this.Block.fromRaw === 'function') {
    this.block = this.Block.fromRaw(payload);
  } else {
    this.block = this.Block.fromBuffer(payload);
  }
};

BlockMessage.prototype.getPayload = function() {
  if (typeof this.Block.fromRaw === 'function') {
    return this.block.toRaw();
  }
  return this.block.toBuffer();
};

module.exports = BlockMessage;
