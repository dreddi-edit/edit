import React from 'react';

interface MainViewProps {
  children: React.ReactNode;
}

export const MainView: React.FC<MainViewProps> = ({ children }) => {
  return (
    <main className="app-main-content">
      {children}
    </main>
  );
};
