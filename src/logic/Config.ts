import { Graph } from "./Graph";

export interface IConfigOptionsLang {
    /**
     * 'typescript', 'csharp'
     * @see https://microsoft.github.io/monaco-editor/
     */
    language: string
    /**
     * '.tsx', '.cs'
     * @see https://microsoft.github.io/monaco-editor/
     */
    ext: string
}
export enum ConfigOptionsPropViewType {
    Editor,
    Checkbox,
    List,
    SimpleText,
    GUID
}

(window as any).ConfigOptionsPropViewType = ConfigOptionsPropViewType;

export interface IConfigOptionsPropEditor extends Partial<IConfigOptionsLang> {
    defaultValue?: string
    /**
     * Value set instead of empty string value when changed in the editor
     */
    valueOnEmpty?: string
    isMonoline: boolean,
    placeholder: string,
    type: string,
    codeBefore?: string
    codeAfter?: string
    nbLines?: number
    isDarkMode?: boolean
    viewType: ConfigOptionsPropViewType.Editor
    group?: string
}
export interface IConfigOptionsPropCheckbox {
    label: string
    defaultValue?: boolean
    viewType: ConfigOptionsPropViewType.Checkbox
    group?: string
}
export interface IConfigOptionsPropList {
    defaultValue?: number
    hasEmptyOption?: boolean
    options: string[]
    viewType: ConfigOptionsPropViewType.List
    group?: string
}
export interface IConfigOptionsPropSimpleText {
    defaultValue?: string
    valueOnEmpty?: string
    isMonoline: boolean,
    style?: React.CSSProperties,
    placeholder: string,
    nbLines?: number
    viewType: ConfigOptionsPropViewType.SimpleText
    group?: string
}
export interface IConfigOptionsPropGUID {
    style?: React.CSSProperties,
    viewType: ConfigOptionsPropViewType.GUID
    group?: string
}

export type IConfigOptionsProp = IConfigOptionsPropEditor | IConfigOptionsPropCheckbox | IConfigOptionsPropList | IConfigOptionsPropSimpleText | IConfigOptionsPropGUID;

export interface IConfigOptionsCodeWrapperCtx {
    id: string
    lib: string
    returnType?: string
}

export interface IConfigOptionsTypeEntry {
    name: string
    headerPropertyId?: string
    properties?: IConfigOptionsPropsList
    defaultSize?: {
        width?: number
        height?: number
    },
    minWidth?: number
    nbOutputsMax?: number
    isVisible?: boolean
    style?: React.CSSProperties
    resizable?: boolean
}
export interface IConfigOptionsType {
    [typeId: string]: IConfigOptionsTypeEntry
}
export interface IConfigOptionsNodeLink {
    properties?: IConfigOptionsPropsList
    types: IConfigOptionsType
}

export interface IConfigOptionsLinkTypeAddon {
    hasTargetNode: boolean
}
export interface IConfigOptionsLinkAddon {
    types: IConfigOptionsLinkAddonItems
}
export interface IConfigOptionsLinkAddonItems {
    [typeId: string]: IConfigOptionsLinkTypeAddon
}
export type IConfigOptionsLink = IConfigOptionsNodeLink & IConfigOptionsLinkAddon;

export interface IConfigOptionsPropsList {
    [id: string]: IConfigOptionsProp
}
export interface IConfigOptions {
    toCodeConverter: (ctx: { data: string, graph: Graph }) => string
	beforeCode: (ctx: IConfigOptionsCodeWrapperCtx)  => string
	afterCode: (ctx: IConfigOptionsCodeWrapperCtx)  => string
	defaultLang: IConfigOptionsLang,

    nodes: IConfigOptionsNodeLink
    links: IConfigOptionsLink
}

export class Config {
    public static instance: Config;
    
    public constructor(protected options: IConfigOptions) {
    }

    get defaultLang() {
        return this.options.defaultLang;
    }

    get nodes() {
        const graphStyle = {
            backgroundColor: 'blueviolet',
            borderColor: 'blueviolet',
        }

        const result = Object.assign({}, this.options.nodes);
        result.types = Object.assign({
            _subGraph_: {
                name: 'Sub graph',
                headerPropertyId: 'name',
                defaultSize: {
                    width: 318,
                    height: 0
                },
                nbOutputsMax: 1,
                properties: {
                    name: {
                        isMonoline: true,
                        placeholder: 'Name',
                        viewType: ConfigOptionsPropViewType.SimpleText
                    },
                },
                style: graphStyle
            },
            _subGraph_input_: {
                name: 'Sub graph - input',
                defaultSize: {
                    width: 144,
                    height: 36
                },
                resizable: false,
                nbOutputsMax: 1,
                isVisible: false,
                style: graphStyle
            },
            _subGraph_output_: {
                name: 'Sub graph - output',
                defaultSize: {
                    width: 144,
                    height: 36
                },
                resizable: false,
                nbOutputsMax: 0,
                isVisible: false,
                style: graphStyle
            },
        } as IConfigOptionsType, result.types);

        return result;
    }

    get links() {
        const result = Object.assign({}, this.options.links);
        result.types = Object.assign({
            _subGraph_input_link_: {
                name: 'Sub graph - input',
                hasTargetNode: true,
                isVisible: false
            },
            _subGraph_output_link_: {
                name: 'Sub graph - output',
                hasTargetNode: true,
                isVisible: false
            },
        } as IConfigOptionsLinkAddonItems, result.types);

        return result;
    }

    beforeCode(ctx: IConfigOptionsCodeWrapperCtx) {
        return this.options.beforeCode(ctx);
    }
    afterCode(ctx: IConfigOptionsCodeWrapperCtx) {
        return this.options.afterCode(ctx);
    }

    toCode(ctx: { data: string, graph: Graph }) {
        return this.options.toCodeConverter(ctx);
    }

    private _currentNodeModeId: string;
    public get currentNodeModeId() {
        if(!this._currentNodeModeId) {
            this._currentNodeModeId = this.nodes.types.default ? 'default' : Object.keys(this.nodes.types)[0];
        }
        return this._currentNodeModeId;
    }
    public set currentNodeModeId(value) {
        this._currentNodeModeId = value;
    }
    
    public get currentNodeMode() {
        return this.nodes.types[this.currentNodeModeId];
    }

    private _currentLinkModeId: string;
    public get currentLinkModeId() {
        if(!this._currentLinkModeId) {
            this._currentLinkModeId = this.links.types.default ? 'default' : Object.keys(this.links.types)[0];
        }
        return this._currentLinkModeId;
    }
    public set currentLinkModeId(value) {
        this._currentLinkModeId = value;
    }

    public get currentLinkMode() {
        return this.links.types[this.currentLinkModeId];
    }
}
