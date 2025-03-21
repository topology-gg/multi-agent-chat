const webpack = require("webpack");

module.exports = function override(config, env) {
    config.resolve.fallback = {
        async_hooks: false,
        url: require.resolve("url"),
        fs: require.resolve("graceful-fs"),
        buffer: require.resolve("buffer"),
        stream: require.resolve("stream-browserify"),
        path: require.resolve("path-browserify"),
        crypto: require.resolve("crypto-browserify"),
        os: require.resolve("os-browserify/browser"),
        'process/browser': require.resolve('process/browser'),
        assert: require.resolve("assert"),
        util: require.resolve("util"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        zlib: require.resolve("browserify-zlib"),
        constants: require.resolve("constants-browserify"),
        vm: require.resolve("vm-browserify"),
    };
    config.plugins.push(
        new webpack.ProvidePlugin({
            process: require.resolve("process/browser"),
            Buffer: ["buffer", "Buffer"],
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.browser': true,
            'process.version': JSON.stringify(process.version),
            'global': 'window',
        }),
        new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
            const mod = resource.request.replace(/^node:/, "");
            switch (mod) {
                case "buffer":
                    resource.request = "buffer";
                    break;
                case "stream":
                    resource.request = "readable-stream";
                    break;
                case "crypto":
                    resource.request = "crypto-browserify";
                    break;
                case "fs":
                    resource.request = "graceful-fs";
                    break;
                default:
                    throw new Error(`Not found ${mod}`);
            }
        }),
    );
    config.ignoreWarnings = [/Failed to parse source map/];

    return config;
};