import React from 'react';

export const SnapshotGallery: React.FC = () => {
  const snapshots = [
    { id: 1, date: '2 hours ago', thumb: '/server/thumbnails/thumb_1_1772988231582.jpg' },
    { id: 2, date: 'Yesterday', thumb: '/server/thumbnails/thumb_1_1772988231605.jpg' },
    { id: 3, date: '3 days ago', thumb: '/server/thumbnails/thumb_1_1772988233122.jpg' }
  ];

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4 text-white">Visual Snapshot Gallery</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {snapshots.map(s => (
          <div key={s.id} className="group relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700 cursor-pointer hover:border-blue-500 transition-all">
            <img src={s.thumb} alt="snapshot" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-col justify-end">
              <p className="text-[10px] text-white font-bold">{s.date}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-blue-600 text-white text-[8px] px-2 py-1 rounded font-bold uppercase">Restore</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
