import React from 'react';

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
    </div>
  );
};
