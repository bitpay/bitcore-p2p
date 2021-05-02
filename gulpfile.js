'use strict';

var gulp = require('gulp');
var widecoreTasks = require('widecore-build');

widecoreTasks('p2p', {skipBrowser: true});

gulp.task('default', ['lint', 'coverage']);
