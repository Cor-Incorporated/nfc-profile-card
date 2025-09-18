import React from 'react';
import { useEditor } from '@craftjs/core';

export function SettingsPanel() {
  const { selected } = useEditor((state) => {
    const [currentNodeId] = state.events.selected;
    let selected;

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.displayName ||
              state.nodes[currentNodeId].data.name,
        settings: state.nodes[currentNodeId].related?.settings,
      };
    }

    return {
      selected,
    };
  });

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-4">設定</h3>
      {selected ? (
        <div>
          <div className="mb-4 pb-4 border-b">
            <p className="text-sm text-muted-foreground">選択中:</p>
            <p className="font-medium">{selected.name}</p>
          </div>
          {selected.settings && React.createElement(selected.settings)}
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-8">
          要素を選択すると<br />設定が表示されます
        </div>
      )}
    </div>
  );
}