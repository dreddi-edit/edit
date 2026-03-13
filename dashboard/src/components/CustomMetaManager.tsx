import React, { useState } from 'react';

export const CustomMetaManager: React.FC = () => {
  const [tags, setTags] = useState([{ key: 'twitter:card', value: 'summary_large_image' }]);

  const addTag = () => setTags([...tags, { key: '', value: '' }]);

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Advanced Meta Tags</h3>
        <button onClick={addTag} className="text-[10px] bg-white text-black px-2 py-1 rounded font-bold uppercase">Add Tag</button>
      </div>
      <div className="space-y-2">
        {tags.map((tag, i) => (
          <div key={i} className="flex gap-2">
            <input 
              placeholder="Property/Name" 
              value={tag.key} 
              className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-[10px] text-gray-300 font-mono outline-none"
              onChange={e => {
                const next = [...tags]; next[i].key = e.target.value; setTags(next);
              }}
            />
            <input 
              placeholder="Content" 
              value={tag.value} 
              className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-[10px] text-gray-300 font-mono outline-none"
              onChange={e => {
                const next = [...tags]; next[i].value = e.target.value; setTags(next);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
