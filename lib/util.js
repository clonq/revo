var fs = require('fs')
  , log = require('./logging')
  , S = require('string')
  , handlebars = require('handlebars')

module.exports = {

	copyFile: function(src, dst){
	    fs.createReadStream(src).pipe(fs.createWriteStream(dst));  
	},

    shortFilename: function(filename, opts) {
        var snfrom = (filename.indexOf('/') >= 0) ? filename.lastIndexOf('/') + 1 : 0;
        var snto = filename.length;
        if(opts && !opts.ext) snto = (filename.indexOf('.') >= 0) ? filename.lastIndexOf('.') : filename.length-1;
        var shortname = filename.substring(snfrom, snto);
        return shortname;
    },

    emptyDirectory: function(path, fn) {
        fs.readdir(path, function(err, files){
            if (err && 'ENOENT' != err.code) throw err;
            fn(!files || !files.length);
        });
    },

    abort: function(str) {
        log.err(str, 3);
        process.exit(1);
    },

    loadJson: function(filename) {
        var ret = {};
        var filename = S(filename).ensureRight('.json').s;
        if(fs.existsSync(filename)) {
            ret = JSON.parse(fs.readFileSync(filename));
        } else {
            this.abort('no such file ' + filename)
        }
        return ret;
    },

    getDirs: function(rootDir) {
        var ret = [];
        var files = fs.readdirSync(rootDir);
        for(var i=0; i<files.length; i++) {
            var file = files[i];
            if(file[0] != '.') {
                var filePath = rootDir+'/'+file;
                var stat = fs.statSync(filePath);
                if(stat.isDirectory()) ret.push(file);
            }
        }
        return ret;
    },

    getFiles: function(rootDir) {
        var ret = [];
        var files = fs.readdirSync(rootDir);
        for(var i=0; i<files.length; i++) {
            var file = files[i];
            if(file[0] != '.') {
                var filePath = rootDir+'/'+file;
                var stat = fs.statSync(filePath);
                if(stat.isFile()) ret.push(file);
            }
        }
        return ret;
    },

    compileTemplate: function(source, data) {
        var template = handlebars.compile(source);
        return template(data);
    },

    isDir: function(filepath) {
        return fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory();
    },

    cleanupDataDir: function() {
        //todo
    }

}