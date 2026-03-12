import React from 'react';
import { EditorAudits } from "./EditorAudits";
import { EditorOverlay } from "./EditorOverlay";
import { EditorStructure } from "./EditorStructure";
import { EditorAiAssistant } from "./EditorAiAssistant";

interface SidebarProps {
  isEditRailCollapsed: boolean;
  setIsEditRailCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  currentPlatformMeta: any;
  handleAiRescan: (type?: string) => void;
  aiScanLoading: boolean;
  exportReadiness: string;
  currentProject: any;
  loadedUrl: string;
  titleCaseFallback: (text: string) => string;
  versionPreview: any;
  previewVersionTitle: string;
  versionMetaFor: (v: any) => string;
  projectVersions: any[];
  versionTitleFor: (v: any) => string;
  activeVersionActionId: string | null;
  previewProjectVersion: (id: string) => Promise<void>;
  compareProjectVersion: (id: string) => Promise<void>;
  restoreProjectVersion: (id: string) => Promise<void>;
  exitVersionPreview: (hard: boolean) => void;
  runEditorAudit: () => void;
  runningAudit: boolean;
  editorAudit: any;
  blockFilter: string;
  setBlockFilter: (filter: string) => void;
  BLOCK_FILTER_OPTIONS: any;
  structureItems: any[];
  moveStructureItem: (id: string, delta: number) => void;
  leftAiModel: string;
  setLeftAiModel: (m: string) => void;
  leftAiTone: string;
  setLeftAiTone: (t: string) => void;
  leftAiPrompt: string;
  setLeftAiPrompt: (p: string) => void;
  AI_MODELS: any[];
  leftAiRunning: boolean;
  batchAiRunning: boolean;
  runLeftAiPrompt: () => void;
  runBatchAiAcrossPages: () => void;
}

export const EditorSidebar: React.FC<SidebarProps> = (props) => {
  return (
    <aside className={`editor-panel ${props.isEditRailCollapsed ? "is-collapsed" : ""}`}>
      <button
        className="editor-panel__collapse"
        onClick={() => props.setIsEditRailCollapsed(prev => !prev)}
        title={props.isEditRailCollapsed ? "Expand tools" : "Collapse tools"}
      >
        {props.isEditRailCollapsed ? ">" : "<"}
      </button>

      {props.isEditRailCollapsed ? (
        <div className="editor-panel__collapsed-stack">
          <div
            className="editor-panel__mini-platform"
            style={{
              borderColor: props.currentPlatformMeta.border,
              background: props.currentPlatformMeta.background,
              color: props.currentPlatformMeta.accent,
            }}
          >
            {props.currentPlatformMeta.shortLabel}
          </div>

          <button
            className="editor-panel__mini-action"
            onClick={() => props.handleAiRescan("block")}
            disabled={props.aiScanLoading}
            title="AI Block"
          >
            AI
          </button>

          <button
            className="editor-panel__mini-action"
            onClick={() => props.handleAiRescan("page")}
            disabled={props.aiScanLoading}
            title="AI Page"
          >
            Page
          </button>

          <div className={`editor-panel__mini-readiness ${props.exportReadiness}`}>
            {props.exportReadiness === "guarded" ? "!" : "OK"}
          </div>
        </div>
      ) : (
        <div className="editor-panel__scroll">
          <section className="editor-panel__section">
            <div className="editor-panel__label">Page</div>
            <div className="editor-panel__site-card">
              <div
                className="editor-panel__site-icon"
                style={{
                  borderColor: props.currentPlatformMeta.border,
                  background: props.currentPlatformMeta.background,
                  color: props.currentPlatformMeta.accent,
                }}
              >
                {props.currentPlatformMeta.shortLabel}
              </div>

              <div className="editor-panel__site-copy">
                <div className="editor-panel__site-name">
                  {props.currentProject?.name || props.loadedUrl.replace(/^https?:\/\//, "") || "No site loaded"}
                </div>
                <div className="editor-panel__site-meta">
                  <span className="editor-panel__site-dot" style={{ background: props.currentPlatformMeta.accent }} />
                  {props.currentPlatformMeta.label}
                  {props.currentProject ? ` · ${props.titleCaseFallback(props.currentProject.workflowStage || "draft")}` : ""}
                </div>
              </div>
            </div>
          </section>

          <div className="editor-panel__divider" />
          
          <EditorAudits 
            runEditorAudit={props.runEditorAudit} 
            runningAudit={props.runningAudit} 
            editorAudit={props.editorAudit} 
          />

          <div className="editor-panel__divider" />

          <EditorOverlay 
            blockFilter={props.blockFilter} 
            setBlockFilter={props.setBlockFilter} 
            BLOCK_FILTER_OPTIONS={props.BLOCK_FILTER_OPTIONS} 
            handleAiRescan={props.handleAiRescan} 
            aiScanLoading={props.aiScanLoading} 
            versionPreview={props.versionPreview} 
          />

          <div className="editor-panel__divider" />

          <EditorStructure 
            structureItems={props.structureItems} 
            moveStructureItem={props.moveStructureItem} 
            titleCaseFallback={props.titleCaseFallback} 
          />

          <div className="editor-panel__divider" />

          <EditorAiAssistant 
            leftAiModel={props.leftAiModel} 
            setLeftAiModel={props.setLeftAiModel} 
            leftAiTone={props.leftAiTone} 
            setLeftAiTone={props.setLeftAiTone} 
            leftAiPrompt={props.leftAiPrompt} 
            setLeftAiPrompt={props.setLeftAiPrompt} 
            AI_MODELS={props.AI_MODELS} 
            leftAiRunning={props.leftAiRunning} 
            batchAiRunning={props.batchAiRunning} 
            runLeftAiPrompt={props.runLeftAiPrompt} 
            runBatchAiAcrossPages={props.runBatchAiAcrossPages} 
            versionPreview={props.versionPreview} 
          />
        </div>
      )}
    </aside>
  );
};
