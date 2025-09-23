// src/components/simple-editor/utils/dataStructure.ts
export interface ProfileComponent {
  id: string;
  type: 'text' | 'image' | 'link' | 'profile';
  order: number;
  content: {
    [key: string]: any;
  };
  style?: {
    [key: string]: any;
  };
}

export interface ProfileData {
  components: ProfileComponent[];
  background?: any;
  updatedAt: Date;
}