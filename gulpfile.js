require('6to5/polyfill');
var Promise = global.Promise = require('bluebird');
var _ = require('lodash-next');

var addsrc = require('gulp-add-src');
var autoprefixer = require('autoprefixer-core')({ cascade: true });
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var concat = require('gulp-concat');
var cssbeautify = require('gulp-cssbeautify');
var cssmqpacker = require('css-mqpacker');
var csswring = require('csswring');
var del = require('del');
var envify = require('envify/custom');
var es6to5 = require('gulp-6to5');
var gplumber = require('gulp-plumber');
var gulp = require('gulp');
var gutil = require('gulp-util');
var imagemin = require('gulp-imagemin');
var insert = require('gulp-insert');
var jshint = require('gulp-jshint');
var path = require('path');
var postcss = require('gulp-postcss');
var react = require('gulp-react');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var style = require('gulp-react-nexus-style');
var stylish = require('jshint-stylish');
var uglify = require('gulp-uglify');

// Improve default error handler to get stack trace.
function plumber() {
    return gplumber({ errorHandler: function(err) { console.error(err.stack); } });
};

var DEV = process.env.NODE_ENV !== 'production';
if(DEV) {
  console.log('gulp started in DEVELOPMENT mode; start with NODE_ENV="production" before deploying.');
}
else {
  console.log('gulp started in PRODUCTION mode; start with NODE_ENV="development" to get more runtime-checks.');
}

gulp.task('clean', function(fn) {
  del([
    'dist',
    'public/native.history.js', 'public/normalize.css',
    'public/p.js', 'public/c.js', 'public/p.css', 'public/p.js',
    'public/p.min.js', 'public/c.min.js', 'public/p.min.css', 'public/p.min.js',
  ], fn);
});

gulp.task('lintJS', ['clean'], function() {
  return gulp.src('src/**/*.js')
  .pipe(plumber())
  .pipe(jshint())
  .pipe(jshint.reporter(stylish));
});

gulp.task('lintJSX', ['clean'], function() {
  return gulp.src(['src/**/*.jsx'])
  .pipe(plumber())
  .pipe(react())
  .pipe(jshint({ quotmark: false }))
  .pipe(jshint.reporter(stylish));
})

gulp.task('lint', ['lintJS', 'lintJSX']);

gulp.task('build', ['clean'], function() {
  return gulp.src(['src/**/*.js', 'src/**/*.jsx'])
  .pipe(plumber())
  .pipe(DEV ? sourcemaps.init() : gutil.noop())
  .pipe(insert.prepend('require(\'6to5/polyfill\');\nconst Promise = require(\'bluebird\'); const __DEV__ = (process.env.NODE_ENV !== \'production\');\n'))
  .pipe(rename({ extname: '.js' }))
  .pipe(es6to5())
  .pipe(DEV ? sourcemaps.write() : gutil.noop())
  .pipe(gulp.dest('dist'));
});

gulp.task('compile', ['lint', 'build']);

gulp.task('bundle', ['compile'], function() {
  return browserify({
    fullPaths: false,
    debug: DEV,
    entries: ['./dist/client.js'],
    ignoreMissing: ['promise'],
  })
  .transform(envify({ NODE_ENV: DEV }))
  .bundle()
  .pipe(plumber())
  .pipe(source('c.js'))
  .pipe(gulp.dest('dist'));
});

gulp.task('componentsCSS', ['compile'], function() {
  return gulp.src('src/**/*.jsx', { base: '.' })
  .pipe(plumber())
  .pipe(rename(function(p) {
    p.dirname = path.join(__dirname, p.dirname.replace(/^src/, 'dist'));
    p.extname = ".js";
  }))
  .pipe(style())
  .pipe(DEV ? sourcemaps.init() : gutil.noop())
  .pipe(concat('c.css'))
  .pipe(postcss([autoprefixer]))
  .pipe(cssbeautify({ indent: '  ', autosemicolon: true }))
  .pipe(DEV ? sourcemaps.write() : gutil.noop())
  .pipe(gulp.dest('dist'));
});

gulp.task('public', ['componentsCSS', 'bundle'], function() {
  return gulp.src([
    'bower_components/history.js/scripts/bundled/html4+html5/native.history.js',
    'bower_components/normalize.css/normalize.css',
    'dist/c.js',
    'dist/c.css',
  ])
  .pipe(plumber())
  .pipe(gulp.dest('public'));
});

gulp.task('packJS', ['public'], function() {
  return gulp.src(['public/**/*.js', '!public/p.js', '!public/p.min.js', '!public/c.js'])
  .pipe(plumber())
  .pipe(DEV ? sourcemaps.init() : gutil.noop())
  // Add c.js later so that it always gets evaluated last
  .pipe(addsrc('public/c.js'))
  .pipe(concat('p.js'))
  .pipe(DEV ? gutil.noop() : uglify())
  .pipe(DEV ? gutil.noop() : rename({ extname: '.min.js' }))
  .pipe(DEV ? sourcemaps.write() : gutil.noop())
  .pipe(gulp.dest('public'));
});

gulp.task('packCSS', ['public'], function() {
  return gulp.src(['public/**/*.css', '!public/p.css', '!public/p.min.css', '!public/c.css'])
  .pipe(plumber())
  .pipe(DEV ? sourcemaps.init() : gutil.noop())
  // Add c.css later so that it always gets evaluated last
  .pipe(addsrc('public/c.css'))
  .pipe(concat('p.css'))
  .pipe(DEV ? gutil.noop() : postcss([cssmqpacker, csswring]))
  .pipe(DEV ? gutil.noop() : rename({ extname: '.min.css' }))
  .pipe(DEV ? sourcemaps.write() : gutil.noop())
  .pipe(gulp.dest('public'));
});

gulp.task('pack', ['packJS', 'packCSS']);

gulp.task('finalize', ['pack'], function(fn) {
  if(DEV) {
    return fn(null);
  }
  del(['public/c.css', 'public/c.js', 'public/native.history.js', 'public/normalize.css'], fn);
})

gulp.task('default', ['finalize']);
