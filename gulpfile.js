'use strict';

var gulp = require('gulp');
var bitcoreTasks = require('bitcore-build');

bitcoreTasks('p2p');

gulp.task('default', ['lint', 'coverage']);
