import React from "react";
import ReactDOMClient from 'react-dom/client';
import { AppView, currentSubGraphGuid, save, selectedLinks, selectedNodes, updateView } from "./logic/App/AppView";
import { Graph, GraphNode } from "./logic/Graph";
import { Config, ConfigOptionsPropViewType, IConfigOptions } from "./logic/Config";
import { Viewport } from "./logic/Viewport";

let root: ReactDOMClient.Root;

(window as any).start = (config: IConfigOptions) => {
	Config.instance = new Config(config);

	if(!root) {
		console.log(`== HELP ==
 MMB: move canvas
 CTRL + RMB: move canvas
 SHIFT + RMB: move canvas
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
 CTRL + SHIFT + z: redo`);
		
		window.onbeforeunload = function() {
			return "Are you sure to close this tool?";
		};
	
		const bundlesRoot = `dist/`;
		self.MonacoEnvironment = {
			getWorkerUrl: function (_moduleId: any, label: string) {
				if (label === 'json') {
					return `./${bundlesRoot}json.worker.bundle.js`;
				}
				if (label === `css` || label === `scss` || label === `less`) {
					return `./${bundlesRoot}css.worker.bundle.js`;
				}
				if (label === `html` || label === `handlebars` || label === `razor`) {
					return `./${bundlesRoot}html.worker.bundle.js`;
				}
				if (label === `typescript` || label === `javascript`) {
					return `./${bundlesRoot}ts.worker.bundle.js`;
				}
				return `./${bundlesRoot}editor.worker.bundle.js`;
			}
		};
	
		document.addEventListener('keydown', async (e) => {
			if(e.code.toLowerCase().startsWith('digit')) {
				e.stopPropagation();
				e.preventDefault();

				let index = parseInt(e.code.substring('digit'.length)) - 1;
				if(index < 0) {
					index = 10;
				}

				if(e.shiftKey)
				{
					const list = Object.keys(Config.instance.links.types).filter(e => Config.instance.links.types[e].isVisible !== false);
					Config.instance.currentLinkModeId = list[Math.min(index, list.length - 1)];
				}
				else
				{
					const list = Object.keys(Config.instance.nodes.types).filter(e => Config.instance.nodes.types[e].isVisible !== false);
					Config.instance.currentNodeModeId = list[Math.min(index, list.length - 1)];
				}

				updateView();
			} else if(e.ctrlKey && e.key.toLowerCase() === 's') { // save
				e.stopPropagation();
				e.preventDefault();
				
				save();
			} else if((selectedNodes.length > 0 || selectedLinks.length > 0) && e.key.toLowerCase() === 'delete') { // delete
				e.stopPropagation();
				e.preventDefault();

				if(e.shiftKey || confirm("Are you sure ?")) {
					const graph = Graph.current;

					for(const n of selectedNodes) {
						graph.deleteNode(n);
					}
					
					graph.links = graph.links.filter(e => !selectedLinks.includes(e));
					
					graph.saveHistory();

					selectedNodes.splice(0);
					selectedLinks.splice(0);

					updateView();
				}
			} else if((selectedNodes.length > 0 || selectedLinks.length > 0) && e.ctrlKey && e.key.toLowerCase() === 'd') { // duplicate
				e.stopPropagation();
				e.preventDefault();

				const result = Graph.current.clone({
					selected: {
						links: selectedLinks.map(e => e.guid),
					},
					references: Graph.current.deepGet(selectedNodes),
					nodeSelectionSubGraphGuid: currentSubGraphGuid,
					currentSubGraphGuid: currentSubGraphGuid,
					cloneExternalLinks: e.shiftKey,
					positionOffset: {
						x: 10,
						y: 10
					}
				});

				Graph.current.saveHistory();

				selectedNodes.splice(0);
				selectedNodes.push(...result.selection.nodes);

				selectedLinks.splice(0);
				selectedLinks.push(...result.selection.links);
				
				updateView();
			} else if((selectedNodes.length > 0 || selectedLinks.length > 0) && e.ctrlKey && ['c', 'x'].includes(e.key.toLowerCase())) { // copy/cut
				e.stopPropagation();
				e.preventDefault();

				const viewport = Viewport.instance.viewport;
				const isCut = e.key.toLowerCase() === 'x';

				const data = {
					selected: {
						//nodes: selectedNodes.map(e => e.guid),
						links: selectedLinks.map(e => e.guid),
					},
					references: Graph.current.deepGet(selectedNodes),
					nodeSelectionSubGraphGuid: currentSubGraphGuid,
					initialPosition: {
						x: viewport.x,
						y: viewport.y
					}
				};

				const dataStr = JSON.stringify(data);

				const clipboardItemData = new ClipboardItem({
					"text/plain": dataStr
				});

				navigator.clipboard.write([clipboardItemData]);

				if(isCut) {
					const graph = Graph.current;

					for(const n of selectedNodes) {
						graph.deleteNode(n);
					}
					
					graph.links = graph.links.filter(e => !selectedLinks.includes(e));
					
					graph.saveHistory();

					selectedNodes.splice(0);
					selectedLinks.splice(0);

					updateView();
				}
			} else if(e.ctrlKey && e.key.toLowerCase() === 'v') { // paste
				e.stopPropagation();
				e.preventDefault();
				
				const clipboardItemDatas = await navigator.clipboard.read();

				if(clipboardItemDatas && clipboardItemDatas.length > 0) {
					const clipboardItemData = clipboardItemDatas[0];

					if(clipboardItemData.types.includes('text/plain')) {
						const blob = await clipboardItemData.getType('text/plain');
						const dataStr = await blob.text();
						const data: {
							selected: {
								links: string[],
							}
							references: ReturnType<Graph['deepGet']>,
							nodeSelectionSubGraphGuid: string,
							initialPosition: {
								x: number,
								y: number,
							}
						} = JSON.parse(dataStr);
						
        				const viewport = Viewport.instance.viewport;
						
						const result = Graph.current.clone({
							...data,
							currentSubGraphGuid: currentSubGraphGuid,
							positionOffset: {
								x: data.initialPosition.x - viewport.x,
								y: data.initialPosition.y - viewport.y,
							}
						})

						Graph.current.saveHistory();

						selectedNodes.splice(0);
						selectedNodes.push(...result.selection.nodes);

						selectedLinks.splice(0);
						selectedLinks.push(...result.selection.links);

						updateView();
					}
				}
			} else if(e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') { // undo
				Graph.current.undo();
				updateView();
			} else if(e.ctrlKey && e.key.toLowerCase() === 'y' || e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') { // redo
				Graph.current.redo();
				updateView();
			}
		});
			
		const view = document.querySelector('.view');
		root = ReactDOMClient.createRoot(view);
		
		const previousConfig = localStorage.getItem('config');
		if(previousConfig) {
			try {
				// eslint-disable-next-line no-eval
				const configGetter = eval(`() => { ${previousConfig} }`);
				Config.instance = new Config(configGetter());
			} // eslint-disable-next-line no-unused-vars
			catch(ex) {
			}
		}

		try
		{
			const previousCode = localStorage.getItem('code');
			if(previousCode) {
				Graph.current = Graph.parse(previousCode);
				Graph.resetHistory();
			}
		// eslint-disable-next-line no-unused-vars
		} catch(ex) {
		} finally {
			if(!Graph.current) {
				Graph.current = new Graph();
				const node = new GraphNode();
				node.x = 10;
				node.y = 100;
				Graph.current.nodes.push(node);
				Graph.resetHistory();
			}
		}
	}

	root.render(<AppView />);
};

(window as any).start({
	nodes: {
		types: {
			default: {
				name: 'default',
				headerPropertyId: 'id',
				properties: {
					id: {
						value: (e) => e.guid,
						viewType: ConfigOptionsPropViewType.Procedural
					},
					text: {
						isMonoline: false,
						placeholder: 'Text',
						viewType: ConfigOptionsPropViewType.SimpleText
					}
				}
			}
		}
	},
	defaultLang: {
		ext: '',
		language: ''
	},
	links: {
		types: {
			default: {
				hasTargetNode: true,
				name: 'default'
			}
		}
	},
	toCodeConverter: () => ``,
	afterCode: () => '',
	beforeCode: () => '',
} as IConfigOptions);
