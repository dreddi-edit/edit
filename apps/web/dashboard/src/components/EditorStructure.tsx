import React from 'react';

interface EditorStructureProps {
  structureItems: Array<{
    id: string;
    rootId: string;
    displayLabel: string;
    kind: string;
    childCount: number;
    isSelected: boolean;
  }>;
  moveStructureItem: (id: string, delta: number) => void;
  titleCaseFallback: (text: string) => string;
}

export const EditorStructure: React.FC<EditorStructureProps> = ({ 
  structureItems, moveStructureItem, titleCaseFallback 
}) => (
  <section className="editor-panel__section">
    <h2 className="editor-panel__label">Structure</h2>
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
            <button className="editor-structure__move" type="button" onClick={() => moveStructureItem(item.rootId, -2)} aria-label={`Move ${item.displayLabel} to top`}>↑↑</button>
            <button className="editor-structure__move" type="button" onClick={() => moveStructureItem(item.rootId, -1)} aria-label={`Move ${item.displayLabel} up`}>↑</button>
            <button className="editor-structure__move" type="button" onClick={() => moveStructureItem(item.rootId, 1)} aria-label={`Move ${item.displayLabel} down`}>↓</button>
            <button className="editor-structure__move" type="button" onClick={() => moveStructureItem(item.rootId, 2)} aria-label={`Move ${item.displayLabel} to bottom`}>↓↓</button>
          </div>
        </div>
      ))}
    </div>
  </section>
);
