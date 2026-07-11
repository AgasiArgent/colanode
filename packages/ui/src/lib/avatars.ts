import { hashCode, IdType } from '@colanode/core';
import { defaultIcons } from '@colanode/ui/lib/assets';

export type AvatarSize = 'small' | 'medium' | 'large' | 'extra-large';

export interface AvatarProps {
  id: string;
  name?: string | null;
  avatar?: string | null;
  size?: AvatarSize;
  className?: string;
}

export const getAvatarSizeClasses = (size?: AvatarSize) => {
  if (size === 'small') {
    return 'size-5';
  }
  if (size === 'medium') {
    return 'size-9';
  }
  if (size === 'large') {
    return 'size-12';
  }
  if (size === 'extra-large') {
    return 'size-16';
  }

  return 'size-9';
};

export interface AvatarColor {
  background: string;
  foreground: string;
}

// Mycel muted avatar tones (from the reference screen): dark-soil background
// with a pale tinted foreground. Deterministic per id, readable on both themes.
const colors: AvatarColor[] = [
  { background: '#2E4A3C', foreground: '#B9E4CD' }, // moss
  { background: '#3C2E4A', foreground: '#D3B9E4' }, // plum
  { background: '#4A3C2E', foreground: '#E4D3B9' }, // ochre
  { background: '#2E404A', foreground: '#B9D6E4' }, // steel
  { background: '#4A2E33', foreground: '#E4B9C0' }, // clay
  { background: '#3E4A2E', foreground: '#D3E4B9' }, // lichen
];

export const getColorForId = (id: string): AvatarColor => {
  const index = Math.abs(hashCode(id)) % colors.length;
  return colors[index]!;
};

export const getDefaultNodeAvatar = (type: IdType): string | null => {
  if (type === IdType.Channel) {
    return defaultIcons.chat;
  }

  if (type === IdType.Page) {
    return defaultIcons.book;
  }

  if (type === IdType.Database) {
    return defaultIcons.database;
  }

  if (type === IdType.Record) {
    return defaultIcons.bookmark;
  }

  if (type === IdType.Folder) {
    return defaultIcons.folder;
  }

  if (type === IdType.Space) {
    return defaultIcons.apps;
  }

  return null;
};
