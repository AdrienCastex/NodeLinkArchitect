// eslint-disable no-empty-file

/**
 * @typedef {Object} IConfigOptionsLang
 * @property {string} language - 'typescript', 'csharp'
 * @property {string} ext - 'tsx', 'cs'
 * @see https://microsoft.github.io/monaco-editor/
 */
  
/**
 * @typedef {Object} IConfigOptionsPropEditor
 * 
 * @property {string} [language] - 'typescript', 'csharp'
 * @property {string} [ext] - 'tsx', 'cs'
 * 
 * @property {string} [defaultValue] - The default value for the editor.
 * @property {string} [valueOnEmpty] - Value set instead of an empty string value when changed in the editor.
 * @property {boolean} isMonoline - Indicates if the editor is in monoline mode.
 * @property {string} placeholder - The placeholder text for the editor.
 * @property {string} [codeBefore]
 * @property {string} [codeAfter]
 * @property {number} [nbLines]
 * @property {string} group - The group of the field.
 * @property {number} viewType - The view type for the editor. (0: Editor, 1: Checkbox)
 */

/**
 * @typedef {Object} IConfigOptionsPropCheckbox
 * @property {string} label - The label for the checkbox.
 * @property {boolean} [defaultValue] - The default value for the checkbox.
 * @property {string} group - The group of the field.
 * @property {number} viewType - The view type for the checkbox. (1: Checkbox)
 */

/**
 * @typedef {Object} IConfigOptionsPropList
 * @property {number} [defaultValue]
 * @property {boolean} [hasEmptyOption]
 * @property {string[]} options
 * @property {string} group - The group of the field.
 * @property {number} viewType - The view type for the list. (2: List)
 */

/**
 * @typedef {Object} IConfigOptionsPropSimpleText
 * @property {string} [defaultValue] - The default value for the editor.
 * @property {string} [valueOnEmpty] - Value set instead of an empty string value when changed in the editor.
 * @property {boolean} isMonoline - Indicates if the editor is in monoline mode.
 * @property {string} placeholder - The placeholder text for the editor.
 * @property {React.CSSProperties} [style]
 * @property {number} [nbLines]
 * @property {string} group - The group of the field.
 * @property {number} viewType - The view type for the simple text. (3: SimpleText)
 */

/**
 * @typedef {Object} IConfigOptionsPropProcedural
 * @property {React.CSSProperties} [style]
 * @property {string} group - The group of the field.
 * @property {((nodeLink: GraphNodeLink, graph: Graph) => string)} value
 * @property {number} viewType - The view type for the simple text. (4: Procedural)
 */

/**
 * @typedef {IConfigOptionsPropEditor | IConfigOptionsPropCheckbox | IConfigOptionsPropList | IConfigOptionsPropSimpleText | IConfigOptionsPropProcedural} IConfigOptionsProp
 */

/**
 * @typedef {Object} IConfigOptionsCodeWrapperCtx
 * @property {string} id
 * @property {string} [lib]
 * @property {string} [returnType]
 */

/**
 * @typedef {Object} IConfigOptionsTypeEntry
 * @property {string} name
 * @property {string} [headerPropertyId]
 * @property {{ width?: number, height?: number }} [defaultSize]
 * @property {number} [minWidth]
 * @property {number} [nbOutputsMax]
 * @property {boolean} [isVisible]
 * @property {Object.<string, IConfigOptionsProp>} [properties]
 * @property {boolean} [resizable]
 */

/**
 * @typedef {Object} IConfigOptionsType
 * @property {IConfigOptionsTypeEntry} typeId
 */

/**
 * @typedef {Object} IConfigOptionsNodeLink
 * @property {Object.<string, IConfigOptionsProp>} [properties]
 * @property {Object.<string, IConfigOptionsTypeEntry>} types
 */

/**
 * @typedef {Object} IConfigOptionsLinkTypeAddon
 * @property {boolean} hasTargetNode - Indicates if the link type has a target node.
 */

/**
 * @typedef {Object} IConfigOptionsLinkAddon
 * @property {IConfigOptionsLinkTypeAddon} types
 */

/**
 * @typedef {IConfigOptionsNodeLink & IConfigOptionsLinkAddon} IConfigOptionsLink
 */

/**
 * @typedef {Object} IConfig
 * @property {(ctx: { data: string, graph: Graph }) => string} toCodeConverter - A function for converting nodes and links to code.
 * @property {(ctx: IConfigOptionsCodeWrapperCtx) => string} codeBefore - A function to be add before editor code.
 * @property {(ctx: IConfigOptionsCodeWrapperCtx) => string} codeAfter - A function to be add after editor code.
 * @property {IConfigOptionsLang} defaultLang
 * @property {IConfigOptionsNodeLink} nodes - The nodes configuration.
 * @property {IConfigOptionsLink} links - The links configuration.
 */
  
/**
 * @typedef {Object} Graph
 * @property {string} guid
 * @property {string} lib
 * @property {GraphNode[]} nodes
 * @property {GraphLink[]} links
 * @property {{ nodes: GraphNode[], links: GraphLink[] }} flatNodesLinks
 * @property {GraphNode[]} flatNodes
 * @property {GraphLink[]} flatLinks
 */

/**
 * @typedef {{ [id: string]: { value: string|boolean } }} IGraphProperties
 */

/**
 * @typedef {Object} GraphNodeLink
 * @property {string} guid
 * @property {IGraphProperties} properties
 * @property {string} typeId
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {IConfigOptionsTypeEntry} type
 * @property {IConfigOptionsNodeLink} info
 */

/**
 * @typedef {GraphNodeLink} GraphNode
 */

/**
 * @typedef {GraphNodeLink & {
 *  srcNodeGuid: string
 *  targetNodeGuid: string
 *  type: IConfigOptionsTypeEntry & IConfigOptionsLinkTypeAddon
 *  hasTargetNode: boolean
 *  getSrcNode: (nodes: GraphNode[]) => GraphNode
 *  getTargetNode: (nodes: GraphNode[]) => GraphNode
 * }} GraphLink
 */
