import React, { useEffect, useRef } from "react";
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
}

export function createEditor(options: ICreateEditorOptions): monaco.editor.IStandaloneCodeEditor {
    if(!options.domElement) {
        return undefined;
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

    const model = monaco.editor.createModel(code, options.language ?? "typescript", monaco.Uri.file(`f${id}.${options.fileExtension ?? 'tsx'}`));

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
    })
    
    jsxHighlighter.highlighter();

    editor.onDidDispose(() => {
        model.dispose();
        jsxHighlighter.dispose();
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
    }

    let skipOnChange = false;
    editor.onDidChangeModelContent((e) => {
        jsxHighlighter.highlighter();

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
} & Omit<ICreateEditorOptions, "domElement">) {
    const ref = useRef<HTMLDivElement>();
    const editor = useRef<monaco.editor.IStandaloneCodeEditor>(undefined);

    useEffect(() => {
        if(editor.current) {
            const viewState = editor.current.saveViewState();

            editor.current.dispose();
            editor.current = createEditor({
                ...props,
                domElement: ref.current
            });

            editor.current.restoreViewState(viewState);
        }
    }, [Config.instance]);

    useEffect(() => {
        if(editor.current) {
            editor.current.dispose();
            editor.current = undefined;
        }

        editor.current = createEditor({
            ...props,
            domElement: ref.current
        });

        return () => {
            if(editor.current) {
                editor.current.dispose();
                editor.current = undefined;
            }
        }
    }, []);

    return <div className={`${props.className ?? ''} ${props.isMonoline ? 'monoline' : ''}`} style={props.height ? {
        height: props.height
    } : {}} ref={ref} title={props.placeholder}>{props.code ? undefined : <div className="placeholder">{props.placeholder}</div>}</div>;
}
