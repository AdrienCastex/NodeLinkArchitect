import React, { useState } from "react";
import { IGraphProperties, Graph } from "../Graph";
import { Editor } from "../Editor";
import { Config, ConfigOptionsPropViewType, IConfigOptionsPropsList } from "../Config";
import { Form } from "react-bootstrap";
import './PropertiesStyle';
import { saveServerUrl } from "../App/AppView";

export function Properties(props: { isHeader: boolean, properties: IConfigOptionsPropsList; excludeProperties?: string[]; nodeLink: { height: number, properties: IGraphProperties; guid: string, parseValue?(value: string): string }; forceUpdate: () => void; }) {
    const nodeLink = props.nodeLink;
    const excludeProperties = props.excludeProperties ?? [];

    const [isOpen, setIsOpen] = useState<string[]>([]);

    const isMonoline = (propertyKey: string) => {
        const prop = props.properties[propertyKey];

        if(prop.viewType === ConfigOptionsPropViewType.Checkbox || prop.viewType === ConfigOptionsPropViewType.List) {
            return true;
        } else {
            return prop.isMonoline;
        }
    }

    const allPropsKeys = Object.keys(props.properties);
    const grouped = allPropsKeys.filter(key => !excludeProperties.includes(key)).reduce((p, c) => {
        const groupKey = props.properties[c].group ?? '';
        let group = p[groupKey];
        if(!group) {
            group = {
                items: [],
                nbMonolines: 0,
                nbMultilines: 0,
                height: 0,
                multilinesHeight: 0
            };
            p[groupKey] = group;
        }
        group.items.push(c);
        
        if(isMonoline(c)) {
            ++group.nbMonolines;
        } else {
            ++group.nbMultilines;
        }

        return p;
    }, {} as { [groupKey: string]: { nbMonolines: number, nbMultilines: number, items: string[], height: number, multilinesHeight: number } });

    let totalHeight = nodeLink.height;

    const nbProperties = allPropsKeys.length - Object.keys(grouped).filter(groupKey => groupKey && !isOpen.includes(groupKey)).map(e => grouped[e].items.length).reduce((p, c) => p + c, 0);
    const nbMonolineProperties = allPropsKeys.filter(propKey => isMonoline(propKey) && (!props.properties[propKey].group || isOpen.includes(props.properties[propKey].group))).length;
    const nbMultilineProperties = nbProperties - nbMonolineProperties;

    const lineHeight = 29;
    const heightForMultilines = totalHeight - (nbMonolineProperties + (Object.keys(grouped).length - 1)) * lineHeight;

    for(const groupKey in grouped) {
        const group = grouped[groupKey];
        group.multilinesHeight = heightForMultilines / nbMultilineProperties * group.nbMultilines;
        group.height = group.multilinesHeight + group.nbMonolines * lineHeight;
    }

    return <>
        {Object.keys(grouped).map(groupKey => <div className={"properties-group " + (props.isHeader ? 'header' : '')} key={groupKey} style={{ height: `${grouped[groupKey].height}px` }}>
            {groupKey ? <div className="properties-group-title" onClick={(e) => {
                const index = isOpen.indexOf(groupKey);
                if(index >= 0) {
                    isOpen.splice(index, 1);
                } else {
                    isOpen.push(groupKey);
                }
                setIsOpen(isOpen);
            }}>
                {groupKey}
            </div> : undefined}
            {!groupKey || isOpen.includes(groupKey) ? grouped[groupKey].items.map(key => {
                const entry = props.properties[key];

                switch (entry.viewType) {
                    case ConfigOptionsPropViewType.Editor: {
                        return <Editor
                            key={key}
                            className="property"
                            height={entry.isMonoline ? undefined : `calc(100% - 1em * ${allPropsKeys.length - 1} - ${allPropsKeys.length - 1} * 2 * 0.5ch)`}
                            code={nodeLink.properties[key].value as string}
                            onChange={(value) => nodeLink.properties[key].value = (value || nodeLink.parseValue(entry.valueOnEmpty) || '')}
                            isMonoline={entry.isMonoline}
                            placeholder={entry.placeholder}
                            type={entry.type}
                            fileExtension={entry.ext ?? Config.instance.defaultLang.ext}
                            language={entry.language ?? Config.instance.defaultLang.language}
                            codeBefore={entry.codeBefore}
                            codeAfter={entry.codeAfter}
                        />;
                    }
                    case ConfigOptionsPropViewType.Checkbox: {
                        return <div className="property" key={key}>
                            <Form.Check type="checkbox" label={entry.label} checked={nodeLink.properties[key].value as boolean} onChange={(e) => {
                                nodeLink.properties[key].value = e.target.checked;
                                Graph.current.saveHistory();
                                props.forceUpdate();
                            }} />
                        </div>;
                    }
                    case ConfigOptionsPropViewType.List: {
                        return <div className="property" key={key}>
                            <Form.Select value={(nodeLink.properties[key].value as any as number)?.toString() ?? -1} size="sm" onChange={(e) => {
                                nodeLink.properties[key].value = (e.target.selectedIndex - (entry.hasEmptyOption ? 1 : 0)) as any;
                                props.forceUpdate();
                            }} onBlur={() => Graph.current.saveHistory()} >
                                {entry.hasEmptyOption ? <option value={-1}></option> : undefined}
                                {entry.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
                            </Form.Select>
                        </div>;
                    }
                    case ConfigOptionsPropViewType.SimpleText: {
                        return <div className={"property " + (entry.isMonoline ? 'monoline' : '')} key={key} style={{
                            height: entry.isMonoline ? undefined : `${heightForMultilines / nbMultilineProperties}px`
                        }}>
                            <Form.Control as="textarea" style={entry.style} rows={entry.isMonoline ? 1 : undefined} placeholder={entry.placeholder} value={nodeLink.properties[key].value as string} onChange={(e) => {
                                nodeLink.properties[key].value = e.target.value || nodeLink.parseValue(entry.valueOnEmpty) || '';
                                props.forceUpdate();
                            }} onContextMenu={(e) => e.stopPropagation()} onBlur={() => Graph.current.saveHistory()} onKeyDown={e => {
                                if(e.ctrlKey && e.key.toLowerCase() === 's') {
                                    e.preventDefault();
                                    Graph.current.save(saveServerUrl);
                                }
                            }} />
                        </div>;
                    }
                }
            }) : undefined}
        </div>)}
    </>;
}
