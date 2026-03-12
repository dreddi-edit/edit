import React from 'react';

interface MainViewProps {
  view: 'dashboard' | 'editor';
  children: React.ReactNode;
}

export const MainView: React.FC<MainViewProps> = ({ view, children }) => {
  return (
    <main className="app-main-content">
      {children}
    </main>
  );
};
