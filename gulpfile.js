import gulp from 'gulp'
import source from 'vinyl-source-stream'
import tsify from 'tsify'
import browsersync from 'browser-sync'
import browserify from 'browserify'
import esmify from 'esmify'
import webpack from 'webpack-stream'

const destination = 'dist'

gulp.task('copyPublic', () =>
    gulp.src('public/**/*').pipe(gulp.dest(destination))
)

gulp.task('browserify', () =>
    browserify({
        basedir: 'src',
        entries: ['main.ts'],
        debug: true,
        cache: {},
        packageCache: {},
    })
        .plugin(tsify)
        .plugin(esmify)
        .bundle()
        .on('error', console.log)
        .pipe(source('bundle.js'))
        .pipe(gulp.dest(destination))
)

const webpackConfig = {
    mode: 'development',
    output: {
        filename: 'bundle.js',
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.js$/,
                use: 'source-map-loader',
                enforce: 'pre',
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
}
gulp.task('webpack-watch', done => {
    const w = gulp
        .src('src/main.ts')
        .pipe(webpack({ watch: true, ...webpackConfig }))
        .pipe(gulp.dest(destination))

    done()
    return w
})

gulp.task('webpack', () =>
    gulp
        .src('src/main.ts')
        .pipe(webpack(webpackConfig))
        .pipe(gulp.dest(destination))
)

gulp.task('serve', () =>
    browsersync.init({
        server: {
            baseDir: destination,
        },
        port: 5210,
        open: false,
        https: true,
    })
)

gulp.task('reload browsersync', done => {
    browsersync.reload()
    done()
})

gulp.task('watch', () => {
    gulp.watch('public/**/*', gulp.series('copyPublic', 'reload browsersync'))
    gulp.watch('dist/bundle.js', gulp.series('reload browsersync'))
    // gulp.watch('src/**/*', gulp.series('webpack', 'reload browsersync')).on(
    //     'error',
    //     console.log
    // )
    // done()
})

gulp.task('build', gulp.series('copyPublic', 'webpack'))

gulp.task('dev', gulp.series('copyPublic', 'webpack-watch', gulp.parallel('serve', 'watch')))
