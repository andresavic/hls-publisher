const fs = require('fs');
const m3u8Parser = require('m3u8-parser');
const tus = require('tus-js-client');

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

        console.log(parsedManifest);

        parsedManifest.segments.forEach((segment) => {
            if (this.queue.includes(segment)) {
                console.log("Segement " + segment + " already in queue");
                return;
            }

            this.queue.push(segment);

            console.log("Add " + segment + " to upload queue");

            this.upload(segment.uri, (filename) => {
                this.uploaded.push(filename);
                this.checkManifestFinishedUpload(parsedManifest, manifest);
            });
        })
        //this.addQueue(manifest);
    }

    checkManifestFinishedUpload(parsedManifest, manifest) {
        let finished = parsedManifest.segments.every((seg) => {
            return this.uploaded.includes(seg.uri);
        })

        if (finished) {
            fs.writeFile(this.path + 'temp.m3u8', manifest, err => {
                if (err) {
                  console.error(err)
                  return
                }
                this.upload('temp.m3u8', () => {
                    console.log("Manifest uploaded");
                })
            })
            console.log("Upload MANIFEST");
        }
    }

    upload(filename, successCallback) {
        let path = this.path + filename;
        var file = fs.createReadStream(path);
        var size = fs.statSync(path).size;

        var options = {
            endpoint: 'http://127.0.0.1:1080/files/',
            retryDelays: [0, 1000, 2500, 5000, 10000],
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
              //console.log(bytesUploaded, bytesTotal, `${percentage}%`)
            },
            onSuccess () {
              successCallback && successCallback(filename);
              console.log('Upload finished: ' + filename);
            },
        }
          
        var upload = new tus.Upload(file, options)
        upload.start()
    }
}

const publisher = new Publisher('/Users/andresavic/hls/', 'stream.m3u8');
publisher.start();