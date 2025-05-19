import React, { useEffect, useState } from "react";
import { Graph, GraphNodeLink } from "../Graph";
import { Editor } from "../Editor";
import { Config, ConfigOptionsPropViewType } from "../Config";
import { Form } from "react-bootstrap";
import './PropertiesStyle';
import { saveLoadServerUrl } from "../App/AppView";

export function Properties(props: { isHeader: boolean, properties: string[]; excludeProperties?: string[]; nodeLink: GraphNodeLink; forceUpdate: () => void; }) {
    const nodeLink = props.nodeLink;

    const [isOpen, setIsOpen] = useState<string[]>(Graph.current.openGroups[nodeLink.guid] ?? []);

    useEffect(() => {
        if(isOpen.length > 0) {
            Graph.current.openGroups[nodeLink.guid] = isOpen;
        } else {
            delete Graph.current.openGroups[nodeLink.guid];
        }

        nodeLink.updateHeight();
        props.forceUpdate();
    }, [isOpen]);

    const grouped = nodeLink.getGroupedProperties({
        properties: props.properties
    });
    
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const lineHeightPx = 1.5 * rem;

    return <>
        {Object.keys(grouped).filter(groupKey => grouped[groupKey].items.length > 0).map(groupKey => <div className={"properties-group " + (props.isHeader ? 'header' : '')} key={groupKey} style={{ height: `${grouped[groupKey].heightPx}px` }}>
            {groupKey ? <div className="properties-group-title" onClick={(e) => {
                const index = isOpen.indexOf(groupKey);
                if(index >= 0) {
                    isOpen.splice(index, 1);
                } else {
                    isOpen.push(groupKey);
                }
                setIsOpen([...isOpen]);
            }}>
                {groupKey}
            </div> : undefined}
            {!groupKey || isOpen.includes(groupKey) ? grouped[groupKey].items.filter(key => nodeLink.propertiesInfo[key]).map(key => {
                const entry = nodeLink.propertiesInfo[key];

                switch (entry.viewType) {
                    case ConfigOptionsPropViewType.Editor: {
                        return <Editor
                            key={key}
                            className="property"
                            height={entry.isMonoline ? undefined : `${entry.nbLines ? entry.nbLines * lineHeightPx : grouped[groupKey].singleAutoLineHeight}px`}
                            code={nodeLink.properties[key].value as string}
                            onChange={(value) => {
                                nodeLink.properties[key].value = (value || nodeLink.parseValue(entry.valueOnEmpty) || '');
                                props.forceUpdate();
                            }}
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
                            height: entry.isMonoline ? undefined : `${entry.nbLines ? entry.nbLines * lineHeightPx : grouped[groupKey].singleAutoLineHeight}px`
                        }}>
                            <Form.Control as="textarea" style={entry.style} rows={entry.isMonoline ? 1 : undefined} placeholder={entry.placeholder} value={nodeLink.properties[key].value as string} onChange={(e) => {
                                nodeLink.properties[key].value = e.target.value || nodeLink.parseValue(entry.valueOnEmpty) || '';
                                props.forceUpdate();
                            }} onContextMenu={(e) => e.stopPropagation()} onBlur={() => Graph.current.saveHistory()} onKeyDown={e => {
                                if(e.ctrlKey && e.key.toLowerCase() === 's') {
                                    e.preventDefault();
                                    Graph.current.save(saveLoadServerUrl);
                                }
                            }} />
                        </div>;
                    }
                    case ConfigOptionsPropViewType.GUID: {
                        return <div className="property monoline" key={key}>
                            <Form.Control as="textarea" style={entry.style} rows={1} value={nodeLink.guid as string} readOnly={true} />
                        </div>;
                    }
                }
            }) : undefined}
        </div>)}
    </>;
}
