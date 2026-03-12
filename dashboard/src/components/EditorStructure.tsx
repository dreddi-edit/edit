import React from 'react';

interface EditorStructureProps {
  structureItems: any[];
  moveStructureItem: (id: string, delta: number) => void;
  titleCaseFallback: (text: string) => string;
}

export const EditorStructure: React.FC<EditorStructureProps> = ({ 
  structureItems, moveStructureItem, titleCaseFallback 
}) => (
  <section className="editor-panel__section">
    <div className="editor-panel__label">Structure</div>
    <div className="editor-structure">
      {structureItems.length === 0 ? (
        <div className="editor-panel__note">Load a site to reorder motherblocks.</div>
      ) : structureItems.map(item => (
        <div key={item.id} className={`editor-structure__item ${item.isSelected ? "is-selected" : ""}`}>
          <div className="editor-structure__copy">
            <div className="editor-structure__title">{item.displayLabel}</div>
            <div className="editor-structure__meta">
              {item.childCount > 0 ? `${item.childCount} child blocks` : titleCaseFallback(item.kind)}
            </div>
          </div>
          <div className="editor-structure__actions">
            <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, -2)}>↑↑</button>
            <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, -1)}>↑</button>
            <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, 1)}>↓</button>
            <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, 2)}>↓↓</button>
          </div>
        </div>
      ))}
    </div>
  </section>
);
