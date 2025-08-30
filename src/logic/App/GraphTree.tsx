import React, { useState } from "react";
import './GraphTreeStyle';
import { Graph, IGraphTree } from "../Graph";
import { currentSubGraphGuid } from "./AppView";

export enum TreeFilterResult {
    HideAndHideChildren,
    HideButNotChildren,
    Show
}

export function GraphTreeContainer(props: { children: any, graph: Graph, currentSubGraphGUIDs: string[], onChangeCurrentSubGraphGUIDs: (values: string[]) => void, onUpdate: () => void, treeFilter?: (tree: IGraphTree) => TreeFilterResult }) {
    const [isHover, setIsHover] = useState(false);

    return <div className="graph-tree-container" onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
        <div className="graph-tree-wrapper-ref">{isHover ? <div className="graph-tree-wrapper" onWheel={(e) => e.stopPropagation()}>
            <GraphTree tree={props.graph.graphTree} currentSubGraphGUIDs={props.currentSubGraphGUIDs} onChangeCurrentSubGraphGUIDs={props.onChangeCurrentSubGraphGUIDs} onUpdate={props.onUpdate} treeFilter={props.treeFilter} />
        </div> : undefined}</div>
        <div className="side-btn">{props.children}</div>
    </div>;
}
export function GraphTree(props: { tree: IGraphTree, currentSubGraphGUIDs: string[], onChangeCurrentSubGraphGUIDs: (values: string[]) => void, onUpdate: () => void, treeFilter: (tree: IGraphTree) => TreeFilterResult }) {
    const treeFilterResult = props.treeFilter ? props.treeFilter(props.tree) : undefined;

    switch(treeFilterResult) {
        case TreeFilterResult.HideAndHideChildren:
            return undefined;
        case TreeFilterResult.HideButNotChildren:
            return props.tree.graphs.map(e => <GraphTree currentSubGraphGUIDs={props.currentSubGraphGUIDs} key={e.graphNode.guid} tree={e} onChangeCurrentSubGraphGUIDs={props.onChangeCurrentSubGraphGUIDs} onUpdate={props.onUpdate} treeFilter={props.treeFilter} />);
    }

    return <div className={"graph-tree " + (props.tree.graphs.length > 0 ? 'has-children' : '')}>
        <div
            className={"graph-tree-name " + (currentSubGraphGuid == props.tree.guid ? 'active' : '') + ' ' + (!props.tree.guid || props.currentSubGraphGUIDs.includes(props.tree.guid) ? 'parent-active' : '')}
            onClick={() => {
                props.onChangeCurrentSubGraphGUIDs(props.tree.hierarchicalPath.slice(1).reverse());
            }}>
            {props.tree.graphNode ? <span className={"favorite " + (props.tree.graphNode.isFavorite ? 'active' : '')} onClick={e => {
                e.stopPropagation();
                e.preventDefault();

                props.tree.graphNode.isFavorite = !props.tree.graphNode.isFavorite;
                props.onUpdate();
            }}>★</span> : undefined}
            <span className="graph-tree-name-content">{props.tree.graphNode ? props.tree.graphNode.properties.name.value ?? '- no name -' : 'root'}</span>
        </div>
        <div className="graph-tree-sub">{props.tree.graphs.map(e => <GraphTree currentSubGraphGUIDs={props.currentSubGraphGUIDs} key={e.graphNode.guid} tree={e} onChangeCurrentSubGraphGUIDs={props.onChangeCurrentSubGraphGUIDs} onUpdate={props.onUpdate} treeFilter={props.treeFilter} />)}</div>
    </div>;
}
