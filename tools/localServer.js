import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EditorServer } from "./editorLib.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(root, '../src/Story/Story.tsx');
const libFilesRoot = '../declarations';

const editorServer = new EditorServer({
    writeData(data) {
        console.log('Data received');

        fs.writeFileSync(dataFile, data.code);

        console.log('Write ' + data.code.length + ' chars at ' + dataFile);
    },
    readData() {
        console.log('Data requested');
        return fs.readFileSync(dataFile);
    },
    readInlineLib() {
        console.log('Lib inline requested');

        return '';
    },
    readVirtualLib() {
        console.log('Lib virtual requested');

        let totalContent = '';

        const process = (filePath) => {
            if(fs.statSync(filePath).isDirectory()) {
                for(const subFile of fs.readdirSync(filePath)) {
                    process(path.join(filePath, subFile));
                }
            } else {
                const content = fs.readFileSync(filePath)
                    .toString()
                    .replace(/^import .+$/img, '')
                    .replace(/import\s*\([^)]+\)\./img, '')
                    .replace(/^\s*export\s*{\s*}\s*;?\s*$/img, '')
                    .replace(/^\s*export\s*/img, '')

                totalContent = `${totalContent}\n// ${filePath}\n\n${content}\n`;
            }
        }
        process(path.join(root, libFilesRoot));

        return totalContent;
    }
});

editorServer.watchAndNotify({
    rootFolder: path.join(root, libFilesRoot),
    changeType: 'lib'
});

editorServer.start();
