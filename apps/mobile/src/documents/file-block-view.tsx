import { Ionicons } from '@expo/vector-icons';
import { eq, useLiveQuery as useDbLiveQuery } from '@tanstack/react-db';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DownloadStatus, type LocalFileNode } from '@colanode/client/types';
import { useCurrentWorkspace } from '@colanode/mobile/session/current-workspace-context';
import { type Palette } from '@colanode/mobile/theme/palette';
import { useTheme } from '@colanode/mobile/theme/theme-context';
import { radius, spacing } from '@colanode/mobile/theme/tokens';
import { fonts, typeScale } from '@colanode/mobile/theme/typography';
import { useLiveQuery } from '@colanode/ui/hooks/use-live-query';

// shortcut: file nodes carry no intrinsic dimensions, so image previews use a
// fixed 4/3 aspect — swap for stored width/height if they land on the schema.
const IMAGE_ASPECT_RATIO = 4 / 3;

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    image: {
      width: '100%',
      aspectRatio: IMAGE_ASPECT_RATIO,
      borderRadius: radius.md,
    },
    loadingBox: {
      width: '100%',
      aspectRatio: IMAGE_ASPECT_RATIO,
      backgroundColor: palette.surface,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    progress: {
      fontFamily: fonts.mono,
      fontSize: typeScale.caption.fontSize,
      color: palette.textMuted,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: palette.surface,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    chipText: { flex: 1, gap: 2 },
    chipName: { ...typeScale.body, color: palette.textPrimary },
    chipMeta: { ...typeScale.caption, color: palette.textMuted },
  });

export const FileBlockView = ({ fileId }: { fileId: string }) => {
  const { workspace, collections } = useCurrentWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const nodeQuery = useDbLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.nodes })
        .where(({ nodes }) => eq(nodes.id, fileId))
        .findOne(),
    [fileId]
  );
  const fileQuery = useLiveQuery({
    type: 'local.file.get',
    fileId,
    userId: workspace.userId,
    autoDownload: true,
  });

  const node = nodeQuery.data as LocalFileNode | undefined;
  const local = fileQuery.data;
  const isImage = node?.subtype === 'image';
  const downloadStatus = local?.downloadStatus;

  if (isImage && downloadStatus === DownloadStatus.Completed && local?.url) {
    return (
      <Image
        source={{ uri: local.url }}
        style={styles.image}
        resizeMode="contain"
      />
    );
  }

  if (
    isImage &&
    (downloadStatus === DownloadStatus.Pending ||
      downloadStatus === DownloadStatus.Downloading)
  ) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.progress}>
          {Math.round(local?.downloadProgress ?? 0)}%
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.chip}
      accessibilityRole="button"
      onPress={() =>
        Alert.alert('Open on desktop', 'Open this file on desktop to view it.')
      }
    >
      <Ionicons
        name="document-attach-outline"
        size={22}
        color={palette.textMuted}
      />
      <View style={styles.chipText}>
        <Text style={styles.chipName} numberOfLines={1}>
          {node?.name ?? 'File'}
        </Text>
        <Text style={styles.chipMeta}>{node?.subtype ?? 'file'}</Text>
      </View>
    </Pressable>
  );
};
