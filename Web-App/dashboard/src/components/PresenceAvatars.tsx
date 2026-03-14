import React from 'react';

export const PresenceAvatars: React.FC = () => {
  const users = [
    { name: 'Edgar (You)', color: 'bg-blue-500', initial: 'E' },
    { name: 'AI Assistant', color: 'bg-purple-600', initial: 'AI' },
    { name: 'Team Guest', color: 'bg-pink-500', initial: 'G' }
  ];

  return (
    <div className="flex items-center -space-x-2">
      {users.map((u, i) => (
        <div 
          key={i} 
          title={u.name}
          className={`w-7 h-7 rounded-full border-2 border-gray-950 ${u.color} flex items-center justify-center text-[10px] font-bold text-white cursor-help hover:scale-110 transition-transform`}
        >
          {u.initial}
        </div>
      ))}
      <div className="pl-4 text-[10px] text-gray-500 font-medium">3 active</div>
    </div>
  );
};
