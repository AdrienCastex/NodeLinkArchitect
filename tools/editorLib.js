import http from "http";
import fs from "fs";

/**
 * @typedef {{ code: string, graph: any }} Data
 */
/**
 * @typedef {'virtualLib'} NotificationChangeType
 */
/**
 * @typedef {{
 *  port?: number,
 *  writeData(data: Data): Promise<void>,
 *  readData(): string | Promise<string>,
 *  readInlineLib(): string | Promise<string>,
 *  readVirtualLib(): string | Promise<string>,
 * }} EditorServerOptions
 */

export class EditorServer {
    /**
     * @param {EditorServerOptions} options
     */
    constructor(options) {
        this.options = options;

        if(this.options.port) {
            this.port = this.options.port;
        }
    }

    port = 1900;

    /**
     * @type {{ [headerKey: string]: string | number }}
     */
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
        'Access-Control-Max-Age': 2592000,
        'Access-Control-Allow-Headers': 'Content-Type, Accept'
    };

    /**
     * @type {{ res: http.ServerResponse }[]}
     */
    notificationClients = [];
    /**
     * @type {{ [changeType: string]: NodeJS.Timeout }}
     */
    notifyWithDelayTimeout = {};

    /**
     * @param {NotificationChangeType} changeType
     */
    notifyWithDelay(changeType) {
        if(this.notifyWithDelayTimeout[changeType]) {
            clearTimeout(this.notifyWithDelayTimeout[changeType]);
        }
        this.notifyWithDelayTimeout[changeType] = setTimeout(() => {
            delete this.notifyWithDelayTimeout[changeType];

            for(const client of this.notificationClients) {
                client.res.write(`data: ${JSON.stringify({
                    eventId: 'contentChanged',
                    changeType: changeType
                })}\n\n`);
            }

            console.log('Clients notified');
        }, 50);
    }

    /**
     *
     * @param {{ rootFolder: string, changeType: NotificationChangeType }} options
     */
    watchAndNotify(options) {
        fs.watch(options.rootFolder, { recursive: true }, (event, filename) => {
            console.log('File change detected: ' + filename);
            this.notifyWithDelay(options.changeType);
        });
    }

    /**
     * @protected
     * @type {http.Server}
     */
    _server;
    /**
     * @type {http.Server}
     */
    get server() {
        if(!this._server) {
            this._server = http.createServer((req, res) => this.onServerRequest(req, res));
        }
        return this._server;
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    onServerRequestOptions(req, res) {
        res.writeHead(200, this.headers);
        res.end();
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    onServerRequestPost(req, res) {
        let body = "";
        req.on('readable', () => {
            const part = req.read();
            if(part) {
                body += part;
            }
        });
        req.on('end', () => {
            /**
             * @type {Data}
             */
            const data = JSON.parse(body);

            res.writeHead(200, this.headers);
            res.end();

            this.options.writeData(data);
        });
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    onServerRequestGet(req, res) {
        switch(req.url) {
            case '/':
                this.onServerRequestGetData(req, res);
                break;
            case '/virtual-lib':
                this.onServerRequestGetVirtualLib(req, res);
                break;
            case '/inline-lib':
                this.onServerRequestGetInlineLib(req, res);
                break;
            case '/notifications':
                this.onServerRequestGetNotifications(req, res);
                break;
        }
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    async onServerRequestGetData(req, res) {
        res.writeHead(200, this.headers);
        res.end(await this.options.readData());
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    async onServerRequestGetVirtualLib(req, res) {
        res.writeHead(200, this.headers);
        res.end(await this.options.readVirtualLib());
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    async onServerRequestGetInlineLib(req, res) {
        res.writeHead(200, this.headers);
        res.end(await this.options.readInlineLib());
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    onServerRequestGetNotifications(req, res) {
        const notifHeaders = {
            ...this.headers,
            'Content-Type': 'text/event-stream',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        };
        res.writeHead(200, notifHeaders);

        res.write(`data: ${JSON.stringify({
            eventId: 'connected',
        })}\n\n`);

        /**
         * @type {notificationClients[0]}
         */
        const notificationClient = {
            res: res
        }
        this.notificationClients.push(notificationClient);
        console.log('Client subscribed');

        req.on('close', () => {
            console.log('Client unsubscribed');
            const index = this.notificationClients.indexOf(notificationClient);
            if(index >= 0) {
                this.notificationClients.splice(index, 1);
            }
        });
    }

    /**
     * @protected
     * @param {http.IncomingMessage} req
     * @param {http.ServerResponse<http.IncomingMessage} res
     */
    onServerRequest(req, res) {
        switch(req.method.toLowerCase()) {
            case 'options':
                this.onServerRequestOptions(req, res);
                break;
            case 'post':
                this.onServerRequestPost(req, res);
                break;
            case 'get':
                this.onServerRequestGet(req, res);
                break;
        }
    }

    get editorUrl() {
        return `https://adriencastex.github.io/NodeLinkArchitect/?serverUrl=http://localhost:${this.port}`;
    }

    start() {
        this.server.listen(this.port);

        console.log('Listening: http://localhost:' + this.port);
        console.log('Editor available at: ' + this.editorUrl);
    }
}
