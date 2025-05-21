import React from "react";
import { GraphLink, GraphNode } from "../Graph";
import "./StoryLinkStyle";
import { Viewport } from "../Viewport";
import { Properties } from "../Properties/Properties";

export function StoryLinkView(props: { offset: { x: number, y: number }, forceUpdate: () => void, isSelected: boolean, nodes: GraphNode[], link: GraphLink, deleteLink(force: boolean): void, onDragStart(update: (e: { x: number, y: number }, dragStart: { x: number, y: number }) => void): void }) {
    const link = props.link;
    
    let initialPos: { x: number, y: number };

    const viewport = Viewport.instance;

    const srcNode = link.getSrcNode(props.nodes);
    const targetNode = link.getTargetNode(props.nodes);

    const width = link.type.headerPropertyId ? link.width : 25;

    const isHeightResizable = link.isHeightResizable;

    const style: React.CSSProperties = {
        top: (!link.hasTargetNode ? link.y : (srcNode.y + srcNode.height + targetNode.y) / 2) + viewport.y + props.offset.y,
        left: (!link.hasTargetNode ? link.x : (srcNode.x + targetNode.x) / 2 - width / 2 + props.offset.x) + viewport.x,
        width: width
    };

    if(!link.type.headerPropertyId) {
        return <div className={`graph-link cursor-ghost ${!link.hasTargetNode ? 'target-id' : ''} ${props.isSelected ? 'selected': ''}`} style={Object.assign({ marginTop: `-1em` }, link.type.style ?? {}, style)}>
            <div className="remove-btn" onClick={(e) => props.deleteLink(e.ctrlKey)}>x</div>
        </div>;
    }

    style.height = `${link.height}px`;

    return <div className={`graph-link ${!link.hasTargetNode ? 'target-id' : ''} ${props.isSelected ? 'selected': ''}`} style={Object.assign({}, link.type.style ?? {}, style)}>
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
                    <td><Properties isHeader={true} properties={[link.type.headerPropertyId]} nodeLink={link} forceUpdate={props.forceUpdate} /></td>
                    <td className="remove-btn" onClick={(e) => props.deleteLink(e.ctrlKey)}><div>x</div></td>
                </tr>
            </tbody>
        </table>
        {link.propertiesInfo
            ? <Properties isHeader={false} properties={Object.keys(link.propertiesInfo).filter(k => k !== link.type.headerPropertyId)} nodeLink={link} forceUpdate={props.forceUpdate} />
            : undefined
        }
        {!link.isResizable ? undefined : <div className={"resize-handle " + (isHeightResizable ? 'xy' : 'x')} onMouseDown={(e) => {
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
        }}></div>}
    </div>
}
