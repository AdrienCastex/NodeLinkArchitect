# Node Link Architect

A web-based GUI to visually create and manage nodes and links with customizable types, parameters and output generation.

Create a configuration, then use this tool to create a graph. Finally, convert the graph into code based on the configuration.

Online version: https://adriencastex.github.io/NodeLinkArchitect/

# Controls

This help is visible in the console while on the GUI:
```
== HELP ==
 MMB: move canvas
 RMB on canvas: create new entry
 RMB from entry to entry: draw choice
 RMB from entry to canvas: draw choice + create new entry
 0-9: change node mode
 0-9 + SHIFT: change link mode
 LMB: area selection
 LMB + SHIFT: area selection - additive
 LMB + CTRL: area selection - exclusive
 LMB on grip: drag entry
 LMB + CTRL on delete btn: skip confirmation prompt
 CTRL + c: copy selection
 CTRL + v: paste selection
 CTRL + d: duplicate selection
 CTRL + SHIFT + d: duplicate selection and preserve external links
 CTRL + z: undo
 CTRL + y: redo
 CTRL + SHIFT + z: redo
```

# Configuration

The configuration code is JavaScript. It will be stored with the data, to keep data and the configuration together to avoid version divergence.

## Example of configuration
```javascript
/** @type {IConfig} */
const config = {
	nodes: {
		types: {
			default: { // this is a type of node
				name: 'default', // this is how it will be displayed in the GUI
				headerPropertyId: 'id', // the property to display between the grab area and the delete btn
				properties: { // list of properties and their definition
					id: {
                        value: (nodeLink, graph) => nodeLink.guid, // display the GUID of the node (readonly)
						viewType: ConfigOptionsPropViewType.Procedural
					},
					text: {
						isMonoline: false, // not on one line
						placeholder: 'Text',
						viewType: ConfigOptionsPropViewType.SimpleText // text field (value = string)
					}
				}
			},
            // ...
		}
	},
    links: {
        types: {
            default: { // this is a type of link
                name: "Choice",
                headerPropertyId: 'isAuto',
                hasTargetNode: true, // this link must be end with a node (false = floating)
                properties: {
                    isAuto: {
                        label: "Is auto", // text next to the checkbox
                        defaultValue: true,
                        viewType: ConfigOptionsPropViewType.Checkbox // checkbox (value = boolean)
                    },
                    // same as for nodes
                }
            },
            // ...
        }
    },

    // convert the graph into a string; you are supposed to paste this string into your code, for integration in your engine, whatever it is (but you do whatever you want)
	toCodeConverter: (ctx) => {
        let json = ``;

        // create your own data structure from the graph; for instance, here, we create JSON
        
        for(const node of ctx.graph.flatNodes) {
            // find links with 'node' as their source
            const links = ctx.graph.flatLinks.filter(l => l.srcNodeGuid === node.guid);

            json += `"${node.properties.id.value}": {
                "text": "${node.properties.text.value}",
                "nextNodes": [
                    ${links
                        .map(l => `{
                            "isAuto": ${l.properties.isAuto.value ? 'true' : 'false'},
                            "targetId": "${l.getTargetNode(ctx.graph.nodes).properties.id.value}"
                        },`)
                        .join('\n')
                    }
                ]
            },`
        }

        json = `{ ${json} }`;

        // ctx.data contains a parsable representation of the graph; the software need it to load the data, so we add ctx.data with comments; this way, we will be able to just copy the content of the file, and when loaded in the software, this part will be extracted (it's just easier and more maintenable to have the 'generated code' and the 'parsable data' in the same file)
        json = `//${ctx.data} \n ${json}`;

        return json;
    },
    
    // for code editor in the GUI (properties); if you don't use editor properties, then this is not used
	defaultLang: {
        language: 'typescript',
        ext: 'tsx',
	},
    beforeCode: (ctx) => `
        import React from "react";
        
        ${specialBehaviours.map(sb => `const ${sb.id}: any = ${sb.code};`).join('\n')}

        ${ctx.lib};
        function __${ctx.id}__(): ${ctx.returnType ?? ''} {
            return (`, // code to add before editor fields
    afterCode: (ctx) => `);}`, // code to add after editor fields
}

return config;
```

`toCodeConverter` can be left empty if you generate the code in the save server.

Use an IDE to exploit the JSDoc typing.

Advice: copy/paste this configuration and play with it. Apply, change it, apply again, etc.

## Internal editor

The GUI has its own editor to edit the configuration.

## External editor

First, import the jsdoc you can find at [`tools/jsdoc/jsdoc.js`](tools/jsdoc/jsdoc.js). Then, create your configuration and return it.
```javascript
/** @typedef {import("./jsdoc/jsdoc")} */

/** @type {IConfig} */
const config = {
    // ...
};

return config;
```

# Save/load server

The save/load server is not necessary, but you can connect it with this software to easily update your project. Just press CTRL+S (or press the button to save the data on the bottom right), and if you added a save server url (input field on the bottom right) then the graph data and the generated code will be sent to this URL.

An example (usable) of this server can be found in [`tools/localServer.js`](tools/localServer.js). You can start it with nodejs (`node localServer.js`).

# Parameters

You can pass the `serverUrl` to specify the server URL. For instance:
```
https://adriencastex.github.io/NodeLinkArchitect/?serverUrl=http://localhost:1900
```
