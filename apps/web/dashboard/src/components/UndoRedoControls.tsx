import React from 'react';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const UndoRedoControls: React.FC<Props> = ({ canUndo, canRedo, onUndo, onRedo }) => {
  return (
    <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1">
      <button 
        onClick={onUndo} 
        disabled={!canUndo}
        title="Undo (Cmd+Z)"
        className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="拋15 19l-7-7 7-7" /></svg>
      </button>
      <button 
        onClick={onRedo} 
        disabled={!canRedo}
        title="Redo (Cmd+Shift+Z)"
        className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
};
