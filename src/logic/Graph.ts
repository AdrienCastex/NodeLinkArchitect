import { Config, ConfigOptionsPropViewType, IConfigOptionsLinkTypeAddon, IConfigOptionsNodeLink, IConfigOptionsType, IConfigOptionsTypeEntry } from "./Config";
import { IViewport, Viewport } from "./Viewport";

export class Graph {
    public static current: Graph;
    protected static keys = [
        { start: '{___stateMachineDataStart___}', end: '{___stateMachineDataEnd___}' },
        { start: '{___dialogStoryStart___}', end: '{___dialogStoryEnd___}' },
    ]
    protected static currentVersion = 1;

    public static parseConfig(data: any) {
        if(typeof data === 'string') {
            for(const keyEntry of Graph.keys) {
                if(data.includes(keyEntry.start)) {
                    data = data.substring(data.indexOf(keyEntry.start) + keyEntry.start.length);
                    data = data.substring(0, data.indexOf(keyEntry.end));
                    break;
                }
            }

            data = JSON.parse(data);
        }

        if(data.config && !localStorage.getItem('config')) {
            return data.config;
        }

        return undefined;
    }

    public static parse(data: any) {
        if(typeof data === 'string') {
            for(const keyEntry of Graph.keys) {
                if(data.includes(keyEntry.start)) {
                    data = data.substring(data.indexOf(keyEntry.start) + keyEntry.start.length);
                    data = data.substring(0, data.indexOf(keyEntry.end));
                    break;
                }
            }

            data = JSON.parse(data);
        }

        const graph = new Graph();

        graph.guid = data.guid;
        graph.lib = data.lib ?? '';
        graph.viewport = data.viewport ?? graph.viewport;
        graph.openGroups = data.openGroups ?? graph.openGroups;
        graph.currentSubGraphGUIDs = data.currentSubGraphGUIDs ?? graph.currentSubGraphGUIDs;
        graph.nodes = data.nodes.map(n => GraphNode.parse(n, data.version));
        graph.links = data.links.map(l => GraphLink.parse(l, data.version));

        return graph;
    }

    public clone(options: { nodes: GraphNode[], links: GraphLink[], positionOffset?: { x: number, y: number }, cloneExternalLinks?: boolean }) {
        const positionOffset = options.positionOffset ?? { x: 0, y: 0 };
        const nodes = options.nodes;
        const links = options.links;
        const cloneExternalLinks = options.cloneExternalLinks ?? false;

        const newNodes: GraphNode[] = [];
        const newLinks: GraphLink[] = [];

        const nodesMapping: { [srcGUID: string]: string } = {};

        for(const node of nodes) {
            const newNode = GraphNode.parse(JSON.parse(JSON.stringify(node)), Graph.currentVersion);
            newNode.guid = Graph.generateGUID();
            newNodes.push(newNode);

            nodesMapping[node.guid] = newNode.guid;

            newNode.x += positionOffset.x;
            newNode.y += positionOffset.y;
        }

        for(const node of nodes) {
            if(node.typeId === '_subGraph_') {
                const subGraphID = node.guid;

                const subGraphItems = this.nodes.filter(n => n.subGraphGUID === subGraphID);
                const subGraphClonedItems = this.clone({
                    nodes: subGraphItems,
                    links: [],
                });

                for(const item of subGraphClonedItems.nodes) {
                    item.subGraphGUID = nodesMapping[subGraphID];
                }
            }
        }

        for(const link of links) {
            if(nodesMapping[link.srcNodeGuid] && (!link.hasTargetNode || nodesMapping[link.targetNodeGuid])) {
                const newLink = GraphLink.parse(JSON.parse(JSON.stringify(link)), Graph.currentVersion);
                newLink.guid = Graph.generateGUID();
                newLinks.push(newLink);

                newLink.srcNodeGuid = nodesMapping[newLink.srcNodeGuid];
                if(newLink.hasTargetNode) {
                    newLink.targetNodeGuid = nodesMapping[newLink.targetNodeGuid];
                }
                
                newLink.x += positionOffset.x;
                newLink.y += positionOffset.y;
            }
        }
        
        for(const node of nodes) {
            const srcTargetLinks = this.links.filter(l => !links.some(l1 => l1.guid === l.guid)).filter(l => l.srcNodeGuid === node.guid || l.targetNodeGuid === node.guid);

            for(const link of srcTargetLinks) {
                const srcFound = !!nodesMapping[link.srcNodeGuid];
                const targetFound = link.hasTargetNode && !!nodesMapping[link.targetNodeGuid];
                const isInternalLink = srcFound && targetFound;
                const isExternalLink = srcFound || targetFound;

                if(isInternalLink || cloneExternalLinks && isExternalLink) {
                    const newLink = GraphLink.parse(JSON.parse(JSON.stringify(link.toJSON())), Graph.currentVersion);
                    newLink.guid = Graph.generateGUID();

                    if(srcFound) {
                        newLink.srcNodeGuid = nodesMapping[newLink.srcNodeGuid];
                    }
                    if(targetFound) {
                        newLink.targetNodeGuid = nodesMapping[newLink.targetNodeGuid];
                    }

                    if(link.hasTargetNode) {
                        this.links.push(newLink);
                    } else {
                        newLinks.push(newLink);
                    }
                    
                    newLink.x += positionOffset.x;
                    newLink.y += positionOffset.y;
                }
            }
        }

        this.nodes.push(...newNodes);
        this.links.push(...newLinks);

        return {
            nodes: newNodes,
            links: newLinks
        }
    }

