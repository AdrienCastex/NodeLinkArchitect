import React, { useReducer } from "react";
import { GraphLink, GraphNode } from "../Graph";
import "./StoryLinkStyle";
import { Viewport } from "../Viewport";
import { Properties } from "../Properties/Properties";

export function StoryLinkView(props: { forceUpdate: () => void, isSelected: boolean, nodes: GraphNode[], link: GraphLink, deleteLink(force: boolean): void, onDragStart(update: (e: { x: number, y: number }, dragStart: { x: number, y: number }) => void): void }) {
    const link = props.link;
    
    let initialPos: { x: number, y: number };

    const viewport = Viewport.instance;

    const srcNode = link.getSrcNode(props.nodes);
    const targetNode = link.getTargetNode(props.nodes);

    const width = link.type.headerPropertyId ? link.width : 25;

    const isHeightResizable = link.isHeightResizable;

    const style: React.CSSProperties = {
        top: (!link.hasTargetNode ? link.y : (srcNode.y + srcNode.height + (targetNode?.y || 0)) / 2) + viewport.y,
        left: (!link.hasTargetNode ? link.x : (srcNode.x + srcNode.width / 2 + (targetNode?.x || 0) + (targetNode?.width || 0) / 2) / 2 - width / 2) + viewport.x,
        width: width,
    };

    if(!link.type.headerPropertyId) {
        return <div className={`graph-link cursor-ghost ${!link.hasTargetNode ? 'target-id' : ''} ${props.isSelected ? 'selected': ''}`} style={Object.assign({ marginTop: `-1em` }, link.type.style ?? {}, style)}>
            <div className="remove-btn" onClick={(e) => props.deleteLink(e.ctrlKey)}>x</div>
        </div>;
    }

    return <div className={`graph-link ${!link.hasTargetNode ? 'target-id' : ''} ${props.isSelected ? 'selected': ''}`} style={Object.assign({ marginTop: `-${link.propertiesInfo ? Object.entries(link.propertiesInfo).length : 0}em` }, link.type.style ?? {}, style)}>
        <table className="header-table">
            <tbody>
                <tr>
                    {!link.hasTargetNode ? <td className="drag-handle" onMouseDown={(e) => {
                            if(e.button === 0) {
                                e.stopPropagation();

                                props.onDragStart(undefined);
                            }
                        }}>
                        <div>::</div>
                    </td> : undefined}
                    <td><Properties isHeader={true} properties={{ [link.type.headerPropertyId]: link.propertiesInfo[link.type.headerPropertyId] }} nodeLink={link} forceUpdate={props.forceUpdate} /></td>
                    <td className="remove-btn" onClick={(e) => props.deleteLink(e.ctrlKey)}><div>x</div></td>
                </tr>
            </tbody>
        </table>
        {link.propertiesInfo
            ? <Properties isHeader={false} properties={link.propertiesInfo} excludeProperties={[ link.type.headerPropertyId ]} nodeLink={link} forceUpdate={props.forceUpdate} />
            : undefined
        }
        <div className={"resize-handle " + (isHeightResizable ? 'xy' : 'x')} onMouseDown={(e) => {
            e.stopPropagation();

            initialPos = {
                y: link.height,
                x: link.width
            };

            props.onDragStart((e, dragStart) => {
                link.width = initialPos.x + (e.x - dragStart.x);

                if(isHeightResizable) {
                    link.height = initialPos.y + (e.y - dragStart.y);
                }

                props.forceUpdate();
            });
        }}></div>
    </div>
}
