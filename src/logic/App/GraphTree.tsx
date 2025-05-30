import React, { useState } from "react";
import './GraphTreeStyle';
import { Graph, IGraphTree } from "../Graph";
import { currentSubGraphGuid } from "./AppView";

export function GraphTreeContainer(props: { graph: Graph, currentSubGraphGUIDs: string[], onChangeCurrentSubGraphGUIDs: (values: string[]) => void }) {
    const [isHover, setIsHover] = useState(false);

    return <div className="graph-tree-container" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
        {isHover ? <div className="graph-tree-wrapper" onWheel={(e) => e.stopPropagation()}>
            <GraphTree tree={props.graph.graphTree} currentSubGraphGUIDs={props.currentSubGraphGUIDs} onChangeCurrentSubGraphGUIDs={props.onChangeCurrentSubGraphGUIDs} />
        </div> : undefined}
        <div className="side-btn">Tree</div>
    </div>;
}
export function GraphTree(props: { tree: IGraphTree, currentSubGraphGUIDs: string[], onChangeCurrentSubGraphGUIDs: (values: string[]) => void }) {

    return <div className={"graph-tree " + (props.tree.graphs.length > 0 ? 'has-children' : '')}>
        <div
            className={"graph-tree-name " + (currentSubGraphGuid == props.tree.guid ? 'active' : '') + ' ' + (!props.tree.guid || props.currentSubGraphGUIDs.includes(props.tree.guid) ? 'parent-active' : '')}
            onClick={() => {
                props.onChangeCurrentSubGraphGUIDs(props.tree.hierarchicalPath.slice(1).reverse());
            }}>
            {props.tree.graphNode ? props.tree.graphNode.properties.name.value ?? '- no name -' : 'root'}
        </div>
        <div className="graph-tree-sub">{props.tree.graphs.map(e => <GraphTree currentSubGraphGUIDs={props.currentSubGraphGUIDs} key={e.graphNode.guid} tree={e} onChangeCurrentSubGraphGUIDs={props.onChangeCurrentSubGraphGUIDs} />)}</div>
    </div>;
}
