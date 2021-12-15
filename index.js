const fs = require('fs');
const m3u8Parser = require('m3u8-parser');
const tus = require('tus-js-client');

const FILE_SERVER = 'http://23.88.119.203:1080/files/';
//const FILE_SERVER = 'http://0.0.0.0:1080/files/';

class Publisher {
    constructor(path, playlist) {
      this.playlist = playlist;
      this.path = path;
      this.queue = [];

      this.uploaded = [];
    }

    start() {
        fs.watchFile(this.path + this.playlist, (curr, prev) => {
            console.log(`Playlist file Changed`);

            fs.readFile(this.path + this.playlist, 'utf8' , (err, data) => {
                if (err) {
                    console.error(err)
                    return
                }
                this.processNewSegment(data);
            })

        });

    
    }


    processNewSegment(manifest) {
        var parser = new m3u8Parser.Parser();

        parser.push(manifest);
        parser.end();

        var parsedManifest = parser.manifest;

        //console.log(parsedManifest);

        parsedManifest.segments.forEach((segment) => {
            if (this.queue.includes(segment.uri)) {
                console.log("Segement " + segment.uri + " already in queue");
                return;
            }

            this.queue.push(segment.uri);
            console.log("Add " + segment.uri + " to upload queue");
        })
        

        if (this.uploaded.length === 0) {
            this.work(0);
        }
        //this.addQueue(manifest);
    }

    

    work(pos) {
        console.log(this.uploaded.length + "/" + this.queue.length);
        if (this.queue[pos] === undefined) {
            setTimeout(() => {
                this.work(pos);
            }, 500);
            return;
        }
        console.log("Work on: " + this.queue[pos]);
        this.upload(this.queue[pos], (filename) => {
            this.uploaded.push(filename);
            console.log('Upload finished: ' + filename);
            //this.checkManifestFinishedUpload(parsedManifest, manifest);
            if (this.queue.length > pos) {
                this.work(pos + 1);
            }
        });
    }

    upload(filename, successCallback) {
        let path = this.path + filename;
        var file = fs.createReadStream(path);
        var size = fs.statSync(path).size;

        var options = {
            endpoint: FILE_SERVER,
            retryDelays: [0, 1000, 2000, 4000, 8000, 10000, 15000, 20000, 30000, 40000, 50000, 60000],
            metadata: {
              filename: filename,
              filetype: 'application/octet-stream',
            },
            uploadSize: size,
            onError (error) {
              console.log("ERROR", error);
            },
            onProgress (bytesUploaded, bytesTotal) {
              var percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
              console.log(`${percentage}% - ${bytesUploaded}/${bytesTotal}`)
            },
            onSuccess () {
              successCallback && successCallback(filename);
            },
        }
          
        var upload = new tus.Upload(file, options)
        upload.start()
    }
}

const publisher = new Publisher('/Users/andresavic/hls/', 'stream.m3u8');
publisher.start();