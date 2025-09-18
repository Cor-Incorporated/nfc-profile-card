import React from 'react';
import { useNode } from '@craftjs/core';

export const Text = ({ text, fontSize = 16 }: any) => {
  const { connectors: { connect, drag }, isActive } = useNode((state) => ({
    isActive: state.events.selected,
  }));

  return (
    <div
      ref={(ref) => connect(drag(ref as any))}
      style={{
        padding: '10px',
        fontSize: `${fontSize}px`,
        border: isActive ? '2px solid #3B82F6' : 'none',
      }}
    >
      {text}
    </div>
  );
};

Text.craft = {
  displayName: 'Text',
  props: {
    text: 'テキストを入力',
    fontSize: 16,
  },
};