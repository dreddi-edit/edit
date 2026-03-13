import React from 'react';

export const ProjectTransfer: React.FC<{ projectId?: number }> = () => {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
      Project transfer is not active in this build yet. The previous version used demo behavior and was removed from the live UI.
    </div>
  );
};

export default ProjectTransfer;
