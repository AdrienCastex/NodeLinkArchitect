import { currentSubGraphGuid } from "./App/AppView";
import { Graph } from "./Graph";

export class Viewport implements IViewport {
    public static instance = new Viewport();

    public get viewport() {
        return currentSubGraphGuid ? Graph.current.nodes.find(n => n.guid === currentSubGraphGuid).viewport : Graph.current.viewport;
    }

    public get x() {
        return this.viewport.x;
    }
    public set x(value) {
        this.viewport.x = value;
    }
    public get y() {
        return this.viewport.y;
    }
    public set y(value) {
        this.viewport.y = value;
    }
    public get scale() {
        return this.viewport.scale;
    }
    public set scale(value) {
        this.viewport.scale = value;
    }
}

export interface IViewport {
    x: number;
    y: number;
    scale: number;
}
