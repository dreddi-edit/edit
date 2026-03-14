import React from 'react';

interface TreeNode {
  tag: string;
  id: string | null;
  children: TreeNode[];
}

export const VisualNodeTree: React.FC<{ html: string }> = ({ html }) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const getTree = (node: Element, depth = 0): TreeNode[] => {
    return Array.from(node.children).map(child => ({
      tag: child.tagName.toLowerCase(),
      id: child.getAttribute('data-block-id') || child.id || null,
      children: getTree(child, depth + 1)
    })).filter(item => ['section', 'header', 'footer', 'main', 'h1', 'h2', 'div'].includes(item.tag));
  };

  const treeData = getTree(doc.body);

  const renderNode = (node: TreeNode, idx: number): React.ReactNode => (
    <div key={idx} className="ml-4 border-l border-gray-800 pl-3 my-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] bg-gray-800 text-blue-400 px-1.5 py-0.5 rounded font-mono uppercase font-bold">{node.tag}</span>
        {node.id && <span className="text-[9px] text-gray-600 font-mono truncate max-w-[100px]">#{node.id}</span>}
      </div>
      {node.children.length > 0 && (
        <div className="mt-1">{node.children.map((child: TreeNode, i: number) => renderNode(child, i))}</div>
      )}
    </div>
  );

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Visual Structure Tree</h3>
      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {treeData.length > 0 ? treeData.map((node, i) => renderNode(node, i)) : <p className="text-gray-500 italic text-sm">No structural elements detected.</p>}
      </div>
    </div>
  );
};
