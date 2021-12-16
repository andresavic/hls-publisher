const fs = require('fs');
const m3u8Parser = require('m3u8-parser');
const tus = require('tus-js-client');
var path = require('path');

const { performance } = require('perf_hooks');

const FILE_SERVER = 'http://23.88.119.203:1080/files/';
//const FILE_SERVER = 'http://0.0.0.0:1080/files/';

class Publisher {
    constructor(key, path, delay) {
      this.key = key;
      this.delay = delay, 
      this.path = path;
      this.currentPos = 0;
      this.queue = [];
      this.uploaded = [];
    }

    start() {
        fs.watch(this.path, (event, filename) => {
            if (path.extname(filename) != '.ts') {
                return;
            }

            this.processNewSegment(filename);
        });

        this.work();
    }


    processNewSegment(segment) {
        if (this.queue.includes(segment)) {
            return;
        }

        this.queue.push(segment);
    }

    

    work() {
        console.log("Work on: " + this.queue[this.currentPos] + " Stats: " + this.currentPos + " / " + this.queue.length +  " (" + (this.queue.length - this.currentPos)  + ")");

        if (this.queue[this.currentPos] === undefined) {
            setTimeout(() => {
                this.work();
            }, 500);
            return;
        }

        if (this.uploaded.includes(this.queue[this.currentPos])) {
            console.log("Already uploaded");
            this.currentPos++;
            this.work();
            return;
        }


        if ((this.queue.length - this.currentPos) <= this.delay) {
            setTimeout(() => {
                this.work();
            }, 100);

            return;
        }

        let start = performance.now();
        this.upload(this.queue[this.currentPos], (filename) => {
            this.uploaded.push(filename);
            let time = Math.round(performance.now() - start);
            console.log('Done Pos: ' + this.currentPos +  ' Name:' + filename + ' Time:' + time);
            this.currentPos++;
            //this.checkManifestFinishedUpload(parsedManifest, manifest);
            if (this.queue.length >= this.currentPos) {
                this.work();
            }
        }, (error) => {
            console.log("ERROR", error);
            this.work();
        });
    }

    upload(filename, successCallback, errorCallback) {
        let path = this.path + filename;
        var file = fs.createReadStream(path);
        var size = fs.statSync(path).size;

        var options = {
            endpoint: FILE_SERVER,
            retryDelays: [0, 1000],
            metadata: {
              key: this.key,
              filename: filename,
              currentPos: this.currentPos,
              queueLength: this.queue.length,
              filetype: 'application/octet-stream',
            },
            uploadSize: size,
            onError (error) {
              errorCallback && errorCallback(error);
            },
            onProgress (bytesUploaded, bytesTotal) {
              //var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
              //console.log(`${percentage}% - ${bytesUploaded}/${bytesTotal}`)
            },
            onSuccess () {
              successCallback && successCallback(filename);
            },
        }
          
        var upload = new tus.Upload(file, options)
        upload.start()
    }
}

const publisher = new Publisher('test3', '/Users/andresavic/hls/', 10);
publisher.start();