    public save(saveServerUrl: string) {
        const code = this.toJS();
        localStorage.setItem('code', code);

        if(saveServerUrl) {
            if(!saveServerUrl.includes('://')) {
                saveServerUrl = `http://${saveServerUrl}`;
            }

            fetch(saveServerUrl, {
                method: "POST",
                body: JSON.stringify({
                    graph: this.toJSON(),
                    code: code
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            navigator.clipboard.writeText(code);
        }
    }

    public undo() {
        if(Graph.currentHistoryIndex > 0) {
            --Graph.currentHistoryIndex;
            Graph.current = Graph.parse(Graph.history[Graph.currentHistoryIndex]);
        }
    }

    public redo() {
        if(Graph.currentHistoryIndex < Graph.history.length) {
            Graph.current = Graph.parse(Graph.history[Graph.currentHistoryIndex]);
            ++Graph.currentHistoryIndex;
        }
    }

    public saveHistory() {
        Graph.history.splice(Graph.currentHistoryIndex + 1);
        Graph.history.push(JSON.stringify(this.toJSON()));
        
        ++Graph.currentHistoryIndex;
    }

    public deleteNode(n: GraphNode) {
        if(n.typeId === '_subGraph_') {
            const subGraphs = [ n.guid ];
            let subGraphsChanged = false;
            do {
                subGraphsChanged = false;
                for(const node of this.nodes) {
                    if(subGraphs.includes(node.subGraphGUID) && node.typeId === '_subGraph_' && !subGraphs.includes(node.guid)) {
                        subGraphs.push(node.guid);
                        subGraphsChanged = true;
                    }
                }
            } while(subGraphsChanged);
            
            const nodesToDelete = this.nodes.filter(e => e === n || subGraphs.includes(e.subGraphGUID)).map(e => e.guid);
            this.nodes = this.nodes.filter(e => !nodesToDelete.includes(e.guid));

            this.links = this.links.filter(l => !nodesToDelete.includes(l.srcNodeGuid) && (!l.targetNodeGuid || !nodesToDelete.includes(l.targetNodeGuid)));
        } else {
            this.nodes = this.nodes.filter(e => e !== n);

            this.links = this.links.filter(l => !(l.targetNodeGuid === n.guid || l.srcNodeGuid === n.guid));
        }
    }

    public toJS(): string
    public toJS(config: Config): string
    public toJS(config?: Config) {
        if(!config) {
            return this.toJS(Config.instance);
        }

        const keyEntry = Graph.keys[0];
        const data = `//// <GENERATED CODE - State machine tool - date=${Date.now()}> ////${keyEntry.start}${JSON.stringify(this)}${keyEntry.end}`;

        return config.toCode({
            data: data,
            graph: this
        });
    }

    public static generateGUID() {
        return Math.random().toString().substring(2) + Date.now().toString();
    }

    guid = Graph.generateGUID();

    lib: string = '';
    nodes: GraphNode[] = [];
    links: GraphLink[] = [];
    
    viewport: IViewport = {
        x: 0,
        y: 0,
        scale: 1
    };

    openGroups: { [nodeLinkGUID: string]: string[] } = {};

    currentSubGraphGUIDs: string[] = [];
    
    public get flatNodes() {
        return this.nodes.filter(n => !n.typeId.startsWith('_subGraph_'));
    }
    public get flatLinks() {
        const linksToRemove: GraphLink[] = [];
        const linksToAdd: GraphLink[] = [];

        for(const link of this.links) {
            if(link.typeId === '_subGraph_output_link_') { // convert sub graph output links
                const graphNodeGuid = link.srcNodeGuid;
                const outputGraphNode = this.nodes.find(n => n.typeId === '_subGraph_output_' && n.subGraphGUID === graphNodeGuid);
                
                const outputLinks = this.links.filter(l => l.targetNodeGuid === outputGraphNode.guid);
                linksToRemove.push(...outputLinks);
                linksToRemove.push(link);

                linksToAdd.push(...outputLinks.map(l => {
                    const newLink = GraphLink.parse(JSON.parse(JSON.stringify(l.toJSON())), Graph.currentVersion);
                    newLink.targetNodeGuid = link.targetNodeGuid;
                    return newLink;
                }));
            } else {
                const targetNode = link.getTargetNode(this.nodes);
                
                if(targetNode && targetNode.typeId === '_subGraph_') { // convert sub graph input links
                    const inputGraphNode = this.nodes.find(n => n.typeId === '_subGraph_input_' && n.subGraphGUID === targetNode.guid);

                    const inputLink = this.links.find(l => l.srcNodeGuid === inputGraphNode.guid);
                    linksToRemove.push(inputLink);
                    linksToRemove.push(link);
                    
                    const newLink = GraphLink.parse(JSON.parse(JSON.stringify(link.toJSON())), Graph.currentVersion);
                    newLink.targetNodeGuid = inputLink.targetNodeGuid;
                    linksToAdd.push(newLink);
                }
            }
        }

        return this.links
            .filter(l => !linksToRemove.includes(l))
            .concat(linksToAdd);
    }

    static history: string[] = [];
    static currentHistoryIndex: number = 0;

    public createNode(node: GraphNode) {
        this.nodes.push(node);
        node.updateHeight();
        node.updateWidth();

        if(node.typeId === '_subGraph_') {
            node.viewport = {
                x: 0,
                y: 0,
                scale: 1
            };

            {
                const innerNode = new GraphNode();
                innerNode.setType('_subGraph_input_');
                innerNode.x = 0;
                innerNode.y = 0;
                innerNode.subGraphGUID = node.guid;
                this.nodes.push(innerNode);
            }
            {
                const innerNode = new GraphNode();
                innerNode.setType('_subGraph_output_');
                innerNode.x = 0;
                innerNode.y = 100;
                innerNode.subGraphGUID = node.guid;
                this.nodes.push(innerNode);
            }
        }
    }
    public createLink(link: GraphLink, typeId: string) {
        const srcNode = this.nodes.find(n => n.guid === link.srcNodeGuid);

        link.setType(srcNode.typeId === '_subGraph_' ? '_subGraph_output_link_' : (srcNode.typeId === '_subGraph_input_' ? '_subGraph_input_link_' : typeId));
        this.links.push(link);
    }

    public static resetHistory() {
        Graph.history = [];
        Graph.currentHistoryIndex = 0;
        Graph.current.saveHistory();
    }

    toJSON() {
        return {
            version: Graph.currentVersion,
            guid: this.guid,
            lib: this.lib,
            nodes: this.nodes.map(a => a.toJSON()),
            links: this.links.map(a => a.toJSON()),
            viewport: this.viewport,
            openGroups: this.openGroups,
            currentSubGraphGUIDs: this.currentSubGraphGUIDs,
            config: localStorage.getItem('config')
        }
    }
}

(window as any).Graph = Graph;

export interface IGraphProperties {
    [id: string]: {
        value: string | number | boolean
    }
}

export abstract class GraphNodeLink {
    public static parseAndWrite<T extends GraphNodeLink>(result: T, data, version: number): T {
        if(data.height !== undefined) {
            data._height = data.height;
            delete data.height;
        }
        if(data.width !== undefined) {
            data._width = data.width;
            delete data.width;
        }

        Object.assign(result, data);
        GraphNodeLink.fulfillType(result.properties, result.info, data.typeId);
        return result;
    }

    constructor() {
        this.setType();
    }

    protected abstract get info(): IConfigOptionsNodeLink;

    static fulfillType(properties: IGraphProperties, allInfo: IConfigOptionsNodeLink, typeId: string = allInfo.types.default ? 'default' : Object.keys(allInfo.types)[0]) {
        const commonProps = allInfo.properties;
        if(commonProps) {
            for(const propId in commonProps) {
                const prop = commonProps[propId];
                
                properties[propId] = properties[propId] ?? {
                    value: prop.defaultValue
                };
            }
        }

        const info = allInfo.types[typeId];

        for(const propId in info.properties) {
            const prop = info.properties[propId];
            
            properties[propId] = properties[propId] ?? {
                value: prop.defaultValue
            };
        }
    }

    setType(typeId: string = this.info.types.default ? 'default' : Object.keys(this.info.types)[0]) {
        if(this.typeId !== typeId) {
            this.typeId = typeId;

            const commonProps = this.info.properties;
            if(commonProps) {
                for(const propId in commonProps) {
                    const prop = commonProps[propId];
                    
                    this.properties[propId] = {
                        value: typeof prop.defaultValue === 'string' ? this.parseValue(prop.defaultValue) : prop.defaultValue
                    };
                }
            }

            const info = this.info.types[typeId];

            for(const propId in info.properties) {
                const prop = info.properties[propId];
                
                this.properties[propId] = {
                    value: typeof prop.defaultValue === 'string' ? this.parseValue(prop.defaultValue) : prop.defaultValue
                };
            }

            this._width = info.defaultSize?.width ?? this._width;
            this._height = info.defaultSize?.height ?? this._height;
        }
    }

    public parseValue(defaultValue: string) {
        return defaultValue ? defaultValue.replace('{_guid_}', this.guid) : defaultValue;
    }

    guid = Graph.generateGUID();
    properties: IGraphProperties = {};
    typeId: string;

    get type() {
        return this.info.types[this.typeId];
    }

    get propertiesInfo() {
        return {
            ...this.info.properties,
            ...this.type.properties
        }
    }

    x: number
    y: number
    protected _width: number = 300
    get width() {
        return this._width;
    }
    set width(value) {
        this._width = Math.max(value, this.minWidth);
    }

    protected _height: number = 0
    get height() {
        return this._height;
    }
    set height(value) {
        this._height = Math.max(value, this.minHeight);
    }

    public updateHeight() {
        this.height = this.height;
    }
    public updateWidth() {
        this.width = this.width;
    }

    public get minWidth() {
        return 100;
    }

    public get minHeight() {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

        if(!Graph.current) {
            return 1.5 * rem;
        }

        const border = 0.4 * rem;

        return Object.values(this.getGroupedProperties()).reduce((p, c) => p + (c.isOpen ? c.minHeightPx : 1.5 * rem), border * 2 - 2); // -2: last two spacing pixels
    }

    public get isHeightResizable() {
        return this.hasMultiline;
    }

    public get hasMultiline() {
        const properties = this.type.properties;

        const isMonoline = (propertyKey: string) => {
            const prop = properties[propertyKey];
    
            if(prop.viewType === ConfigOptionsPropViewType.Checkbox || prop.viewType === ConfigOptionsPropViewType.List) {
                return true;
            } else {
                return prop.isMonoline;
            }
        }

        for(const key in properties) {
            if(!isMonoline(key)) {
                return true;
            }
        }

        return false;
    }

    public getGroupedProperties(excludeProperties: string[] = []) {
        const properties = this.type.properties;

        const isMonoline = (propertyKey: string) => {
            const prop = properties[propertyKey];
    
            if(prop.viewType === ConfigOptionsPropViewType.Checkbox || prop.viewType === ConfigOptionsPropViewType.List) {
                return true;
            } else {
                return prop.isMonoline;
            }
        }
        
        const isOpenList = Graph.current.openGroups[this.guid] ?? [];
    
        const allPropsKeys = Object.keys(properties);
        const grouped = allPropsKeys.filter(key => !excludeProperties.includes(key)).reduce((p, c) => {
            const groupKey = properties[c].group ?? '';
            const isDefaultGroup = !groupKey;

            let group = p[groupKey];
            if(!group) {
                group = {
                    items: [],
                    nbMonolines: !isDefaultGroup ? 1 : 0,
                    nbMultilines: 0,
                    heightPx: 0,
                    multilinesHeight: 0,
                    minHeightPx: 0,
                    monolinesHeight: 0,
                    isOpen: isDefaultGroup || isOpenList.includes(groupKey)
                };
                p[groupKey] = group;
            }
            group.items.push(c);
            
            if(isMonoline(c)) {
                ++group.nbMonolines;
            } else {
                ++group.nbMultilines;
            }
    
            return p;
        }, {} as { [groupKey: string]: { nbMonolines: number, nbMultilines: number, items: string[], heightPx: number, multilinesHeight: number, monolinesHeight: number, minHeightPx: number, isOpen: boolean } });
    
        let totalHeightPx = this._height;
    
        const nbProperties = allPropsKeys.length - Object.keys(grouped).filter(groupKey => groupKey && !isOpenList.includes(groupKey)).map(e => grouped[e].items.length).reduce((p, c) => p + c, 0);
        const nbMonolineProperties = allPropsKeys.filter(propKey => isMonoline(propKey) && (!properties[propKey].group || isOpenList.includes(properties[propKey].group))).length;
        const nbMultilineProperties = nbProperties - nbMonolineProperties;
    
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const border = 0.4 * rem;
    
        totalHeightPx -= border * 2;
    
        const lineHeightPx = 1.5 * rem;
        const heightForMultilines = totalHeightPx - (nbMonolineProperties + (Object.keys(grouped).length - 1)) * lineHeightPx;
        const oneMultilineHeight = heightForMultilines / nbMultilineProperties;
    
        for(const groupKey in grouped) {
            const group = grouped[groupKey];
            group.multilinesHeight = group.nbMultilines > 0 ? oneMultilineHeight * group.nbMultilines : 0;
            group.monolinesHeight = group.nbMonolines * lineHeightPx;
            group.heightPx = group.multilinesHeight + group.monolinesHeight;
            group.minHeightPx = group.nbMultilines * lineHeightPx + group.monolinesHeight;
        }

        return grouped;
    }
    
    public toJSON() {
        return {
            guid: this.guid,
            typeId: this.typeId,
            properties: this.properties,
            x: this.x,
            y: this.y,
            _width: this._width,
            _height: this._height,
        }
    }
}

export class GraphNode extends GraphNodeLink {
    public subGraphGUID: string = undefined;
    public viewport: IViewport = undefined;

    public static parse(data, version: number) {
        const result = GraphNodeLink.parseAndWrite(new GraphNode(), data, version);
        result.subGraphGUID = data.subGraphGUID;
        
        result.viewport = data.viewport;
        if(!data.viewport && result.typeId === '_subGraph_') {
            result.viewport = {
                x: 0,
                y: 0,
                scale: 1
            };
        }
        
        return result;
    }

    protected get info(): IConfigOptionsNodeLink {
        return Config.instance.nodes;
    }

    public toJSON() {
        return Object.assign({
            subGraphGUID: this.subGraphGUID,
            viewport: this.viewport
        }, super.toJSON());
    }
}

export class GraphLink extends GraphNodeLink {
    public static parse(data, version: number) {
        return GraphNodeLink.parseAndWrite(new GraphLink(), data, version);
    }

    protected get info(): IConfigOptionsNodeLink {
        return Config.instance.links;
    }

    public toJSON() {
        return {
            ...super.toJSON(),
            srcNodeGuid: this.srcNodeGuid,
            targetNodeGuid: this.targetNodeGuid
        }
    }

    get type() {
        return (super.type as any) as IConfigOptionsTypeEntry & IConfigOptionsLinkTypeAddon;
    }

    get hasTargetNode() {
        return this.type.hasTargetNode;
    }
    
    srcNodeGuid: string
    targetNodeGuid: string

    protected _srcNode: GraphNode;
    getSrcNode(nodes: GraphNode[]) {
        if(!this._srcNode || this._srcNode.guid !== this.srcNodeGuid) {
            this._srcNode = nodes.find(n => n.guid === this.srcNodeGuid);
        }
        return this._srcNode;
    }
    
    protected _targetNode: GraphNode;
    getTargetNode(nodes: GraphNode[]) {
        if(!this._targetNode || this._targetNode.guid !== this.targetNodeGuid) {
            this._targetNode = nodes.find(n => n.guid === this.targetNodeGuid);
        }
        return this._targetNode;
    }
}
