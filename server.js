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
    }

 
    
    start() {
        const fileNameFromUrl = (req) => {
            console.log(req);
            return req.url.replace(/\//g, '-');
        }

        this.server.datastore = new tus.FileStore({
            path: '/files'
        });
        const host = '127.0.0.1';
        const port = 1080;
        this.server.listen({ host, port }, () => {
            console.log(`[${new Date().toLocaleTimeString()}] tus server listening at http://${host}:${port}`);
        });

        this.server.on(tus.EVENTS.EVENT_UPLOAD_COMPLETE, (event) => {
            const oldPath = `${storageFolder}/${event.file.id}`
            const newPath = `${storageFolder}/${metadataStringToObject(event.file.upload_metadata).filename}`
            
            fs.rename(oldPath, newPath, (err) => {
              // handle error in here
              //console.error(err)
            })
          })
    }
}

const receiver = new Receiver();
receiver.start();