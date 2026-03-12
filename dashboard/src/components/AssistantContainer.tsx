import React from 'react';

interface AssistantContainerProps {
  children: React.ReactNode;
}

export const AssistantContainer: React.FC<AssistantContainerProps> = ({ children }) => {
  return (
    <div className="assistant-wrapper">
      {children}
    </div>
  );
};
