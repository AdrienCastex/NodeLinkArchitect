import * as monaco from 'monaco-editor';

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.React
});

export const monacoEditorOptionsBase: monaco.editor.IStandaloneEditorConstructionOptions = {
    language: 'javascript',
    automaticLayout: true,
    glyphMargin: false,
    folding: false,
    lineNumbers: 'off',
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    minimap: { enabled: false },
    overviewRulerLanes: 0,
    scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        handleMouseWheel: false,
    },
    contextmenu: false,
    theme: 'vs-dark'
};
