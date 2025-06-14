import React, { useCallback, useEffect, useReducer, useState } from "react";
import { Graph, GraphLink, GraphNode, GraphNodeLink } from "../Graph";
import { StoryNodeView } from "../StoryNode/StoryNodeView";
import "./AppStyle";
import { Viewport } from "../Viewport";
import { StoryLinkView } from "../StoryLink/StoryLinkView";
import { Config } from "../Config";
import { SideButton } from "./SideButton";
import { Editor } from "../Editor";
import defaultConfig from '../DefaultConfig.txt';
import configJsdoc from '../../../tools/jsdoc/jsdoc.txt';
import { GraphTreeContainer } from "./GraphTree";

let dragStart: { x: number, y: number };
let drawingLine: { x: number, y: number, srcNode: GraphNode };

const LinkLine = function(props: { point1: { x: number, y: number }, point2: { x: number, y: number }, isSplit: boolean }) {
    const padding = 20;

    const vec = {
        x: props.point1.x - props.point2.x,
        y: props.point1.y - props.point2.y
    };
    if(Math.abs(vec.x) <= 2) { // too narrow to display
        props.point1.x += 2 * (vec.x < 0 ? -1 : 1);
    }

    const min = {
        x: Math.min(props.point1.x, props.point2.x),
        y: Math.min(props.point1.y, props.point2.y),
    }
    const max = {
        x: Math.max(props.point1.x, props.point2.x),
        y: Math.max(props.point1.y, props.point2.y),
    }

    const diff1 = {
        x: props.point1.x - min.x,
        y: props.point1.y - min.y,
    }
    const diff2 = {
        x: props.point2.x - min.x,
        y: props.point2.y - min.y,
    }

    const vector = {
        x: diff2.x - diff1.x,
        y: diff2.y - diff1.y,
    };
    const vectorLength = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    const angleRad = Math.asin(vector.y / vectorLength);
    let angleDeg = angleRad * 180 / Math.PI;

    if(vector.x < 0) {
        angleDeg = 180 - angleDeg;
    }

    const [rnd] = useState(Math.random().toString().replace('.', ''));
    //const rnd = Math.random().toString().replace('.', '');

    const colors = [
        'green',
        'rgb(158, 63, 100)'
    ];

    const steps = [
        { offset: 0, color: colors[0] },
        { offset: 0.45, color: colors[0] },
        { offset: 0.55, color: colors[1] },
        { offset: 1, color: colors[1] },
    ];

    const arrowAngle = 20;
    const arrowSize = 30;
    const nbSubTriangles = Math.max(1, Math.round(vectorLength / 800));
    const triangleStep = {
        x: vector.x / 2 / (nbSubTriangles + 1),
        y: vector.y / 2 / (nbSubTriangles + 1),
    };

    const produceTriangle = (point: { x: number, y: number }, color: string) => {
        const generator = (point: { x: number, y: number }) => ({
            points: [point, {
                x: point.x + Math.cos((angleDeg - arrowAngle + 180) * Math.PI / 180) * arrowSize,
                y: point.y + Math.sin((angleDeg - arrowAngle + 180) * Math.PI / 180) * arrowSize
            }, {
                x: point.x + Math.cos((angleDeg + arrowAngle + 180) * Math.PI / 180) * arrowSize,
                y: point.y + Math.sin((angleDeg + arrowAngle + 180) * Math.PI / 180) * arrowSize
            }],
            color: color
        });
        
        const firstPosition = {
            x: point.x - triangleStep.x * (nbSubTriangles - 1) / 2,
            y: point.y - triangleStep.y * (nbSubTriangles - 1) / 2,
        };
        
        const result = [];
        for(let i = 0; i < nbSubTriangles; ++i) {
            result.push(generator({
                x: firstPosition.x + triangleStep.x * i,
                y: firstPosition.y + triangleStep.y * i,
            }));
        }

        return result;
    }

    const triangles = [
        ...produceTriangle({
            x: diff1.x + vector.x * 1 / 4,
            y: diff1.y + vector.y * 1 / 4,
        }, colors[0]),
        ...produceTriangle({
            x: diff1.x + vector.x * 3 / 4,
            y: diff1.y + vector.y * 3 / 4,
        }, colors[1]),
    ];

    return <svg style={{ left: min.x - padding, top: min.y - padding, width: max.x - min.x + padding * 2, height: max.y - min.y + padding * 2 }}>
        {props.isSplit ? <>
            <defs>
                <linearGradient id={"linear" + rnd} gradientTransform={`translate(0.5, 0.5) rotate(${angleDeg}) translate(-0.5, -0.5)`}>
                    {steps.map((s, i) => <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color}></stop>)}
                </linearGradient>
            </defs>
            {triangles.map((e, i) => <path key={i} d={e.points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v.x + padding},${v.y + padding}`).join(' ') + ' Z'} fill={e.color}></path>)}
        </> : undefined}
        <polyline points={`${diff1.x + padding},${diff1.y + padding} ${diff2.x + padding},${diff2.y + padding}`} stroke={props.isSplit ? `url(#linear${rnd})` : colors[0]}></polyline>
    </svg>;
}

const scrollViewport = {
    x: 0,
    y: 0,
    refresh: undefined as () => void
};

(window as any).settings = {
    viewportScrollSpeed: 0.1,
    viewportSpeed: 45
};

export let save: () => void = undefined;

export const updateView = () => scrollViewport?.refresh();

setInterval(() => {
    if(scrollViewport.x !== 0 || scrollViewport.y !== 0) {
        const speed = (window as any).settings.viewportSpeed / Viewport.instance.scale;

        Viewport.instance.x += scrollViewport.x * speed;
        Viewport.instance.y += scrollViewport.y * speed;

        if(dragStart) {
            dragStart.x += scrollViewport.x * speed;
            dragStart.y += scrollViewport.y * speed;
        }

        if(scrollViewport.refresh) {
            scrollViewport.refresh();
        }
    }
}, 50);

const getQueryVariable = (paramName: string, defaultValue: string = undefined): string => {
    const query = window.location.search.substring(1);
    const variables = query.split('&');
    for(const variable of variables) {
        const keyValue = variable.split('=');
        if(keyValue[0] === paramName) {
            return decodeURIComponent(keyValue[1]);
        }
    }

    return defaultValue;
}

export let selectedNodes: GraphNode[] = [];
export let selectedLinks: GraphLink[] = [];
export let currentSubGraphGuid: string;
export let saveLoadServerUrl: string;

export function AppView() {
    const [currentDragging, setCurrentDragging] = useState<(e: { x: number, y: number }, dragStart: { x: number, y: number }) => void>();
    const [graph, setGraph] = useState<Graph>(Graph.current);
    const [serverUrl, setServerUrl] = useState<string>(getQueryVariable('serverUrl') || localStorage.getItem('serverUrl') || '');
    const [configStr, setConfigStr] = useState<string>(localStorage.getItem('config') || defaultConfig);
    const [showConfigEditor, setShowConfigEditor] = useState<boolean>(false);
    const [currentSubGraphGUIDs, setCurrentSubGraphGUIDs] = useState<string[]>(Graph.current.currentSubGraphGUIDs);
    const [selectionArea, setSelectionArea] = useState<{
        x: number,
        y: number,
        w: number,
        h: number
    }>(undefined);
    const [_, forceUpdate] = useReducer((x) => x + 1, 0);
    const [saving, setSaving] = useState<{ status: 'pending' | 'done' | 'error' }[]>([]);

    save = useCallback(() => {
        const currentSavingEntry: typeof saving[0] = {
            status: 'pending'
        };

        setSaving([ currentSavingEntry, ...saving ]);
        Graph.current.save(saveLoadServerUrl)
            .then(() => {
                currentSavingEntry.status = 'done';
                forceUpdate();
            })
            .catch((e) => {
                console.error(e);

                currentSavingEntry.status = 'error';
                forceUpdate();
            })
            .finally(() => {
                setTimeout(() => {
                    setSaving(saving.filter(s => s !== currentSavingEntry));
                }, 5000);
            });
    }, [saving, saveLoadServerUrl]);

    const [saveConfigRef] = useState<{ ref: () => void }>({ ref: undefined });
    saveConfigRef.ref = () => {
        let code;
        try {
            code = Graph.current.toJS();
        } // eslint-disable-next-line no-unused-vars
        catch(ex) {
        }

        // eslint-disable-next-line no-eval
        const configGetter = eval(`() => { ${configStr} }`);
        Config.instance = new Config(configGetter());
        localStorage.setItem('config', configStr);
        
        if(code) {
            Graph.current = Graph.parse(code);
            setGraph(() => Graph.current);
        }
        
        for(const link of Graph.current.links) {
            link.updateHeight();
            link.updateWidth();
        }
        
        for(const node of Graph.current.nodes) {
            node.updateHeight();
            node.updateWidth();
        }

        setShowConfigEditor(false);
    };

    const loadData = async () => {
        let codePromise: Promise<string>;

        if(saveLoadServerUrl) {
            codePromise = fetch(saveLoadServerUrl, {
                method: "GET",
                headers: {
                    'Accept': 'application/json'
                }
            }).then(r => r.text());
        } else {
            codePromise = navigator.clipboard.readText();
        }
        
        const code = await codePromise;

        //const configStr = localStorage.getItem('config');

        //if(!configStr) {
            const config = Graph.parseConfig(code);
            if(config) {
                // eslint-disable-next-line no-eval
                const configGetter = eval(`() => { ${config} }`);
                Config.instance = new Config(configGetter());
                localStorage.setItem('config', config);
                setConfigStr(config);
            }
        //}

        Graph.current = Graph.parse(code);
        Graph.resetHistory();
        setGraph(() => Graph.current);
        localStorage.setItem('code', code);
        
        setCurrentSubGraphGUIDs(Graph.current.currentSubGraphGUIDs);

        /*
        if(currentSubGraphGUIDs && !Graph.current.nodes.some(n => n.guid === currentSubGraphGUIDs[0] && n.typeId === '_subGraph_')) {
            setCurrentSubGraphGUIDs([]);
        }*/
    }
    
    const viewport = Viewport.instance;

    useEffect(() => {
        currentSubGraphGuid = currentSubGraphGUIDs[0];
        Graph.current.currentSubGraphGUIDs = currentSubGraphGUIDs;
        forceUpdate();
    }, [currentSubGraphGUIDs]);
    useEffect(() => {
        saveLoadServerUrl = serverUrl;
        localStorage.setItem('serverUrl', saveLoadServerUrl);
    }, [serverUrl]);
    useEffect(() => {
    }, [configStr]);

    //const jsonJsTextarea = useRef<HTMLTextAreaElement>();
    //const libTextarea = useRef<HTMLTextAreaElement>();

    useEffect(() => {
        scrollViewport.refresh = () => forceUpdate();

        setTimeout(forceUpdate, 0);

        if(serverUrl) {
            loadData();
        }
    }, []);

    useEffect(() => {
        setGraph(Graph.current);
    }, [Graph.current]);

    //const configTextareaRef = useRef<HTMLTextAreaElement>();

    const updateDragStart = (n: GraphLink | GraphNode) => (update) => {
        if(update) {
            setCurrentDragging(() => update);
        } else {
            const element = selectedNodes.includes(n as GraphNode) || selectedLinks.includes(n as GraphLink) ? (selectedNodes as (GraphLink | GraphNode)[]).concat(selectedLinks) : [ n ];

            const initialPositions = element.map(n => ({
                x: n.x,
                y: n.y
            }));

            setCurrentDragging(() => (e, dragStart) => {
                const posPercent = {
                    x: e.x * viewport.scale / window.innerWidth,
                    y: e.y * viewport.scale / window.innerHeight
                };

                const percentDistance = 0.03;
                const viewportDrag = {
                    x: posPercent.x < percentDistance ? 1 : posPercent.x > 1 - percentDistance ? -1 : 0,
                    y: posPercent.y < percentDistance ? 1 : posPercent.y > 1 - percentDistance ? -1 : 0,
                };
                if(viewportDrag.x !== 0 || viewportDrag.y !== 0) { // normalization
                    const length = Math.sqrt(viewportDrag.x * viewportDrag.x + viewportDrag.y * viewportDrag.y);
                    viewportDrag.x /= length;
                    viewportDrag.y /= length;

                    scrollViewport.x = viewportDrag.x;
                    scrollViewport.y = viewportDrag.y;
                } else {
                    scrollViewport.x = 0;
                    scrollViewport.y = 0;
                }

                for(let i = 0; i < element.length; ++i) {
                    const node = element[i];
                    const initialPos = initialPositions[i];

                    node.x = initialPos.x + (e.x - dragStart.x);
                    node.y = initialPos.y + (e.y - dragStart.y);
                }

                forceUpdate();
            });
        }
    };

    return <div className="viewport" style={{ backgroundPosition: `${viewport.x * viewport.scale}px ${viewport.y * viewport.scale}px`, backgroundSize: `${80 * viewport.scale}px` }} onMouseMove={(e) => {
        if(currentDragging) {
            const point = {
                x: e.clientX / viewport.scale,
                y: e.clientY / viewport.scale,
            };

            if(!dragStart) {
                dragStart = point;
            }

            currentDragging(point, dragStart);
            e.stopPropagation();
        } else if(drawingLine) {
            drawingLine.x = e.clientX / viewport.scale;
            drawingLine.y = e.clientY / viewport.scale;
            e.stopPropagation();
            forceUpdate();
        }
    }} onMouseUp={(e) => {
        e.preventDefault();
        e.stopPropagation();

        scrollViewport.x = 0;
        scrollViewport.y = 0;

        if(currentDragging) {
            dragStart = undefined;
            setCurrentDragging(undefined);
            setSelectionArea(undefined);
        } else if(drawingLine) {

            if(Config.instance.currentLinkMode.hasTargetNode) {
                const node = new GraphNode();
                node.setType(Config.instance.currentNodeModeId);
                node.x = drawingLine.x - viewport.x;
                node.y = drawingLine.y - viewport.y;
                node.subGraphGUID = currentSubGraphGUIDs[0];
                graph.createNode(node);
                
                const link = new GraphLink();
                link.srcNodeGuid = drawingLine.srcNode.guid;
                link.targetNodeGuid = node.guid;
                graph.createLink(link, Config.instance.currentLinkModeId);
            } else {
                const link = new GraphLink();
                link.srcNodeGuid = drawingLine.srcNode.guid;
                link.x = e.clientX / viewport.scale - viewport.x;
                link.y = e.clientY / viewport.scale - viewport.y;
                graph.createLink(link, Config.instance.currentLinkModeId);
            }

            drawingLine = undefined;

            graph.saveHistory();
            forceUpdate();
        }
    }} onMouseDown={(e) => {
        if(e.button === 2 && !e.shiftKey && !e.ctrlKey) { // RMB => create node
            e.stopPropagation();
            e.preventDefault();

            const node = new GraphNode();
            node.setType(Config.instance.currentNodeModeId);
            node.x = e.clientX / viewport.scale - viewport.x;
            node.y = e.clientY / viewport.scale - viewport.y;
            node.subGraphGUID = currentSubGraphGUIDs[0];
            graph.createNode(node);
            graph.saveHistory();

            forceUpdate();
        } else if(e.button === 1 || e.button === 2 && (e.shiftKey || e.ctrlKey)) { // MMB => move viewport
            e.stopPropagation();
            e.preventDefault();

            const initialPos = {
                x: viewport.x,
                y: viewport.y
            }

            setCurrentDragging(() => (e, dragStart) => {
                viewport.x = initialPos.x + (e.x - dragStart.x);
                viewport.y = initialPos.y + (e.y - dragStart.y);

                forceUpdate();
            });
        } else if(e.button === 0) { // LMB => multi selection
            const initialPos = {
                x: e.clientX / viewport.scale - viewport.x,
                y: e.clientY / viewport.scale - viewport.y,
            }

            let previouslySelectedNodes = selectedNodes;
            let previouslySelectedLinks = selectedLinks;
            let additiveMode = e.shiftKey;
            let exclusionMode = e.ctrlKey;
            if(!exclusionMode && !additiveMode) {
                previouslySelectedNodes = [];
                previouslySelectedLinks = [];
                
                selectedNodes = [];
                selectedLinks = [];
            }

            setSelectionArea(undefined);

            setCurrentDragging(() => (e) => {
                let area = {
                    x: initialPos.x,
                    y: initialPos.y,
                    w: e.x - viewport.x - initialPos.x,
                    h: e.y - viewport.y - initialPos.y,
                };
                area = {
                    x: Math.min(area.x, area.x + area.w),
                    y: Math.min(area.y, area.y + area.h),
                    w: Math.abs(area.w),
                    h: Math.abs(area.h),
                }

                const tempSelectedNodes = graph.nodes.filter(n => n.subGraphGUID === currentSubGraphGUIDs[0]).filter(n => !(n.x > area.x + area.w || n.x + n.width < area.x || n.y > area.y + area.h || n.y + n.height < area.y));
                const tempSelectedLinks = graph.links.filter(l => l.getSrcNode(graph.nodes).subGraphGUID === currentSubGraphGUIDs[0]).filter(n => !n.hasTargetNode && !(n.x > area.x + area.w || n.x + n.width < area.x || n.y > area.y + area.h || n.y + n.height < area.y));

                if(exclusionMode) {
                    selectedNodes = tempSelectedNodes.filter(e => !previouslySelectedNodes.includes(e));
                    selectedLinks = tempSelectedLinks.filter(e => !previouslySelectedLinks.includes(e));
                } else {
                    selectedNodes = tempSelectedNodes;
                    selectedLinks = tempSelectedLinks;
                }

                if(exclusionMode || additiveMode) {
                    selectedNodes = selectedNodes.concat(previouslySelectedNodes.filter(e => !tempSelectedNodes.includes(e)));
                    selectedLinks = selectedLinks.concat(previouslySelectedLinks.filter(e => !tempSelectedLinks.includes(e)));
                } else {
                    selectedNodes = tempSelectedNodes;
                    selectedLinks = tempSelectedLinks;
                }

                setSelectionArea(area);
                //forceUpdate();
            });
        }
    }} onWheel={(e) => {
        const scaleDelta = 1 + (e.deltaY < 0 ? 1 : -1) * (window as any).settings.viewportScrollSpeed;
        
        const oldScale = viewport.scale;
        viewport.scale *= scaleDelta;
        const newScale = viewport.scale;

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const change = {
            x: mouseX / oldScale - mouseX / newScale,
            y: mouseY / oldScale - mouseY / newScale,
        }

        viewport.x -= change.x;
        viewport.y -= change.y;

        if(dragStart) {
            dragStart.x -= change.x;
            dragStart.y -= change.y;
        }

        e.stopPropagation();
        e.preventDefault();
        forceUpdate();
    }} onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }} onKeyDown={(e) => {
        e.stopPropagation();
    }}>
        {currentSubGraphGUIDs.length > 0 ? <div className="sub-graph-controls" style={{ pointerEvents: currentDragging ? 'none' : undefined }} onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setCurrentSubGraphGUIDs(currentSubGraphGUIDs.slice(1))}>{'<'} Exit sub-graph {currentSubGraphGUIDs.map(guid => graph.nodes.find(n => n.guid === guid).properties.name.value ?? '').reverse().join(' / ')}</button>
        </div> : undefined}

        <div className="viewport-content" style={{ transform: `scale(${viewport.scale})` }}>
            {!selectionArea ? undefined : <div className="selection-area" style={{ left: selectionArea.x + viewport.x, top: selectionArea.y + viewport.y, width: selectionArea.w, height: selectionArea.h, borderWidth: `${3 / viewport.scale}px` }} />}

            {graph && graph === Graph.current ? <>
                {graph.groupedLinks.filter(l => l[0].getSrcNode(graph.nodes).subGraphGUID === currentSubGraphGUIDs[0]).map(links => links.map((l, i) => {

                    if(!l.hasTargetNode) {
                        const srcNode = l.getSrcNode(graph.nodes);
                        const targetNode = l.getTargetNode(graph.nodes);

                        const getPoint = (srcNode: GraphNodeLink) => ({
                            x: srcNode.x + srcNode.width / 2 + viewport.x,
                            y: srcNode.y + srcNode.height / 2 + viewport.y
                        });
                        const getRect = (targetNode: GraphNodeLink) => ({
                            min: {
                                x: targetNode.x + viewport.x,
                                y: targetNode.y + viewport.y,
                            },
                            max: {
                                x: targetNode.x + targetNode.width + viewport.x,
                                y: targetNode.y + targetNode.height + viewport.y,
                            },
                        });

                        const findClosestPoint = (p: {x: number, y: number}, rect: { min: {x: number, y:number}, max: {x: number, y:number} }) => {
                            let dx = Math.max(rect.min.x - p.x, 0, p.x - rect.max.x);
                            let dy = Math.max(rect.min.y - p.y, 0, p.y - rect.max.y);

                            if(p.x > rect.min.x) {
                                dx *= -1;
                            }
                            if(p.y > rect.min.y) {
                                dy *= -1;
                            }

                            return {
                                x: p.x + dx,
                                y: p.y + dy
                            }
                        }
                        
                        const rect = l.hasTargetNode ? getRect(targetNode) : getRect(l);
                        
                        const p2 = findClosestPoint(getPoint(l), rect);
                        const p1 = findClosestPoint(p2, getRect(srcNode));
                        
                        return <LinkLine key={l.guid} point1={p1} point2={p2} isSplit={l.hasTargetNode} />
                    } else {
                        const getStep = (node: GraphNode) => node.width / (links.length + 1) * (i + 1);

                        const srcNode = l.getSrcNode(graph.nodes);
                        const point1 = { x: srcNode.x + (l.hasTargetNode ? getStep(srcNode) : 0) + viewport.x, y: srcNode.height + srcNode.y + viewport.y };
                        let point2: { x: number, y: number };

                        if(!l.hasTargetNode) {
                            point2 = {
                                x: l.x + l.width / 2 + viewport.x,
                                y: l.y + viewport.y
                            };
                        } else {
                            const targetNode = l.getTargetNode(graph.nodes);
                            point2 = { x: targetNode.x + getStep(targetNode) + viewport.x, y: targetNode.y + viewport.y };
                        }
                        
                        return <LinkLine key={l.guid} point1={point1} point2={point2} isSplit={l.hasTargetNode} />
                    }
                }))}

                {graph.groupedLinks.filter(l => l[0].getSrcNode(graph.nodes).subGraphGUID === currentSubGraphGUIDs[0]).map(links => links.map((l, i) => {
                    let offset: { x: number, y: number };

                    if(l.hasTargetNode) {
                        const spacing = 5;
                        const totalSizeY = links.reduce((p, c) => p + c.height + spacing, 0);

                        const offsetY = links.filter((_, i2) => i2 < i).reduce((p, c) => p + c.height + spacing, 0) - totalSizeY / 2;
                        const getStep = (node: GraphNode) => node.width / (links.length + 1) * (i + 1);

                        const srcNode = l.getSrcNode(graph.nodes);
                        const targetNode = l.getTargetNode(graph.nodes);

                        const srcStep = getStep(srcNode);
                        const targetStep = getStep(targetNode);
                        
                        const point1 = { x: srcNode.x + srcStep, y: srcNode.height + srcNode.y };
                        const point2 = { x: targetNode.x + targetStep, y: targetNode.y };
                        
                        const distY = point1.y - point2.y; // a
                        const distX = point1.x - point2.x; // b
                        
                        const x1 = 0;
                        const x2 = offsetY * distX / distY;
                        
                        const x = Math.abs(distY) >= 150 ? x2 : x1;

                        offset = {
                            x: (srcStep + targetStep) / 2 + x,
                            y: offsetY
                        };
                    } else {
                        offset = {
                            x: 0,
                            y: 0
                        };
                    }

                    return <StoryLinkView
                        offset={offset}
                        forceUpdate={forceUpdate}
                        isSelected={selectedLinks.includes(l)}
                        nodes={graph.nodes}
                        key={l.guid}
                        link={l}
                        deleteLink={(force: boolean) => {
                            if(force || confirm("Are you sure ?")) {
                                graph.links = graph.links.filter(e => e !== l);
                                graph.saveHistory();
                                forceUpdate();
                            }
                        }}
                        onDragStart={updateDragStart(l)}
                    />
                }))}
                
                {graph.nodes.filter(n => n.subGraphGUID === currentSubGraphGUIDs[0]).map((n) => <StoryNodeView forceUpdate={forceUpdate} isSelected={selectedNodes.includes(n)} key={n.guid} node={n} onDragStart={updateDragStart(n)} onDrawingLineStart={(node) => {
                    drawingLine = {
                        srcNode: node,
                        x: undefined,
                        y: undefined
                    };
                }} openSubGraph={(id: string) => {
                    if(graph.nodes.some(n => n.guid === id)) {
                        setCurrentSubGraphGUIDs([ id, ...currentSubGraphGUIDs ]);
                        forceUpdate();
                    }
                }} onDrawingLineEnd={(node) => {
                    if(drawingLine) {
                        if(drawingLine.srcNode !== node && Config.instance.currentLinkMode.hasTargetNode /*&& Graph.current.links.every(link => [link.srcNodeGuid, link.targetNodeGuid].some(guid => ![node.guid, drawingLine.srcNode.guid].includes(guid)))*/) {
                            const link = new GraphLink();
                            link.srcNodeGuid = drawingLine.srcNode.guid;
                            link.targetNodeGuid = node.guid;
                            graph.createLink(link, Config.instance.currentLinkModeId);

                            graph.saveHistory();
                        }
                        
                        drawingLine = undefined;

                        forceUpdate();
                    }
                }} deleteNode={(force: boolean) => {
                    if(force || confirm("Are you sure ?")) {
                        graph.deleteNode(n);
                        graph.saveHistory();

                        forceUpdate();
                    }
                }} />)}
                {drawingLine && drawingLine.x !== undefined
                    ? <LinkLine point1={{ x: drawingLine.srcNode.x + drawingLine.srcNode.width / 2 + viewport.x, y: drawingLine.srcNode.height + drawingLine.srcNode.y + viewport.y }} point2={{ x: drawingLine.x, y: drawingLine.y }} isSplit={true} />
                    : undefined
                }
            </> : undefined}
        </div>

        <div className="types-switch" title="CTRL => change modes" style={{ pointerEvents: currentDragging ? 'none' : undefined }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="types-switch-line">
                <div className="types-switch-title">Node mode:</div>
                {Object.entries(Config.instance.nodes.types).filter(kv => kv[1].isVisible !== false).map(kv => <div className={`types-switch-item ${Config.instance.currentNodeModeId === kv[0] ? 'active' : ''}`} key={kv[0]} onClick={() => {
                    Config.instance.currentNodeModeId = kv[0];
                    forceUpdate();
}}              >{kv[1].name}</div>)}
            </div>
            <div className="types-switch-line">
                <div className="types-switch-title">Link mode:</div>
                {Object.entries(Config.instance.links.types).filter(kv => kv[1].isVisible !== false).map(kv => <div className={`types-switch-item ${Config.instance.currentLinkModeId === kv[0] ? 'active' : ''}`} key={kv[0]} onClick={() => {
                    Config.instance.currentLinkModeId = kv[0];
                    forceUpdate();
}}              >{kv[1].name}</div>)}
            </div>
        </div>
        
        <GraphTreeContainer graph={graph} currentSubGraphGUIDs={currentSubGraphGUIDs} onChangeCurrentSubGraphGUIDs={(values) => setCurrentSubGraphGUIDs(values)} />
        
        <div className="btns-panel" style={{ pointerEvents: currentDragging ? 'none' : undefined }} onMouseDown={(e) => e.stopPropagation()}>
            <SideButton
                onClick={save}
                desc={<>Generate code to [{serverUrl?.trim() ? <><span className="strike">clipboard</span> / server</> : <>clipboard / <span className="strike">server</span></>}]</>}
                sideItems={saving.map((e, i) => <div className={`save-status-${e.status}`} key={i}>{e.status === 'pending' ? <span className="spinning">⟳</span> : e.status === 'done' ? '🗸' : '✖'}</div>)}
            >Data 🖪</SideButton>

            <SideButton
                onClick={async () => {
                    loadData();
                }}
                desc={<>Load from [{serverUrl?.trim() ? <><span className="strike">clipboard</span> / server</> : <>clipboard / <span className="strike">server</span></>}]</>}
            >Data ↺</SideButton>

            <SideButton onClick={async () => {
                setShowConfigEditor(true);
                
            }} desc="Edit configuration">Config 🖉</SideButton>
            <input type="text" title="Save/load server URL" onChange={(e) => setServerUrl(e.target.value ?? '')} value={serverUrl} placeholder="Save/load server URL" />
        </div>

        {showConfigEditor ? <div className="config-editor-panel-wrapper">
            <div className="config-editor-panel-tools">
                <button onClick={saveConfigRef.ref}>Apply</button>
                <button onClick={() => setShowConfigEditor(false)}>Close</button>
            </div>
            <div className="config-editor-panel">
                <Editor
                    className="config-editor-panel-textarea"
                    code={configStr}
                    onChange={setConfigStr}
                    isMonoline={false}
                    placeholder={''}
                    type={''}
                    fileExtension={'.js'}
                    language={'javascript'}
                    codeBefore={/*configJsdoc + '\n'*/''}
                    codeAfter={''}
                    skipConfig={true}
                    overrideConfig={{
                        lineNumbers: "on",
                        //glyphMargin: true,
                        lineDecorationsWidth: '1ch',
                        minimap: { enabled: true },
                        wordWrap: 'on',
                        theme: 'vs-dark'
                    }}
                    lib={configJsdoc}
                    onSaveRequest={saveConfigRef}
                    viewStateGUID="config-editor"
                />
            </div>
        </div> : undefined}
    </div>
}
