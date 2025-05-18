import React, { useEffect, useReducer, useRef, useState } from "react";
import { Graph, GraphLink, GraphNode } from "../Graph";
import { StoryNodeView } from "../StoryNode/StoryNodeView";
import "./AppStyle";
import { Viewport } from "../Viewport";
import { StoryLinkView } from "../StoryLink/StoryLinkView";
import { Config } from "../Config";
import { SideButton } from "./SideButton";
import { Editor } from "../Editor";
import defaultConfig from '../DefaultConfig.txt';
import configJsdoc from '../../../tools/jsdoc/jsdoc.txt';

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

    const [steps, setSteps] = useState([
        { offset: 0, color: colors[0] },
        { offset: 0.45, color: colors[0] },
        { offset: 0.55, color: colors[1] },
        { offset: 1, color: colors[1] },
    ]);
/*
    const progressArray = (percent) => {
        const color1 = 'black';
        const color2 = 'red';

        const result = [
            { offset: (percent + 0.15) % 1, color: color2 },
            { offset: (percent + 0.25) % 1, color: color1 },
            { offset: (percent + 0.45) % 1, color: color1 },
            { offset: (percent + 0.55) % 1, color: color2 },
            { offset: (percent + 0.85) % 1, color: color1 },
            { offset: (percent + 0.95) % 1, color: color2 },
        ];

        result.sort((a, b) => a.offset - b.offset);

        result.splice(0, 0, { offset: 0, color: result[result.length - 1].color });
        result.push({ offset: 1, color: result[0].color });

        return result;
    }

    useEffect(() => {
        let inc = 0;

        const id = setInterval(() => {
            inc += 0.1;
            setSteps(progressArray(inc));
        }, 100);

        return () => clearInterval(id);
    }, []);*/

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

            const dragStartValue = dragStart ?? point;
            if(!dragStart) {
                dragStart = dragStartValue;
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
        if(e.button === 2) { // RMB => create node
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
        } else if(e.button === 1) { // MMB => move viewport
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

            setCurrentDragging(() => (e, dragStart) => {
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

        viewport.x -= mouseX / oldScale - mouseX / newScale;
        viewport.y -= mouseY / oldScale - mouseY / newScale;

        e.stopPropagation();
        e.preventDefault();
        forceUpdate();
    }} onContextMenu={(e) => e.preventDefault()} onKeyDown={(e) => {
        e.stopPropagation();
    }}>
        <div className="bottom-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.y = -1;
            }
        }} onMouseLeave={() => {
            scrollViewport.y = 0;
        }}></div>
        <div className="top-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.y = 1;
            }
        }} onMouseLeave={() => {
            scrollViewport.y = 0;
        }}></div>
        <div className="left-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.x = 1;
            }
        }} onMouseLeave={() => {
            scrollViewport.x = 0;
        }}></div>
        <div className="right-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.x = -1;
            }
        }} onMouseLeave={() => {
            scrollViewport.x = 0;
        }}></div>
        <div className="top-right-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.x = -Math.sqrt(1/2);
                scrollViewport.y = Math.sqrt(1/2);
            }
        }} onMouseLeave={() => {
            scrollViewport.x = 0;
            scrollViewport.y = 0;
        }}></div>
        <div className="bottom-right-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.x = -Math.sqrt(1/2);
                scrollViewport.y = -Math.sqrt(1/2);
            }
        }} onMouseLeave={() => {
            scrollViewport.x = 0;
            scrollViewport.y = 0;
        }}></div>
        <div className="top-left-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.x = Math.sqrt(1/2);
                scrollViewport.y = Math.sqrt(1/2);
            }
        }} onMouseLeave={() => {
            scrollViewport.x = 0;
            scrollViewport.y = 0;
        }}></div>
        <div className="bottom-left-max" onMouseEnter={(e) => {
            if(e.buttons === 2 || e.buttons === 1) {
                scrollViewport.x = Math.sqrt(1/2);
                scrollViewport.y = -Math.sqrt(1/2);
            }
        }} onMouseLeave={() => {
            scrollViewport.x = 0;
            scrollViewport.y = 0;
        }}></div>
        
        {currentSubGraphGUIDs.length > 0 ? <div className="sub-graph-controls" style={{ pointerEvents: currentDragging ? 'none' : undefined }} onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setCurrentSubGraphGUIDs(currentSubGraphGUIDs.slice(1))}>{'<'} Exit sub-graph {graph.nodes.find(n => n.guid === currentSubGraphGUIDs[0]).properties.name.value ?? ''}</button>
        </div> : undefined}

        <div className="viewport-content" style={{ transform: `scale(${viewport.scale})` }}>
            {!selectionArea ? undefined : <div className="selection-area" style={{ left: selectionArea.x + viewport.x, top: selectionArea.y + viewport.y, width: selectionArea.w, height: selectionArea.h, borderWidth: `${3 / viewport.scale}px` }} />}

            {graph && graph === Graph.current ? <>
                {graph.links.filter(l => l.getSrcNode(graph.nodes).subGraphGUID === currentSubGraphGUIDs[0]).map((l) => {
                    const srcNode = l.getSrcNode(graph.nodes);
                    const point1 = { x: srcNode.x + srcNode.width / 2 + viewport.x, y: srcNode.height + srcNode.y + viewport.y };
                    let point2: { x: number, y: number };

                    if(!l.hasTargetNode) {
                        point2 = {
                            x: l.x + l.width / 2 + viewport.x,
                            y: l.y + viewport.y
                        };
                    } else {
                        const targetNode = l.getTargetNode(graph.nodes);
                        point2 = { x: targetNode.x + targetNode.width / 2 + viewport.x, y: targetNode.y + viewport.y };
                    }
                    
                    return <LinkLine key={l.guid} point1={point1} point2={point2} isSplit={l.hasTargetNode} />
                })}

                {graph.links.filter(l => l.getSrcNode(graph.nodes).subGraphGUID === currentSubGraphGUIDs[0]).map((l) => <StoryLinkView forceUpdate={forceUpdate} isSelected={selectedLinks.includes(l)} nodes={graph.nodes} key={l.guid} link={l} deleteLink={(force: boolean) => {
                    if(force || confirm("Are you sure ?")) {
                        graph.links = graph.links.filter(e => e !== l);
                        graph.saveHistory();
                        forceUpdate();
                    }
                }} onDragStart={updateDragStart(l)} />)}
                
                {graph.nodes.filter(n => n.subGraphGUID === currentSubGraphGUIDs[0]).map((n) => <StoryNodeView forceUpdate={forceUpdate} isSelected={selectedNodes.includes(n)} key={n.guid} node={n} onDragStart={updateDragStart(n)} onDrawingLineStart={(node) => {
                    drawingLine = {
                        srcNode: node,
                        x: undefined,
                        y: undefined
                    };
                }} openSubGraph={() => {
                    setCurrentSubGraphGUIDs([ n.guid, ...currentSubGraphGUIDs ]);
                    forceUpdate();
                }} onDrawingLineEnd={(node) => {
                    if(drawingLine) {
                        if(drawingLine.srcNode !== node && Config.instance.currentLinkMode.hasTargetNode && Graph.current.links.every(link => [link.srcNodeGuid, link.targetNodeGuid].some(guid => ![node.guid, drawingLine.srcNode.guid].includes(guid)))) {
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
        
        <div className="btns-panel" style={{ pointerEvents: currentDragging ? 'none' : undefined }} onMouseDown={(e) => e.stopPropagation()}>
            <SideButton onClick={() => {
                Graph.current.save(saveLoadServerUrl);
                /*
                const code = Graph.current.toJS();
                //jsonJsTextarea.current.value = code;
                localStorage.setItem('code', code);

                if(serverUrl) {
                    fetch(serverUrl, {
                        method: "POST",
                        body: JSON.stringify({
                            graph: Graph.current.toJSON(),
                            code: code
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    navigator.clipboard.writeText(code);
                }*/
            }} desc={<>Generate code to [{serverUrl?.trim() ? <><span className="strike">clipboard</span> / server</> : <>clipboard / <span className="strike">server</span></>}]</>}>Data 🖪</SideButton>
            <SideButton onClick={async () => {
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

                if(currentSubGraphGUIDs && !Graph.current.nodes.some(n => n.guid === currentSubGraphGUIDs[0] && n.typeId === '_subGraph_')) {
                    setCurrentSubGraphGUIDs([]);
                }
            }} desc={<>Load from [{serverUrl?.trim() ? <><span className="strike">clipboard</span> / server</> : <>clipboard / <span className="strike">server</span></>}]</>}>Data ↺</SideButton>
            {/*
            <SideButton onClick={() => {
                //const configStr = localStorage.getItem('config');
                navigator.clipboard.writeText(configStr);
            }} desc="Store current configuration to clipboard">Config 🖪</SideButton>
            <SideButton onClick={async () => {
                let code;
                try {
                    code = Graph.current.toJS();
                } catch(ex) {
                }

                const configStr = await navigator.clipboard.readText();

                const configGetter = eval(`() => { ${configStr} }`);
                Config.instance = new Config(configGetter());
                localStorage.setItem('config', configStr);
                setConfigStr(configStr);
                
                if(code) {
                    Graph.current = Graph.parse(code);
                    setGraph(() => Graph.current);
                }
            }} desc="Load configuration from clipboard">Config ↺</SideButton>*/}
            <SideButton onClick={async () => {
                setShowConfigEditor(true);
                
            }} desc="Edit configuration">Config 🖉</SideButton>
            <input type="text" title="Save/load server URL" onChange={(e) => setServerUrl(e.target.value ?? '')} value={serverUrl} placeholder="Save/load server URL" />
            {/*
            <div className="line">
                <div className="btn" onClick={() => {
                    const code = Graph.current.toJS();
                    jsonJsTextarea.current.value = code;
                    localStorage.setItem('code', code);
                    forceUpdate();

                    fetch("http://localhost:1900", {
                        method: "POST",
                        body: JSON.stringify({
                            graph: Graph.current.toJSON(),
                            code: code
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                }}>Generate JSON/code {'>'}</div>
                <textarea placeholder="Generated code" ref={jsonJsTextarea} defaultValue={localStorage.getItem('code')} />
                <div className="btn" onClick={() => {
                    const code = jsonJsTextarea.current.value;

                    if(!configTextareaRef.current.value) {
                        const config = Graph.parseConfig(code);
                        if(config) {
                            const configGetter = eval(`() => { ${config} }`);
                            Config.instance = new Config(configGetter());
                            localStorage.setItem('config', config);
                            configTextareaRef.current.value = config;
                        }
                    }

                    Graph.current = Graph.parse(code);
                    Graph.resetHistory();
                    setGraph(() => Graph.current);
                    localStorage.setItem('code', code);

                    if(currentSubGraphGUIDs && !Graph.current.nodes.some(n => n.guid === currentSubGraphGUIDs[0] && n.typeId === '_subGraph_')) {
                        setCurrentSubGraphGUIDs([]);
                    }
                }}>{'>'} From code</div>
            </div>
            <div className="line">
                <textarea onChange={(e) => Graph.current.lib = e.target.value} placeholder="Lib" value={Graph.current.lib} />
                <textarea ref={configTextareaRef} placeholder="Config" defaultValue={localStorage.getItem('config')} />
                <div className="btn" onClick={() => {
                    let code;
                    try {
                        code = Graph.current.toJS();
                    } catch(ex) {
                    }

                    const configGetter = eval(`() => { ${configTextareaRef.current.value} }`);
                    Config.instance = new Config(configGetter());
                    localStorage.setItem('config', configTextareaRef.current.value);
                    
                    if(code) {
                        Graph.current = Graph.parse(code);
                        setGraph(() => Graph.current);
                    }
                }}>{'>'} Load config</div>
            </div>*/}
        </div>

        {showConfigEditor ? <div className="config-editor-panel-wrapper">
            <div className="config-editor-panel-tools">
                <button onClick={() => {
                    let code;
                    try {
                        code = Graph.current.toJS();
                    } catch(ex) {
                    }

                    const configGetter = eval(`() => { ${configStr} }`);
                    Config.instance = new Config(configGetter());
                    localStorage.setItem('config', configStr);
                    setConfigStr(configStr);
                    
                    if(code) {
                        Graph.current = Graph.parse(code);
                        setGraph(() => Graph.current);
                    }
                }}>Apply</button>
                <button onClick={() => setShowConfigEditor(false)}>Close</button>
            </div>
            <div className="config-editor-panel">
                <Editor
                    className="config-editor-panel-textarea"
                    code={configStr}
                    onChange={(value) => setConfigStr(value)}
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
                        wordWrap: 'on'
                    }}
                    lib={configJsdoc}
                />
            </div>
        </div> : undefined}
    </div>
}
