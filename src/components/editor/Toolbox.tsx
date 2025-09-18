import React from 'react';
import { useEditor, Element } from '@craftjs/core';
import { Text } from './editableComponents/Text';
import { Container } from './editableComponents/Container';
import { Type, Square } from 'lucide-react';

export function Toolbox() {
  const { connectors } = useEditor();

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-4">コンポーネント</h3>
      <div className="space-y-2">
        <div
          ref={(ref: any) =>
            connectors.create(ref, <Text text="新しいテキスト" fontSize={16} />)
          }
          className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
        >
          <Type className="h-4 w-4" />
          <span className="text-sm">テキスト</span>
        </div>

        <div
          ref={(ref: any) =>
            connectors.create(
              ref,
              <Element is={Container} canvas>
                <Text text="コンテナ内のテキスト" />
              </Element>
            )
          }
          className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
        >
          <Square className="h-4 w-4" />
          <span className="text-sm">コンテナ</span>
        </div>
      </div>
    </div>
  );
}