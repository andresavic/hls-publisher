const tus = require('tus-node-server');
const fs = require('fs');
const path = require('path');

const storageFolder = path.join(process.cwd(), '/files')

const metadataStringToObject = (stringValue) => {
    const keyValuePairList = stringValue.split(',')
  
    return keyValuePairList.reduce((metadata, keyValuePair) => {
      let [key, base64Value] = keyValuePair.split(' ')
      metadata[key] = new Buffer(base64Value, "base64").toString("ascii")
  
      return metadata
    }, {})
}

class Receiver {
    constructor() {
        this.server = new tus.Server();
        this.streams = {}
    }

 
    
    start() {
        const fileNameFromUrl = (req) => {
            console.log(req);
            return req.url.replace(/\//g, '-');
        }

        this.server.datastore = new tus.FileStore({
            path: '/files'
        });
        const host = '0.0.0.0';
        const port = 1080;
        this.server.listen({ host, port }, () => {
            console.log(`[${new Date().toLocaleTimeString()}] tus server listening at http://${host}:${port}`);
        });

        this.server.on(tus.EVENTS.EVENT_UPLOAD_COMPLETE, (event) => {

     
            const oldPath = `${storageFolder}/${event.file.id}`
            const key = metadataStringToObject(event.file.upload_metadata).key;

            let currentSegment = this.streams[key]?.currentSegment || 0;

            const newPath = `${storageFolder}/${key}-stream${currentSegment}.ts`
            const currentPos = metadataStringToObject(event.file.upload_metadata).currentPos;
            const queueLength = metadataStringToObject(event.file.upload_metadata).queueLength;

            fs.rename(oldPath, newPath, (err) => {
              // handle error in here
              //console.error(err)

                //let segmentId = +segment.replace('stream', '').replace('.ts', '');
                let segments = Array.from(Array(currentSegment + 1).keys()).map((id) => {
                    return `#EXTINF:2.000000,
${key}-stream${id}.ts`;
                });

                
const manifest = `#EXTM3U
#EXT-X-PLAYLIST-TYPE:EVENT
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
${segments.join('\n')}
`;

                fs.writeFile(storageFolder + '/' + key + '.m3u8', manifest, err => {
                    if (err) {
                      console.error(err)
                      return
                    }

                    console.log("[" + key + "] Segment: " + currentSegment + " Client Stats: " + currentPos + "/" + queueLength + " (" + (queueLength - currentPos)  + ")");

                    this.streams[key] = {
                        currentSegment: (this.streams[key]?.currentSegment || 0) + 1
                    }
                });

            })
          })
    }
}

const receiver = new Receiver();
receiver.start();