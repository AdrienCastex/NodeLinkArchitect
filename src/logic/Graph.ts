import { Config, ConfigOptionsPropViewType, IConfigOptionsLinkTypeAddon, IConfigOptionsNodeLink, IConfigOptionsTypeEntry } from "./Config";
import { IViewport } from "./Viewport";
import { compress, decompress, trimUndefinedRecursively } from 'compress-json'

export interface IGraphTree {
    hierarchicalPath: string[]
    parentGuid: string
    guid: string
    graphNode: GraphNode
    nodes: GraphNode[]
    graphs: IGraphTree[]
}

export class Graph {
    public static current: Graph;
    protected static keys = [
        { start: '{___stateMachineDataStart___}', end: '{___stateMachineDataEnd___}' },
        { start: '{___dialogStoryStart___}', end: '{___dialogStoryEnd___}' },
    ]
    public static currentVersion = 1;

    protected static extractDataObject(data: any): any {
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

        if(Array.isArray(data)) {
            data = decompress(data as any);
        }

        return data;
    }

    public static parseConfig(data: any) {
        data = this.extractDataObject(data);
        
        return data.config;
    }

    public static parse(data: any) {
        data = this.extractDataObject(data);

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
            const newNode = GraphNode.clone(node);
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
                const newLink = GraphLink.clone(link);
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
                    const newLink = GraphLink.clone(link);
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

    public save(serverUrl: string) {
        return new Promise<void>((resolve, reject) => {
            try {
                const code = this.toJS();
                localStorage.setItem('code', code);

                if(serverUrl) {
                    if(!serverUrl.includes('://')) {
                        serverUrl = `http://${serverUrl}`;
                    }

                    fetch(serverUrl, {
                        method: "POST",
                        body: JSON.stringify({
                            graph: this.toJSON(),
                            code: code
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }).then(() => resolve()).catch(reject);
                } else {
                    navigator.clipboard.writeText(code).then(() => resolve()).catch(reject);
                }
            } catch(ex) {
                reject(ex);
            }
        })
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

        const dataObj = this.toJSON();
        trimUndefinedRecursively(dataObj);

        const data = `//// <GENERATED CODE - State machine tool - date=${Date.now()}> ////${keyEntry.start}${JSON.stringify(compress(dataObj))}${keyEntry.end}`;

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
    
    public get graphTree() {
        return this.graphTreeFlat[''];
    }
    public get graphTreeFlat() {
        const parenting: { [id: string]: IGraphTree } = {};

        const getParent = (parentId: string) => {
            let entry = parenting[parentId];
            if(!entry) {
                entry = {
                    hierarchicalPath: [],
                    parentGuid: '',
                    guid: parentId,
                    graphNode: undefined,
                    graphs: [],
                    nodes: []
                };
                parenting[parentId] = entry;
            }
            return entry;
        }

        for(const node of this.nodes) {
            const parentId = node.subGraphGUID || '';
            const parentEntry = getParent(parentId);

            parentEntry.nodes.push(node);
            
            if(node.typeId === '_subGraph_') {
                const subGraphEntry = getParent(node.guid);
                subGraphEntry.graphNode = node;
                subGraphEntry.parentGuid = node.subGraphGUID;
                parentEntry.graphs.push(subGraphEntry);
            }
        }

        for(const id in parenting) {
            const entry = parenting[id];
            entry.hierarchicalPath.push(entry.guid);

            let currentEntry: IGraphTree = entry;
            while(currentEntry.parentGuid) {
                entry.hierarchicalPath.splice(0, 0, currentEntry.parentGuid);
                currentEntry = parenting[currentEntry.parentGuid];
            };
            
            if(entry.guid) {
                entry.hierarchicalPath.splice(0, 0, '');
            }
        }

        return parenting;
    }

    public static groupLinks(links: GraphLink[]) {
        const groups: { [id: string]: GraphLink[] } = {};

        for(const link of links) {
            const groupId = link.type.hasTargetNode ? (link.srcNodeGuid + ' -> ' + link.targetNodeGuid) : link.guid;
            let groupArray = groups[groupId];
            if(!groupArray) {
                groupArray = [];
                groups[groupId] = groupArray;
            }

            groupArray.push(link);
        }

        return Object.values(groups);
    }

    public get groupedLinks(): GraphLink[][] {
        return Graph.groupLinks(this.links);
    }
    public get groupedFlatLinks(): GraphLink[][] {
        return Graph.groupLinks(this.flatLinks);
    }

    public get subGraphCloneNodes() {
        return this.nodes.filter(n => n.typeId === '_subGraph_clone_');
    }

    public getFlatNodesLinks(parentGUID: string, prefix: string) {
        const result = {
            nodes: [] as GraphNode[],
            links: [] as GraphLink[],
        };

        const mapping: { [originalGuid: string]: string } = {};

        for(const node of this.nodes) {
            if(node.subGraphGUID === parentGUID) {
                if(node.typeId.startsWith('_subGraph_')) {
                    if(node.typeId === '_subGraph_' || node.typeId === '_subGraph_clone_') {
                        const subGraphGUID = node.typeId === '_subGraph_' ? node.guid : node.properties.id.value as string;
                        
                        const subGraph = this.getFlatNodesLinks(subGraphGUID, `${prefix}-${node.guid}`);
                        result.nodes.push(...subGraph.nodes);
                        result.links.push(...subGraph.links);
                    }
                } else {
                    const newNode = node.clone();
                    newNode.guid = `${prefix}-${newNode.guid}`;
                    result.nodes.push(newNode);
                    
                    mapping[node.guid] = newNode.guid;
                }
            }
        }

        const makeLink = (link: GraphLink, newLink: GraphLink) => {
            if(link.hasTargetNode) {
                const targetNode = link.getTargetNode(this.nodes);

                if(targetNode.typeId === '_subGraph_output_') {
                    return;
                } else if(targetNode.typeId === '_subGraph_' || targetNode.typeId === '_subGraph_clone_') {
                    const subGraphGUID = targetNode.typeId === '_subGraph_' ? targetNode.guid : targetNode.properties.id.value as string;
                    
                    const inputNode = this.nodes.find(n => n.subGraphGUID === subGraphGUID && n.typeId === '_subGraph_input_');
                    const inputNodeTargetGuid = this.links.find(l => l.srcNodeGuid === inputNode.guid).targetNodeGuid;
                    newLink.targetNodeGuid = `${prefix}-${targetNode.guid}-${inputNodeTargetGuid}`;
                } else {
                    newLink.targetNodeGuid = mapping[link.targetNodeGuid];
                }
            }

            result.links.push(newLink);
        }

        for(const link of this.links) {
            const srcNode = link.getSrcNode(this.nodes);

            if(srcNode.subGraphGUID === parentGUID) {
                if(srcNode.typeId === '_subGraph_input_') {
                    continue;
                } else if(srcNode.typeId === '_subGraph_' || srcNode.typeId === '_subGraph_clone_') {
                    const subGraphGUID = srcNode.typeId === '_subGraph_' ? srcNode.guid : srcNode.properties.id.value as string;
                    
                    const outputNode = this.nodes.find(n => n.subGraphGUID === subGraphGUID && n.typeId === '_subGraph_output_');
                    const outputLinks = this.links.filter(l => l.targetNodeGuid === outputNode.guid);

                    for(const outputLink of outputLinks) {
                        const newLink = outputLink.clone();
                        newLink.guid = `${prefix}-${srcNode.guid}-${link.guid}`;
                        newLink.srcNodeGuid = `${prefix}-${srcNode.guid}-${outputLink.srcNodeGuid}`;
                        makeLink(link, newLink);
                    }
                } else {
                    const newLink = link.clone();
                    newLink.guid = `${prefix}-${link.guid}`;
                    newLink.srcNodeGuid = mapping[link.srcNodeGuid];
                    makeLink(link, newLink);
                }
            }
        }

        return result;
    }
    public get flatNodesLinks() {
        return this.getFlatNodesLinks(undefined, '');
    }
    
    public get flatNodes() {
        return this.flatNodesLinks.nodes;
        const nodes: GraphNode[] = [];

        for(const node of this.nodes) {
            if(node.typeId.startsWith('_subGraph_')) {
                if(node.typeId === '_subGraph_clone_') {
                    const targetGraphId = node.properties.id.value;
                    const subNodes = this.nodes.filter(n => n.subGraphGUID === targetGraphId && ['_subGraph_output_', '_subGraph_input_'].every(t => n.typeId !== t));
                    
                    for(const subNode of subNodes) {
                        const clonedNode = subNode.clone();
                        clonedNode.guid += `-${node.guid}`;
                        clonedNode.subGraphGUID = node.guid;
                        nodes.push(clonedNode);
                    }
                }
            } else {
                nodes.push(node);
            }
        }

        return nodes;
    }
    public get flatLinks() {
        return this.flatNodesLinks.links;
        const linksToRemove: GraphLink[] = [];
        const linksToAdd: GraphLink[] = [];

        const subGraphCloneSuffix: { [subGraphId: string]: string[] } = {};
        for(const subGraphCloneNode of this.subGraphCloneNodes) {
            const src = subGraphCloneNode.properties.id.value as string;
            let array = subGraphCloneSuffix[src];
            if(!array) {
                array = [];
                subGraphCloneSuffix[src] = array;
            }
            const prefix = `-${subGraphCloneNode.guid}`;
            array.push(prefix);

            for(const link of this.links) {
                const srcNode = link.getSrcNode(this.nodes);
                const targetNode = link.getTargetNode(this.nodes);

                if(srcNode.subGraphGUID === src && srcNode.typeId !== '_subGraph_input_' && (!targetNode || targetNode.typeId !== '_subGraph_output_') && link.typeId !== '_subGraph_input_link_') {
                    const newLink = link.clone();
                    newLink.guid += prefix;
                    newLink.srcNodeGuid += prefix;
                    if(newLink.targetNodeGuid) {
                        newLink.targetNodeGuid += prefix;
                    }
                    linksToAdd.push(newLink);
                }
            }
        }

        for(const link of this.links) {
            if(link.typeId === '_subGraph_output_link_') { // convert sub graph output links
                const srcNode = link.getSrcNode(this.nodes);
                const isSrcSubGraphClone = srcNode.typeId === '_subGraph_clone_';

                const subGraphId = isSrcSubGraphClone ? srcNode.properties.id.value as string : srcNode.guid;
                const outputGraphNode = this.nodes.find(n => n.typeId === '_subGraph_output_' && n.subGraphGUID === subGraphId);
                
                const outputLinks = this.links.filter(l => l.targetNodeGuid === outputGraphNode.guid);
                linksToRemove.push(...outputLinks);
                linksToRemove.push(link);

                linksToAdd.push(...outputLinks.map(l => {
                    const newLink = l.clone();
                    newLink.targetNodeGuid = link.targetNodeGuid;
                    
                    if(isSrcSubGraphClone) {
                        newLink.srcNodeGuid += `-${srcNode.guid}`;
                    }

                    return newLink;
                }));
            } else {
                const targetNode = link.getTargetNode(this.nodes);
                
                if(targetNode) {
                    const isTargetSubGraph = targetNode.typeId === '_subGraph_';
                    const isTargetSubGraphClone = targetNode.typeId === '_subGraph_clone_';

                    if(isTargetSubGraph || isTargetSubGraphClone) { // convert sub graph input links
                        const subGraphId = isTargetSubGraph ? targetNode.guid : targetNode.properties.id.value as string;
                        const suffix = isTargetSubGraphClone ? `-${targetNode.guid}` : '';

                        const inputGraphNode = this.nodes.find(n => n.typeId === '_subGraph_input_' && n.subGraphGUID === subGraphId);

                        const inputLink = this.links.find(l => l.srcNodeGuid === inputGraphNode.guid);
                        linksToRemove.push(inputLink);
                        linksToRemove.push(link);
                        
                        const newLink = link.clone();
                        newLink.targetNodeGuid = inputLink.targetNodeGuid + suffix;
                        linksToAdd.push(newLink);
                    }
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

        link.setType(srcNode.typeId === '_subGraph_' || srcNode.typeId === '_subGraph_clone_' ? '_subGraph_output_link_' : (srcNode.typeId === '_subGraph_input_' ? '_subGraph_input_link_' : typeId));
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
    // eslint-disable-next-line no-unused-vars
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
                
                if(prop.viewType !== ConfigOptionsPropViewType.Procedural) {
                    properties[propId] = properties[propId] ?? {
                        value: prop.defaultValue
                    };
                }
            }
        }

        const info = allInfo.types[typeId];

        for(const propId in info.properties) {
            const prop = info.properties[propId];
            
            if(prop.viewType !== ConfigOptionsPropViewType.Procedural) {
                properties[propId] = properties[propId] ?? {
                    value: prop.defaultValue
                };
            }
        }
    }

    setType(typeId: string = this.info.types.default ? 'default' : Object.keys(this.info.types)[0]) {
        if(this.typeId !== typeId) {
            this.typeId = typeId;

            const commonProps = this.info.properties;
            if(commonProps) {
                for(const propId in commonProps) {
                    const prop = commonProps[propId];
                    
                    if(prop.viewType !== ConfigOptionsPropViewType.Procedural) {
                        this.properties[propId] = {
                            value: typeof prop.defaultValue === 'string' ? this.parseValue(prop.defaultValue) : prop.defaultValue
                        };
                    }
                }
            }

            const info = this.info.types[typeId];

            for(const propId in info.properties) {
                const prop = info.properties[propId];
                
                if(prop.viewType !== ConfigOptionsPropViewType.Procedural) {
                    this.properties[propId] = {
                        value: typeof prop.defaultValue === 'string' ? this.parseValue(prop.defaultValue) : prop.defaultValue
                    };
                }
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

    public get isResizable() {
        return this.type.resizable === undefined || !!this.type.resizable;
    }

    public updateHeight() {
        if(!this.isResizable && this.type.defaultSize.height) {
            this.height = this.type.defaultSize.height;
        } else if(this.isHeightResizable) {
            // eslint-disable-next-line no-self-assign
            this.height = this.height;
        } else {
            this.height = 0;
        }
    }
    public updateWidth() {
        if(!this.isResizable && this.type.defaultSize.width) {
            this.width = this.type.defaultSize.width;
        } else {
            // eslint-disable-next-line no-self-assign
            this.width = this.width;
        }
    }

    public get minWidth() {
        return this.type.minWidth ?? 100;
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
        return this.hasAutoLine;
    }
    
    public isPropertyHeightFixed = (propertyKey: string) => {
        const prop = this.type.properties[propertyKey];

        if(prop.viewType === ConfigOptionsPropViewType.Checkbox || prop.viewType === ConfigOptionsPropViewType.List || prop.viewType === ConfigOptionsPropViewType.Procedural) {
            return true;
        } else {
            return prop.isMonoline || prop.nbLines !== undefined;
        }
    }

    public get hasAutoLine() {
        const properties = this.type.properties;

        for(const key in properties) {
            if(!this.isPropertyHeightFixed(key)) {
                return true;
            }
        }

        return false;
    }

    public getGroupedProperties(options?: {
        properties?: string[]
    }) {
        options = options ?? {};
        
        const properties = this.type.properties ?? {};
        const propertiesToSelect = options.properties ?? Object.keys(properties);
        
        const isOpenList = Graph.current.openGroups[this.guid] ?? [];
    
        const allPropsKeys = Object.keys(properties);
        const grouped = allPropsKeys/*.filter(key => propertiesToSelect.includes(key))*/.reduce((p, propKey) => {
            const prop = properties[propKey];
            const groupKey = prop.group ?? '';
            const isDefaultGroup = !groupKey;
            const isPropertyIncluded = propertiesToSelect.includes(propKey);

            let group = p[groupKey];
            if(!group) {
                group = {
                    items: [],
                    totalFixedNbLines: isDefaultGroup ? 0 : 1,
                    totalFixedNbLinesFiltered: isDefaultGroup ? 0 : 1,
                    singleAutoLineHeight: 0,
                    nbAutoLines: 0,
                    nbAutoLinesFiltered: 0,
                    heightPx: 0,
                    totalAutoHeight: 0,
                    minHeightPx: 0,
                    totalFixedHeight: 0,
                    isOpen: isDefaultGroup || isOpenList.includes(groupKey)
                };
                p[groupKey] = group;
            }
            if(isPropertyIncluded) {
                group.items.push(propKey);
            }
            
            let nbLines: number = undefined;

            switch(prop.viewType) {
                case ConfigOptionsPropViewType.Procedural:
                case ConfigOptionsPropViewType.List:
                case ConfigOptionsPropViewType.Checkbox: {
                    nbLines = 1;
                    break;
                }

                default: {
                    if(prop.isMonoline) {
                        nbLines = 1;
                    } else if(prop.nbLines) {
                        nbLines = prop.nbLines;
                    }
                    break;
                }
            }

            if(nbLines) {
                group.totalFixedNbLines += nbLines;
                if(isPropertyIncluded) {
                    group.totalFixedNbLinesFiltered += nbLines;
                }
            } else {
                ++group.nbAutoLines;
                if(isPropertyIncluded) {
                    ++group.nbAutoLinesFiltered;
                }
            }
    
            return p;
        }, {} as { [groupKey: string]: {
            singleAutoLineHeight: number,
            nbAutoLines: number,
            nbAutoLinesFiltered: number,
            totalFixedNbLines: number,
            totalFixedNbLinesFiltered: number,
            items: string[],
            heightPx: number,
            totalAutoHeight: number,
            totalFixedHeight: number,
            minHeightPx: number,
            isOpen: boolean
        } });
    
        const nbAutolinesProperties = Object.values(grouped)
            .filter(g => g.isOpen)
            .reduce((p, c) => p + c.nbAutoLines, 0);
    
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const border = 0.4 * rem;
    
        const totalHeightPx = this._height - border * 2;
    
        const lineHeightPx = 1.5 * rem;
        const totalFixedHeight = Object.values(grouped).reduce((p, c) => p + (c.isOpen ? c.totalFixedNbLines : 1), 0) * lineHeightPx;
        const heightForAutolines = totalHeightPx - totalFixedHeight;
        const oneMultilineHeight = heightForAutolines / nbAutolinesProperties;
    
        for(const groupKey in grouped) {
            const group = grouped[groupKey];
            group.totalAutoHeight = group.nbAutoLinesFiltered > 0 ? oneMultilineHeight * group.nbAutoLinesFiltered : 0;
            group.totalFixedHeight = group.totalFixedNbLinesFiltered * lineHeightPx;
            group.heightPx = group.isOpen ? group.totalAutoHeight + group.totalFixedHeight : lineHeightPx;
            group.minHeightPx = group.nbAutoLinesFiltered * lineHeightPx + group.totalFixedHeight;
            group.singleAutoLineHeight = oneMultilineHeight;
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
    
    public static clone(data: any) {
        return GraphNode.parse(JSON.parse(JSON.stringify(data)), Graph.currentVersion);
    }
    public clone() {
        return GraphNode.clone(this);
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

    public static clone(data: any) {
        return GraphLink.parse(JSON.parse(JSON.stringify(data)), Graph.currentVersion);
    }
    public clone() {
        return GraphLink.clone(this);
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
