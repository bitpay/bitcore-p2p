'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

// todo: add payload: https://en.bitcoin.it/wiki/Protocol_documentation#reject
function RejectMessage(arg, options) {
  Message.call(this, options);
  this.command = 'reject';
}
inherits(RejectMessage, Message);

RejectMessage._name = 'Reject';

RejectMessage.prototype.setPayload = function() {};

RejectMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = RejectMessage;
