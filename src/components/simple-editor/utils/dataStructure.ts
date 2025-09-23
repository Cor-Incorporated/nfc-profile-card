// src/components/simple-editor/utils/dataStructure.ts

// Content types for each component type
export interface TextContent {
  text: string;
}

export interface ImageContent {
  src?: string;
  alt?: string;
}

export interface LinkContent {
  url: string;
  label?: string;
}

export interface ProfileContent {
  firstName?: string;
  lastName?: string;
  phoneticFirstName?: string;
  phoneticLastName?: string;
  name?: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  bio?: string;
  photoURL?: string;
  cardBackgroundColor?: string;
  cardBackgroundOpacity?: number;
}

export type ComponentContent = TextContent | ImageContent | LinkContent | ProfileContent;

export interface ProfileComponent {
  id: string;
  type: 'text' | 'image' | 'link' | 'profile';
  order: number;
  content: ComponentContent;
  style?: Record<string, string | number>;
}

export interface BackgroundSettings {
  type: 'color' | 'gradient' | 'image' | 'pattern';
  color?: string;
  gradient?: {
    from: string;
    to: string;
    direction: string;
  };
  image?: {
    url: string;
    opacity: number;
    blur?: number;
  };
  pattern?: string;
  opacity?: number;
}

export interface ProfileData {
  components: ProfileComponent[];
  background?: BackgroundSettings;
  updatedAt: Date;
}

// Props interfaces for components
export interface SortableItemProps {
  component: ProfileComponent;
  onDelete: (id: string) => void;
  onEdit: (component: ProfileComponent) => void;
}

export interface SimplePageEditorProps {
  userId: string;
  initialData?: ProfileData;
  user?: {
    username?: string;
    email?: string;
    displayName?: string;
  };
}