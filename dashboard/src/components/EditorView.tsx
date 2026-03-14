import React from 'react';

import { PseudoElementEditor } from './PseudoElementEditor';
import { ZIndexInspector } from './ZIndexInspector';
import { ResponsiveGridControls } from './ResponsiveGridControls';
import { FormConfigEditor } from './FormConfigEditor';
import { ShortcutsLegend } from './ShortcutsLegend';
import { AiSuggestionChip } from './AiSuggestionChip';

interface EditorViewProps {
  currentProject: { name?: string } | null;
  children?: React.ReactNode;
}

export const EditorView: React.FC<EditorViewProps> = ({ currentProject, children }) => {
  return (
    <div className="editor-main-layout">
      <div className="editor-sidebar">
        {/* Project details could go here */}
        <h3>{currentProject?.name}</h3>
      </div>
      <div className="editor-canvas">
        {children}
      </div>
    
          <ResponsiveGridControls selectedBlockId="block-1" />
          <FormConfigEditor selectedBlockId="block-1" />
          <ZIndexInspector />
          <PseudoElementEditor />  <AiSuggestionChip visible={true} onAction={(a) => console.log(a)} />
      <ShortcutsLegend />
    </div>
  );
};
