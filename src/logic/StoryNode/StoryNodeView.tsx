import React, { useReducer } from "react";
import { Graph, GraphNode } from "../Graph";
import "./StoryNodeStyle";
import { Viewport } from "../Viewport";
import { Properties } from "../Properties/Properties";

export function StoryNodeView(props: { forceUpdate: () => void, isSelected: boolean, node: GraphNode, openSubGraph(): void, deleteNode(force: boolean): void, onDragStart(update: (e: { x: number, y: number }, dragStart: { x: number, y: number }) => void): void, onDrawingLineStart(node: GraphNode): void, onDrawingLineEnd(node: GraphNode): void }) {
    const node = props.node;

    const viewport = Viewport.instance;

    const isHeightResizable = node.isHeightResizable;

    const isSubGraph = node.typeId === '_subGraph_';
    const isSubGraphInputOutput = !isSubGraph && node.typeId.startsWith('_subGraph_');

    return <div className={"graph-node " + (props.isSelected ? 'selected' : '')} style={Object.assign({}, node.type.style ?? {}, { top: node.y + viewport.y, left: node.x + viewport.x, width: node.width, height: node.height })} onMouseUp={(e) => {
        if(e.button === 2) {
            e.stopPropagation();
            e.preventDefault();
            props.onDrawingLineEnd(node);
        }
    }} onMouseDown={(e) => {
        if(e.button === 2) {
            e.stopPropagation();
            e.preventDefault();

            // max 1 output link for _subGraph_
            if(node.type.nbOutputsMax === undefined || Graph.current.links.filter(l => l.srcNodeGuid === node.guid).length < node.type.nbOutputsMax) {
                props.onDrawingLineStart(node);
            }
        }
    }}>
        {isSubGraphInputOutput ? <>
            <table className="header-table">
                <tbody>
                    <tr>
                        <td className="drag-handle" onMouseDown={(e) => {
                            if(e.button === 0) {
                                e.stopPropagation();

                                props.onDragStart(undefined);
                            } else if(e.button === 2) {
                                e.stopPropagation();
                            }
                        }}>
                            <div>::</div>
                        </td>
                        <td>{node.typeId === '_subGraph_input_' ? 'Input' : 'Output'}</td>
                    </tr>
                </tbody>
            </table>
        </> : <>
            <table className="header-table">
                <tbody>
                    <tr>
                        <td className="drag-handle" onMouseDown={(e) => {
                            if(e.button === 0) {
                                e.stopPropagation();

                                props.onDragStart(undefined);
                            } else if(e.button === 2) {
                                e.stopPropagation();
                            }
                        }}>
                            <div>::</div>
                        </td>
                        <td><Properties isHeader={true} properties={{ [node.type.headerPropertyId]: node.propertiesInfo[node.type.headerPropertyId] }} nodeLink={node} forceUpdate={props.forceUpdate} /></td>
                        {isSubGraph ? <td><div className="open-subgraph-btn" onClick={() => props.openSubGraph()}>Open</div></td> : undefined}
                        <td className="remove-btn" onClick={(e) => props.deleteNode(e.ctrlKey)}><div>x</div></td>
                    </tr>
                </tbody>
            </table>

            <Properties isHeader={false} properties={node.propertiesInfo} excludeProperties={[ node.type.headerPropertyId ]} nodeLink={node} forceUpdate={props.forceUpdate} />
        </>}

        <div className={"resize-handle " + (isHeightResizable ? 'xy' : 'x')} onMouseDown={(e) => {
            e.stopPropagation();

            const initialPos = {
                x: node.width,
                y: node.height
            };

            props.onDragStart((e, dragStart) => {
                node.width = initialPos.x + (e.x - dragStart.x);

                if(isHeightResizable) {
                    node.height = initialPos.y + (e.y - dragStart.y);
                }

                props.forceUpdate();
            });
        }}></div>
    </div>
}


