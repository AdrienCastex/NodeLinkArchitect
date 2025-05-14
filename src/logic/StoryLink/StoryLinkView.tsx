import React, { useReducer } from "react";
import { GraphLink, GraphNode } from "../Graph";
import "./StoryLinkStyle";
import { Viewport } from "../Viewport";
import { Properties } from "../Properties/Properties";

export function StoryLinkView(props: { isSelected: boolean, nodes: GraphNode[], link: GraphLink, deleteLink(force: boolean): void, onDragStart(update: (e: { x: number, y: number }, dragStart: { x: number, y: number }) => void): void }) {
    const link = props.link;
    
    let initialPos: { x: number, y: number };
    const [_, forceUpdate] = useReducer((x) => x + 1, 0);

    const viewport = Viewport.instance;

    const srcNode = link.getSrcNode(props.nodes);
    const targetNode = link.getTargetNode(props.nodes);

    const width = link.type.headerPropertyId ? link.width : 25;

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
                    {!link.hasTargetNode ? <td>
                        <div className="drag-handle" onMouseDown={(e) => {
                            if(e.button === 0) {
                                e.stopPropagation();

                                props.onDragStart(undefined);
                            }
                        }}>::</div>
                    </td> : undefined}
                    <td><Properties isHeader={true} properties={{ [link.type.headerPropertyId]: link.propertiesInfo[link.type.headerPropertyId] }} nodeLink={link} forceUpdate={forceUpdate} /></td>
                    <td><div className="remove-btn" onClick={(e) => props.deleteLink(e.ctrlKey)}>x</div></td>
                </tr>
            </tbody>
        </table>
        {link.propertiesInfo
            ? <Properties isHeader={false} properties={link.propertiesInfo} excludeProperties={[ link.type.headerPropertyId ]} nodeLink={link} forceUpdate={forceUpdate} />
            : undefined
        }
        <div className="resize-handle" onMouseDown={(e) => {
            e.stopPropagation();

            initialPos = {
                y: 0,
                x: link.width
            };

            props.onDragStart((e, dragStart) => {
                link.width = initialPos.x + (e.x - dragStart.x);

                forceUpdate();
            });
        }}></div>
    </div>
}
