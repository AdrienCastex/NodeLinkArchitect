import React, { useEffect, useRef } from "react";
import * as monaco from 'monaco-editor';
import { monacoEditorOptionsBase } from "./monacoEditorOptionsBase";
import { Graph } from "./Graph";
import { Config, IConfigOptionsCodeWrapperCtx } from "./Config";

export interface ICreateEditorOptions {
    type?: string
    code: string
    onChange: (newCode: string) => void | string
    domElement: HTMLElement
    isMonoline: boolean
    language?: string
    fileExtension?: string
    codeBefore?: string
    codeAfter?: string
    skipConfig?: boolean
    overrideConfig?: monaco.editor.IStandaloneEditorConstructionOptions
    lib?: string
}

export function createEditor(options: ICreateEditorOptions) {
    if(!options.domElement) {
        return;
    }

    if(!options.domElement.hasAttribute("editorId")) {
        options.domElement.setAttribute("editorId", Math.random().toString().replace("0.", "") + Date.now().toString());
    }
    const id = options.domElement.getAttribute("editorId");

    const lineCtx: IConfigOptionsCodeWrapperCtx = {
        id: id,
        lib: Graph.current.lib,
        returnType: options.type
    };

    const before = options.skipConfig ? (options.codeBefore ?? '') : Config.instance.beforeCode(lineCtx) + (options.codeBefore ?? '');
    const after = options.skipConfig ? (options.codeAfter ?? '') : (options.codeAfter ?? '') + Config.instance.afterCode(lineCtx);
    const code = (before ? (before + '\n') : '') + (options.code ?? '') + (after ? ('\n' + after) : '');

    const editor = monaco.editor.create(options.domElement, {
        ...monacoEditorOptionsBase,
        model: monaco.editor.createModel(code, options.language ?? "typescript", monaco.Uri.file(`f${id}.${options.fileExtension ?? 'tsx'}`)),
        ...(options.isMonoline ? {} : {
            wordWrap: 'bounded',
            scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                handleMouseWheel: true,
            }
        }),
        ...options.overrideConfig,
    });

    editor.onDidFocusEditorText(() => {
        if(options.lib) {
            monaco.languages.typescript.javascriptDefaults.setExtraLibs([{ content: options.lib }]);
        } else {
            monaco.languages.typescript.javascriptDefaults.setExtraLibs([]);
        }
    });

    if(before || after) {
        const createRanges = (code: string) => {
            const lastLine = code.split('\n').length;
            const endLine = lastLine - after.split('\n').length + 1;
        
            return [
                before ? new monaco.Range(1, 0, before.split('\n').length, 100) : undefined,
                after ? new monaco.Range(endLine, 0, lastLine, 100) : undefined,
            ].filter(e => e);
        }
        ((editor as any).setHiddenAreas as (ranges: monaco.IRange[], source?: unknown) => void)(createRanges(code));
        
        editor.onKeyDown(e => {
            const hiddenRanges = createRanges(editor.getValue());

            const exitBoundaries = editor
                .getSelections()
                .some(sel => {
                    if(e.keyCode === monaco.KeyCode.Backspace && sel.startColumn === 1 && sel.endColumn === 1 && sel.startLineNumber === sel.endLineNumber) {
                        return hiddenRanges.some(r => r.startLineNumber === sel.startLineNumber - 1 || r.endLineNumber === sel.startLineNumber - 1);
                    } else if(e.keyCode === monaco.KeyCode.Delete && sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn) {
                        const visibleRanges = editor.getVisibleRanges();

                        if(visibleRanges.length === 0 || visibleRanges.find(r => r.endLineNumber === sel.endLineNumber)?.endColumn === sel.endColumn) {
                            return true;
                        }
                    }

                    return false;
                });

            if(exitBoundaries) {
                e.stopPropagation();
                e.preventDefault();
            }
        });
    }

    let skipOnChange = false;
    editor.onDidChangeModelContent((e) => {
        if(skipOnChange) {
            skipOnChange = false;
            return;
        }

        const value = editor.getValue();
        const newCode = (before || after) ? (value.substring(before.length, value.length - after.length).trim() || undefined) : value;
        const alteredCode = options.onChange(newCode);

        if(typeof alteredCode === 'string' && alteredCode && alteredCode !== newCode) {
            skipOnChange = true;
            editor.setValue(alteredCode);
        }
    });
}


export function Editor(props: {
    className?: string
    placeholder: string
    height?: string
    codeBefore?: string
    codeAfter?: string
    skipConfig?: boolean
    overrideConfig?: monaco.editor.IStandaloneEditorConstructionOptions
    lib?: string
} & Omit<ICreateEditorOptions, "domElement">) {
    const ref = useRef<HTMLDivElement>();

    useEffect(() => {
        createEditor({
            ...props,
            domElement: ref.current
        });
    }, []);

    return <div className={`${props.className ?? ''} ${props.isMonoline ? 'monoline' : ''}`} style={props.height ? {
        height: props.height
    } : {}} ref={ref} title={props.placeholder}>{props.code ? undefined : <div className="placeholder">{props.placeholder}</div>}</div>;
}
