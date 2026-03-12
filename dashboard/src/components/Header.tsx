import React from 'react';

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="app-header">
      <div className="logo">My App</div>
      <div className="user-profile">
        <span>{user?.email}</span>
        <button onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
};
