import React from 'react';

interface EditorAiAssistantProps {
  leftAiModel: string;
  setLeftAiModel: (val: string) => void;
  leftAiTone: string;
  setLeftAiTone: (val: string) => void;
  leftAiPrompt: string;
  setLeftAiPrompt: (val: string) => void;
  AI_MODELS: any[];
  leftAiRunning: boolean;
  batchAiRunning: boolean;
  runLeftAiPrompt: () => void;
  runBatchAiAcrossPages: () => void;
  versionPreview: any;
}

export const EditorAiAssistant: React.FC<EditorAiAssistantProps> = ({
  leftAiModel, setLeftAiModel, leftAiTone, setLeftAiTone, leftAiPrompt, setLeftAiPrompt,
  AI_MODELS, leftAiRunning, batchAiRunning, runLeftAiPrompt, runBatchAiAcrossPages, versionPreview
}) => (
  <section className="editor-panel__section">
    <div className="editor-panel__label">AI Assistant</div>
    <select className="editor-select editor-select--full" value={leftAiModel} onChange={e => setLeftAiModel(e.target.value)}>
      {AI_MODELS.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}
    </select>
    <select className="editor-select editor-select--full" value={leftAiTone} onChange={e => setLeftAiTone(e.target.value)}>
      <option value="neutral">Neutral tone</option>
      <option value="professional">Professional</option>
      <option value="casual">Casual</option>
      <option value="persuasive">Persuasive</option>
      <option value="luxury">Luxury</option>
      <option value="direct">Direct response</option>
    </select>
    <textarea
      className="editor-textarea"
      value={leftAiPrompt}
      onChange={e => setLeftAiPrompt(e.target.value)}
      placeholder="Prompt..."
    />
    <button className={`editor-btn editor-btn--panel editor-btn--accent ${leftAiRunning ? "is-loading" : ""}`} onClick={() => void runLeftAiPrompt()} disabled={leftAiRunning || Boolean(versionPreview)}>
      {leftAiRunning ? "Running..." : "Run prompt"}
    </button>
    <button className={`editor-btn editor-btn--panel editor-btn--panel-muted ${batchAiRunning ? "is-loading" : ""}`} onClick={() => void runBatchAiAcrossPages()} disabled={batchAiRunning || leftAiRunning || Boolean(versionPreview)}>
      {batchAiRunning ? "Running..." : "Run across pages"}
    </button>
  </section>
);
