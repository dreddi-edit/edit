import React from 'react';
import { PresenceAvatars } from './PresenceAvatars';

interface HeaderProps {
  user: { email?: string } | null;
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
