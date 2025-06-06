import React, { Ref, useEffect, useId, useRef } from "react";
import * as monaco from 'monaco-editor';
import { monacoEditorOptionsBase } from "./monacoEditorOptionsBase";
import { Graph } from "./Graph";
import { Config, IConfigOptionsCodeWrapperCtx } from "./Config";
import { MonacoJsxSyntaxHighlight, getWorker } from 'monaco-jsx-syntax-highlight';

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
    isDarkMode?: boolean
    overrideConfig?: monaco.editor.IStandaloneEditorConstructionOptions
    lib?: string
    onSaveRequest: { ref: () => void }
    id: string
}

export function createEditor(options: ICreateEditorOptions): monaco.editor.IStandaloneCodeEditor {
    if(!options.domElement) {
        return undefined;
    }
/*
    if(!options.domElement.hasAttribute("editorId")) {
        options.domElement.setAttribute("editorId", Math.random().toString().replace("0.", "") + Date.now().toString());
    }
    const id = options.domElement.getAttribute("editorId");*/
    const id = options.id.replace(/:/img, '');

    const lineCtx: IConfigOptionsCodeWrapperCtx = {
        id: id,
        lib: Graph.current.lib,
        returnType: options.type
    };

    const before = options.skipConfig ? (options.codeBefore ?? '') : Config.instance.beforeCode(lineCtx) + (options.codeBefore ?? '');
    const after = options.skipConfig ? (options.codeAfter ?? '') : (options.codeAfter ?? '') + Config.instance.afterCode(lineCtx);
    const code = (before ? (before + '\n') : '') + (options.code ?? '') + (after ? ('\n' + after) : '');

    const uri = monaco.Uri.file(`f${id}.${options.fileExtension ?? 'tsx'}`);
    /*let model = monaco.editor.getModels().find(m => m.uri.toString() === uri.toString());
    if(!model || model.isDisposed()) {
        model = monaco.editor.createModel(code, options.language ?? "typescript", uri);
    }*/
    const model = monaco.editor.createModel(code, options.language ?? "typescript", uri);

    const editor = monaco.editor.create(options.domElement, {
        ...monacoEditorOptionsBase,
        model: model,
        ...(options.isMonoline ? {} : {
            wordWrap: 'bounded',
            scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                handleMouseWheel: true,
            }
        }),
        //theme: options.isDarkMode ? 'vs-dark' : 'vs',
        ...options.overrideConfig,
    });

    const jsxController = new MonacoJsxSyntaxHighlight(getWorker(), monaco);
    const jsxHighlighter = jsxController.highlighterBuilder({
        editor: editor,
        filePath: uri.toString()
    })
    
    jsxHighlighter.highlighter();

    editor.onDidDispose(() => {
        jsxHighlighter.dispose();
        model.dispose();
    });

    editor.onDidFocusEditorText(() => {
        if(options.lib) {
            monaco.languages.typescript.javascriptDefaults.setExtraLibs([{ content: options.lib }]);
        } else {
            monaco.languages.typescript.javascriptDefaults.setExtraLibs([]);
        }
    });
    
    editor.onMouseDown(e => {
        e.event.stopPropagation();
    });

    const saveRequested = (e: monaco.IKeyboardEvent) => {
        if(e.ctrlKey && e.keyCode === monaco.KeyCode.KeyS) {
            e.stopPropagation();
            e.preventDefault();
            options.onSaveRequest.ref();
            return true;
        }

        return false;
    }

    if(before || after) {
        const nbBeforeLines = before ? before.split('\n').length : 0;
        const nbAfterLines = after ? after.split('\n').length : 0;
        const getEndLinesData = (codeLines: string[]) => {
            const lastLine = codeLines.length;
            const endLine = lastLine - nbAfterLines + 1;

            return {
                lastLine,
                endLine
            }
        };

        const createRanges = (codeLines: string[]) => {
            const endLineData = getEndLinesData(codeLines);
        
            return [
                before ? new monaco.Range(1, 0, nbBeforeLines, 100) : undefined,
                after ? new monaco.Range(endLineData.endLine, 0, endLineData.lastLine, 100) : undefined,
            ].filter(e => e);
        }
        ((editor as any).setHiddenAreas as (ranges: monaco.IRange[], source?: unknown) => void)(createRanges(code.split('\n')));
        
        editor.onKeyDown(e => {
            if(saveRequested(e)) {
                return;
            }

            const code = editor.getValue();
            const codeLines = code.split('\n');
            const hiddenRanges = createRanges(codeLines);
            const endLineData = getEndLinesData(codeLines);

            const newSelections = editor
                .getSelections()
                .map(r => {
                    const newSelection = new monaco.Selection(
                        Math.min(Math.max(r.selectionStartLineNumber, nbBeforeLines + 1), endLineData.endLine - 1),
                        r.selectionStartLineNumber < nbBeforeLines + 1 ? 0 : r.selectionStartColumn,
                        Math.min(Math.max(r.positionLineNumber, nbBeforeLines + 1), endLineData.endLine - 1),
                        r.positionLineNumber > endLineData.endLine - 1 ? codeLines[codeLines.length - nbAfterLines - 1].length + 1 : r.positionColumn
                    );

                    return newSelection;
                });

            editor.setSelections(newSelections);

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
    } else {
        editor.onKeyDown(e => {
            if(saveRequested(e)) {
                return;
            }
        });
    }

    let skipOnChange = false;
    editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        if(model && !model.isDisposed()) {
            jsxHighlighter.highlighter();
        }

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

    return editor;
}

const viewStates: { [guid: string]: monaco.editor.ICodeEditorViewState } = {};
const pendingLoadings: { [guid: string]: NodeJS.Timeout } = {};

export function Editor(props: {
    className?: string
    placeholder: string
    height?: string
    codeBefore?: string
    codeAfter?: string
    skipConfig?: boolean
    isDarkMode?: boolean
    overrideConfig?: monaco.editor.IStandaloneEditorConstructionOptions
    lib?: string
    viewStateGUID?: string
} & Omit<Omit<ICreateEditorOptions, "domElement">, "id">) {
    const ref = useRef<HTMLDivElement>();
    const editor = useRef<monaco.editor.IStandaloneCodeEditor>(undefined);

    const id = useId();

    useEffect(() => {
        if(editor.current) {
            const viewState = editor.current.saveViewState();

            editor.current.dispose();
            
            if(pendingLoadings[id]) {
                clearTimeout(pendingLoadings[id]);
                delete pendingLoadings[id];
            }
            
            pendingLoadings[id] = setTimeout(() => {
                delete pendingLoadings[id];

                editor.current = createEditor({
                    ...props,
                    domElement: ref.current,
                    id: id
                });

                editor.current.restoreViewState(viewState);
            });
        } else if(!pendingLoadings[id]) {
            pendingLoadings[id] = setTimeout(() => {
                delete pendingLoadings[id];

                editor.current = createEditor({
                    ...props,
                    domElement: ref.current,
                    id: id
                });
                
                if(props.viewStateGUID && viewStates[props.viewStateGUID]) {
                    editor.current.restoreViewState(viewStates[props.viewStateGUID]);
                }
            });
        }

        return () => {
            if(pendingLoadings[id]) {
                clearTimeout(pendingLoadings[id]);
                delete pendingLoadings[id];
            }
        }
    }, [Config.instance]);

    useEffect(() => {
        if(editor.current) {
            editor.current.dispose();
            editor.current = undefined;
        }
        
        if(pendingLoadings[id]) {
            clearTimeout(pendingLoadings[id]);
            delete pendingLoadings[id];
        }

        pendingLoadings[id] = setTimeout(() => {
            delete pendingLoadings[id];

            editor.current = createEditor({
                ...props,
                domElement: ref.current,
                id: id
            });
            
            if(props.viewStateGUID && viewStates[props.viewStateGUID]) {
                editor.current.restoreViewState(viewStates[props.viewStateGUID]);
            }
        });

        return () => {
            if(pendingLoadings[id]) {
                clearTimeout(pendingLoadings[id]);
                delete pendingLoadings[id];
            }

            if(editor.current) {
                if(props.viewStateGUID) {
                    viewStates[props.viewStateGUID] = editor.current.saveViewState();
                }

                editor.current.dispose();
                editor.current = undefined;
            }
        }
    }, []);

    return <div className={`${props.className ?? ''} ${props.isMonoline ? 'monoline' : ''}`} style={props.height ? {
        height: props.height
    } : {}} ref={ref} title={props.placeholder}>{props.code ? undefined : <div className="placeholder">{props.placeholder}</div>}</div>;
}
