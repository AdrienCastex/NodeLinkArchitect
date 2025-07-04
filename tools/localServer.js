import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import child_process from 'child_process';

const port = 1900;
const root = path.dirname(fileURLToPath(import.meta.url));
/**
 * File path where to save the code generated
 */
const targetFile = path.join(root, '../src/Story/Story.tsx');
const editorUrl = `https://adriencastex.github.io/NodeLinkArchitect/?serverUrl=http://localhost:${port}`;
const libFiles = [];

/**
 * @typedef {{ code: string, graph: any }} Data
 */

/**
 * @param {Data} data
 */
const onData = (data) => {
    console.log('Data received');

    fs.writeFileSync(targetFile, data.code);

    console.log('Write ' + data.code.length + ' chars at ' + targetFile);
}
const getData = () => {
    console.log('Data requested');

    return fs.readFileSync(targetFile);
}
const getInlineLib = () => {
    console.log('Lib inline requested');

    let totalContent = '';
    for(const file of libFiles) {
        const filePath = path.join(root, file);

        const content = fs.readFileSync(filePath)
            .toString()
            .replace(/^import .+$/img, '');

        totalContent = `${totalContent}\n${content}`;
    }

    return totalContent;
}
const getVirtualLib = () => {
    console.log('Lib virtual requested');

    let totalContent = '';

    return totalContent;
}

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Max-Age': 2592000,
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
};

const server = http.createServer((req, res) => {
    switch(req.method.toLowerCase()) {
        case 'options': {
            res.writeHead(200, headers);
            res.end();
            break;
        }
        case 'post': {
            let body = "";
            req.on('readable', function() {
                const part = req.read();
                if(part) {
                    body += part;
                }
            });
            req.on('end', function() {
                /**
                 * @type {Data}
                 */
                const data = JSON.parse(body);

                res.writeHead(200, headers);
                res.end();

                onData(data);
            });
            break;
        }
        case 'get': {
            res.writeHead(200, headers);
            switch(req.url) {
                case '/':
                    res.end(getData());
                    break;
                case '/virtual-lib':
                    res.end(getVirtualLib());
                    break;
                case '/inline-lib':
                    res.end(getInlineLib());
                    break;
            }
            break;
        }
    }
});

server.listen(port);

console.log('Listening: http://localhost:' + port);
console.log('Editor available at: ' + editorUrl);
child_process.exec(`start ${editorUrl}`);
