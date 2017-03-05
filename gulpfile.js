'use strict';
const gulp = require('gulp');
const gutil = require('gulp-util');
const merge = require('merge-stream');
const runSequence = require('run-sequence');
const streamify = require('gulp-streamify');

const persistify = require('persistify');
const watchify = require('watchify');
const babelify = require('babelify');
const uglify = require('gulp-uglify');
const scssify = require('scssify');

const source = require('vinyl-source-stream');

const sass = require('gulp-sass');
const htmlmin = require('gulp-htmlmin');
const cssnano = require('gulp-cssnano');

const yargs = require('yargs');
const argv = yargs.argv;

const browserSync = require('browser-sync').create();

const vendors = [
	'react',
	'react-dom'
];
const isProduction = argv.p || argv.prod || argv.production;

if(isProduction) {
	process.env.NODE_ENV = 'production';
}

const SRC_DIR = './src';
const BUILD_DIR = './build';

function swallowError (error) {
	console.log(error.toString());
	this.emit('end');
}

function buildHtml() {
	let buildStartTime = null;
	let buildEndTime = null;

	function run() {
		buildStartTime = new Date();

		let stream = gulp.src(`${SRC_DIR}/html/index.html`)
		.on('error', swallowError)
		.on('end', () => {
			buildEndTime = new Date();
			gutil.log(`Building HTML done. (Time elapsed ${buildEndTime - buildStartTime}ms.)`);
		})

		if(isProduction) {
			stream.pipe(htmlmin({collapseWhitespace: true}));
		}

		return stream.pipe(gulp.dest(`${BUILD_DIR}/html`));
	} 

	gulp.watch(`${SRC_DIR}/html/**`, () => {
		gutil.log('Detect HTML changes. Rebuilding...');
		return run();
	});

	return run();
}

function buildScss() {
	let buildStartTime = null;
	let buildEndTime = null;

	function run() {
		buildStartTime = new Date();

		let stream = gulp.src(`${SRC_DIR}/css/app.css`)
		.on('error', swallowError)
		.on('end', () => {
			buildEndTime = new Date();
			gutil.log(`Building SCSS done. (Time elapsed ${buildEndTime - buildStartTime}ms.)`);
		})
		.pipe(sass());

		if(isProduction) {
			stream.pipe(cssnano());
		}

		return stream.pipe(gulp.dest(`${BUILD_DIR}/css`))
		.pipe(browserSync.stream());
	} 

	gulp.watch(`${SRC_DIR}/scss/**`, () => {
		gutil.log('Detect SCSS changes. Rebuilding...');
		return run();
	});

	return run();
}

function buildVendor() {
	const b = persistify({ debug: false });

	vendors.forEach(vendor => {
		b.require(vendor);
	});

	let stream = b.bundle()
	.on('error', swallowError)
	.on('end', () => {
		browserSync.reload();
	})
	.pipe(source('vendor.js'));

	if(isProduction) {
		stream.pipe(streamify(uglify()));
	}

	return stream.pipe(gulp.dest(`${BUILD_DIR}/js`));
}

function buildJs() {
	let bopts = {
		paths: [
			`${SRC_DIR}/js`,
			`${SRC_DIR}/scss`
		],
		debug: !isProduction
	};
	let opts = Object.assign({}, watchify.args, bopts);

	let b = watchify(persistify(opts))
	.add(`${SRC_DIR}/js/index.js`)
	.on('update', bundle)
	.on('log', gutil.log)
	.external(vendors)
	.transform(babelify, { 
		presets: ["es2015", "react"],
		plugins: [
			"syntax-async-functions",
			"transform-regenerator",
			"transform-class-properties"
		]
	})
	.transform(scssify, {
		autoInject: true
	});
	
	function bundle() {
		let stream = b.bundle()
		.on('error', swallowError)
		.on('end', () => {
			browserSync.reload();
		})
		.on('error', swallowError)
		.pipe(source('bundle.js'));

		if(isProduction) {
			stream.pipe(streamify(uglify()));
		}

		return stream.pipe(gulp.dest(`${BUILD_DIR}/js`));
	}

	return bundle();
}

function serve() {
	browserSync.init({
		server: {
			baseDir: [
				BUILD_DIR,
				`${BUILD_DIR}/html`,
				`${BUILD_DIR}/css`,
				`${BUILD_DIR}/js`
			]
		}
	});

	gulp.watch(`${SRC_DIR}/html/**`, buildHtml);
	gulp.watch(`${SRC_DIR}/scss/**`, buildScss);

	gulp.watch(`${BUILD_DIR}/html/index.html`).on('change', browserSync.reload);

	// return empty stream
	return gutil.noop();	
}


gulp.task('default', () => {
	runSequence('build', 'serve');
});

gulp.task('build', () => {
	return merge([
		buildHtml(),
		buildScss(),
		buildJs(),
		buildVendor()
	]);
});

gulp.task('build::html', () => {
	return buildHtml();
});

gulp.task('build::scss', () => {
	return buildScss();
});

gulp.task('build::script', () => {
	return merge([
		buildJs(), 
		buildVendor()
	]);
});

gulp.task('serve', () => {
	return serve();
});