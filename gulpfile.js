'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const csso = require('gulp-csso');
const pug = require('gulp-pug');
const webpack = require('webpack-stream');
const path = require('path');
const browsersync = require('browser-sync');
const del = require('del');
const webp = require('gulp-webp');
const spritesmith = require('gulp.spritesmith');
const merge = require('merge-stream');  // spritesmith dependency
const svgSprite = require('gulp-svg-sprite');
const rev = require('gulp-rev');  // add hash for css
const revdel = require('gulp-rev-delete-original');  // remove original css after 'gulp-dev'
const revCollector = require('gulp-rev-collector');  // replace css hash link in html

// const webpackCfg = require('./webpack-developer-config.js');

const dist = './dist/';

gulp.task('buildHtml', () => gulp
  .src('./src/pug/pages/*.pug')
  .pipe(pug({ pretty: true }))
  .pipe(gulp.dest(dist))
  .pipe(browsersync.stream()));

gulp.task('create-raster-sprite', () => {
  const spriteData = gulp.src('./src/img/raster-icons-for-sprite/*.png')
    .pipe(spritesmith({
      imgName: 'raster-sprite.png',
      cssName: 'raster-sprite.scss',
      cssFormat: 'scss',
      algorithm: 'binary-tree',
      imgPath: '../img/sprite/raster-sprite.png',
    }));

  const imgStream = spriteData.img
    .pipe(gulp.dest('./src/img/sprite/'));

  const cssStream = spriteData.css
    .pipe(gulp.dest('./src/sass/'));

  return merge(imgStream, cssStream);
});

gulp.task('buildCss', () => gulp
  .src('./src/sass/pages/*.scss')
  .pipe(sass())
  .pipe(autoprefixer({ cascade: false, }))
  .pipe(csso({ restructure: true }))
  .pipe(gulp.dest(`${dist}css/`))
  .pipe(browsersync.stream()));

gulp.task('add-hash-for-css', () => gulp.src('./dist/css/*.css')
  .pipe(rev())
  .pipe(revdel())
  .pipe(gulp.dest('./dist/css'))
  .pipe(rev.manifest())
  .pipe(gulp.dest('./src/manifest-for-hash-css'))
  .pipe(gulp.src(['./src/manifest-for-hash-css/*.json', 'dist/*.html'])));

gulp.task('replace-css-hash-link-in-html', () => gulp.src(['src/manifest-for-hash-css/*.json', 'dist/*.html'])
  .pipe(revCollector({
    replaceReved: true,
    dirReplacements: {
      css: 'css',
    },
  }))
  .pipe(gulp.dest('dist')));

gulp.task('createWebp', () => gulp
  .src([
    './src/img/**',
    '!./src/img/sprite/**',
    '!./src/img/webp/**',
    '!./src/img/raster-icons-for-sprite/**',
    '!./src/img/vector-icons-for-sprite/**',
  ], { nodir: true })
  .pipe(webp({ quality: 80 }))
  .pipe(gulp.dest('./src/img/webp/')));

gulp.task('create-vector-sprite', () => gulp.src('./src/img/vector-icons-for-sprite/*.svg')
  .pipe(svgSprite({
    svg: {
      xmlDeclaration: false,
      doctypeDeclaration: false,
    },
    mode: {
      symbol: {
        bust: false,
        dest: './',
        sprite: './vector-sprite',
        common: 'background-image',
      },
    },
  }))
  .pipe(gulp.dest('./src/img/sprite')));

gulp.task('copyImage', () => gulp
  .src([
    './src/img/**/*',
    '!./src/img/raster-icons-for-sprite/**',
    '!./src/img/vector-icons-for-sprite/**',
  ])
  .pipe(gulp.dest(`${dist}img/`)));

gulp.task('copyFonts', () => gulp
  .src('./src/fonts/**/*')
  .pipe(gulp.dest(`${dist}fonts/`)));

gulp.task('copyVideo', () => gulp
  .src('./src/video/**/*')
  .pipe(gulp.dest(`${dist}video/`)));

gulp.task('clean', () => del([dist, 'src/manifest-for-hash-css']));


gulp.task('build-js', () => gulp
  .src('./src/js/*.js')
  .pipe(
    webpack({
      mode: 'development',
      context: path.resolve(__dirname, 'src/js'),
      entry: {
        index: './index.js',
        photoVideo: './photo-video.js',
        feedback: './feedback.js',
        //  vendor: './src/vendor.js',
      },
      output: {
        path: path.resolve(__dirname, 'dist/js'),
        filename: '[name].js',  // names are taken from 'entry'
        // filename: 'bundle.[name].js',  // names are taken from 'entry'
      },
      watch: false,  // ?????????????
      devtool: 'source-map',
      target: 'web',
      module: {
        rules: [
          { // rules[0]
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  [
                    '@babel/preset-env',
                    {
                      debug: true,
                      corejs: 3,
                      useBuiltIns: 'usage'
                    },
                  ],
                ],
              },
            },
          },
          {  // rules[1]

          }
        ],
      },
    }),
  )
  .pipe(gulp.dest(`${dist}js/`))
  .on('end', browsersync.reload));

gulp.task('watch', () => {
  browsersync.init({
    server: dist,
    port: 4000,
    notify: true,
  });

  gulp.watch('./src/pug/**/*.pug', gulp.parallel('buildHtml'));
  gulp.watch('./src/sass/**/*.scss', gulp.parallel('buildCss'));
  gulp.watch('./src/js/**/*.js', gulp.parallel('build-js'));
  gulp.watch('./src/img/**/*', gulp.parallel('copyImage'));  // НАДО ЧТО-ТО ДЕЛАТЬ (создание webp)
  // gulp.watch('./src/img/**/*', gulp.parallel('create-raster-sprite', 'buildCss', 'createWebp', 'create-vector-sprite', 'copyImage'));  // НАДО ЧТО-ТО ДЕЛАТЬ (создание webp)
});

gulp.task('build', gulp.series('clean', 'buildHtml', 'buildCss', 'build-js', 'createWebp', 'copyImage', 'copyFonts'));


// buildHTML, create-raster-sprite, buildCss, (add-hash-for-css, replace-css-hash-link-in-html (prod)), createWebp, create-vector-sprite, copyImage, copyFonts, build-js,
gulp.task('new-serve', gulp.series('clean', 'buildHtml', 'create-raster-sprite', 'buildCss', 'createWebp', 'create-vector-sprite', 'copyImage', 'copyFonts', 'copyVideo', 'build-js', 'watch'));
gulp.task('new-prod', gulp.series('clean', 'buildHtml', 'create-raster-sprite', 'buildCss', 'add-hash-for-css', 'replace-css-hash-link-in-html', 'createWebp', 'create-vector-sprite', 'copyImage', 'copyFonts'));

gulp.task('build-prod-js', () => gulp
  .src('./src/js/main.js')
  .pipe(
    webpack({
      mode: 'production',
      output: {
        filename: './js/main.js'
      },
      module: {
        rules: [
          {
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/,
            // exclude: /node_modules[\/\\](?!(swiper|dom7)[\/\\])/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  [
                    '@babel/preset-env',
                    {
                      corejs: 3,
                      useBuiltIns: 'usage'
                    }
                  ]
                ]
              }
            }
          }
        ]
      }
    })
  )
  .pipe(gulp.dest(dist)));

gulp.task('default', gulp.parallel('watch', 'build'));
